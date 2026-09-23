"""
Backend API tests for GeoPush location management.
Covers auth/role gating and request validation only — creating/deleting a
real location has a real, visible effect on Boomerangme (and on any device
already in range), so that's left to manual verification; see the project
plan for the confirmed real-device test of the display:false toggle.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Same reasoning as test_notifications.py: Cafe Demo's Boomerangme key
# returns empty/invalid results, a pre-existing data issue unrelated to
# this feature. super_admin still satisfies require_workspace_admin.
ADMIN_EMAIL = "demo@devotio.com"
ADMIN_PASSWORD = "demo123"


class TestGeoPushLocations:
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

    def test_list_requires_auth(self):
        resp = self.session.get(f"{BASE_URL}/api/geo-locations")
        assert resp.status_code == 401

    def test_workspace_admin_can_list_locations(self):
        token = self.get_workspace_admin_token()
        resp = self.session.get(
            f"{BASE_URL}/api/geo-locations",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("success") is True
        assert "locations" in data
        assert "meta" in data

    def test_create_missing_required_fields_rejected(self):
        token = self.get_workspace_admin_token()
        resp = self.session.post(
            f"{BASE_URL}/api/geo-locations",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Sucursal Test"}
        )
        assert resp.status_code == 422

    def test_invalid_open_time_format_rejected(self):
        token = self.get_workspace_admin_token()
        resp = self.session.post(
            f"{BASE_URL}/api/geo-locations",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Sucursal Test", "address": "Test", "message": "Test",
                "latitude": "9.9", "longitude": "-84.1",
                "schedule_enabled": True, "open_time": "8am", "close_time": "17:00"
            }
        )
        assert resp.status_code == 422

    def test_invalid_close_time_format_rejected(self):
        token = self.get_workspace_admin_token()
        resp = self.session.post(
            f"{BASE_URL}/api/geo-locations",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Sucursal Test", "address": "Test", "message": "Test",
                "latitude": "9.9", "longitude": "-84.1",
                "schedule_enabled": True, "open_time": "08:00", "close_time": "5pm"
            }
        )
        assert resp.status_code == 422
