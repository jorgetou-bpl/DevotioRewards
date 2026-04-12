"""
Test suite for verifying the refactored ResultPage.js functionality
Tests card scanning, accrual modes, and workspace-scoped endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tenant-rewards-1.preview.emergentagent.com')

# Test credentials
DEMO_USER = {"email": "demo@devotio.com", "password": "demo123"}

# Test card IDs
CASHBACK_CARD = "255665-725-189"
DISCOUNT_CARD = "185504-436-130"
MEMBERSHIP_CARD = "551608-563-657"
REWARD_CARD = "896844-833-112"
STAMP_CARD = "353530-676-963"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_demo_user(self):
        """Test 1: Login with demo@devotio.com/demo123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert data["email"] == DEMO_USER["email"]
        assert data["workspace_id"] is not None, "workspace_id not in response"
        assert data["workspace_name"] == "Devotio Default"
        print(f"✓ Login successful: {data['name']} ({data['workspace_name']})")


class TestCardScanning:
    """Test card scanning for different card types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_scan_cashback_card(self):
        """Test 2: Scan cashback card 255665-725-189"""
        response = requests.get(f"{BASE_URL}/api/cards/{CASHBACK_CARD}", headers=self.headers)
        assert response.status_code == 200, f"Card scan failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True or "card" in data
        card = data.get("card", data)
        assert card.get("id") == CASHBACK_CARD or card.get("cardId") == CASHBACK_CARD
        print(f"✓ Cashback card scanned: {card.get('type', 'cashback')}")
    
    def test_scan_discount_card(self):
        """Test 3: Scan discount card 185504-436-130"""
        response = requests.get(f"{BASE_URL}/api/cards/{DISCOUNT_CARD}", headers=self.headers)
        assert response.status_code == 200, f"Card scan failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True or "card" in data
        print(f"✓ Discount card scanned successfully")
    
    def test_scan_membership_card(self):
        """Test 4: Scan membership card 551608-563-657"""
        response = requests.get(f"{BASE_URL}/api/cards/{MEMBERSHIP_CARD}", headers=self.headers)
        assert response.status_code == 200, f"Card scan failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True or "card" in data
        print(f"✓ Membership card scanned successfully")
    
    def test_scan_reward_card(self):
        """Test 5: Scan reward card 896844-833-112"""
        response = requests.get(f"{BASE_URL}/api/cards/{REWARD_CARD}", headers=self.headers)
        assert response.status_code == 200, f"Card scan failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True or "card" in data
        print(f"✓ Reward card scanned successfully")


class TestAccrualModeEndpoints:
    """Test card accrual mode endpoints with workspace_id"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        data = response.json()
        self.token = data["token"]
        self.workspace_id = data["workspace_id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_accrual_mode(self):
        """Test 8: GET /api/cards/{card_id}/accrual-mode with demo token"""
        response = requests.get(
            f"{BASE_URL}/api/cards/{CASHBACK_CARD}/accrual-mode",
            headers=self.headers
        )
        assert response.status_code == 200, f"GET accrual-mode failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("card_id") == CASHBACK_CARD
        print(f"✓ GET accrual-mode: mode={data.get('mode')}")
    
    def test_set_accrual_mode(self):
        """Test 9: POST /api/cards/{card_id}/accrual-mode with demo token"""
        test_card_id = "test-card-refactor-14"
        
        # Set accrual mode
        response = requests.post(
            f"{BASE_URL}/api/cards/{test_card_id}/accrual-mode",
            headers=self.headers,
            json={"mode": "spend"}
        )
        assert response.status_code == 200, f"POST accrual-mode failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("mode") == "spend"
        print(f"✓ POST accrual-mode: mode={data.get('mode')}")
        
        # Verify it was stored with workspace_id by fetching it back
        response = requests.get(
            f"{BASE_URL}/api/cards/{test_card_id}/accrual-mode",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mode") == "spend"
        print(f"✓ Verified accrual mode persisted: mode={data.get('mode')}")


class TestOperationsPage:
    """Test operations page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_operations(self):
        """Test 6: Operations page loads correctly with data"""
        response = requests.get(f"{BASE_URL}/api/operations", headers=self.headers)
        assert response.status_code == 200, f"GET operations failed: {response.text}"
        
        data = response.json()
        assert "operations" in data or isinstance(data, list)
        operations = data.get("operations", data)
        print(f"✓ Operations loaded: {len(operations)} records")


class TestSettingsPage:
    """Test settings page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_settings(self):
        """Test 7: Settings page loads correctly"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=self.headers)
        assert response.status_code == 200, f"GET settings failed: {response.text}"
        print(f"✓ Settings loaded successfully")
    
    def test_get_stamp_config(self):
        """Test stamp configuration endpoint"""
        response = requests.get(f"{BASE_URL}/api/stamp-config", headers=self.headers)
        assert response.status_code == 200, f"GET stamp-config failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Stamp config: mode={data.get('stamp_mode')}, threshold={data.get('spend_threshold')}")
    
    def test_get_discount_tiers(self):
        """Test discount tiers endpoint"""
        response = requests.get(f"{BASE_URL}/api/discount-tiers", headers=self.headers)
        assert response.status_code == 200, f"GET discount-tiers failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        tiers = data.get("tiers", [])
        print(f"✓ Discount tiers loaded: {len(tiers)} tiers")


class TestTierProgress:
    """Test tier progress endpoints for discount/cashback cards"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_tier_progress(self):
        """Test tier progress for cashback card"""
        response = requests.get(
            f"{BASE_URL}/api/tier-progress/{CASHBACK_CARD}",
            headers=self.headers
        )
        assert response.status_code == 200, f"GET tier-progress failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("card_id") == CASHBACK_CARD
        print(f"✓ Tier progress: accumulated={data.get('accumulated_amount')}, tier={data.get('current_tier')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
