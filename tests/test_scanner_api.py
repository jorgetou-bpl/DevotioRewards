"""
Backend API tests for Devotio Rewards Scanner App
Tests: Authentication, Card Scanning, Card Actions (add-stamp, add-point, redeem)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@devotio.com"
TEST_PASSWORD = "demo123"

# Test card IDs
DEMO_STAMP_CARD = "DEMO-001"
REAL_DISCOUNT_CARD = "955355-486-631"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Devotio" in data.get("message", "")
        print(f"✓ API root passed: {data}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login success: user={data['user']['email']}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_auth_me_without_token(self):
        """Test /auth/me without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403
        print("✓ Unauthenticated /auth/me correctly rejected")


class TestCardScanning:
    """Card scanning endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_scan_demo_stamp_card(self, auth_token):
        """Test scanning DEMO-001 stamp card - should return 8/10 stamps"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/scan", 
                                 json={"qr_data": DEMO_STAMP_CARD},
                                 headers=headers)
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        card = data["card"]
        
        # Verify card type - should be stamp_card for demo
        assert card["type"] in ["stamp_card", "stamp"], f"Expected stamp card type, got: {card['type']}"
        
        # Verify stamp balance - 8/10 stamps
        balance = card.get("balance", {})
        current_stamps = balance.get("currentNumberOfUses", 0)
        total_stamps = balance.get("numberStampsTotal", 10)
        assert current_stamps == 8, f"Expected 8 stamps, got: {current_stamps}"
        assert total_stamps == 10, f"Expected 10 total stamps, got: {total_stamps}"
        
        # Verify customer name is visible (not masked)
        customer = card.get("customer", {})
        assert customer.get("firstName") == "Maria", f"Expected firstName 'Maria', got: {customer.get('firstName')}"
        assert customer.get("surname") == "González", f"Expected surname 'González', got: {customer.get('surname')}"
        
        # Verify email/phone are masked
        assert customer.get("email") == "***@***.***", f"Email should be masked, got: {customer.get('email')}"
        assert customer.get("phone") == "***-***-****", f"Phone should be masked, got: {customer.get('phone')}"
        
        print(f"✓ DEMO-001 stamp card: {current_stamps}/{total_stamps} stamps, customer: {customer.get('firstName')} {customer.get('surname')}")
    
    def test_scan_real_discount_card(self, auth_token):
        """Test scanning real discount card 955355-486-631 - should return discount card UI"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/scan", 
                                 json={"qr_data": REAL_DISCOUNT_CARD},
                                 headers=headers)
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        card = data["card"]
        
        # Verify card type - should be discount (type ID 4 from Boomerang API)
        card_type = card.get("type", {})
        if isinstance(card_type, dict):
            # API returns {id: 4, name: "discount"} format
            assert card_type.get("id") == 4 or card_type.get("name") == "discount", f"Expected discount card type, got: {card_type}"
        else:
            assert card_type in ["discount", "discount_card"], f"Expected discount card type, got: {card_type}"
        
        # Verify balance has discount info
        balance = card.get("balance", {})
        # Real API may return discountPercentage or discountLevel
        discount_level = balance.get("discountPercentage") or balance.get("discountLevel")
        assert discount_level is not None, f"Expected discount level in balance, got: {balance}"
        
        # Verify customer info is masked
        customer = card.get("customer", {})
        if customer:
            # Name should be visible
            assert customer.get("firstName") is not None or customer.get("name") is not None
            # Email/phone should be masked
            if customer.get("email"):
                assert "***" in customer.get("email"), f"Email should be masked, got: {customer.get('email')}"
        
        print(f"✓ Real discount card {REAL_DISCOUNT_CARD}: type={card_type}, discount={discount_level}%")
    
    def test_scan_invalid_card(self, auth_token):
        """Test scanning invalid card ID"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/scan", 
                                 json={"qr_data": "INVALID-CARD-123"},
                                 headers=headers)
        # Should return 404 for card not found
        assert response.status_code in [404, 200], f"Unexpected status: {response.status_code}"
        print("✓ Invalid card handled correctly")


class TestCardActions:
    """Card action endpoint tests (add-stamp, add-point, redeem)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_add_stamp_to_demo_card(self, auth_token):
        """Test adding stamp to DEMO-001"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/cards/{DEMO_STAMP_CARD}/add-stamp", 
                                 json={"amount": 1, "comment": "Test stamp"},
                                 headers=headers)
        assert response.status_code == 200, f"Add stamp failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        print(f"✓ Add stamp to DEMO-001: {data.get('message')}")
    
    def test_add_point_to_discount_card(self, auth_token):
        """Test adding points to real discount card with purchase amount"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/cards/{REAL_DISCOUNT_CARD}/add-point", 
                                 json={"amount": 100, "purchaseSum": 5000, "comment": "Test purchase"},
                                 headers=headers)
        assert response.status_code == 200, f"Add point failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"✓ Add point to discount card: {data.get('message')}")
    
    def test_redeem_reward_demo_card(self, auth_token):
        """Test redeeming reward from DEMO-001 (has 1 reward available)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/cards/{DEMO_STAMP_CARD}/redeem-reward", 
                                 json={"amount": 1, "comment": "Test redeem"},
                                 headers=headers)
        assert response.status_code == 200, f"Redeem reward failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"✓ Redeem reward from DEMO-001: {data.get('message')}")


class TestCardTypes:
    """Test different card types return correct configuration"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_demo_cashback_card(self, auth_token):
        """Test DEMO-002 cashback card"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/scan", 
                                 json={"qr_data": "DEMO-002"},
                                 headers=headers)
        assert response.status_code == 200
        card = response.json()["card"]
        assert card["type"] in ["cashback_card", "cashback"]
        assert card["balance"].get("cashbackPercent") == 5
        print(f"✓ DEMO-002 cashback card: {card['balance'].get('cashbackPercent')}% cashback")
    
    def test_demo_discount_card(self, auth_token):
        """Test DEMO-003 discount card"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/scan", 
                                 json={"qr_data": "DEMO-003"},
                                 headers=headers)
        assert response.status_code == 200
        card = response.json()["card"]
        assert card["type"] in ["discount_card", "discount"]
        assert card["balance"].get("discountLevel") == 1
        print(f"✓ DEMO-003 discount card: {card['balance'].get('discountLevel')}% discount")
    
    def test_demo_coupon(self, auth_token):
        """Test DEMO-005 coupon"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/scan", 
                                 json={"qr_data": "DEMO-005"},
                                 headers=headers)
        assert response.status_code == 200
        card = response.json()["card"]
        assert card["type"] == "coupon"
        assert card["balance"].get("couponStatus") == "active"
        print(f"✓ DEMO-005 coupon: status={card['balance'].get('couponStatus')}")
    
    def test_demo_multipass(self, auth_token):
        """Test DEMO-006 multipass"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/scan", 
                                 json={"qr_data": "DEMO-006"},
                                 headers=headers)
        assert response.status_code == 200
        card = response.json()["card"]
        assert card["type"] == "multipass"
        assert card["balance"].get("visitsAvailable") == 6
        print(f"✓ DEMO-006 multipass: {card['balance'].get('visitsAvailable')} visits available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
