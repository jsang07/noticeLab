"""Bounded, reproducible boundary tests derived only from the eligibility AST.

All constructed values are synthetic test inputs, never normalized member facts.
No provider calls, random choices, wall clock dates, or sample-specific rule IDs.
"""
from datetime import date, timedelta
from itertools import product

from ...models.compilation import NoticeCompilation
from ...models.member import Member
from ...models.rule import Condition, ENUM_FIELDS, RuleNode, conditions
from ...models.simulation import Persona
from .date_resolver import anchor_date, resolve_dates

MAX_PERSONAS = 12

# Presentation only. Member field names, enum values, and generated inputs stay unchanged.
FIELD_LABELS = {"hireDate": "입사일", "contractEndDate": "계약 종료일", "employmentType": "고용 형태",
                "employmentStatus": "재직 상태", "managerialLevel": "직책"}
ENUM_LABELS = {"FULL_TIME": "정규직", "CONTRACT": "계약직", "INTERN": "인턴", "PART_TIME": "파트타임",
               "VENDOR": "외부 인력", "ACTIVE": "재직", "ON_LEAVE": "휴직", "TERMINATED": "퇴직",
               "TEAM_LEAD": "팀장", "DEPARTMENT_HEAD": "부서장", "EXECUTIVE": "임원", "IC": "일반 구성원"}


def branches(node: RuleNode) -> list[list[Condition]]:
    """Small bounded DNF expansion to retain the context of an OR branch."""
    if node.kind == "condition":
        return [[node]]
    if node.kind == "any":
        return [branch for child in node.children for branch in branches(child)][:24]
    result = [[]]
    for child in node.children:
        result = [(left + right) for left, right in product(result, branches(child))][:24]
    return result


def thresholds(rule: Condition, compilation: NoticeCompilation) -> list[date]:
    if rule.value.kind == "relative_date":
        return sorted({value for _, value in resolve_dates(rule.value, compilation)})
    if rule.value.type == "date":
        return [date.fromisoformat(rule.value.value)]
    return []


def example_value(rule: Condition, compilation: NoticeCompilation, *, passing: bool = True):
    dates = thresholds(rule, compilation)
    if dates:
        boundary = max(dates) if rule.operator in ("GT", "GTE") else min(dates)
        shift = {"EQ": 0, "NEQ": 1, "LTE": 0, "LT": -1, "GTE": 0, "GT": 1}[rule.operator] if passing else {
            "EQ": 1, "NEQ": 0, "LTE": 1, "LT": 0, "GTE": -1, "GT": 0}[rule.operator]
        if not passing and rule.operator in ("GT", "GTE"):
            boundary = min(dates)
        return (boundary + timedelta(days=shift)).isoformat()
    if rule.operator in ("IS_NULL", "IS_NOT_NULL"):
        if passing == (rule.operator == "IS_NULL"):
            return None
        if rule.field in ("hireDate", "contractEndDate"):
            return anchor_date(compilation.anchors[0], compilation.timezone).isoformat() if compilation.anchors else "2000-01-01"
        if rule.field in ENUM_FIELDS:
            return next(item.value for item in ENUM_FIELDS[rule.field] if item.value != "UNKNOWN")
        return "synthetic"
    if rule.value.kind != "literal":
        return None
    value = rule.value.value
    if rule.field in ENUM_FIELDS:
        choices = [item.value for item in ENUM_FIELDS[rule.field] if item.value != "UNKNOWN"]
        values = value if isinstance(value, list) else [value]
        include = passing == (rule.operator in ("EQ", "IN"))
        return next((item for item in choices if (item in values) == include), "UNKNOWN")
    if isinstance(value, list):
        return value[0] if value and passing == (rule.operator == "IN") else "synthetic-other"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        shift = {"GT": 1, "LT": -1, "NEQ": 1}.get(rule.operator, 0) if passing else {"GTE": -1, "LTE": 1, "EQ": 1}.get(rule.operator, 0)
        return value + shift
    return value if passing == (rule.operator == "EQ") else "synthetic-other"


def assign(values: dict, field: str, value):
    if field.startswith("customFields."):
        values.setdefault("customFields", {})[field.removeprefix("customFields.")] = value
    else:
        values[field] = "UNKNOWN" if field in ENUM_FIELDS and value is None else value


def generate_personas(compilation: NoticeCompilation) -> list[Persona]:
    paths = branches(compilation.baselineEligibility)
    leaves = conditions(compilation.baselineEligibility)
    personas: list[Persona] = []
    fingerprints = set()

    def seed(target: Condition | None = None) -> dict:
        path = next((path for path in paths if target is not None and any(r.id == target.id for r in path)), paths[0])
        # Explicitly synthetic defaults. Real members never pass through this function.
        values = dict(id="synthetic", name="가상 구성원", department="Synthetic", positionTitle="Test persona",
                      employmentType="FULL_TIME", employmentStatus="ACTIVE", managerialLevel="IC",
                      hireDate=None, contractEndDate=None, customFields={})
        for rule in path:
            value = example_value(rule, compilation)
            if value is not None or rule.operator == "IS_NULL":
                assign(values, rule.field, value)
        return values

    def append(label: str, values: dict, rule_ids: list[str]):
        if len(personas) >= MAX_PERSONAS:
            return
        member = Member.model_validate(values)
        fingerprint = member.model_dump_json(exclude={"id", "name"})
        if fingerprint in fingerprints:
            return
        fingerprints.add(fingerprint)
        id_ = f"P{len(personas) + 1:02}"
        member.id, member.name = id_, f"테스트 {len(personas) + 1:02}"
        personas.append(Persona(id=id_, label=label, member=member, generatedFromRuleIds=list(dict.fromkeys(rule_ids))))

    # Reserve space for enums and interactions: first two temporal boundaries.
    date_rules = [rule for rule in leaves if thresholds(rule, compilation)][:2]
    for rule in date_rules:
        dates = thresholds(rule, compilation)
        boundary = max(dates)
        for shift, label in [(-1, "기준일 하루 전"), (0, "기준일 당일"), (1, "기준일 하루 후")]:
            values = seed(rule)
            assign(values, rule.field, (boundary + timedelta(days=shift)).isoformat())
            append(f"{FIELD_LABELS.get(rule.field, rule.field)} {label} · {boundary.isoformat()}", values, [rule.id])

    # Explore allowed alternatives and one excluded enum value, using actual predicates.
    enum_rules = [rule for rule in leaves if rule.field in ENUM_FIELDS and rule.operator in ("EQ", "IN")]
    if enum_rules:
        field = enum_rules[0].field
        matching = [rule for rule in enum_rules if rule.field == field]
        allowed = []
        for rule in matching:
            value = rule.value.value
            for item in (value if isinstance(value, list) else [value]):
                if item not in allowed:
                    allowed.append(item)
        excluded = next((item.value for item in ENUM_FIELDS[field] if item.value != "UNKNOWN" and item.value not in allowed), None)
        for item in allowed[:2] + ([excluded] if excluded else []):
            rule = next((r for r in matching if item == r.value.value or isinstance(r.value.value, list) and item in r.value.value), matching[0])
            values = seed(rule)
            assign(values, field, item)
            append(f"{FIELD_LABELS.get(field, field)} · {ENUM_LABELS.get(item, item)}", values, [r.id for r in matching])

    # Pair a matching exception with baseline failures (contract-duration, leave, etc.).
    # Predicates provide both fields and values; no sample-specific date or manager constant.
    for exception in compilation.exceptions[:1]:
        exception_path = branches(exception.when)[0]
        pair_rules = [r for r in leaves if r.value.kind == "relative_date"] + [r for r in leaves if r.operator in ("NEQ", "NOT_IN")]
        for rule in pair_rules[:2]:
            values = seed(rule)
            assign(values, rule.field, example_value(rule, compilation, passing=False))
            for predicate in exception_path:
                assign(values, predicate.field, example_value(predicate, compilation))
            append(f"예외 규칙 × {FIELD_LABELS.get(rule.field, rule.field)} 경계", values, [rule.id, exception.id, *[p.id for p in exception_path]])

    # The earliest anchor is also useful when an unresolved date has several candidates.
    for rule in date_rules:
        dates = thresholds(rule, compilation)
        if len(dates) > 1:
            values = seed(rule)
            assign(values, rule.field, dates[0].isoformat())
            append(f"가장 이른 기준일 경계 · {dates[0].isoformat()}", values, [rule.id])

    # Resolved rules may have no exceptions. Fill remaining slots with enum alternatives.
    for rule in leaves:
        if rule.field in ENUM_FIELDS:
            for item in ENUM_FIELDS[rule.field]:
                if item.value != "UNKNOWN":
                    values = seed(rule)
                    assign(values, rule.field, item.value)
                    append(f"{FIELD_LABELS.get(rule.field, rule.field)} · {ENUM_LABELS.get(item.value, item.value)}", values, [rule.id])
    if not personas:
        append("기본 조건 테스트", seed(), [r.id for r in leaves])
    return personas
