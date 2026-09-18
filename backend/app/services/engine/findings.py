from ...models.compilation import NoticeCompilation
from ...models.simulation import Finding, MemberResult

TITLES = {"MISSING_REFERENCE": "잔여 기간의 기준일이 없습니다", "UNSPECIFIED_PRECEDENCE": "예외 규칙의 우선순위가 불분명합니다",
          "AMBIGUOUS_BOUNDARY": "경계 조건을 확인해 주세요", "MISSING_REQUIRED_FACT": "필수 정보가 없습니다", "OTHER": "규칙 해석을 확인해 주세요"}


def build_findings(compilation: NoticeCompilation, members: list[MemberResult], personas: list[MemberResult]) -> list[Finding]:
    findings = []
    covered = set()
    for index, uncertainty in enumerate(compilation.uncertainties, 1):
        def affected(result):
            if result.status not in ("CONFLICT", "NEEDS_CLARIFICATION"):
                return False
            # For precedence pairs, both the exception and the specific failing rule
            # must matter. This keeps leave conflicts out of contract findings.
            rule_ids = set(uncertainty.affectsRuleIds)
            if uncertainty.type == "UNSPECIFIED_PRECEDENCE":
                failed = {e.ruleId for e in result.evaluations if e.result == "FALSE"}
                return bool(rule_ids & failed) and bool(rule_ids & set(result.applicableExceptionIds))
            return bool(rule_ids & set(result.decisiveRuleIds)) and (
                uncertainty.type != "MISSING_REFERENCE" or "MISSING_REFERENCE" in result.reasonCodes)
        member_ids = [r.memberId for r in members if affected(r)]
        persona_ids = [r.memberId for r in personas if affected(r)]
        covered.update(member_ids + persona_ids)
        findings.append(Finding(id=f"F{index:02}", type=uncertainty.type, severity=uncertainty.severity,
                                title=TITLES[uncertainty.type], question=uncertainty.question,
                                affectedRuleIds=uncertainty.affectsRuleIds, affectedMemberIds=member_ids,
                                affectedPersonaIds=persona_ids))
    for code, title, question in [
        ("MISSING_MEMBER_FIELD", "판정에 필요한 구성원 정보가 없습니다", "필수 구성원 정보를 확인해 주세요. 누락된 값은 추정하지 않습니다."),
        ("CONTRADICTORY_RULES", "서로 모순되는 규칙이 있습니다", "포함과 제외 규칙 중 어떤 조건이 우선하나요?"),
        ("RULE_AMBIGUITY", "규칙에 확인이 필요합니다", "모호한 조건의 정확한 의미를 확인해 주세요."),
    ]:
        affected_members = [r for r in members if code in r.reasonCodes and r.memberId not in covered]
        affected_personas = [r for r in personas if code in r.reasonCodes and r.memberId not in covered]
        if affected_members or affected_personas:
            findings.append(Finding(id=f"F{len(findings)+1:02}", type=code, severity="HIGH", title=title, question=question,
                                    affectedRuleIds=sorted({i for r in affected_members + affected_personas for i in r.decisiveRuleIds}),
                                    affectedMemberIds=[r.memberId for r in affected_members],
                                    affectedPersonaIds=[r.memberId for r in affected_personas]))
    return sorted(findings, key=lambda f: ({"HIGH": 0, "MEDIUM": 1, "LOW": 2}[f.severity], -len(f.affectedMemberIds), f.id))
