from itertools import product

from ...models.compilation import NoticeCompilation
from ...models.member import Member
from ...models.simulation import MemberResult, Truth
from .evaluator import evaluate


def possible(truth: Truth) -> list[bool]:
    return [True, False] if truth == Truth.UNKNOWN else [truth == Truth.TRUE]


def resolve_member(compilation: NoticeCompilation, member: Member) -> MemberResult:
    baseline = evaluate(compilation.baselineEligibility, member, compilation)
    exceptions = [(rule, evaluate(rule.when, member, compilation)) for rule in compilation.exceptions]
    outcomes = set()
    # Bounded (<=8 exceptions). Unknown predicates explore both possibilities.
    # Definitive contradictory effects are conflicts; uncertain contradictions need clarification.
    for base, *matches in product(possible(baseline.truth), *(possible(result.truth) for _, result in exceptions)):
        applicable = [rule for (rule, _), match in zip(exceptions, matches) if match]
        overrides = {rule.effect == "INCLUDE" for rule in applicable if rule.precedence == "OVERRIDE_BASELINE"}
        effects = overrides or {base}
        effects |= {rule.effect == "INCLUDE" for rule in applicable if rule.precedence == "UNSPECIFIED"}
        outcomes.add("CONFLICT" if len(effects) > 1 else "INCLUDED" if True in effects else "EXCLUDED")
    status = next(iter(outcomes)) if len(outcomes) == 1 else "NEEDS_CLARIFICATION"
    reasons = set()
    decisive = baseline.decisive
    active = [(rule, result) for rule, result in exceptions if result.truth != Truth.FALSE]
    if status == "NEEDS_CLARIFICATION":
        reasons.update(reason for e in baseline.decisive for reason in e.reasonCodes)
        for _, result in active:
            reasons.update(reason for e in result.decisive for reason in e.reasonCodes)
        if not reasons:
            reasons.add("RULE_AMBIGUITY")
    elif status == "CONFLICT":
        reasons.add("CONTRADICTORY_RULES")
        if any(rule.precedence == "UNSPECIFIED" for rule, _ in active):
            reasons.add("UNSPECIFIED_PRECEDENCE")
    summaries = {
        "INCLUDED": "적용 가능한 규칙에 따라 지원 대상입니다.",
        "EXCLUDED": "명시된 지원 조건을 충족하지 않습니다.",
        "NEEDS_CLARIFICATION": "누락된 정보 또는 규칙 해석에 따라 결과가 달라집니다.",
        "CONFLICT": "포함과 제외 규칙이 충돌하며 우선순위가 정해지지 않았습니다.",
    }
    return MemberResult(memberId=member.id, status=status, baselineResult=baseline.truth,
                        reasonCodes=sorted(reasons), summary=summaries[status],
                        evaluations=baseline.evaluations + [e for _, r in exceptions for e in r.evaluations],
                        decisiveRuleIds=sorted({e.ruleId for e in decisive} |
                                               {rule.id for rule, _ in active} |
                                               {e.ruleId for _, r in active for e in r.decisive}),
                        applicableExceptionIds=[rule.id for rule, r in active if r.truth == Truth.TRUE])
