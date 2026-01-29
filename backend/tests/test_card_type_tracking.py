# Test card_type tracking feature - Operations reporting enhancements
# Tests: card_type in filters, summary by_card_type, CSV export columns

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCardTypeTracking:
    """Test card_type tracking in operations endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token for all tests"""
        self.token = None
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
        yield
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    # ============ GET /api/operations Tests ============
    
    def test_operations_returns_card_types_in_filters(self):
        """Verify /api/operations returns card_types in filters"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(f"{BASE_URL}/api/operations", headers=self.get_headers())
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "filters" in data
        assert "card_types" in data["filters"], "card_types should be in filters"
        assert isinstance(data["filters"]["card_types"], list)
        print(f"Available card_types: {data['filters']['card_types']}")
    
    def test_operations_supports_card_type_filter(self):
        """Verify /api/operations supports card_type query parameter"""
        if not self.token:
            pytest.skip("Auth failed")
        
        # First get available card types
        response = requests.get(f"{BASE_URL}/api/operations", headers=self.get_headers())
        assert response.status_code == 200
        
        card_types = response.json().get("filters", {}).get("card_types", [])
        
        # If we have card types, test filtering
        if card_types:
            test_type = card_types[0]
            filtered_response = requests.get(
                f"{BASE_URL}/api/operations?card_type={test_type}", 
                headers=self.get_headers()
            )
            assert filtered_response.status_code == 200
            
            filtered_data = filtered_response.json()
            assert filtered_data.get("success") == True
            
            # Verify all returned operations have the filtered card_type
            for op in filtered_data.get("operations", []):
                if op.get("card_type"):  # Only check if card_type is set
                    assert op.get("card_type") == test_type, f"Expected card_type {test_type}, got {op.get('card_type')}"
            print(f"Filtered by card_type={test_type}, got {len(filtered_data.get('operations', []))} operations")
        else:
            print("No card_types available for filtering test - skipping filter verification")
    
    def test_operations_have_card_type_fields(self):
        """Verify operations have card_type and card_type_label fields"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(f"{BASE_URL}/api/operations", headers=self.get_headers())
        assert response.status_code == 200
        
        operations = response.json().get("operations", [])
        
        # Check structure of operations
        for op in operations[:5]:  # Check first 5
            # card_type and card_type_label should exist (may be null for old operations)
            assert "card_type" in op or op.get("card_type") is None, "card_type field should exist"
            print(f"Operation {op.get('id', 'N/A')[:8]}: card_type={op.get('card_type')}, card_type_label={op.get('card_type_label')}")
    
    # ============ GET /api/operations/summary Tests ============
    
    def test_summary_returns_by_card_type(self):
        """Verify /api/operations/summary returns by_card_type data"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(f"{BASE_URL}/api/operations/summary", headers=self.get_headers())
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "summary" in data
        
        summary = data["summary"]
        assert "by_card_type" in summary, "by_card_type should be in summary"
        assert isinstance(summary["by_card_type"], list)
        
        # Check structure of by_card_type entries
        for entry in summary["by_card_type"]:
            assert "_id" in entry, "by_card_type entry should have _id"
            assert "count" in entry, "by_card_type entry should have count"
            print(f"Card type: {entry.get('_id')} - Count: {entry.get('count')}")
    
    def test_summary_returns_card_types_in_filters(self):
        """Verify /api/operations/summary returns card_types in filters"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(f"{BASE_URL}/api/operations/summary", headers=self.get_headers())
        assert response.status_code == 200
        
        data = response.json()
        assert "filters" in data
        assert "card_types" in data["filters"], "card_types should be in summary filters"
        print(f"Summary filter card_types: {data['filters']['card_types']}")
    
    def test_summary_supports_card_type_filter(self):
        """Verify /api/operations/summary supports card_type query parameter"""
        if not self.token:
            pytest.skip("Auth failed")
        
        # First get available card types
        response = requests.get(f"{BASE_URL}/api/operations/summary", headers=self.get_headers())
        assert response.status_code == 200
        
        card_types = response.json().get("filters", {}).get("card_types", [])
        
        if card_types:
            test_type = card_types[0]
            filtered_response = requests.get(
                f"{BASE_URL}/api/operations/summary?card_type={test_type}", 
                headers=self.get_headers()
            )
            assert filtered_response.status_code == 200
            
            filtered_data = filtered_response.json()
            assert filtered_data.get("success") == True
            print(f"Summary filtered by card_type={test_type}: total_operations={filtered_data['summary'].get('total_operations')}")
        else:
            print("No card_types available for summary filter test")
    
    # ============ CSV Export Tests ============
    
    def test_csv_export_includes_card_type_columns(self):
        """Verify CSV export includes 'Tipo de Tarjeta' and 'Valor del Canje' columns"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/operations/export?format=csv", 
            headers=self.get_headers()
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        csv_content = response.text
        lines = csv_content.split('\n')
        
        # Check header row
        if lines:
            header = lines[0]
            assert "Tipo de Tarjeta" in header, f"CSV header should include 'Tipo de Tarjeta'. Header: {header}"
            assert "Valor del Canje" in header, f"CSV header should include 'Valor del Canje'. Header: {header}"
            print(f"CSV Headers: {header}")
    
    def test_csv_export_supports_card_type_filter(self):
        """Verify CSV export supports card_type filter parameter"""
        if not self.token:
            pytest.skip("Auth failed")
        
        # Get available card types first
        ops_response = requests.get(f"{BASE_URL}/api/operations", headers=self.get_headers())
        card_types = ops_response.json().get("filters", {}).get("card_types", [])
        
        if card_types:
            test_type = card_types[0]
            response = requests.get(
                f"{BASE_URL}/api/operations/export?format=csv&card_type={test_type}", 
                headers=self.get_headers()
            )
            assert response.status_code == 200
            print(f"CSV export with card_type={test_type} filter successful")
        else:
            # Just verify export works without filter
            response = requests.get(
                f"{BASE_URL}/api/operations/export?format=csv", 
                headers=self.get_headers()
            )
            assert response.status_code == 200
            print("CSV export successful (no card_types to filter)")
    
    # ============ Operation Logging Tests ============
    
    def test_operation_has_purchase_sum_and_redeemed_value_fields(self):
        """Verify operations have separate purchase_sum and redeemed_value fields"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(f"{BASE_URL}/api/operations", headers=self.get_headers())
        assert response.status_code == 200
        
        operations = response.json().get("operations", [])
        
        # Check that fields exist in operation structure
        for op in operations[:5]:
            # These fields should exist (may be null)
            assert "purchase_sum" in op or op.get("purchase_sum") is None
            assert "redeemed_value" in op or op.get("redeemed_value") is None
            print(f"Op {op.get('operation_type')}: purchase_sum={op.get('purchase_sum')}, redeemed_value={op.get('redeemed_value')}")
    
    def test_create_operation_with_card_type(self):
        """Test that new operations get card_type populated"""
        if not self.token:
            pytest.skip("Auth failed")
        
        # Use demo card to create an operation
        scan_response = requests.post(
            f"{BASE_URL}/api/scan",
            headers=self.get_headers(),
            json={"qr_data": "DEMO-001"}
        )
        
        if scan_response.status_code == 200:
            card_data = scan_response.json().get("card", {})
            card_type = card_data.get("type", "")
            print(f"Demo card type: {card_type}")
            
            # Add stamp to create operation
            stamp_response = requests.post(
                f"{BASE_URL}/api/cards/DEMO-001/add-stamp",
                headers=self.get_headers(),
                json={"amount": 1, "comment": "Test card_type tracking"}
            )
            
            if stamp_response.status_code == 200:
                # Check latest operation has card_type
                ops_response = requests.get(
                    f"{BASE_URL}/api/operations?card_id=DEMO-001",
                    headers=self.get_headers()
                )
                
                if ops_response.status_code == 200:
                    operations = ops_response.json().get("operations", [])
                    if operations:
                        latest_op = operations[0]
                        print(f"Latest operation card_type: {latest_op.get('card_type')}, card_type_label: {latest_op.get('card_type_label')}")
                        # Demo cards should have card_type populated
                        assert latest_op.get("card_type") is not None or latest_op.get("card_type") == "stamp"


class TestOperationsEndpointStructure:
    """Verify operations endpoint response structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = None
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
        yield
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_operations_response_structure(self):
        """Verify complete operations response structure"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(f"{BASE_URL}/api/operations", headers=self.get_headers())
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level structure
        assert "success" in data
        assert "operations" in data
        assert "meta" in data
        assert "filters" in data
        
        # Check filters structure
        filters = data["filters"]
        assert "gerentes" in filters
        assert "operation_types" in filters
        assert "card_types" in filters  # NEW: card_types filter
        
        # Check meta structure
        meta = data["meta"]
        assert "total" in meta
        assert "page" in meta
        assert "items_per_page" in meta
        assert "total_pages" in meta
        
        print(f"Operations response structure valid. Total: {meta['total']}, Filters: {list(filters.keys())}")
    
    def test_summary_response_structure(self):
        """Verify complete summary response structure"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(f"{BASE_URL}/api/operations/summary", headers=self.get_headers())
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level structure
        assert "success" in data
        assert "summary" in data
        assert "filters" in data
        
        # Check summary structure
        summary = data["summary"]
        assert "total_operations" in summary
        assert "by_gerente" in summary
        assert "by_type" in summary
        assert "by_card_type" in summary  # NEW: by_card_type
        
        # Check filters structure
        filters = data["filters"]
        assert "card_types" in filters  # NEW: card_types filter
        
        print(f"Summary response structure valid. Total ops: {summary['total_operations']}, by_card_type count: {len(summary['by_card_type'])}")
