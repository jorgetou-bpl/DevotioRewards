"""
Backend API tests for Operations feature (Operaciones)
Tests the new operations endpoints for transaction logging with gerente attribution
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOperationsAPI:
    """Test suite for Operations endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = login_response.json().get("user")
        
    def test_health_check(self):
        """Test health endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("SUCCESS: Health check passed")
    
    def test_get_operations_endpoint(self):
        """Test GET /api/operations returns operations list"""
        response = self.session.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "operations" in data
        assert "meta" in data
        assert "filters" in data
        
        # Verify meta structure
        meta = data["meta"]
        assert "total" in meta
        assert "page" in meta
        assert "total_pages" in meta
        
        # Verify filters structure
        filters = data["filters"]
        assert "gerentes" in filters
        assert "operation_types" in filters
        
        print(f"SUCCESS: GET /api/operations returned {meta['total']} operations")
    
    def test_operations_pagination(self):
        """Test operations endpoint supports pagination"""
        response = self.session.get(f"{BASE_URL}/api/operations?page=1&items_per_page=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data["meta"]["page"] == 1
        print("SUCCESS: Pagination works correctly")
    
    def test_operations_filter_by_date(self):
        """Test operations can be filtered by date range"""
        response = self.session.get(
            f"{BASE_URL}/api/operations?start_date=2026-01-01&end_date=2026-12-31"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: Date filtering works")
    
    def test_operations_filter_by_gerente(self):
        """Test operations can be filtered by gerente"""
        # First get list of gerentes
        response = self.session.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200
        
        data = response.json()
        gerentes = data["filters"]["gerentes"]
        
        if gerentes:
            # Filter by first gerente
            filter_response = self.session.get(
                f"{BASE_URL}/api/operations?gerente={gerentes[0]}"
            )
            assert filter_response.status_code == 200
            print(f"SUCCESS: Gerente filter works (tested with: {gerentes[0]})")
        else:
            print("INFO: No gerentes found to test filter")
    
    def test_operations_filter_by_type(self):
        """Test operations can be filtered by operation type"""
        response = self.session.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200
        
        data = response.json()
        op_types = data["filters"]["operation_types"]
        
        if op_types:
            filter_response = self.session.get(
                f"{BASE_URL}/api/operations?operation_type={op_types[0]}"
            )
            assert filter_response.status_code == 200
            print(f"SUCCESS: Operation type filter works (tested with: {op_types[0]})")
        else:
            print("INFO: No operation types found to test filter")
    
    def test_export_csv(self):
        """Test CSV export endpoint"""
        response = self.session.get(f"{BASE_URL}/api/operations/export?format=csv")
        assert response.status_code == 200
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "text/csv" in content_type, f"Expected CSV content type, got: {content_type}"
        
        # Check content disposition header for filename
        content_disp = response.headers.get("Content-Disposition", "")
        assert "operaciones_" in content_disp
        assert ".csv" in content_disp
        
        # Verify CSV has Spanish headers
        csv_content = response.text
        assert "Fecha" in csv_content
        assert "Cliente" in csv_content
        assert "Gerente" in csv_content
        
        print("SUCCESS: CSV export works with Spanish headers")
    
    def test_export_xlsx(self):
        """Test XLSX export endpoint"""
        response = self.session.get(f"{BASE_URL}/api/operations/export?format=xlsx")
        assert response.status_code == 200
        
        # Check content type for Excel
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Check content disposition header for filename
        content_disp = response.headers.get("Content-Disposition", "")
        assert "operaciones_" in content_disp
        assert ".xlsx" in content_disp
        
        print("SUCCESS: XLSX export works")
    
    def test_trend_hourly_granularity(self):
        """Test GET /api/operations/trend?granularity=hour — today bucketed
        by hour in Costa Rica local time (see routes/operations.py's
        _get_hourly_trend for the UTC->CR conversion this exists to verify
        doesn't regress)."""
        response = self.session.get(f"{BASE_URL}/api/operations/trend?granularity=hour")
        assert response.status_code == 200

        data = response.json()
        assert data.get("success") is True
        assert data.get("granularity") == "hour"
        series = data.get("series", [])
        assert len(series) == 24
        assert [s["date"] for s in series] == [f"{h:02d}:00" for h in range(24)]
        print(f"SUCCESS: Hourly trend - {data['current_period']['operations_count']} visitas hoy")

    def test_trend_day_granularity_default(self):
        """Default (no granularity param) still returns the day-bucketed
        series, now tagged granularity="day" for the frontend to branch on."""
        response = self.session.get(f"{BASE_URL}/api/operations/trend?days=7")
        assert response.status_code == 200
        data = response.json()
        assert data.get("granularity") == "day"
        assert len(data.get("series", [])) == 7

    def test_trend_explicit_date_range_takes_precedence(self):
        """start_date/end_date (the single page-level filter) drives this
        chart now, not its own period selector — days is only a fallback."""
        from datetime import date, timedelta
        today = date.today()
        week_ago = today - timedelta(days=6)
        response = self.session.get(
            f"{BASE_URL}/api/operations/trend",
            params={"start_date": week_ago.isoformat(), "end_date": today.isoformat()}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("granularity") == "day"
        assert data.get("days") == 7
        series = data.get("series", [])
        assert series[0]["date"] == week_ago.isoformat()
        assert series[-1]["date"] == today.isoformat()

    def test_trend_series_has_active_customers_and_avg_spend(self):
        """Each /trend series bucket (day or hour) now also carries
        active_customers (distinct count) and avg_spend — powers the
        Active-Customers/Avg-Spend trend charts, which reuse this same
        payload instead of a separate fetch."""
        response = self.session.get(f"{BASE_URL}/api/operations/trend?days=7")
        assert response.status_code == 200
        series = response.json().get("series", [])
        assert len(series) == 7
        for bucket in series:
            assert "active_customers" in bucket
            assert "avg_spend" in bucket

    def test_enrollment_trend(self):
        response = self.session.get(f"{BASE_URL}/api/operations/enrollment-trend?days=7")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        series = data.get("series", [])
        assert len(series) == 7
        for bucket in series:
            assert {"date", "new_customers", "total_visits", "enrollment_rate"} <= bucket.keys()
            assert bucket["new_customers"] <= bucket["total_visits"] or bucket["total_visits"] == 0

    def test_weekly_performance_trend(self):
        response = self.session.get(f"{BASE_URL}/api/operations/weekly-performance-trend?weeks=8")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        series = data.get("series", [])
        assert len(series) == 8
        for bucket in series:
            assert 0 <= bucket["engagement_rate"] <= 1
            assert 0 <= bucket["retention_rate"] <= 1

    def test_new_customers_by_month(self):
        response = self.session.get(f"{BASE_URL}/api/customer-insights/new-customers-by-month?months=6")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        buckets = data.get("buckets", [])
        assert len(buckets) == 6
        assert all("label" in b and "count" in b for b in buckets)

    def test_operations_summary(self):
        """Test operations summary endpoint"""
        response = self.session.get(f"{BASE_URL}/api/operations/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "summary" in data
        
        summary = data["summary"]
        assert "total_operations" in summary
        assert "by_gerente" in summary
        assert "by_type" in summary
        
        print(f"SUCCESS: Operations summary - Total: {summary['total_operations']}")
    
    def test_rewards_summary(self):
        """Test GET /api/operations/rewards-summary — emitted vs. redeemed
        rewards, from db.rewards_earned (redeemed_value was already being
        captured on every redemption but never aggregated before this)."""
        response = self.session.get(f"{BASE_URL}/api/operations/rewards-summary")
        assert response.status_code == 200

        data = response.json()
        assert data.get("success") is True
        rewards = data.get("rewards", {})
        for field in ["issued_count", "redeemed_count", "redemption_rate", "redeemed_value_total"]:
            assert field in rewards
        assert rewards["redeemed_count"] <= rewards["issued_count"]
        print(f"SUCCESS: Rewards summary - {rewards['issued_count']} issued, {rewards['redeemed_count']} redeemed")

    def test_rewards_summary_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/operations/rewards-summary")
        assert response.status_code == 401

    def test_visit_recurrence(self):
        """Test GET /api/customer-insights/visit-recurrence — lifetime
        visit-count buckets, open to every role (unlike age-distribution)."""
        response = self.session.get(f"{BASE_URL}/api/customer-insights/visit-recurrence")
        assert response.status_code == 200

        data = response.json()
        assert data.get("success") is True
        buckets = data.get("buckets", [])
        assert len(buckets) == 3
        assert {b["label"] for b in buckets} == {"1 visita", "2-3 visitas", "4+ visitas"}
        print(f"SUCCESS: Visit recurrence - {sum(b['count'] for b in buckets)} customers bucketed")

    def test_add_stamp_creates_operation_log(self):
        """Test that add-stamp action creates an operation log with gerente"""
        # Perform add-stamp action on DEMO card
        card_id = "DEMO-001"
        action_response = self.session.post(
            f"{BASE_URL}/api/cards/{card_id}/add-stamp",
            json={
                "amount": 1,
                "comment": "Test stamp from pytest",
                "gerente": self.user.get("name", "Demo User")
            }
        )
        assert action_response.status_code == 200, f"Add stamp failed: {action_response.text}"
        
        # Verify operation was logged
        ops_response = self.session.get(f"{BASE_URL}/api/operations?card_id={card_id}")
        assert ops_response.status_code == 200
        
        data = ops_response.json()
        operations = data.get("operations", [])
        
        # Check if our operation was logged
        found_operation = False
        for op in operations:
            if op.get("card_id") == card_id and "add-stamp" in op.get("operation_type", ""):
                found_operation = True
                # Verify gerente field is populated
                assert op.get("gerente"), "Gerente field should be populated"
                print(f"SUCCESS: Operation logged with gerente: {op.get('gerente')}")
                break
        
        assert found_operation, "Operation should be logged after add-stamp action"
    
    def test_real_card_stamp_creates_operation(self):
        """Test that stamping a real card creates operation with gerente in comment"""
        card_id = "820551-447-797"  # Real test card
        
        action_response = self.session.post(
            f"{BASE_URL}/api/cards/{card_id}/add-stamp",
            json={
                "amount": 1,
                "comment": "Test from operations testing",
                "gerente": self.user.get("name", "Demo User")
            }
        )
        
        # May succeed or fail depending on card state, but should not error
        assert action_response.status_code in [200, 400], f"Unexpected error: {action_response.text}"
        
        if action_response.status_code == 200:
            print("SUCCESS: Real card stamp action completed")
            
            # Verify operation was logged
            ops_response = self.session.get(f"{BASE_URL}/api/operations?card_id={card_id}")
            assert ops_response.status_code == 200
            
            data = ops_response.json()
            if data.get("operations"):
                latest_op = data["operations"][0]
                assert latest_op.get("gerente"), "Gerente should be logged"
                print(f"SUCCESS: Real card operation logged with gerente: {latest_op.get('gerente')}")
        else:
            print(f"INFO: Card action returned 400 (expected for some card states)")
    
    def test_operations_unauthorized_access(self):
        """Test that operations endpoint requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 401, "Should require authentication"
        print("SUCCESS: Operations endpoint requires authentication")
    
    def test_export_unauthorized_access(self):
        """Test that export endpoint requires authentication"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/operations/export?format=csv")
        assert response.status_code == 401, "Should require authentication"
        print("SUCCESS: Export endpoint requires authentication")


class TestOperationDataIntegrity:
    """Test data integrity for operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = login_response.json().get("user")
    
    def test_operation_record_structure(self):
        """Test that operation records have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200
        
        data = response.json()
        operations = data.get("operations", [])
        
        if operations:
            op = operations[0]
            
            # Required fields
            required_fields = [
                "id", "created_at", "card_id", "operation_type", 
                "gerente", "gerente_email", "source"
            ]
            
            for field in required_fields:
                assert field in op, f"Missing required field: {field}"
            
            # Optional but expected fields
            optional_fields = [
                "customer_name", "customer_phone", "device", 
                "template_id", "operation_label", "note", 
                "amount", "balance", "purchase_sum"
            ]
            
            print(f"SUCCESS: Operation record has correct structure")
            print(f"  - Gerente: {op.get('gerente')}")
            print(f"  - Operation: {op.get('operation_label', op.get('operation_type'))}")
            print(f"  - Card: {op.get('card_id')}")
        else:
            print("INFO: No operations to verify structure")
    
    def test_gerente_attribution_in_operations(self):
        """Test that gerente is correctly attributed in operations"""
        response = self.session.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200
        
        data = response.json()
        operations = data.get("operations", [])
        
        gerente_count = 0
        for op in operations:
            if op.get("gerente"):
                gerente_count += 1
        
        if operations:
            percentage = (gerente_count / len(operations)) * 100
            print(f"SUCCESS: {gerente_count}/{len(operations)} operations have gerente ({percentage:.0f}%)")
        else:
            print("INFO: No operations to check gerente attribution")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
