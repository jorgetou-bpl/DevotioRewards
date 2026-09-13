"""
Backend API tests for the push notifications module.
Covers auth/role gating and request validation only — sending a real push is
not idempotent (reaches real Apple/Google Wallet devices), so it's
deliberately left out of automated tests; see the project plan for the
manual real-device verification step.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Devotio Default (super_admin) — not Cafe Demo — deliberately: Cafe Demo's
# Boomerangme API key returns empty/invalid results (confirmed via
# `GET /templates` also coming back empty for that workspace), a pre-existing
# data issue unrelated to this feature. `super_admin` still satisfies
# `require_workspace_admin`, so it exercises the same role gate.
ADMIN_EMAIL = "demo@devotio.com"
ADMIN_PASSWORD = "demo123"


class TestPushNotifications:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def get_workspace_admin_token(self):
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        return resp.json().get("token")

    def get_workspace_id(self, token):
        resp = self.session.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        return resp.json().get("workspace_id")

    def test_history_requires_auth(self):
        resp = self.session.get(f"{BASE_URL}/api/notifications/pushes")
        assert resp.status_code == 401

    def test_workspace_admin_can_list_history(self):
        token = self.get_workspace_admin_token()
        resp = self.session.get(
            f"{BASE_URL}/api/notifications/pushes",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("success") is True
        assert "pushes" in data
        assert "meta" in data
        print(f"SUCCESS: history returned {data['meta'].get('total')} total pushes")

    def test_send_missing_message_rejected(self):
        token = self.get_workspace_admin_token()
        resp = self.session.post(
            f"{BASE_URL}/api/notifications/push",
            headers={"Authorization": f"Bearer {token}"},
            json={"template_id": 1}
        )
        assert resp.status_code == 422

    def test_send_missing_template_rejected(self):
        token = self.get_workspace_admin_token()
        resp = self.session.post(
            f"{BASE_URL}/api/notifications/push",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Prueba"}
        )
        assert resp.status_code == 422

    def test_send_invalid_template_id_rejected(self):
        token = self.get_workspace_admin_token()
        resp = self.session.post(
            f"{BASE_URL}/api/notifications/push",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Prueba", "template_id": 0}
        )
        assert resp.status_code == 422

    def test_operator_cannot_access_notifications(self):
        """Create a throwaway operator, confirm 403 on both endpoints, clean up."""
        admin_token = self.get_workspace_admin_token()
        workspace_id = self.get_workspace_id(admin_token)

        test_email = f"test-operator-{uuid.uuid4().hex[:8]}@devotio.com"
        test_password = "TestOperator123!"
        create_resp = self.session.post(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"email": test_email, "password": test_password, "name": "Test Operator", "role": "operator"}
        )
        assert create_resp.status_code == 200, f"Could not create test operator: {create_resp.text}"
        operator_id = create_resp.json().get("user", {}).get("id")

        try:
            login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email, "password": test_password
            })
            assert login_resp.status_code == 200, f"Operator login failed: {login_resp.text}"
            operator_token = login_resp.json().get("token")

            history_resp = self.session.get(
                f"{BASE_URL}/api/notifications/pushes",
                headers={"Authorization": f"Bearer {operator_token}"}
            )
            assert history_resp.status_code == 403

            send_resp = self.session.post(
                f"{BASE_URL}/api/notifications/push",
                headers={"Authorization": f"Bearer {operator_token}"},
                json={"message": "Prueba", "template_id": 1}
            )
            assert send_resp.status_code == 403
            print("SUCCESS: operator correctly blocked from both notification endpoints")
        finally:
            if operator_id:
                self.session.delete(
                    f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/{operator_id}",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
