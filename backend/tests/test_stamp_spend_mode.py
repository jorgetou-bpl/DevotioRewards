"""
Test cases for Stamp Card Spend Mode functionality
Tests the partial spend accumulation feature where stamps are earned based on purchase thresholds
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@devotio.com"
TEST_PASSWORD = "demo123"
TEST_CARD_ID = "353530-676-963"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestStampConfig:
    """Tests for global stamp configuration endpoint"""
    
    def test_get_stamp_config(self, api_client):
        """GET /api/stamp-config - should return spend mode with threshold 10000"""
        response = api_client.get(f"{BASE_URL}/api/stamp-config")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["stamp_mode"] == "spend"
        assert data["spend_threshold"] == 10000
        print(f"✓ Stamp config: mode={data['stamp_mode']}, threshold={data['spend_threshold']}")


class TestStampProgress:
    """Tests for stamp progress tracking (partial spend accumulation)"""
    
    def test_reset_progress(self, api_client):
        """DELETE /api/stamp-progress/{card_id} - reset progress for clean test"""
        response = api_client.delete(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Progress reset for card {TEST_CARD_ID}")
    
    def test_get_initial_progress(self, api_client):
        """GET /api/stamp-progress/{card_id} - should show 0 accumulated after reset"""
        response = api_client.get(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["card_id"] == TEST_CARD_ID
        assert data["accumulated_amount"] == 0
        assert data["threshold"] == 10000
        assert data["progress_percent"] == 0
        print(f"✓ Initial progress: {data['accumulated_amount']} of {data['threshold']}")
    
    def test_add_partial_spend_5000(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=5000 - partial spend, no stamp earned"""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=5000")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["accumulated_amount"] == 5000
        assert data["threshold"] == 10000
        assert data["progress_percent"] == 50.0
        assert data["stamps_to_add"] == 0  # No stamp earned yet
        print(f"✓ After 5000: accumulated={data['accumulated_amount']}, stamps_to_add={data['stamps_to_add']}")
    
    def test_add_partial_spend_7000_earns_stamp(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=7000 - should earn 1 stamp (5000+7000=12000 > 10000)"""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=7000")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["stamps_to_add"] == 1  # 1 stamp earned
        assert data["accumulated_amount"] == 2000  # Remaining: 12000 - 10000 = 2000
        assert data["progress_percent"] == 20.0
        print(f"✓ After 7000: stamps_earned={data['stamps_to_add']}, remaining={data['accumulated_amount']}")
    
    def test_verify_remaining_progress(self, api_client):
        """GET /api/stamp-progress/{card_id} - verify remaining 2000 after stamp earned"""
        response = api_client.get(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["accumulated_amount"] == 2000
        assert data["progress_percent"] == 20.0
        print(f"✓ Verified remaining: {data['accumulated_amount']} ({data['progress_percent']}%)")


class TestStampCardLookup:
    """Tests for stamp card lookup"""
    
    def test_get_card_by_id(self, api_client):
        """GET /api/cards/{card_id} - should return stamp card details"""
        response = api_client.get(f"{BASE_URL}/api/cards/{TEST_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["card"]["id"] == TEST_CARD_ID
        assert data["card"]["type"] == "stamp"
        
        balance = data["card"]["balance"]
        assert "currentNumberOfUses" in balance
        assert "stampsBeforeReward" in balance
        print(f"✓ Card found: type={data['card']['type']}, stamps={balance['currentNumberOfUses']}")


class TestMultipleStampsEarned:
    """Test earning multiple stamps in a single transaction"""
    
    def test_reset_for_multi_stamp_test(self, api_client):
        """Reset progress for multi-stamp test"""
        response = api_client.delete(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
        assert response.status_code == 200
    
    def test_large_purchase_earns_multiple_stamps(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=25000 - should earn 2 stamps with 5000 remaining"""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=25000")
        assert response.status_code == 200
        
        data = response.json()
        assert data["stamps_to_add"] == 2  # 25000 / 10000 = 2 stamps
        assert data["accumulated_amount"] == 5000  # 25000 % 10000 = 5000 remaining
        assert data["progress_percent"] == 50.0
        print(f"✓ Large purchase: stamps_earned={data['stamps_to_add']}, remaining={data['accumulated_amount']}")


class TestEdgeCases:
    """Test edge cases for stamp progress"""
    
    def test_reset_for_edge_cases(self, api_client):
        """Reset progress for edge case tests"""
        response = api_client.delete(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
        assert response.status_code == 200
    
    def test_exact_threshold_amount(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=10000 - exact threshold earns 1 stamp, 0 remaining"""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=10000")
        assert response.status_code == 200
        
        data = response.json()
        assert data["stamps_to_add"] == 1
        assert data["accumulated_amount"] == 0
        assert data["progress_percent"] == 0
        print(f"✓ Exact threshold: stamps_earned={data['stamps_to_add']}, remaining={data['accumulated_amount']}")
    
    def test_small_amount_accumulates(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=100 - small amount just accumulates"""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=100")
        assert response.status_code == 200
        
        data = response.json()
        assert data["stamps_to_add"] == 0
        assert data["accumulated_amount"] == 100
        assert data["progress_percent"] == 1.0
        print(f"✓ Small amount: accumulated={data['accumulated_amount']}")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup(auth_token):
    """Cleanup test data after all tests"""
    yield
    # Reset progress after tests
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    session.delete(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
    print("\n✓ Cleanup: Progress reset after tests")
