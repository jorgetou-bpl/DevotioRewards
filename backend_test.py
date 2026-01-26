#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class BoomerangScannerAPITester:
    def __init__(self, base_url="https://rewards-scanner-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            else:
                self.log_test(name, False, f"Unsupported method: {method}")
                return False, {}

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            details = f"Status: {response.status_code}"
            if not success:
                details += f", Expected: {expected_status}, Response: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        self.run_test("Root endpoint", "GET", "/", 200)
        self.run_test("Health check", "GET", "/health", 200)

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n🔍 Testing Authentication Flow...")
        
        # Generate unique test user
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "TestPass123!"
        test_name = "Test User"

        # Test registration
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name
        }
        
        success, response = self.run_test(
            "User registration",
            "POST",
            "/auth/register",
            200,
            data=register_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            self.log_test("Token extraction", True, f"Token length: {len(self.token)}")
        else:
            self.log_test("Token extraction", False, "No token in response")
            return False

        # Test login with same credentials
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        success, response = self.run_test(
            "User login",
            "POST",
            "/auth/login",
            200,
            data=login_data
        )

        # Test get current user
        self.run_test("Get current user", "GET", "/auth/me", 200)

        # Test invalid login
        invalid_login = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        
        self.run_test(
            "Invalid login",
            "POST",
            "/auth/login",
            401,
            data=invalid_login
        )

        return True

    def test_settings_endpoints(self):
        """Test settings management"""
        print("\n🔍 Testing Settings Endpoints...")
        
        if not self.token:
            self.log_test("Settings test setup", False, "No auth token available")
            return

        # Get default settings
        self.run_test("Get settings", "GET", "/settings", 200)

        # Update settings
        settings_update = {
            "vibration": True,
            "beep": True,
            "show_result": False,
            "copy_to_clipboard": False
        }
        
        self.run_test(
            "Update settings",
            "PUT",
            "/settings",
            200,
            data=settings_update
        )

        # Verify settings were updated
        success, response = self.run_test("Verify settings update", "GET", "/settings", 200)
        
        if success:
            settings = response
            if (settings.get('vibration') == True and 
                settings.get('beep') == True and 
                settings.get('show_result') == False):
                self.log_test("Settings values verification", True, "Settings updated correctly")
            else:
                self.log_test("Settings values verification", False, f"Settings not updated: {settings}")

    def test_scan_endpoints(self):
        """Test card scanning functionality"""
        print("\n🔍 Testing Scan Endpoints...")
        
        if not self.token:
            self.log_test("Scan test setup", False, "No auth token available")
            return

        # Test card scan with mock data
        scan_data = {
            "qr_data": "test-card-123"
        }
        
        success, response = self.run_test(
            "Scan card",
            "POST",
            "/scan",
            200,
            data=scan_data
        )

        if success and 'card' in response:
            card = response['card']
            
            # Verify PII masking
            customer = card.get('customer', {})
            pii_masked = (
                customer.get('firstName') == '***' and
                customer.get('surname') == '***' and
                customer.get('email') == '***@***.***' and
                customer.get('phone') == '***-***-****'
            )
            
            self.log_test("PII masking verification", pii_masked, 
                         f"Customer data: {customer}")
            
            # Test get card details
            card_id = card.get('id')
            if card_id:
                self.run_test(
                    "Get card details",
                    "GET",
                    f"/cards/{card_id}",
                    200
                )

        # Test invalid QR data
        invalid_scan = {"qr_data": ""}
        self.run_test(
            "Invalid QR scan",
            "POST",
            "/scan",
            400,
            data=invalid_scan
        )

    def test_card_actions(self):
        """Test card action endpoints"""
        print("\n🔍 Testing Card Actions...")
        
        if not self.token:
            self.log_test("Card actions test setup", False, "No auth token available")
            return

        card_id = "test-card-123"  # Using mock card ID
        
        # Test add stamp
        stamp_data = {"amount": 1, "comment": "Test stamp"}
        self.run_test(
            "Add stamp",
            "POST",
            f"/cards/{card_id}/add-stamp",
            200,
            data=stamp_data
        )

        # Test add points
        points_data = {"amount": 10, "purchaseSum": 25.50}
        self.run_test(
            "Add points",
            "POST",
            f"/cards/{card_id}/add-point",
            200,
            data=points_data
        )

        # Test redeem reward
        reward_data = {"amount": 1, "comment": "Test reward"}
        self.run_test(
            "Redeem reward",
            "POST",
            f"/cards/{card_id}/redeem-reward",
            200,
            data=reward_data
        )

    def test_customer_endpoints(self):
        """Test customer search functionality"""
        print("\n🔍 Testing Customer Endpoints...")
        
        if not self.token:
            self.log_test("Customer test setup", False, "No auth token available")
            return

        # Test search customers by phone
        success, response = self.run_test(
            "Search customers by phone",
            "GET",
            "/customers?phone=+1234567890",
            200
        )

        if success and 'customers' in response:
            customers = response['customers']
            if customers:
                # Verify PII masking in search results
                customer = customers[0]
                pii_masked = (
                    customer.get('firstName') == '***' and
                    customer.get('surname') == '***'
                )
                self.log_test("Customer search PII masking", pii_masked,
                             f"Customer: {customer}")

                # Test get specific customer
                customer_id = customer.get('id')
                if customer_id:
                    self.run_test(
                        "Get customer details",
                        "GET",
                        f"/customers/{customer_id}",
                        200
                    )
                    
                    # Test get customer cards
                    self.run_test(
                        "Get customer cards",
                        "GET",
                        f"/customers/{customer_id}/cards",
                        200
                    )

        # Test search by email
        self.run_test(
            "Search customers by email",
            "GET",
            "/customers?email=test@example.com",
            200
        )

    def test_unauthorized_access(self):
        """Test endpoints without authentication"""
        print("\n🔍 Testing Unauthorized Access...")
        
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        # Test protected endpoints without auth
        self.run_test("Unauthorized scan", "POST", "/scan", 401, data={"qr_data": "test"})
        self.run_test("Unauthorized settings", "GET", "/settings", 401)
        self.run_test("Unauthorized customers", "GET", "/customers", 401)
        
        # Restore token
        self.token = original_token

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting Boomerang Scanner API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        try:
            self.test_health_endpoints()
            
            if self.test_auth_flow():
                self.test_settings_endpoints()
                self.test_scan_endpoints()
                self.test_card_actions()
                self.test_customer_endpoints()
                self.test_unauthorized_access()
            else:
                print("❌ Authentication failed - skipping protected endpoint tests")

        except Exception as e:
            print(f"❌ Test suite failed with exception: {e}")

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

    def get_test_summary(self):
        """Get test summary for reporting"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }

def main():
    tester = BoomerangScannerAPITester()
    exit_code = tester.run_all_tests()
    
    # Save detailed results
    summary = tester.get_test_summary()
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())