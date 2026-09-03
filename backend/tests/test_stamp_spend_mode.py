"""
Test cases for Stamp Card Spend Mode functionality
Stamps are earned per-purchase only: stamps = floor(purchase_amount / threshold).
There is no cross-purchase accumulation — any leftover below the threshold is
discarded, not carried forward (client-confirmed requirement).
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
    """Tests for per-purchase stamp calculation (no cross-purchase carryover)"""

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

    def test_partial_purchase_earns_no_stamp(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=5000 - below threshold, no stamp earned"""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=5000")
        assert response.status_code == 200

        data = response.json()
        assert data["success"] == True
        assert data["stamps_to_add"] == 0
        assert data["accumulated_amount"] == 0  # discarded, not carried forward
        print(f"✓ 5000 alone: stamps_to_add={data['stamps_to_add']}")

    def test_next_purchase_does_not_combine_with_previous(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=7000 - the prior 5000 must NOT
        carry forward; 7000 alone is still below the 10000 threshold, so 0 stamps."""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=7000")
        assert response.status_code == 200

        data = response.json()
        assert data["success"] == True
        assert data["stamps_to_add"] == 0  # NOT 1 — no accumulation across purchases
        assert data["accumulated_amount"] == 0
        print(f"✓ 7000 alone (no carryover from prior 5000): stamps_to_add={data['stamps_to_add']}")

    def test_single_purchase_above_threshold_earns_stamp(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=12000 - a single purchase that
        alone crosses the threshold earns a stamp; the 2000 leftover is discarded."""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=12000")
        assert response.status_code == 200

        data = response.json()
        assert data["success"] == True
        assert data["stamps_to_add"] == 1
        assert data["accumulated_amount"] == 0  # leftover 2000 discarded, not stored
        print(f"✓ 12000 in one purchase: stamps_to_add={data['stamps_to_add']}")

    def test_verify_no_progress_persisted(self, api_client):
        """GET /api/stamp-progress/{card_id} - always 0 now; nothing carries between purchases"""
        response = api_client.get(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
        assert response.status_code == 200

        data = response.json()
        assert data["accumulated_amount"] == 0
        assert data["progress_percent"] == 0
        print(f"✓ Verified nothing persisted: {data['accumulated_amount']} ({data['progress_percent']}%)")


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
    """Test earning multiple stamps from a single large purchase (client's own example)"""

    def test_reset_for_multi_stamp_test(self, api_client):
        """Reset progress for multi-stamp test"""
        response = api_client.delete(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}")
        assert response.status_code == 200

    def test_large_single_purchase_earns_multiple_stamps_remainder_discarded(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=25000 - client's exact example:
        1 stamp per 1500 config would give 2 stamps for 3500 with 500 discarded; here
        with the 10000 threshold, 25000 earns 2 stamps and the 5000 leftover is lost,
        not saved toward the next purchase."""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=25000")
        assert response.status_code == 200

        data = response.json()
        assert data["stamps_to_add"] == 2  # 25000 // 10000 = 2 stamps
        assert data["accumulated_amount"] == 0  # 5000 leftover discarded, not stored
        print(f"✓ Large purchase: stamps_earned={data['stamps_to_add']}, leftover discarded")


class TestEdgeCases:
    """Test edge cases for per-purchase stamp calculation"""

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

    def test_small_amount_earns_nothing_and_is_discarded(self, api_client):
        """POST /api/stamp-progress/{card_id}/add?amount=100 - small amount earns 0 stamps
        and is discarded immediately, not accumulated for a future purchase."""
        response = api_client.post(f"{BASE_URL}/api/stamp-progress/{TEST_CARD_ID}/add?amount=100")
        assert response.status_code == 200

        data = response.json()
        assert data["stamps_to_add"] == 0
        assert data["accumulated_amount"] == 0
        print(f"✓ Small amount discarded: accumulated={data['accumulated_amount']}")


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
