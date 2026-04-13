"""
Super Admin Dashboard API Tests
Tests for:
- POST /api/admin/verify-master-code - Master code verification
- GET /api/admin/dashboard - Dashboard with all workspaces and stats
- GET /api/admin/dashboard/workspaces/{id}/users - Get workspace users
- POST /api/admin/dashboard/users/{id}/reset-password - Reset user password
- PATCH /api/admin/dashboard/workspaces/{id}/toggle-active - Toggle workspace status
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "demo@devotio.com"
SUPER_ADMIN_PASSWORD = "demo123"
MASTER_CODE = "DEVOTIO-2026-ADMIN"
CAFE_ADMIN_EMAIL = "admin@cafedemo.com"
CAFE_ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def super_admin_token(api_client):
    """Get super admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Super admin authentication failed: {response.text}")


@pytest.fixture(scope="module")
def cafe_admin_token(api_client):
    """Get cafe admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": CAFE_ADMIN_EMAIL,
        "password": CAFE_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Cafe admin authentication failed: {response.text}")


class TestMasterCodeVerification:
    """Tests for POST /api/admin/verify-master-code"""
    
    def test_verify_correct_master_code(self, api_client):
        """Test that correct master code returns success"""
        response = api_client.post(f"{BASE_URL}/api/admin/verify-master-code", json={
            "master_code": MASTER_CODE
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Correct master code verification passed")
    
    def test_verify_wrong_master_code(self, api_client):
        """Test that wrong master code returns 403"""
        response = api_client.post(f"{BASE_URL}/api/admin/verify-master-code", json={
            "master_code": "WRONG-CODE-123"
        })
        assert response.status_code == 403
        print(f"✓ Wrong master code correctly rejected with 403")
    
    def test_verify_empty_master_code(self, api_client):
        """Test that empty master code returns 403"""
        response = api_client.post(f"{BASE_URL}/api/admin/verify-master-code", json={
            "master_code": ""
        })
        assert response.status_code == 403
        print(f"✓ Empty master code correctly rejected with 403")


class TestDashboardEndpoint:
    """Tests for GET /api/admin/dashboard"""
    
    def test_dashboard_requires_auth(self, api_client):
        """Test that dashboard requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code in [401, 403]
        print(f"✓ Dashboard correctly requires authentication")
    
    def test_dashboard_requires_super_admin(self, api_client, cafe_admin_token):
        """Test that dashboard requires super_admin role"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {cafe_admin_token}"}
        )
        assert response.status_code == 403
        print(f"✓ Dashboard correctly rejects non-super_admin users")
    
    def test_dashboard_returns_data(self, api_client, super_admin_token):
        """Test that dashboard returns workspaces and totals"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "success" in data
        assert data["success"] == True
        assert "workspaces" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "workspaces" in totals
        assert "users" in totals
        assert "operations" in totals
        assert isinstance(totals["workspaces"], int)
        assert isinstance(totals["users"], int)
        assert isinstance(totals["operations"], int)
        
        # Verify workspaces structure
        workspaces = data["workspaces"]
        assert isinstance(workspaces, list)
        assert len(workspaces) > 0
        
        # Check first workspace has required fields
        ws = workspaces[0]
        required_fields = ["id", "name", "slug", "active", "user_count", "operations_count"]
        for field in required_fields:
            assert field in ws, f"Missing field: {field}"
        
        print(f"✓ Dashboard returns {len(workspaces)} workspaces, {totals['users']} users, {totals['operations']} operations")


class TestWorkspaceUsersEndpoint:
    """Tests for GET /api/admin/dashboard/workspaces/{id}/users"""
    
    def test_get_workspace_users_requires_super_admin(self, api_client, cafe_admin_token):
        """Test that getting workspace users requires super_admin"""
        # First get a workspace ID
        response = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {cafe_admin_token}"}
        )
        # Should fail because cafe_admin is not super_admin
        assert response.status_code == 403
        print(f"✓ Workspace users endpoint correctly requires super_admin")
    
    def test_get_workspace_users_success(self, api_client, super_admin_token):
        """Test getting users for a workspace"""
        # First get workspaces
        dashboard_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert dashboard_resp.status_code == 200
        workspaces = dashboard_resp.json()["workspaces"]
        
        # Find a workspace with users
        ws_with_users = None
        for ws in workspaces:
            if ws["user_count"] > 0:
                ws_with_users = ws
                break
        
        if not ws_with_users:
            pytest.skip("No workspace with users found")
        
        # Get users for that workspace
        response = api_client.get(
            f"{BASE_URL}/api/admin/dashboard/workspaces/{ws_with_users['id']}/users",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "users" in data
        assert isinstance(data["users"], list)
        
        # Check user structure
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
            # Ensure password is not exposed
            assert "password" not in user
            assert "hashed_password" not in user
        
        print(f"✓ Got {len(data['users'])} users for workspace '{ws_with_users['name']}'")


class TestResetPasswordEndpoint:
    """Tests for POST /api/admin/dashboard/users/{id}/reset-password"""
    
    def test_reset_password_requires_master_code(self, api_client, super_admin_token):
        """Test that reset password requires master code"""
        # Get a user ID first
        dashboard_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        workspaces = dashboard_resp.json()["workspaces"]
        
        # Find workspace with users
        ws_with_users = None
        for ws in workspaces:
            if ws["user_count"] > 0:
                ws_with_users = ws
                break
        
        if not ws_with_users:
            pytest.skip("No workspace with users found")
        
        # Get users
        users_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard/workspaces/{ws_with_users['id']}/users",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        users = users_resp.json()["users"]
        
        if len(users) == 0:
            pytest.skip("No users found")
        
        # Try reset without master code
        response = api_client.post(
            f"{BASE_URL}/api/admin/dashboard/users/{users[0]['id']}/reset-password",
            json={"master_code": "WRONG-CODE"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 403
        print(f"✓ Reset password correctly requires valid master code")
    
    def test_reset_password_auto_mode(self, api_client, super_admin_token):
        """Test auto-generated password reset"""
        # Get cafe admin user
        dashboard_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        workspaces = dashboard_resp.json()["workspaces"]
        
        # Find Cafe Demo workspace
        cafe_ws = None
        for ws in workspaces:
            if "cafe" in ws["name"].lower() or "cafe" in ws["slug"].lower():
                cafe_ws = ws
                break
        
        if not cafe_ws:
            pytest.skip("Cafe Demo workspace not found")
        
        # Get users
        users_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard/workspaces/{cafe_ws['id']}/users",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        users = users_resp.json()["users"]
        
        # Find cafe admin user
        cafe_admin = None
        for u in users:
            if u["email"] == CAFE_ADMIN_EMAIL:
                cafe_admin = u
                break
        
        if not cafe_admin:
            pytest.skip("Cafe admin user not found")
        
        # Reset password with auto mode (no new_password provided)
        response = api_client.post(
            f"{BASE_URL}/api/admin/dashboard/users/{cafe_admin['id']}/reset-password",
            json={"master_code": MASTER_CODE},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "new_password" in data
        assert data["new_password"].startswith("Temp-")
        assert "user_email" in data
        
        new_password = data["new_password"]
        print(f"✓ Auto password reset successful. New password: {new_password}")
        
        # Verify new password works
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": CAFE_ADMIN_EMAIL,
            "password": new_password
        })
        assert login_resp.status_code == 200
        print(f"✓ Login with new auto-generated password successful")
        
        # Reset back to original password
        reset_back = api_client.post(
            f"{BASE_URL}/api/admin/dashboard/users/{cafe_admin['id']}/reset-password",
            json={"master_code": MASTER_CODE, "new_password": CAFE_ADMIN_PASSWORD},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert reset_back.status_code == 200
        print(f"✓ Password reset back to original")
    
    def test_reset_password_manual_mode(self, api_client, super_admin_token):
        """Test manual password reset"""
        # Get cafe admin user
        dashboard_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        workspaces = dashboard_resp.json()["workspaces"]
        
        # Find Cafe Demo workspace
        cafe_ws = None
        for ws in workspaces:
            if "cafe" in ws["name"].lower() or "cafe" in ws["slug"].lower():
                cafe_ws = ws
                break
        
        if not cafe_ws:
            pytest.skip("Cafe Demo workspace not found")
        
        # Get users
        users_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard/workspaces/{cafe_ws['id']}/users",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        users = users_resp.json()["users"]
        
        # Find cafe admin user
        cafe_admin = None
        for u in users:
            if u["email"] == CAFE_ADMIN_EMAIL:
                cafe_admin = u
                break
        
        if not cafe_admin:
            pytest.skip("Cafe admin user not found")
        
        # Reset with manual password
        manual_password = "TestManual123!"
        response = api_client.post(
            f"{BASE_URL}/api/admin/dashboard/users/{cafe_admin['id']}/reset-password",
            json={"master_code": MASTER_CODE, "new_password": manual_password},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["new_password"] == manual_password
        print(f"✓ Manual password reset successful")
        
        # Verify new password works
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": CAFE_ADMIN_EMAIL,
            "password": manual_password
        })
        assert login_resp.status_code == 200
        print(f"✓ Login with manual password successful")
        
        # Reset back to original password
        reset_back = api_client.post(
            f"{BASE_URL}/api/admin/dashboard/users/{cafe_admin['id']}/reset-password",
            json={"master_code": MASTER_CODE, "new_password": CAFE_ADMIN_PASSWORD},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert reset_back.status_code == 200
        print(f"✓ Password reset back to original")


class TestToggleWorkspaceActive:
    """Tests for PATCH /api/admin/dashboard/workspaces/{id}/toggle-active"""
    
    def test_toggle_requires_super_admin(self, api_client, cafe_admin_token):
        """Test that toggle requires super_admin role"""
        response = api_client.patch(
            f"{BASE_URL}/api/admin/dashboard/workspaces/some-id/toggle-active",
            headers={"Authorization": f"Bearer {cafe_admin_token}"}
        )
        assert response.status_code == 403
        print(f"✓ Toggle workspace correctly requires super_admin")
    
    def test_toggle_workspace_active_status(self, api_client, super_admin_token):
        """Test toggling workspace active status"""
        # Get workspaces
        dashboard_resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        workspaces = dashboard_resp.json()["workspaces"]
        
        # Find Cafe Demo workspace
        cafe_ws = None
        for ws in workspaces:
            if "cafe" in ws["name"].lower() or "cafe" in ws["slug"].lower():
                cafe_ws = ws
                break
        
        if not cafe_ws:
            pytest.skip("Cafe Demo workspace not found")
        
        original_status = cafe_ws["active"]
        
        # Toggle status
        response = api_client.patch(
            f"{BASE_URL}/api/admin/dashboard/workspaces/{cafe_ws['id']}/toggle-active",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["active"] == (not original_status)
        assert "message" in data
        print(f"✓ Toggled workspace from {original_status} to {data['active']}")
        
        # Verify change persisted
        dashboard_resp2 = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        workspaces2 = dashboard_resp2.json()["workspaces"]
        cafe_ws2 = next((ws for ws in workspaces2 if ws["id"] == cafe_ws["id"]), None)
        assert cafe_ws2["active"] == (not original_status)
        print(f"✓ Status change persisted in database")
        
        # Toggle back to original
        response2 = api_client.patch(
            f"{BASE_URL}/api/admin/dashboard/workspaces/{cafe_ws['id']}/toggle-active",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response2.status_code == 200
        assert response2.json()["active"] == original_status
        print(f"✓ Toggled back to original status: {original_status}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
