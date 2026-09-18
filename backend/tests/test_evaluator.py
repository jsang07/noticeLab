from datetime import date

import pytest

from app.models.member import Member
from app.models.rule import AllNode, AnyNode, Condition, conditions
from app.models.simulation import Truth
from app.services.engine.evaluator import evaluate, tri_all, tri_any
from app.services.engine.conflict_detector import resolve_member


def rule(compilation, id):
    return next(r for r in conditions(compilation.baselineEligibility) if r.id == id)


@pytest.mark.parametrize("hire,expected", [("2026-03-31", Truth.TRUE), ("2026-04-01", Truth.FALSE)])
def test_hire_boundary(compilation, hire, expected):
    assert evaluate(rule(compilation, "hire-date"), Member(id="T", hireDate=hire), compilation).truth == expected


@pytest.mark.parametrize("end,expected", [("2026-07-09", Truth.FALSE), ("2026-07-10", Truth.TRUE)])
def test_contract_boundary(fixed_compilation, end, expected):
    assert evaluate(rule(fixed_compilation, "contract-duration"), Member(id="T", contractEndDate=end), fixed_compilation).truth == expected


@pytest.mark.parametrize("end,expected", [("2026-07-09", Truth.UNKNOWN), ("2026-07-10", Truth.TRUE), ("2026-06-30", Truth.FALSE)])
def test_candidate_reference_consensus(compilation, end, expected):
    result = evaluate(rule(compilation, "contract-duration"), Member(id="T", contractEndDate=end), compilation)
    assert result.truth == expected
    assert len(result.evaluations[0].candidates) == 2


def test_normal_member_on_leave(compilation, members):
    result = resolve_member(compilation, members[4])
    assert result.baselineResult == Truth.FALSE
    assert result.status == "EXCLUDED"


def test_on_leave_manager_conflict(compilation, members):
    result = resolve_member(compilation, members[9])
    assert result.status == "CONFLICT"
    assert "UNSPECIFIED_PRECEDENCE" in result.reasonCodes


def test_irrelevant_unknown_in_and(compilation, members):
    member = members[5].model_copy(update={"hireDate": date(2026, 4, 1), "contractEndDate": None})
    result = resolve_member(compilation, member)
    assert result.status == "EXCLUDED"
    assert result.reasonCodes == []


def test_irrelevant_unknown_in_or(compilation, members):
    result = resolve_member(compilation, members[0])
    assert result.status == "INCLUDED"  # Missing contract end on a full-time member is irrelevant.


def test_missing_fact_stays_unknown(compilation, members):
    member = members[5].model_copy(update={"contractEndDate": None})
    result = resolve_member(compilation, member)
    assert result.status == "NEEDS_CLARIFICATION"
    assert "MISSING_MEMBER_FIELD" in result.reasonCodes


@pytest.mark.parametrize("precedence,status", [("OVERRIDE_BASELINE", "INCLUDED"), ("BASELINE_WINS", "EXCLUDED"), ("UNSPECIFIED", "CONFLICT")])
def test_explicit_precedence(compilation, members, precedence, status):
    compilation.exceptions[0].precedence = precedence
    assert resolve_member(compilation, members[9]).status == status


def test_unknown_exception_does_not_block_matching_baseline(compilation, members):
    member = Member.model_validate({**members[0].model_dump(), "managerialLevel": "UNKNOWN"})
    assert resolve_member(compilation, member).status == "INCLUDED"


@pytest.mark.parametrize("a,b,and_expected,or_expected", [
    (Truth.TRUE, Truth.UNKNOWN, Truth.UNKNOWN, Truth.TRUE),
    (Truth.FALSE, Truth.UNKNOWN, Truth.FALSE, Truth.UNKNOWN),
    (Truth.UNKNOWN, Truth.UNKNOWN, Truth.UNKNOWN, Truth.UNKNOWN),
    (Truth.TRUE, Truth.FALSE, Truth.FALSE, Truth.TRUE),
])
def test_truth_tables(a, b, and_expected, or_expected):
    assert tri_all([a, b]) == and_expected
    assert tri_any([a, b]) == or_expected


@pytest.mark.parametrize("op,value,expected", [("EQ", "Product", Truth.TRUE), ("NEQ", "Product", Truth.FALSE),
    ("IN", ["Product", "Design"], Truth.TRUE), ("NOT_IN", ["Product"], Truth.FALSE),
    ("IS_NULL", None, Truth.FALSE), ("IS_NOT_NULL", None, Truth.TRUE)])
def test_operators(compilation, members, op, value, expected):
    node = Condition(id="test", field="department", operator=op, value={"kind": "literal", "type": "null" if value is None else "string_array" if isinstance(value, list) else "string", "value": value},
                     sourceText="test", confidence="HIGH", requiresConfirmation=False)
    assert evaluate(node, members[0], compilation).truth == expected


@pytest.mark.parametrize("field,operator,literal,actual,expected", [
    ("학년", "GTE", {"kind": "literal", "type": "number", "value": 3}, 3, Truth.TRUE),
    ("학년", "IN", {"kind": "literal", "type": "number_array", "value": [2, 3]}, 3, Truth.TRUE),
    ("회원등급", "EQ", {"kind": "literal", "type": "string", "value": "정회원"}, "정회원", Truth.TRUE),
    ("입학일", "LTE", {"kind": "literal", "type": "date", "value": "2024-03-04"}, "2024-03-04", Truth.TRUE),
    ("장학생여부", "EQ", {"kind": "literal", "type": "boolean", "value": True}, True, Truth.TRUE),
    ("학년", "GTE", {"kind": "literal", "type": "number", "value": 3}, "3", Truth.UNKNOWN),
])
def test_custom_field_typed_comparisons(compilation, field, operator, literal, actual, expected):
    node = Condition(id="custom", field=f"customFields.{field}", operator=operator, value=literal,
                     sourceText="custom", confidence="HIGH", requiresConfirmation=False)
    member = Member(id="CUSTOM", customFields={field: actual})
    assert evaluate(node, member, compilation).truth == expected


def test_custom_field_missing_is_unknown(compilation):
    node = Condition(id="custom", field="customFields.학년", operator="GTE",
                     value={"kind": "literal", "type": "number", "value": 3},
                     sourceText="custom", confidence="HIGH", requiresConfirmation=False)
    assert evaluate(node, Member(id="CUSTOM"), compilation).truth == Truth.UNKNOWN
