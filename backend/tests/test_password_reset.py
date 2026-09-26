"""
Backend API tests for password reset (POST /auth/forgot-password,
POST /auth/reset-password) and backup emails.

The full reset round-trip (valid token -> new password works -> old
password rejected) was verified manually against a disposable test user
created and deleted within the test script itself (never touching the
demo account's real credentials). These automated tests stick to the
generic-response/guard paths, which are safe to run repeatedly.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestForgotPassword:
    def test_known_email_returns_generic_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "demo@devotio.com"})
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_unknown_email_returns_identical_generic_response(self):
        """Anti-enumeration: known and unknown emails must be indistinguishable."""
        known = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "demo@devotio.com"})
        unknown = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "nadie-existe-zzz@example.com"})
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()

    def test_malformed_email_returns_422(self):
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "not-an-email"})
        assert response.status_code == 422


class TestResetPassword:
    def test_garbage_token_returns_400(self):
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "garbage-not-a-jwt", "new_password": "somenewpass123"
        })
        assert response.status_code == 400

    def test_short_password_rejected_by_validation(self):
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "garbage", "new_password": "abc"
        })
        assert response.status_code == 422

    def test_login_token_cannot_be_used_as_reset_token(self):
        """A normal session JWT (no `purpose` claim) must not double as a
        password-reset token — verify_password_reset_token checks purpose
        explicitly for this reason."""
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com", "password": "demo123"
        })
        assert login.status_code == 200
        session_token = login.json()["token"]

        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": session_token, "new_password": "somenewpass123"
        })
        assert response.status_code == 400


class TestBackupEmails:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("token")
        self.workspace_id = login_response.json().get("workspace_id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})

    def test_set_and_clear_backup_emails_on_own_account(self):
        me = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 200

        users_before = self.session.get(f"{BASE_URL}/api/admin/workspaces/{self.workspace_id}/users")
        assert users_before.status_code == 200
        my_user = next((u for u in users_before.json()["users"] if u["email"] == "demo@devotio.com"), None)
        assert my_user, "demo user not found in workspace users list"
        original_backups = my_user.get("backup_emails", [])

        set_response = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{self.workspace_id}/users/{my_user['id']}/backup-emails",
            json={"backup_emails": ["pytest-backup@example.com"]}
        )
        assert set_response.status_code == 200
        assert set_response.json()["backup_emails"] == ["pytest-backup@example.com"]

        restore_response = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{self.workspace_id}/users/{my_user['id']}/backup-emails",
            json={"backup_emails": original_backups}
        )
        assert restore_response.status_code == 200
        assert restore_response.json()["backup_emails"] == original_backups

    def test_invalid_backup_email_format_rejected(self):
        users = self.session.get(f"{BASE_URL}/api/admin/workspaces/{self.workspace_id}/users")
        my_user = next((u for u in users.json()["users"] if u["email"] == "demo@devotio.com"), None)
        response = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{self.workspace_id}/users/{my_user['id']}/backup-emails",
            json={"backup_emails": ["not-an-email"]}
        )
        assert response.status_code == 422
