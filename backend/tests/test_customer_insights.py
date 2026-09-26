"""
Backend API tests for Customer Insights — template_id filter added for the
Tarjetas page's "ver clientes de esta tarjeta" link.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCustomerInsightsTemplateFilter:
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

    def test_customers_without_filter_returns_full_base(self):
        response = self.session.get(f"{BASE_URL}/api/customer-insights/customers", params={"items_per_page": 1})
        assert response.status_code == 200
        assert response.json()["meta"]["total"] > 0

    def test_customers_filtered_by_template_id_is_narrower_or_equal(self):
        unfiltered = self.session.get(f"{BASE_URL}/api/customer-insights/customers", params={"items_per_page": 1})
        total_unfiltered = unfiltered.json()["meta"]["total"]

        templates = self.session.get(f"{BASE_URL}/api/templates")
        assert templates.status_code == 200
        template_list = templates.json().get("templates", [])
        assert template_list, "Demo workspace has no templates to test against"
        template_id = template_list[0]["id"]

        filtered = self.session.get(
            f"{BASE_URL}/api/customer-insights/customers",
            params={"items_per_page": 1, "template_id": template_id}
        )
        assert filtered.status_code == 200
        assert filtered.json()["meta"]["total"] <= total_unfiltered

    def test_customers_filtered_by_nonexistent_template_returns_empty(self):
        response = self.session.get(
            f"{BASE_URL}/api/customer-insights/customers",
            params={"items_per_page": 1, "template_id": "999999999"}
        )
        assert response.status_code == 200
        assert response.json()["meta"]["total"] == 0
