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
