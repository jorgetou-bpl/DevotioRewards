"""
Backend API test for GET /templates/{id} exposing the template-level
installLink/qrLink — the generic self-enrollment QR shown on the Tarjetas
detail page (distinct from a specific customer's per-card QR).
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestTemplateInstallLink:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def test_template_detail_includes_install_link_and_qr(self):
        templates = self.session.get(f"{BASE_URL}/api/templates")
        assert templates.status_code == 200
        template_list = templates.json().get("templates", [])
        assert template_list, "Demo workspace has no templates to test against"
        template_id = template_list[0]["id"]

        detail = self.session.get(f"{BASE_URL}/api/templates/{template_id}")
        assert detail.status_code == 200
        template = detail.json()["template"]
        assert "installLink" in template
        assert "qrLink" in template
        if template["qrLink"]:
            assert template["qrLink"].startswith("https://")
