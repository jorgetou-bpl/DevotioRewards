"""
Backend API tests for GET /customers/search — the unified search field on
the Clientes page (phone/email/cédula/name waterfall).
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCustomerSearch:
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

    def _first_known_customer(self):
        response = self.session.get(f"{BASE_URL}/api/customer-insights/customers", params={"items_per_page": 1})
        assert response.status_code == 200
        customers = response.json()["customers"]
        assert customers, "Demo workspace has no customers to test search against"
        return customers[0]

    def test_search_by_exact_phone_returns_that_customer(self):
        customer = self._first_known_customer()
        response = self.session.get(f"{BASE_URL}/api/customers/search", params={"q": customer["customer_phone"]})
        assert response.status_code == 200
        data = response.json()
        assert data["match_type"] == "phone"
        assert any(c["customer_phone"] == customer["customer_phone"] for c in data["customers"])

    def test_search_by_name_fragment_returns_matches(self):
        customer = self._first_known_customer()
        name_fragment = (customer.get("customer_name") or "").split(" ")[0]
        if not name_fragment:
            pytest.skip("First customer has no name to fragment-search on")
        response = self.session.get(f"{BASE_URL}/api/customers/search", params={"q": name_fragment})
        assert response.status_code == 200
        data = response.json()
        assert data["match_type"] == "name"
        assert len(data["customers"]) >= 1

    def test_search_with_no_match_returns_empty(self):
        response = self.session.get(f"{BASE_URL}/api/customers/search", params={"q": "zzz-no-such-customer-zzz"})
        assert response.status_code == 200
        data = response.json()
        assert data["customers"] == []
        assert data["match_type"] is None

    def test_search_with_blank_query_returns_empty(self):
        response = self.session.get(f"{BASE_URL}/api/customers/search", params={"q": "   "})
        assert response.status_code == 200
        assert response.json()["customers"] == []

    def test_search_route_not_shadowed_by_customer_id_path(self):
        """/customers/search must resolve to the search endpoint, not the
        /{customer_id} catch-all (the exact pitfall customer_insights.py's
        /customers/export already had to route around)."""
        response = self.session.get(f"{BASE_URL}/api/customers/search", params={"q": "test"})
        assert response.status_code == 200
        assert "match_type" in response.json()
