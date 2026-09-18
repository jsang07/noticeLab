from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Any

from ...models.compilation import NoticeCompilation
from ...models.member import Member
from ...models.rule import RuleNode
from ...models.simulation import CandidateEvaluation, Evaluation, Truth
from .date_resolver import resolve_dates


def tri_all(values: list[Truth]) -> Truth:
    return Truth.FALSE if Truth.FALSE in values else Truth.UNKNOWN if Truth.UNKNOWN in values else Truth.TRUE


def tri_any(values: list[Truth]) -> Truth:
    return Truth.TRUE if Truth.TRUE in values else Truth.UNKNOWN if Truth.UNKNOWN in values else Truth.FALSE


def consensus(values: list[Truth]) -> Truth:
    return values[0] if values and len(set(values)) == 1 else Truth.UNKNOWN


@dataclass
class NodeResult:
    truth: Truth
    evaluations: list[Evaluation]
    decisive: list[Evaluation]


def compare(actual: Any, operator: str, expected: Any) -> Truth:
    operations = {
        "EQ": lambda: actual == expected, "NEQ": lambda: actual != expected,
        "LT": lambda: actual < expected, "LTE": lambda: actual <= expected,
        "GT": lambda: actual > expected, "GTE": lambda: actual >= expected,
        "IN": lambda: actual in expected, "NOT_IN": lambda: actual not in expected,
    }
    try:
        return Truth.TRUE if operations[operator]() else Truth.FALSE
    except (TypeError, ValueError):
        return Truth.UNKNOWN


def coerce_custom(actual: Any, literal_type: str) -> Any:
    """Coerce imported custom values only when their JSON shape is unambiguous."""
    if literal_type == "date":
        if isinstance(actual, date):
            return actual
        if isinstance(actual, str):
            try:
                return date.fromisoformat(actual)
            except ValueError:
                return None
        return None
    if literal_type in ("number", "number_array"):
        return actual if type(actual) in (int, float) else None
    if literal_type == "boolean":
        return actual if isinstance(actual, bool) else None
    if literal_type in ("string", "string_array"):
        return actual if isinstance(actual, str) else None
    return actual


def evaluate(node: RuleNode, member: Member, compilation: NoticeCompilation) -> NodeResult:
    if node.kind != "condition":
        children = [evaluate(child, member, compilation) for child in node.children]
        truth = (tri_all if node.kind == "all" else tri_any)([c.truth for c in children])
        # Only decisive branches contribute reasons. Keep all traces for auditability.
        relevant = [c for c in children if c.truth == truth]
        return NodeResult(truth, [e for c in children for e in c.evaluations],
                          [e for c in relevant for e in c.decisive])
    actual = member.customFields.get(node.field.removeprefix("customFields.")) if node.field.startswith("customFields.") else getattr(member, node.field)
    if isinstance(actual, Enum):
        actual = actual.value
    missing = actual is None or actual == "UNKNOWN"
    expected = node.value.model_dump(mode="json")
    reasons = []
    candidates = []
    if node.operator in ("IS_NULL", "IS_NOT_NULL"):
        truth = Truth.TRUE if missing == (node.operator == "IS_NULL") else Truth.FALSE
    elif missing:
        truth, reasons = Truth.UNKNOWN, ["MISSING_MEMBER_FIELD"]
    elif node.value.kind == "relative_date":
        for anchor_id, threshold in resolve_dates(node.value, compilation):
            candidates.append(CandidateEvaluation(anchorId=anchor_id, threshold=threshold.isoformat(),
                                                  result=compare(actual, node.operator, threshold)))
        truth = consensus([c.result for c in candidates])
        if truth == Truth.UNKNOWN:
            reasons = ["MISSING_REFERENCE"]
    else:
        expected = date.fromisoformat(node.value.value) if node.value.type == "date" else node.value.value
        if node.field.startswith("customFields."):
            actual = coerce_custom(actual, node.value.type)
            if actual is None:
                truth, reasons = Truth.UNKNOWN, ["MISSING_MEMBER_FIELD"]
                evaluation = Evaluation(ruleId=node.id, sourceText=node.sourceText, field=node.field,
                                        operator=node.operator, actual=actual, expected=expected, result=truth,
                                        reasonCodes=reasons, candidates=candidates)
                return NodeResult(truth, [evaluation], [evaluation])
        truth = compare(actual, node.operator, expected)
        if truth == Truth.UNKNOWN:
            reasons = ["MISSING_MEMBER_FIELD"]
    if node.requiresConfirmation:
        truth = Truth.UNKNOWN
        reasons = sorted(set(reasons + ["RULE_AMBIGUITY"]))
    evaluation = Evaluation(ruleId=node.id, sourceText=node.sourceText, field=node.field,
                            operator=node.operator, actual=actual, expected=expected, result=truth,
                            reasonCodes=reasons, candidates=candidates)
    return NodeResult(truth, [evaluation], [evaluation])
