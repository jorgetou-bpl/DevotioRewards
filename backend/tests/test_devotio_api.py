"""
Comprehensive Backend API tests for Devotio Rewards Scanner
Tests all features: Auth, Cards, Operations, Settings, Templates, Customers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@devotio.com"
TEST_PASSWORD = "demo123"
TEST_CARD_ID = "820551-447-797"
DEMO_CARD_ID = "DEMO-001"


class TestHealthAndRoot:
    """Test basic health and root endpoints"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert "timestamp" in data
        print("SUCCESS: Health check passed")
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        print(f"SUCCESS: Root endpoint - {data.get('message')} v{data.get('version')}")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test successful login with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert data.get("email") == TEST_EMAIL
        assert "name" in data
        print(f"SUCCESS: Login successful - User: {data.get('name')}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("SUCCESS: Invalid credentials correctly rejected")
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL
        })
        assert response.status_code == 422  # Validation error
        print("SUCCESS: Missing fields correctly rejected")
    
    def test_get_me_authenticated(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_response.json().get("token")
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("email") == TEST_EMAIL
        print(f"SUCCESS: /auth/me returned user: {data.get('name')}")
    
    def test_get_me_unauthenticated(self):
        """Test /auth/me endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("SUCCESS: /auth/me requires authentication")


class TestCardScanning:
    """Test card scanning and retrieval"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_scan_card_by_id(self):
        """Test scanning card by ID format (XXX-XXX-XXX)"""
        response = self.session.post(f"{BASE_URL}/api/scan", json={
            "qr_data": TEST_CARD_ID
        })
        assert response.status_code == 200, f"Scan failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "card" in data
        
        card = data["card"]
        assert "id" in card or "balance" in card
        print(f"SUCCESS: Card scanned - ID: {card.get('id', TEST_CARD_ID)}")
    
    def test_scan_demo_card(self):
        """Test scanning DEMO card (mock data)"""
        response = self.session.post(f"{BASE_URL}/api/scan", json={
            "qr_data": DEMO_CARD_ID
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "card" in data
        print("SUCCESS: DEMO card scanned (mock data)")
    
    def test_get_card_by_id(self):
        """Test GET /cards/{card_id} endpoint"""
        response = self.session.get(f"{BASE_URL}/api/cards/{TEST_CARD_ID}")
        assert response.status_code == 200, f"Get card failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "card" in data
        print(f"SUCCESS: Card retrieved via GET endpoint")
    
    def test_scan_empty_qr_data(self):
        """Test scanning with empty QR data"""
        response = self.session.post(f"{BASE_URL}/api/scan", json={
            "qr_data": ""
        })
        assert response.status_code == 400
        print("SUCCESS: Empty QR data correctly rejected")
    
    def test_scan_unauthenticated(self):
        """Test scanning without authentication"""
        response = requests.post(f"{BASE_URL}/api/scan", json={
            "qr_data": TEST_CARD_ID
        })
        assert response.status_code == 401
        print("SUCCESS: Scan requires authentication")


class TestCardActions:
    """Test card action endpoints (add stamp, subtract reward, etc.)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.user_name = login_response.json().get("name", "Demo User")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_add_stamp_with_gerente(self):
        """Test add-stamp action with gerente attribution"""
        response = self.session.post(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}/add-stamp",
            json={
                "amount": 1,
                "comment": "Test stamp from pytest",
                "gerente": "Test Gerente"
            }
        )
        # May succeed or fail based on card type, but should not error
        assert response.status_code in [200, 400], f"Unexpected error: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "card" in data
            assert "message" in data
            print(f"SUCCESS: Add stamp completed - {data.get('message')}")
        else:
            print("INFO: Add stamp returned 400 (card may not support stamps)")
    
    def test_add_stamp_demo_card(self):
        """Test add-stamp on DEMO card (mock)"""
        response = self.session.post(
            f"{BASE_URL}/api/cards/{DEMO_CARD_ID}/add-stamp",
            json={
                "amount": 1,
                "comment": "Demo stamp test",
                "gerente": self.user_name
            }
        )
        assert response.status_code == 200, f"Demo stamp failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: DEMO card stamp added (mock)")
    
    def test_add_point_endpoint(self):
        """Test add-point endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}/add-point",
            json={
                "amount": 10,
                "comment": "Test points",
                "gerente": self.user_name
            }
        )
        assert response.status_code in [200, 400]
        print(f"INFO: Add point returned {response.status_code}")
    
    def test_subtract_reward_endpoint(self):
        """Test subtract-reward endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}/subtract-reward",
            json={
                "amount": 1,
                "comment": "Test redeem",
                "gerente": self.user_name
            }
        )
        assert response.status_code in [200, 400]
        print(f"INFO: Subtract reward returned {response.status_code}")
    
    def test_card_action_unauthenticated(self):
        """Test card action without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}/add-stamp",
            json={"amount": 1}
        )
        assert response.status_code == 401
        print("SUCCESS: Card actions require authentication")


class TestOperations:
    """Test operations (transaction history) endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_operations_list(self):
        """Test GET /operations returns list with pagination"""
        response = self.session.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "operations" in data
        assert "meta" in data
        assert "filters" in data
        
        meta = data["meta"]
        assert "total" in meta
        assert "page" in meta
        assert "total_pages" in meta
        
        print(f"SUCCESS: Operations list - {meta['total']} total operations")
    
    def test_operations_pagination(self):
        """Test operations pagination"""
        response = self.session.get(f"{BASE_URL}/api/operations?page=1&items_per_page=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data["meta"]["page"] == 1
        print("SUCCESS: Operations pagination works")
    
    def test_operations_date_filter(self):
        """Test operations date range filter"""
        response = self.session.get(
            f"{BASE_URL}/api/operations?start_date=2026-01-01&end_date=2026-12-31"
        )
        assert response.status_code == 200
        print("SUCCESS: Operations date filter works")
    
    def test_operations_gerente_filter(self):
        """Test operations gerente filter"""
        # Get available gerentes
        ops_response = self.session.get(f"{BASE_URL}/api/operations")
        gerentes = ops_response.json()["filters"]["gerentes"]
        
        if gerentes:
            response = self.session.get(f"{BASE_URL}/api/operations?gerente={gerentes[0]}")
            assert response.status_code == 200
            print(f"SUCCESS: Gerente filter works - tested with: {gerentes[0]}")
        else:
            print("INFO: No gerentes to test filter")
    
    def test_operations_type_filter(self):
        """Test operations type filter"""
        ops_response = self.session.get(f"{BASE_URL}/api/operations")
        op_types = ops_response.json()["filters"]["operation_types"]
        
        if op_types:
            response = self.session.get(f"{BASE_URL}/api/operations?operation_type={op_types[0]}")
            assert response.status_code == 200
            print(f"SUCCESS: Operation type filter works - tested with: {op_types[0]}")
        else:
            print("INFO: No operation types to test filter")
    
    def test_export_csv(self):
        """Test CSV export"""
        response = self.session.get(f"{BASE_URL}/api/operations/export?format=csv")
        assert response.status_code == 200
        
        content_type = response.headers.get("Content-Type", "")
        assert "text/csv" in content_type
        
        # Verify Spanish headers
        csv_content = response.text
        assert "Fecha" in csv_content
        assert "Gerente" in csv_content
        print("SUCCESS: CSV export with Spanish headers")
    
    def test_export_xlsx(self):
        """Test XLSX export"""
        response = self.session.get(f"{BASE_URL}/api/operations/export?format=xlsx")
        assert response.status_code == 200
        
        content_disp = response.headers.get("Content-Disposition", "")
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
    
    def test_operations_unauthenticated(self):
        """Test operations require authentication"""
        response = requests.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 401
        print("SUCCESS: Operations require authentication")


class TestSettings:
    """Test settings endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_settings(self):
        """Test GET /settings endpoint"""
        response = self.session.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        # Check default settings structure
        assert "vibration_enabled" in data
        assert "sound_enabled" in data
        assert "currency" in data
        assert "language" in data
        print(f"SUCCESS: Settings retrieved - Currency: {data.get('currency')}, Language: {data.get('language')}")
    
    def test_update_settings(self):
        """Test PUT /settings endpoint"""
        response = self.session.put(f"{BASE_URL}/api/settings", json={
            "vibration_enabled": True,
            "sound_enabled": True,
            "currency": "CRC"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("currency") == "CRC"
        print("SUCCESS: Settings updated")
    
    def test_settings_unauthenticated(self):
        """Test settings require authentication"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 401
        print("SUCCESS: Settings require authentication")


class TestCustomers:
    """Test customer search endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_search_customers_endpoint(self):
        """Test GET /customers endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "customers" in data
        print("SUCCESS: Customers search endpoint works")
    
    def test_search_customers_by_phone(self):
        """Test customer search by phone"""
        response = self.session.get(f"{BASE_URL}/api/customers?phone=12345678")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: Customer phone search works")
    
    def test_search_customers_by_email(self):
        """Test customer search by email"""
        response = self.session.get(f"{BASE_URL}/api/customers?email=test@example.com")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: Customer email search works")
    
    def test_customers_unauthenticated(self):
        """Test customers require authentication"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 401
        print("SUCCESS: Customers require authentication")


class TestTemplates:
    """Test template endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_template_endpoint(self):
        """Test GET /templates/{template_id} endpoint"""
        # First get a card to find its template ID
        card_response = self.session.get(f"{BASE_URL}/api/cards/{TEST_CARD_ID}")
        
        if card_response.status_code == 200:
            card_data = card_response.json().get("card", {})
            template_id = card_data.get("templateId")
            
            if template_id:
                response = self.session.get(f"{BASE_URL}/api/templates/{template_id}")
                assert response.status_code in [200, 404]
                
                if response.status_code == 200:
                    data = response.json()
                    assert data.get("success") == True
                    assert "template" in data
                    print(f"SUCCESS: Template retrieved - ID: {template_id}")
                else:
                    print(f"INFO: Template {template_id} not found (may be expected)")
            else:
                print("INFO: Card has no templateId")
        else:
            print("INFO: Could not get card to test template")
    
    def test_template_unauthenticated(self):
        """Test templates require authentication"""
        response = requests.get(f"{BASE_URL}/api/templates/test-template")
        assert response.status_code == 401
        print("SUCCESS: Templates require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
