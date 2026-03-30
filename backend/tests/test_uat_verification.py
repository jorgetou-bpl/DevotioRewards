"""
UAT Verification Tests for Devotio Rewards Scanner
Tests all card types and their specific features as per UAT requirements.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@devotio.com"
TEST_PASSWORD = "demo123"

# Test card IDs
STAMP_CARD_ID = "353530-676-963"
DISCOUNT_CARD_ID = "185504-436-130"
CASHBACK_CARD_ID = "591682-351-613"
MEMBERSHIP_CARD_ID = "551608-563-657"
REWARD_CARD_VISIT_ID = "896844-833-112"
REWARD_CARD_MANUAL_ID = "199706-114-876"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in login response"
    return data["token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestLoginAndAuth:
    """Test authentication endpoints."""
    
    def test_login_success(self):
        """Test successful login with valid credentials."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        # User data is returned directly in response, not nested under "user"
        assert "name" in data or "email" in data
        print(f"Login successful: {data.get('name', 'Unknown')}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400]


class TestDiscountCard:
    """Test Discount Card (185504-436-130) - No hardcoded tier names."""
    
    def test_get_discount_card(self, api_client):
        """Verify discount card can be retrieved."""
        response = api_client.get(f"{BASE_URL}/api/cards/{DISCOUNT_CARD_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        card = data.get("card", {})
        assert card.get("id") == DISCOUNT_CARD_ID
        print(f"Discount card retrieved: {card.get('type')}")
    
    def test_discount_card_balance_structure(self, api_client):
        """Verify discount card balance has correct structure."""
        response = api_client.get(f"{BASE_URL}/api/cards/{DISCOUNT_CARD_ID}")
        assert response.status_code == 200
        card = response.json().get("card", {})
        balance = card.get("balance", {})
        
        # Should have discount percentage
        discount_level = balance.get("discountLevel") or balance.get("discountPercentage")
        assert discount_level is not None, "Discount level should be present"
        print(f"Discount level: {discount_level}%")
    
    def test_discount_card_add_purchase(self, api_client):
        """Test adding purchase to discount card."""
        response = api_client.post(f"{BASE_URL}/api/cards/{DISCOUNT_CARD_ID}/add-point", json={
            "amount": 5000,
            "purchaseSum": 5000
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Discount card purchase added: {data.get('message')}")


class TestCashbackCard:
    """Test Cashback Card (591682-351-613) - Balance in currency, correct purchaseSum calculation."""
    
    def test_get_cashback_card(self, api_client):
        """Verify cashback card can be retrieved."""
        response = api_client.get(f"{BASE_URL}/api/cards/{CASHBACK_CARD_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        card = data.get("card", {})
        assert card.get("id") == CASHBACK_CARD_ID
        print(f"Cashback card retrieved: {card.get('type')}")
    
    def test_cashback_card_balance_in_currency(self, api_client):
        """Verify cashback balance is in currency units (not percentage)."""
        response = api_client.get(f"{BASE_URL}/api/cards/{CASHBACK_CARD_ID}")
        assert response.status_code == 200
        card = response.json().get("card", {})
        balance = card.get("balance", {})
        
        # Balance should be a numeric value representing currency
        cashback_balance = balance.get("balance", 0)
        assert isinstance(cashback_balance, (int, float)), "Balance should be numeric"
        print(f"Cashback balance: {cashback_balance}")
    
    def test_cashback_card_add_purchase(self, api_client):
        """Test adding purchase to cashback card - purchaseSum calculation."""
        # For cashback, amount = purchaseAmount * (cashbackPercent/100)
        response = api_client.post(f"{BASE_URL}/api/cards/{CASHBACK_CARD_ID}/add-point", json={
            "amount": 100,  # Calculated cashback amount
            "purchaseSum": 10000  # Original purchase amount
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Cashback added: {data.get('message')}")


class TestMembershipCard:
    """Test Membership Card (551608-563-657) - Optional purchase amount, visit count."""
    
    def test_get_membership_card(self, api_client):
        """Verify membership card can be retrieved."""
        response = api_client.get(f"{BASE_URL}/api/cards/{MEMBERSHIP_CARD_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        card = data.get("card", {})
        assert card.get("id") == MEMBERSHIP_CARD_ID
        print(f"Membership card retrieved: {card.get('type')}")
    
    def test_membership_card_visit_count(self, api_client):
        """Verify visit count uses balance.currentNumberOfUses."""
        response = api_client.get(f"{BASE_URL}/api/cards/{MEMBERSHIP_CARD_ID}")
        assert response.status_code == 200
        card = response.json().get("card", {})
        balance = card.get("balance", {})
        
        # currentNumberOfUses represents available visits
        visits = balance.get("currentNumberOfUses", 0)
        assert isinstance(visits, int), "Visits should be integer"
        print(f"Membership visits available: {visits}")
    
    def test_membership_redeem_without_purchase_amount(self, api_client):
        """Test redeeming visit WITHOUT purchase amount (should work)."""
        # First check if there are visits available
        response = api_client.get(f"{BASE_URL}/api/cards/{MEMBERSHIP_CARD_ID}")
        card = response.json().get("card", {})
        visits = card.get("balance", {}).get("currentNumberOfUses", 0)
        
        if visits > 0:
            # Try to redeem without purchaseSum
            response = api_client.post(f"{BASE_URL}/api/cards/{MEMBERSHIP_CARD_ID}/subtract-visit", json={
                "amount": 1
                # Note: No purchaseSum - should still work
            })
            assert response.status_code == 200
            data = response.json()
            assert data.get("success") == True
            print(f"Membership visit redeemed without purchase amount: {data.get('message')}")
        else:
            pytest.skip("No visits available to redeem")


class TestRewardCard:
    """Test Reward Card (896844-833-112) - Accrual mode selection, purchase amount required."""
    
    def test_get_reward_card(self, api_client):
        """Verify reward card can be retrieved."""
        response = api_client.get(f"{BASE_URL}/api/cards/{REWARD_CARD_VISIT_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        card = data.get("card", {})
        assert card.get("id") == REWARD_CARD_VISIT_ID
        print(f"Reward card retrieved: {card.get('type')}")
    
    def test_reward_card_accrual_mode_endpoint(self, api_client):
        """Test accrual mode endpoint exists and returns mode."""
        response = api_client.get(f"{BASE_URL}/api/cards/{REWARD_CARD_VISIT_ID}/accrual-mode")
        assert response.status_code == 200
        data = response.json()
        # Should return success and mode (if saved)
        assert "success" in data
        print(f"Accrual mode response: {data}")
    
    def test_reward_card_save_accrual_mode(self, api_client):
        """Test saving accrual mode preference."""
        response = api_client.post(f"{BASE_URL}/api/cards/{REWARD_CARD_VISIT_ID}/accrual-mode", json={
            "mode": "visit"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Accrual mode saved: {data}")
    
    def test_reward_card_add_visit(self, api_client):
        """Test adding visit to reward card (visit mode)."""
        response = api_client.post(f"{BASE_URL}/api/cards/{REWARD_CARD_VISIT_ID}/add-visit-reward", json={
            "amount": 1,
            "purchaseSum": 5000
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Reward card visit added: {data.get('message')}")


class TestStampCard:
    """Test Stamp Card (353530-676-963) - Dynamic grid, daily limit error."""
    
    def test_get_stamp_card(self, api_client):
        """Verify stamp card can be retrieved."""
        response = api_client.get(f"{BASE_URL}/api/cards/{STAMP_CARD_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        card = data.get("card", {})
        assert card.get("id") == STAMP_CARD_ID
        print(f"Stamp card retrieved: {card.get('type')}")
    
    def test_stamp_card_balance_structure(self, api_client):
        """Verify stamp card balance has correct structure for dynamic grid."""
        response = api_client.get(f"{BASE_URL}/api/cards/{STAMP_CARD_ID}")
        assert response.status_code == 200
        card = response.json().get("card", {})
        balance = card.get("balance", {})
        
        # Should have currentNumberOfUses and stampsBeforeReward
        current_stamps = balance.get("currentNumberOfUses", 0)
        stamps_before_reward = balance.get("stampsBeforeReward", 0)
        
        # Total = current + remaining
        total_stamps = current_stamps + stamps_before_reward
        
        print(f"Stamp card: {current_stamps} active, {stamps_before_reward} until reward, {total_stamps} total")
        assert total_stamps > 0, "Total stamps should be > 0"
    
    def test_stamp_card_daily_limit_error_format(self, api_client):
        """Test that daily limit error returns correct Spanish message."""
        # Try to add a stamp - if daily limit is reached, should get correct error
        response = api_client.post(f"{BASE_URL}/api/cards/{STAMP_CARD_ID}/add-stamp", json={
            "amount": 1,
            "purchaseSum": 1000
        })
        
        if response.status_code == 200:
            print("Stamp added successfully (no daily limit hit)")
        else:
            # Check error message
            error_detail = response.json().get("detail", "")
            print(f"Error response: {error_detail}")
            
            # Should NOT contain old error message
            assert "Esta recompensa ya fue canjeada" not in error_detail, \
                "Should not show old error message"
            
            # If it's a daily limit error, should show correct message
            if "limit" in error_detail.lower() or "check-in" in error_detail.lower():
                assert "Límite de check-in diario alcanzado" in error_detail, \
                    f"Daily limit error should show correct Spanish message, got: {error_detail}"


class TestStampConfig:
    """Test stamp configuration endpoints."""
    
    def test_get_stamp_config(self, api_client):
        """Test getting stamp configuration."""
        response = api_client.get(f"{BASE_URL}/api/stamp-config")
        assert response.status_code == 200
        data = response.json()
        
        # Should have stamp_mode and spend_threshold
        stamp_mode = data.get("stamp_mode")
        spend_threshold = data.get("spend_threshold")
        
        print(f"Stamp config: mode={stamp_mode}, threshold={spend_threshold}")
    
    def test_get_stamp_progress(self, api_client):
        """Test getting stamp progress for a card."""
        response = api_client.get(f"{BASE_URL}/api/stamp-progress/{STAMP_CARD_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Should have accumulated_amount, threshold, progress_percent
        accumulated = data.get("accumulated_amount", 0)
        threshold = data.get("threshold", 0)
        progress = data.get("progress_percent", 0)
        
        print(f"Stamp progress: {accumulated}/{threshold} ({progress}%)")


class TestScanEndpoint:
    """Test card scanning endpoint."""
    
    def test_scan_by_card_id(self, api_client):
        """Test scanning card by ID."""
        response = api_client.post(f"{BASE_URL}/api/scan", json={
            "qr_data": STAMP_CARD_ID
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("card") is not None
        print(f"Scan successful: {data.get('card', {}).get('id')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
