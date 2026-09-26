"""
Backend API tests for GET /customers/by-phone/{phone}/cards — resolves ALL
of a customer's cards (customer_stats only tracks the most recent one).
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCustomerCardsByPhone:
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

    def test_cards_by_known_phone_returns_list(self):
        customers = self.session.get(f"{BASE_URL}/api/customer-insights/customers", params={"items_per_page": 1})
        assert customers.status_code == 200
        known_phone = customers.json()["customers"][0]["customer_phone"]

        response = self.session.get(f"{BASE_URL}/api/customers/by-phone/{known_phone}/cards")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["cards"], list)
        assert len(data["cards"]) >= 1
        assert all("id" in c for c in data["cards"])

    def test_cards_by_unknown_phone_returns_empty(self):
        response = self.session.get(f"{BASE_URL}/api/customers/by-phone/50600000000/cards")
        assert response.status_code == 200
        assert response.json()["cards"] == []
