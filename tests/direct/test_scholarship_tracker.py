"""Behavioral tests for Scholarship Tracker."""

import json

import pytest

CONTRACT = "contracts/scholarship_tracker.py"
SDK_VERSION = "v0.2.16"
POOL = 100_000_000_000_000_000  # 0.1 GEN
EPOCH_PAY = 20_000_000_000_000_000  # 0.02 GEN
STAKE = 10_000_000_000_000_000  # 0.01 GEN
EPOCH_SECS = 60
_DIRECT_VM = None

CONDITIONS = (
    "Each epoch, publish a public progress report URL (blog or GitHub README) "
    "updated within the epoch. Private GPA screenshots alone are not enough."
)


def _review(verdict: str) -> str:
    return json.dumps(
        {
            "verdict": verdict,
            "confidence": 8,
            "reasoning": "Mocked epoch review.",
            "conditions_met": verdict == "PASS",
        }
    )


def _claim(verdict: str) -> str:
    return json.dumps(
        {
            "verdict": verdict,
            "confidence": 8,
            "reasoning": "Mocked claim arbitration.",
        }
    )


def _web(body: str) -> dict:
    return {"method": "GET", "status": 200, "body": body}


@pytest.fixture
def contract(direct_vm, direct_deploy, direct_alice):
    global _DIRECT_VM
    _DIRECT_VM = direct_vm
    direct_vm.mock_web(r".*", _web("Monthly progress report — commits updated."))
    direct_vm.mock_llm(r".*", _review("PASS"))
    direct_vm.sender = direct_alice
    return direct_deploy(CONTRACT, sdk_version=SDK_VERSION)


def _payable(contract, method: str, *args, value: int):
    previous = _DIRECT_VM.value
    _DIRECT_VM.value = value
    try:
        return getattr(contract, method)(*args)
    finally:
        _DIRECT_VM.value = previous


def _amend(contract, conditions: str, reason: str, *, material: bool = True, value: int = EPOCH_PAY):
    return _payable(
        contract,
        "amend_conditions",
        0,
        conditions,
        reason,
        1 if material else 0,
        value=value,
    )


def _create(contract):
    _payable(
        contract,
        "create_scholarship",
        "Builder Grant",
        CONDITIONS,
        EPOCH_SECS,
        EPOCH_PAY,
        value=POOL,
    )


def _offer_and_accept(contract, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract.award_student(0, direct_bob.as_hex)
    direct_vm.sender = direct_bob
    contract.accept_award(0)


class TestCreateAndAward:
    def test_create_scholarship(self, contract):
        _create(contract)
        s = contract.get_scholarship(0)
        assert s["status"] == "ACTIVE"
        assert s["pool_balance"] == POOL
        assert s["amount_per_epoch"] == EPOCH_PAY
        assert "GitHub" in s["conditions"]

    def test_award_requires_accept(self, contract, direct_vm, direct_bob):
        _create(contract)
        contract.award_student(0, direct_bob.as_hex)
        awards = contract.get_scholarship_awards(0)
        assert awards[0]["status"] == "OFFERED"
        assert awards[0]["accepted_conditions_version"] == 0
        assert contract.get_scholarship(0)["active_award_count"] == 1

        direct_vm.sender = direct_bob
        contract.accept_award(0)
        award = contract.get_award(0)
        assert award["status"] == "ACTIVE"
        assert award["accepted_conditions_version"] == 1
        assert award["accepted_conditions"] == CONDITIONS
        assert award["epoch_deadline"] > 0
        assert award["reserved_amount"] == EPOCH_PAY
        s = contract.get_scholarship(0)
        assert s["reserved_balance"] == EPOCH_PAY
        assert s["available_balance"] == POOL - EPOCH_PAY

    def test_leave_offer(self, contract, direct_vm, direct_bob):
        _create(contract)
        contract.award_student(0, direct_bob.as_hex)
        direct_vm.sender = direct_bob
        contract.leave_award(0)
        assert contract.get_award(0)["status"] == "LEFT"
        assert contract.get_scholarship(0)["active_award_count"] == 0

    def test_award_after_amend(self, contract, direct_vm, direct_alice, direct_bob):
        _create(contract)
        _amend(
            contract,
            "Must post weekly public demos on a public URL.",
            "Tighten reporting cadence",
            material=True,
        )
        assert contract.get_scholarship(0)["status"] == "AMENDED"
        contract.award_student(0, direct_bob.as_hex)
        direct_vm.sender = direct_bob
        contract.accept_award(0)
        assert contract.get_award(0)["accepted_conditions_version"] == 2


class TestEpochReview:
    def test_pass_releases_stipend(self, contract, direct_vm, direct_alice, direct_bob):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)
        contract.submit_proof(
            0,
            "Published monthly report with new commits.",
            "https://example.com/report-1",
        )
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("Monthly progress report — commits updated."))
        direct_vm.mock_llm(r".*", _review("PASS"))
        contract.review_epoch(0)

        award = contract.get_award(0)
        assert award["status"] == "ACTIVE"
        assert award["current_epoch"] == 1
        assert award["total_released"] == EPOCH_PAY
        assert award["reserved_amount"] == EPOCH_PAY
        s = contract.get_scholarship(0)
        assert s["pool_balance"] == POOL - EPOCH_PAY
        assert s["reserved_balance"] == EPOCH_PAY
        reviews = contract.get_award_reviews(0)
        assert reviews[0]["verdict"] == "PASS"
        assert reviews[0]["amount_released"] == EPOCH_PAY
        assert reviews[0]["evidence_snapshot"]

    def test_warn_then_fail_cuts(self, contract, direct_vm, direct_alice, direct_bob):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)

        contract.submit_proof(0, "Weak notes only", "https://example.com/weak")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("weak page"))
        direct_vm.mock_llm(r".*", _review("WARN"))
        contract.review_epoch(0)
        assert contract.get_award(0)["status"] == "AT_RISK"
        assert contract.get_award(0)["warn_count"] == 1

        contract.submit_proof(0, "Still insufficient", "https://example.com/weak2")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("weak page 2"))
        direct_vm.mock_llm(r".*", _review("FAIL"))
        contract.review_epoch(0)
        award = contract.get_award(0)
        assert award["status"] == "CUT"
        assert award["reserved_amount"] == 0
        assert contract.get_scholarship(0)["active_award_count"] == 0
        assert contract.get_scholarship(0)["reserved_balance"] == 0


class TestAmendAndClaim:
    def test_amend_conditions(self, contract):
        _create(contract)
        _amend(
            contract,
            "Must post weekly public demos on a public URL.",
            "Tighten reporting cadence",
            material=True,
        )
        s = contract.get_scholarship(0)
        assert s["status"] == "AMENDED"
        assert s["version"] == 2
        assert s["pool_balance"] == POOL + EPOCH_PAY
        amendments = contract.get_scholarship_amendments(0)
        assert amendments[0]["old_conditions"] == CONDITIONS
        assert amendments[0]["kind"] == "MATERIAL"

    def test_student_claim_after_cut(self, contract, direct_vm, direct_alice, direct_bob):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)

        contract.submit_proof(0, "ok", "https://example.com/a")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("WARN"))
        contract.review_epoch(0)
        contract.submit_proof(0, "still", "https://example.com/b")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("FAIL"))
        contract.review_epoch(0)
        assert contract.get_award(0)["status"] == "CUT"
        assert contract.get_award(0)["claim_window_ends"] > 0

        _payable(
            contract,
            "file_claim",
            0,
            "Cut despite public report meeting original conditions.",
            "Report was updated; conditions were later tightened unfairly.",
            "https://example.com/proof",
            value=EPOCH_PAY,
        )
        claim = contract.get_claim(0)
        assert claim["challenged_verdict"] in ("FAIL", "WARN")
        assert claim["student_snapshot_at"] > 0
        assert claim["claim_kind"] == "CUT"
        assert claim["contested_amount"] == EPOCH_PAY

        direct_vm.sender = direct_alice
        contract.respond_to_claim(
            0,
            "Student missed the published cadence; cut was justified.",
            "https://example.com/sponsor-record",
        )
        claim = contract.get_claim(0)
        assert claim["sponsor_responded_at"] > 0

        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _claim("STUDENT_WINS"))
        contract.judge_claim(0)
        claim = contract.get_claim(0)
        assert claim["status"] == "JUDGED"
        assert claim["verdict"] == "STUDENT_WINS"
        assert contract.get_award(0)["status"] == "ACTIVE"
        assert contract.get_award(0)["reserved_amount"] == EPOCH_PAY

    def test_cannot_amend_during_open_claim(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)
        contract.submit_proof(0, "ok", "https://example.com/a")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("WARN"))
        contract.review_epoch(0)
        contract.submit_proof(0, "still", "https://example.com/b")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("FAIL"))
        contract.review_epoch(0)
        _payable(
            contract,
            "file_claim",
            0,
            "Unfair cut",
            "notes",
            "https://example.com/proof",
            value=EPOCH_PAY,
        )
        with pytest.raises(Exception):
            _amend(contract, "Changed while claim open", "bad", material=True)

    def test_left_cannot_claim(self, contract, direct_vm, direct_alice, direct_bob):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)
        direct_vm.sender = direct_bob
        contract.leave_award(0)
        with pytest.raises(Exception):
            _payable(
                contract,
                "file_claim",
                0,
                "after leave",
                "notes",
                "https://example.com/x",
                value=EPOCH_PAY,
            )

    def test_self_award_forbidden(self, contract, direct_alice):
        _create(contract)
        with pytest.raises(Exception):
            contract.award_student(0, direct_alice.as_hex)

    def test_private_url_rejected(self, contract, direct_vm, direct_alice, direct_bob):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)
        with pytest.raises(Exception):
            contract.submit_proof(0, "notes", "http://localhost/secret")

    def test_claim_stake_must_cover_epoch(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)
        contract.submit_proof(0, "ok", "https://example.com/a")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("WARN"))
        contract.review_epoch(0)
        contract.submit_proof(0, "still", "https://example.com/b")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("FAIL"))
        contract.review_epoch(0)
        with pytest.raises(Exception):
            _payable(
                contract,
                "file_claim",
                0,
                "cheap claim",
                "notes",
                "https://example.com/proof",
                value=STAKE,  # 0.01 < epoch 0.02
            )

    def test_close_blocked_while_claim_window(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _offer_and_accept(contract, direct_vm, direct_alice, direct_bob)
        contract.submit_proof(0, "ok", "https://example.com/a")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("WARN"))
        contract.review_epoch(0)
        contract.submit_proof(0, "still", "https://example.com/b")
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("page"))
        direct_vm.mock_llm(r".*", _review("FAIL"))
        contract.review_epoch(0)
        # Award CUT → claim window open, active_award_count 0, but window blocks close.
        with pytest.raises(Exception):
            contract.close_scholarship(0)


class TestClose:
    def test_close_returns_pool(self, contract):
        _create(contract)
        contract.close_scholarship(0)
        s = contract.get_scholarship(0)
        assert s["closed"] is True
        assert s["status"] == "CLOSED"
        assert s["pool_balance"] == 0
