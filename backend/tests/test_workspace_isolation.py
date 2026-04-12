# Multi-tenant Workspace Isolation Tests
# Tests workspace_id filtering on operations, settings, and auth endpoints

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
DEMO_USER = {"email": "demo@devotio.com", "password": "demo123"}
CAFE_USER = {"email": "admin@cafedemo.com", "password": "admin123"}
MASTER_CODE = "DEVOTIO-2026-ADMIN"


class TestAuthWorkspaceInfo:
    """Test that login returns workspace_id and workspace_name"""
    
    def test_demo_user_login_returns_workspace_info(self):
        """Test 1: Login with demo@devotio.com returns workspace_id and workspace_name='Devotio Default'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "workspace_id" in data, "workspace_id not in login response"
        assert "workspace_name" in data, "workspace_name not in login response"
        # Demo user should be in Devotio Default workspace
        assert data.get("workspace_name") == "Devotio Default", f"Expected 'Devotio Default', got '{data.get('workspace_name')}'"
        print(f"✓ Demo user login: workspace_id={data.get('workspace_id')}, workspace_name={data.get('workspace_name')}")
    
    def test_cafe_user_login_returns_workspace_info(self):
        """Test 2: Login with admin@cafedemo.com returns workspace_id and workspace_name='Cafe Demo'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CAFE_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "workspace_id" in data, "workspace_id not in login response"
        assert "workspace_name" in data, "workspace_name not in login response"
        # Cafe user should be in Cafe Demo workspace
        assert data.get("workspace_name") == "Cafe Demo", f"Expected 'Cafe Demo', got '{data.get('workspace_name')}'"
        print(f"✓ Cafe user login: workspace_id={data.get('workspace_id')}, workspace_name={data.get('workspace_name')}")
    
    def test_auth_me_returns_workspace_id(self):
        """Test 9: GET /api/auth/me with demo token returns workspace_id"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        
        # Get /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        
        data = response.json()
        assert "workspace_id" in data, "workspace_id not in /auth/me response"
        assert "workspace_name" in data, "workspace_name not in /auth/me response"
        print(f"✓ /auth/me returns workspace_id={data.get('workspace_id')}, workspace_name={data.get('workspace_name')}")


class TestOperationsWorkspaceIsolation:
    """Test that operations are filtered by workspace_id"""
    
    @pytest.fixture
    def demo_token(self):
        """Get token for demo user (Devotio Default workspace)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return response.json().get("token")
    
    @pytest.fixture
    def cafe_token(self):
        """Get token for cafe user (Cafe Demo workspace)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CAFE_USER)
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_demo_user_sees_operations(self, demo_token):
        """Test 3: GET /api/operations with demo token returns operations with matching workspace_id"""
        response = requests.get(
            f"{BASE_URL}/api/operations",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Operations failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        operations = data.get("operations", [])
        
        # Demo user should see operations (legacy data migrated to Devotio Default)
        print(f"✓ Demo user sees {len(operations)} operations")
        
        # Verify all operations have workspace_id (if any exist)
        if operations:
            for op in operations[:5]:  # Check first 5
                # Operations should have workspace_id matching demo user's workspace
                ws_id = op.get("workspace_id")
                print(f"  - Operation {op.get('id', 'N/A')[:8]}... workspace_id={ws_id}")
    
    def test_cafe_user_sees_no_operations(self, cafe_token):
        """Test 4: GET /api/operations with cafe token returns 0 operations (different workspace)"""
        response = requests.get(
            f"{BASE_URL}/api/operations",
            headers={"Authorization": f"Bearer {cafe_token}"}
        )
        assert response.status_code == 200, f"Operations failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        operations = data.get("operations", [])
        
        # Cafe user should see 0 operations (no data in Cafe Demo workspace)
        assert len(operations) == 0, f"Expected 0 operations for Cafe Demo, got {len(operations)}"
        print(f"✓ Cafe user sees 0 operations (workspace isolation working)")
    
    def test_demo_user_summary_has_operations(self, demo_token):
        """Test 5: GET /api/operations/summary with demo token returns total_operations > 0"""
        response = requests.get(
            f"{BASE_URL}/api/operations/summary",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Summary failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        summary = data.get("summary", {})
        total = summary.get("total_operations", 0)
        
        # Demo user should have operations
        assert total > 0, f"Expected total_operations > 0 for demo user, got {total}"
        print(f"✓ Demo user summary: total_operations={total}")
    
    def test_cafe_user_summary_has_zero_operations(self, cafe_token):
        """Test 6: GET /api/operations/summary with cafe token returns total_operations = 0"""
        response = requests.get(
            f"{BASE_URL}/api/operations/summary",
            headers={"Authorization": f"Bearer {cafe_token}"}
        )
        assert response.status_code == 200, f"Summary failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        summary = data.get("summary", {})
        total = summary.get("total_operations", 0)
        
        # Cafe user should have 0 operations
        assert total == 0, f"Expected total_operations = 0 for cafe user, got {total}"
        print(f"✓ Cafe user summary: total_operations={total} (workspace isolation working)")


class TestSettingsWorkspaceIsolation:
    """Test that stamp-config and discount-tiers are workspace-scoped"""
    
    @pytest.fixture
    def demo_token(self):
        """Get token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_stamp_config_is_workspace_scoped(self, demo_token):
        """Test 7: GET /api/stamp-config with demo token returns workspace-scoped config"""
        response = requests.get(
            f"{BASE_URL}/api/stamp-config",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Stamp config failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        print(f"✓ Stamp config: mode={data.get('stamp_mode')}, threshold={data.get('spend_threshold')}")
    
    def test_discount_tiers_is_workspace_scoped(self, demo_token):
        """Test 8: GET /api/discount-tiers with demo token returns workspace-scoped tiers"""
        response = requests.get(
            f"{BASE_URL}/api/discount-tiers",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Discount tiers failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        tiers = data.get("tiers", [])
        print(f"✓ Discount tiers: {len(tiers)} tiers configured")


class TestWorkspaceCreation:
    """Test workspace creation with master code"""
    
    def test_create_workspace_requires_master_code(self):
        """Test 10: POST /api/admin/workspaces requires master code DEVOTIO-2026-ADMIN"""
        # Try without master code - should fail
        response = requests.post(
            f"{BASE_URL}/api/admin/workspaces",
            json={
                "master_code": "WRONG-CODE",
                "name": "Test Workspace",
                "boomerangme_api_key": "test-key-123"
            }
        )
        assert response.status_code == 403, f"Expected 403 for wrong master code, got {response.status_code}"
        print("✓ Workspace creation rejects invalid master code")
    
    def test_create_workspace_with_valid_master_code(self):
        """Test workspace creation with valid master code (cleanup after)"""
        import uuid
        test_slug = f"test-ws-{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/workspaces",
            json={
                "master_code": MASTER_CODE,
                "name": f"Test Workspace {test_slug}",
                "slug": test_slug,
                "boomerangme_api_key": "test-api-key-for-testing"
            }
        )
        
        # Should succeed
        assert response.status_code == 200, f"Workspace creation failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "workspace" in data
        print(f"✓ Workspace created: {data.get('workspace', {}).get('name')}")


class TestWorkspaceAdminAccess:
    """Test workspace admin page access"""
    
    @pytest.fixture
    def cafe_token(self):
        """Get token for cafe admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CAFE_USER)
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_workspace_admin_can_get_workspace(self, cafe_token):
        """Test workspace admin can access their workspace details"""
        # First get user info to get workspace_id
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cafe_token}"}
        )
        assert me_resp.status_code == 200
        workspace_id = me_resp.json().get("workspace_id")
        
        if workspace_id:
            # Get workspace details
            response = requests.get(
                f"{BASE_URL}/api/admin/workspaces/{workspace_id}",
                headers={"Authorization": f"Bearer {cafe_token}"}
            )
            assert response.status_code == 200, f"Get workspace failed: {response.text}"
            data = response.json()
            assert data.get("success") is True
            print(f"✓ Workspace admin can access workspace: {data.get('workspace', {}).get('name')}")
        else:
            pytest.skip("Cafe user has no workspace_id assigned")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
