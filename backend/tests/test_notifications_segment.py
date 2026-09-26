"""
Backend API tests for segmented push targeting (POST /notifications/push
with `filters`). Deliberately does NOT test an actual matching-segment send
— that fires real pushes to real customer devices and needs a manual,
confirmed test the way the original broadcast feature was verified.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestNotificationsSegmentFilters:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def test_segment_with_no_matches_blocks_before_calling_boomerang(self):
        """An impossible filter must resolve to zero card_ids and 400
        locally, without ever reaching Boomerangme's API."""
        templates = self.session.get(f"{BASE_URL}/api/templates")
        assert templates.status_code == 200
        template_id = templates.json()["templates"][0]["id"]

        response = self.session.post(f"{BASE_URL}/api/notifications/push", json={
            "message": "test - should not send",
            "template_id": template_id,
            "filters": [{"field": "total_visits", "operator": "gte", "value": 999999}]
        })
        assert response.status_code == 400
        assert "filtro" in response.json()["detail"].lower()

    def test_broadcast_without_filters_still_requires_valid_template(self):
        """Unchanged broadcast path (filters omitted) should still validate
        the payload the same way it did before this feature — a 0 template
        id must fail Pydantic validation, not attempt anything."""
        response = self.session.post(f"{BASE_URL}/api/notifications/push", json={
            "message": "test",
            "template_id": 0
        })
        assert response.status_code == 422

    def test_operator_role_cannot_send_segmented_push(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        # demo workspace's operator account, if present; skip if not seeded
        login = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@devotio.com",
            "password": "operator123"
        })
        if login.status_code != 200:
            pytest.skip("No seeded operator account in this environment")
        token = login.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        response = session.post(f"{BASE_URL}/api/notifications/push", json={
            "message": "test",
            "template_id": 1,
            "filters": [{"field": "total_visits", "operator": "gte", "value": 1}]
        })
        assert response.status_code == 403
