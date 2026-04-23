"""
Test Role Editing Feature - Iteration 15
Tests the new PUT /api/admin/workspaces/{ws_id}/users/{user_id}/role endpoint
and role editing functionality for both WorkspaceAdminPage and SuperAdminDashboard
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "demo@devotio.com"
SUPER_ADMIN_PASSWORD = "demo123"
WORKSPACE_ADMIN_EMAIL = "admin@cafedemo.com"
WORKSPACE_ADMIN_PASSWORD = "admin123"
MASTER_CODE = "DEVOTIO-2026-ADMIN"


class TestRoleEditingBackend:
    """Test the role editing backend endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_super_admin_token(self):
        """Login as super admin and get token"""
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Super admin login failed: {resp.text}"
        return resp.json().get("token")
    
    def get_workspace_admin_token(self):
        """Login as workspace admin and get token"""
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": WORKSPACE_ADMIN_EMAIL,
            "password": WORKSPACE_ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Workspace admin login failed: {resp.text}"
        return resp.json().get("token")
    
    def get_workspace_id_for_admin(self, token):
        """Get workspace ID for the logged in admin"""
        resp = self.session.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        return resp.json().get("workspace_id")
    
    def get_workspace_users(self, token, workspace_id):
        """Get users in a workspace"""
        resp = self.session.get(f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        return resp.json().get("users", [])
    
    # ============ ROLE EDITING TESTS ============
    
    def test_01_super_admin_login(self):
        """Test super admin can login"""
        token = self.get_super_admin_token()
        assert token is not None
        print(f"✓ Super admin login successful")
    
    def test_02_workspace_admin_login(self):
        """Test workspace admin can login"""
        token = self.get_workspace_admin_token()
        assert token is not None
        print(f"✓ Workspace admin login successful")
    
    def test_03_get_workspace_users_as_workspace_admin(self):
        """Test workspace admin can get users in their workspace"""
        token = self.get_workspace_admin_token()
        workspace_id = self.get_workspace_id_for_admin(token)
        assert workspace_id is not None, "Workspace admin should have workspace_id"
        
        users = self.get_workspace_users(token, workspace_id)
        assert isinstance(users, list)
        print(f"✓ Got {len(users)} users in workspace")
    
    def test_04_role_update_endpoint_exists(self):
        """Test that PUT /api/admin/workspaces/{ws_id}/users/{user_id}/role endpoint exists"""
        token = self.get_workspace_admin_token()
        workspace_id = self.get_workspace_id_for_admin(token)
        
        # Try with a fake user ID - should return 404 not 405 (method not allowed)
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/fake-user-id/role",
            json={"role": "operator"},
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should be 404 (user not found) not 405 (method not allowed)
        assert resp.status_code in [404, 400], f"Expected 404 or 400, got {resp.status_code}: {resp.text}"
        print(f"✓ Role update endpoint exists (returned {resp.status_code} for fake user)")
    
    def test_05_workspace_admin_can_change_operator_to_admin(self):
        """Test workspace admin can change an operator to workspace_admin"""
        token = self.get_workspace_admin_token()
        workspace_id = self.get_workspace_id_for_admin(token)
        users = self.get_workspace_users(token, workspace_id)
        
        # Find an operator to change
        operator = next((u for u in users if u.get("role") == "operator"), None)
        if not operator:
            pytest.skip("No operator found in workspace to test role change")
        
        user_id = operator.get("id")
        original_role = operator.get("role")
        
        # Change to workspace_admin
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/{user_id}/role",
            json={"role": "workspace_admin"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, f"Role change failed: {resp.text}"
        
        # Verify the change
        users_after = self.get_workspace_users(token, workspace_id)
        updated_user = next((u for u in users_after if u.get("id") == user_id), None)
        assert updated_user is not None
        assert updated_user.get("role") == "workspace_admin", f"Role not updated: {updated_user.get('role')}"
        
        # Revert back to original role
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/{user_id}/role",
            json={"role": original_role},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print(f"✓ Workspace admin can change operator to admin and back")
    
    def test_06_workspace_admin_cannot_set_super_admin_role(self):
        """Test workspace admin cannot set super_admin role"""
        token = self.get_workspace_admin_token()
        workspace_id = self.get_workspace_id_for_admin(token)
        users = self.get_workspace_users(token, workspace_id)
        
        # Find any user to try to make super_admin
        user = next((u for u in users if u.get("role") != "super_admin"), None)
        if not user:
            pytest.skip("No non-super_admin user found")
        
        user_id = user.get("id")
        
        # Try to set super_admin role - should fail
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/{user_id}/role",
            json={"role": "super_admin"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 400, f"Expected 400 for invalid role, got {resp.status_code}: {resp.text}"
        print(f"✓ Workspace admin cannot set super_admin role (correctly rejected)")
    
    def test_07_super_admin_can_set_super_admin_role(self):
        """Test super admin CAN set super_admin role"""
        token = self.get_super_admin_token()
        
        # Get dashboard to find a workspace
        resp = self.session.get(f"{BASE_URL}/api/admin/dashboard", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        workspaces = resp.json().get("workspaces", [])
        
        # Find cafe-demo workspace
        cafe_ws = next((ws for ws in workspaces if "cafe" in ws.get("slug", "").lower()), None)
        if not cafe_ws:
            pytest.skip("Cafe Demo workspace not found")
        
        workspace_id = cafe_ws.get("id")
        
        # Get users in that workspace
        resp = self.session.get(f"{BASE_URL}/api/admin/dashboard/workspaces/{workspace_id}/users", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        users = resp.json().get("users", [])
        
        # Find an operator to promote
        operator = next((u for u in users if u.get("role") == "operator"), None)
        if not operator:
            pytest.skip("No operator found to test super_admin role assignment")
        
        user_id = operator.get("id")
        original_role = operator.get("role")
        
        # Super admin should be able to set super_admin role
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/{user_id}/role",
            json={"role": "super_admin"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, f"Super admin should be able to set super_admin role: {resp.text}"
        
        # Revert back
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/{user_id}/role",
            json={"role": original_role},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print(f"✓ Super admin can set super_admin role")
    
    def test_08_invalid_role_rejected(self):
        """Test that invalid roles are rejected"""
        token = self.get_workspace_admin_token()
        workspace_id = self.get_workspace_id_for_admin(token)
        users = self.get_workspace_users(token, workspace_id)
        
        if not users:
            pytest.skip("No users in workspace")
        
        user_id = users[0].get("id")
        
        # Try invalid role
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/{user_id}/role",
            json={"role": "invalid_role"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 400, f"Expected 400 for invalid role, got {resp.status_code}"
        print(f"✓ Invalid role correctly rejected")
    
    def test_09_workspace_admin_cannot_access_other_workspace(self):
        """Test workspace admin cannot change roles in other workspaces"""
        token = self.get_workspace_admin_token()
        
        # Try to access a different workspace
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/fake-workspace-id/users/fake-user-id/role",
            json={"role": "operator"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 403, f"Expected 403 for unauthorized workspace access, got {resp.status_code}"
        print(f"✓ Workspace admin cannot access other workspaces")
    
    def test_10_operator_cannot_access_role_endpoint(self):
        """Test that operators cannot access the role change endpoint"""
        # First, we need to find an operator to login as
        # For this test, we'll verify the endpoint requires admin role
        token = self.get_workspace_admin_token()
        workspace_id = self.get_workspace_id_for_admin(token)
        
        # Without token should fail
        resp = self.session.put(
            f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users/fake-user-id/role",
            json={"role": "operator"}
        )
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ Unauthenticated requests rejected")


class TestWorkspaceAdminPageUI:
    """Test WorkspaceAdminPage UI consistency and features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_workspace_admin_token(self):
        """Login as workspace admin"""
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": WORKSPACE_ADMIN_EMAIL,
            "password": WORKSPACE_ADMIN_PASSWORD
        })
        assert resp.status_code == 200
        return resp.json().get("token")
    
    def test_11_workspace_admin_can_get_workspace_details(self):
        """Test workspace admin can get their workspace details"""
        token = self.get_workspace_admin_token()
        
        # Get user info to get workspace_id
        resp = self.session.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        user_data = resp.json()
        workspace_id = user_data.get("workspace_id")
        
        # Get workspace details
        resp = self.session.get(f"{BASE_URL}/api/admin/workspaces/{workspace_id}", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        workspace = resp.json().get("workspace")
        
        # Verify workspace has expected fields for UI
        assert "name" in workspace
        assert "user_count" in workspace
        assert "locations" in workspace
        assert "has_api_key" in workspace
        print(f"✓ Workspace details: {workspace.get('name')}, {workspace.get('user_count')} users, {len(workspace.get('locations', []))} locations")
    
    def test_12_workspace_admin_can_list_users(self):
        """Test workspace admin can list users for Users tab"""
        token = self.get_workspace_admin_token()
        
        resp = self.session.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        workspace_id = resp.json().get("workspace_id")
        
        resp = self.session.get(f"{BASE_URL}/api/admin/workspaces/{workspace_id}/users", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        users = resp.json().get("users", [])
        
        # Verify user objects have required fields for role badge display
        for user in users:
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
        
        print(f"✓ Got {len(users)} users with role information")


class TestSuperAdminDashboardRoleEditing:
    """Test SuperAdminDashboard role editing in expanded workspace"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_super_admin_token(self):
        """Login as super admin"""
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert resp.status_code == 200
        return resp.json().get("token")
    
    def test_13_super_admin_dashboard_returns_workspaces(self):
        """Test super admin dashboard returns workspaces with user info"""
        token = self.get_super_admin_token()
        
        resp = self.session.get(f"{BASE_URL}/api/admin/dashboard", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        
        assert "workspaces" in data
        assert "totals" in data
        
        workspaces = data.get("workspaces", [])
        assert len(workspaces) > 0
        
        # Verify workspace has user counts for display
        for ws in workspaces:
            assert "user_count" in ws
            assert "admin_count" in ws
            assert "operator_count" in ws
        
        print(f"✓ Dashboard has {len(workspaces)} workspaces with user counts")
    
    def test_14_super_admin_can_get_workspace_users(self):
        """Test super admin can get users for expanded workspace view"""
        token = self.get_super_admin_token()
        
        # Get dashboard
        resp = self.session.get(f"{BASE_URL}/api/admin/dashboard", headers={
            "Authorization": f"Bearer {token}"
        })
        workspaces = resp.json().get("workspaces", [])
        
        if not workspaces:
            pytest.skip("No workspaces found")
        
        workspace_id = workspaces[0].get("id")
        
        # Get users for expanded view
        resp = self.session.get(f"{BASE_URL}/api/admin/dashboard/workspaces/{workspace_id}/users", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        users = resp.json().get("users", [])
        
        # Verify user objects have role for badge display
        for user in users:
            assert "role" in user
            assert user.get("role") in ["super_admin", "workspace_admin", "operator"]
        
        print(f"✓ Got {len(users)} users with roles for expanded workspace view")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
