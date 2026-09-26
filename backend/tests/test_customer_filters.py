"""
Backend API tests for the simple segment filters on GET /customer-insights/
customers (and /export) — shared field/operator/value shape that will also
drive push notification audience targeting.
"""
import pytest
import requests
import json
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCustomerFilters:
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

    def _get(self, filters=None):
        params = {"items_per_page": 50}
        if filters is not None:
            params["filters"] = json.dumps(filters)
        return self.session.get(f"{BASE_URL}/api/customer-insights/customers", params=params)

    def test_no_filters_returns_full_base(self):
        response = self._get()
        assert response.status_code == 200
        assert response.json()["meta"]["total"] > 0

    def test_gte_filter_on_total_visits(self):
        unfiltered = self._get().json()["meta"]["total"]
        response = self._get([{"field": "total_visits", "operator": "gte", "value": 10}])
        assert response.status_code == 200
        data = response.json()
        assert data["meta"]["total"] <= unfiltered
        assert all(c["total_visits"] >= 10 for c in data["customers"])

    def test_avg_spend_expr_filter(self):
        response = self._get([{"field": "avg_spend", "operator": "gte", "value": 5000}])
        assert response.status_code == 200
        data = response.json()
        for c in data["customers"]:
            avg = c["total_purchase_sum"] / c["total_visits"] if c["total_visits"] else 0
            assert avg >= 5000

    def test_impossible_filter_returns_empty(self):
        response = self._get([{"field": "total_visits", "operator": "gte", "value": 999999}])
        assert response.status_code == 200
        assert response.json()["meta"]["total"] == 0

    def test_unknown_field_is_ignored_not_500(self):
        response = self._get([{"field": "not_a_real_field", "operator": "gte", "value": 1}])
        assert response.status_code == 200

    def test_malformed_filters_json_is_ignored_not_500(self):
        response = self.session.get(
            f"{BASE_URL}/api/customer-insights/customers",
            params={"items_per_page": 1, "filters": "{not valid json"}
        )
        assert response.status_code == 200

    def test_export_respects_filters(self):
        filters = json.dumps([{"field": "total_visits", "operator": "gte", "value": 10}])
        response = self.session.get(
            f"{BASE_URL}/api/customer-insights/customers/export",
            params={"format": "csv", "filters": filters}
        )
        assert response.status_code == 200
        rows = response.text.strip().split("\n")
        # header + N filtered rows should be <= header + unfiltered rows
        unfiltered_total = self._get().json()["meta"]["total"]
        assert len(rows) - 1 <= unfiltered_total
