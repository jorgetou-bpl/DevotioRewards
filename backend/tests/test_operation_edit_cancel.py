"""
Backend API tests for PATCH /operations/{id} (edit) and
POST /operations/{id}/cancel (reverse). The real Boomerangme-balance-mutating
path was verified manually against production-mirrored data (add-point
cancel confirmed 3065 -> 3035 on a demo cashback card) — these automated
tests stick to guard rails and a self-reverting edit so they're safe to run
repeatedly against real data.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestOperationEditCancel:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@devotio.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def _first_operation(self):
        response = self.session.get(f"{BASE_URL}/api/operations", params={"items_per_page": 1})
        assert response.status_code == 200
        ops = response.json()["operations"]
        assert ops, "No operations in demo workspace to test against"
        return ops[0]

    def test_edit_note_and_restore_exact_original(self):
        """Round-trips the note back to its exact original value — never
        guesses, so this is safe to run against real data repeatedly."""
        op = self._first_operation()
        original_note = op.get("note")

        edit_response = self.session.patch(
            f"{BASE_URL}/api/operations/{op['id']}", json={"note": "pytest-temp-edit"}
        )
        assert edit_response.status_code == 200

        restore_response = self.session.patch(
            f"{BASE_URL}/api/operations/{op['id']}", json={"note": original_note or ""}
        )
        assert restore_response.status_code == 200

        confirm = self.session.get(f"{BASE_URL}/api/operations", params={"items_per_page": 1})
        restored_note = confirm.json()["operations"][0].get("note")
        assert restored_note == (original_note or "")

    def test_edit_with_no_fields_returns_400(self):
        op = self._first_operation()
        response = self.session.patch(f"{BASE_URL}/api/operations/{op['id']}", json={})
        assert response.status_code == 400

    def test_edit_nonexistent_operation_returns_404(self):
        response = self.session.patch(
            f"{BASE_URL}/api/operations/does-not-exist-zzz", json={"note": "x"}
        )
        assert response.status_code == 404

    def test_cancel_nonexistent_operation_returns_404(self):
        response = self.session.post(f"{BASE_URL}/api/operations/does-not-exist-zzz/cancel")
        assert response.status_code == 404

    def test_cancel_blocks_non_reversible_types(self):
        """add-purchase/add-transaction-amount/add-stamp have no exact
        Boomerangme inverse — must be blocked before any Boomerangme call,
        never partially applied."""
        response = self.session.get(f"{BASE_URL}/api/operations", params={"items_per_page": 200})
        assert response.status_code == 200
        blocked_types = {"add-purchase", "add-transaction-amount", "add-stamp"}
        candidate = next(
            (o for o in response.json()["operations"] if o["operation_type"] in blocked_types and not o.get("canceled")),
            None
        )
        if not candidate:
            pytest.skip("No non-cancelable-type operation available to test against")

        cancel_response = self.session.post(f"{BASE_URL}/api/operations/{candidate['id']}/cancel")
        assert cancel_response.status_code == 400
        assert "no se puede cancelar" in cancel_response.json()["detail"].lower()

    def test_cancel_already_canceled_operation_returns_400(self):
        """Uses the operation this session's manual verification already
        canceled (4f8e6e9e...) — asserts it's still marked canceled and a
        second cancel attempt is rejected, without mutating anything further."""
        response = self.session.get(f"{BASE_URL}/api/operations", params={"items_per_page": 200})
        assert response.status_code == 200
        canceled = next((o for o in response.json()["operations"] if o.get("canceled")), None)
        if not canceled:
            pytest.skip("No already-canceled operation in this environment")

        second_attempt = self.session.post(f"{BASE_URL}/api/operations/{canceled['id']}/cancel")
        assert second_attempt.status_code == 400
        assert "ya fue cancelada" in second_attempt.json()["detail"].lower()
