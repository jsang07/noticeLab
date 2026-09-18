"""One-time fixture builder. Runtime loads independent, validated JSON fixtures."""
import json
from pathlib import Path
import re
import sys

DATA = Path(__file__).resolve().parents[1] / "app" / "data"
DATA.mkdir(parents=True, exist_ok=True)

if len(sys.argv) > 1:
    spec = Path(sys.argv[1]).read_text(encoding="utf-8")
    members = json.loads(re.search(r"```json\s*(\[\s*\{.*?\])\s*```", spec, re.S)[1])
    (DATA / "sample_members.json").write_text(json.dumps(members, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    notice = re.search(r"## Notice Text\s*```text\s*(.*?)\s*```", spec, re.S)[1]
    (DATA / "sample_notice.txt").write_text(notice + "\n", encoding="utf-8")


def condition(id, field, operator, value, source, type="string"):
    return dict(kind="condition", id=id, field=field, operator=operator,
                value=dict(kind="literal", type=type, value=value), sourceText=source,
                confidence="HIGH", requiresConfirmation=False)


def compilation(fixed=False):
    hire = condition("hire-date", "hireDate", "LTE", "2026-03-31", "2026년 3월 31일까지 입사한", "date")
    leave = condition("leave-exclusion", "employmentStatus", "NEQ", "ON_LEAVE", "현재 휴직 중인 구성원은 신청 대상에서 제외합니다.")
    full = condition("full-time", "employmentType", "EQ", "FULL_TIME", "정규직")
    contract = condition("contract-type", "employmentType", "EQ", "CONTRACT", "계약직")
    duration = condition("contract-duration", "contractEndDate", "GTE", None,
                         "계약직은 신청 마감일인 2026년 4월 10일을 기준으로 계약 종료일까지 3개월 이상 남아 있어야 합니다." if fixed else "계약직은 잔여 계약기간이 3개월 이상인 경우에만 신청할 수 있습니다.")
    duration["value"] = dict(kind="relative_date", base=(dict(kind="anchor_reference", anchorId="application-deadline") if fixed else
        dict(kind="unresolved_reference", uncertaintyId="U01", candidateAnchorIds=["notice-date", "application-deadline"])),
        offset=dict(months=3, days=0))
    manager = condition("manager-level", "managerialLevel", "IN", ["TEAM_LEAD", "DEPARTMENT_HEAD", "EXECUTIVE"], "팀장 이상", "string_array")
    return dict(version="1.0", title="2026년 상반기 직무역량 교육비 지원 안내", timezone="Asia/Seoul",
                anchors=[dict(id="notice-date", type="DATE", value="2026-04-01"),
                         dict(id="application-deadline", type="DATETIME", value="2026-04-10T18:00:00+09:00")],
                baselineEligibility=dict(kind="all", children=[hire, leave, dict(kind="any", children=[full, dict(kind="all", children=[contract, duration])])]),
                exceptions=[] if fixed else [dict(id="manager-exception", when=manager, effect="INCLUDE", precedence="UNSPECIFIED",
                    sourceText="팀장 이상은 고용형태와 관계없이 이번 교육 지원 대상에 포함")],
                actions=[dict(id="apply", description="지원 대상자는 교육 과정명, 교육 기간, 교육비를 작성하여 신청", when=None,
                              deadlineAnchorId="application-deadline", sourceText="교육 과정명, 교육 기간, 교육비를 작성하여 4월 10일 오후 6시까지 신청해 주세요."),
                         dict(id="leadership", description="지원 대상인 팀장 이상은 리더십 심화과정 선택 가능", when=({**manager, "id": "leadership-level"}),
                              deadlineAnchorId=None, sourceText="리더십 심화과정을 선택할 수 있습니다.")],
                uncertainties=[] if fixed else [
                    dict(id="U01", type="MISSING_REFERENCE", severity="HIGH", question="잔여 계약기간 3개월은 공지일과 신청 마감일 중 어느 날짜를 기준으로 계산하나요?",
                         candidateAnchorIds=["notice-date", "application-deadline"], affectsRuleIds=["contract-duration"]),
                    dict(id="U02", type="UNSPECIFIED_PRECEDENCE", severity="HIGH", question="팀장 이상 예외가 계약직의 잔여 계약기간 조건보다 우선하나요?",
                         candidateAnchorIds=[], affectsRuleIds=["contract-duration", "manager-exception"]),
                    dict(id="U03", type="UNSPECIFIED_PRECEDENCE", severity="HIGH", question="팀장 이상 예외가 휴직자 제외 조건보다 우선하나요?",
                         candidateAnchorIds=[], affectsRuleIds=["leave-exclusion", "manager-exception"])])


for fixed, filename in [(False, "sample_compilation.json"), (True, "fixed_compilation.json")]:
    (DATA / filename).write_text(json.dumps(compilation(fixed), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
original = (DATA / "sample_notice.txt").read_text(encoding="utf-8")
fixed_notice = original.replace("계약직은 잔여 계약기간이 3개월 이상인 경우에만 신청할 수 있습니다.",
    "계약직은 신청 마감일인 2026년 4월 10일을 기준으로 계약 종료일까지 3개월 이상 남아 있어야 합니다.").replace(
    "다만, 팀장 이상은 고용형태와 관계없이 이번 교육 지원 대상에 포함되며, 리더십 심화과정을 선택할 수 있습니다.",
    "팀장 이상에게도 위의 입사일, 고용형태, 계약기간 및 휴직 제외 조건을 동일하게 적용합니다. 해당 조건을 충족한 팀장 이상은 리더십 심화과정을 선택할 수 있습니다.")
(DATA / "fixed_notice.txt").write_text(fixed_notice, encoding="utf-8")
print("Sample fixtures written.")
