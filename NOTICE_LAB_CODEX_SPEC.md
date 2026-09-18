# Notice Lab — Codex Build Spec

> **Source of truth for implementation**
>
> Work inside the current `noticeLab` directory.
> Do **not** redesign the product, expand scope, or replace the architecture unless a concrete implementation blocker requires it.
> Build the working MVP described here in the stated priority order.
> Prefer a complete, demoable core loop over optional features.
>
> Core principle:
>
> **LLM compiles. Code decides.**

---

## 0. Product Definition

### Name
**Notice Lab**

### Hero copy
**Don't send it yet. Test your notice before humans do.**

Korean supporting copy:

**공지문을 실행 가능한 규칙으로 바꾸고, 경계 사례와 구성원을 미리 시뮬레이션해 발송 전 문제를 찾습니다.**

### What this is

Notice Lab is a preflight-testing tool for organizational notices.

It is **not** an AI notice writer, summarizer, or chat wrapper.

Core loop:

```text
Natural-language notice
→ Gemini compiles notice into structured Rule JSON
→ deterministic code generates boundary/persona tests
→ deterministic code executes rules against personas and members
→ ambiguity / conflict / missing information is surfaced
→ Gemini rewrites the notice based on findings
→ rewritten notice is compiled again
→ the exact same simulation is rerun
→ Before / After comparison
```

The key demo message is:

> **Test the notice on AI people before sending it to real people.**

---

# 1. MVP Scope

## MUST implement

1. Notice text input
2. One-click sample demo
3. Gemini notice compiler
4. Visible rule cards
5. Deterministic three-valued rule engine
6. Deterministic rule-based edge-case persona generation
7. Sample organization with 18 members
8. Member simulation
9. Blast Radius visualization
10. Findings / ambiguity / conflict panel
11. Gemini "Fix Notice"
12. Recompile fixed notice
13. Re-run same simulation
14. Before / After comparison
15. Deployable frontend + backend

## DO NOT implement before core demo is complete

- Sign up / login
- Database
- Kakao / Slack / Notion
- Email sending
- Real notification sending
- Organization management
- Permission management
- HWP
- OCR
- Large-file processing
- Complex generic HR schema
- Full Excel support
- Production-grade auth
- Chat interface

Optional only after the full demo works:

- raw member text normalization
- CSV paste/import
- CSV file upload

---

# 2. Tech Stack

## Frontend

- React
- TypeScript
- Vite
- CSS Modules, plain CSS, or Tailwind only if already convenient
- No Redux
- `useReducer` or a small local state machine is enough

## Backend

- Python
- FastAPI
- Pydantic v2
- `python-dateutil` for calendar month arithmetic
- pytest

## AI

Use **Google Gemini API**.

Default model:

```text
gemini-2.5-flash
```

Environment variable must allow model replacement:

```env
GEMINI_MODEL=gemini-2.5-flash
```

Use the official Python SDK:

```text
google-genai
```

The API key must exist only on the backend.

```env
GEMINI_API_KEY=
```

Never expose the Gemini API key in the React app.

### LLM responsibilities

Gemini is allowed to:

1. compile notice text into validated structured output
2. rewrite a notice from deterministic findings
3. optionally normalize explicit member data later

Gemini is **not** allowed to:

- decide final member eligibility
- invent missing organizational facts
- silently resolve unclear rule precedence
- silently pick a missing reference date
- invent contract dates, employment types, or statuses

---

# 3. Cost / API Guardrails

This MVP should use very few model calls.

Normal sample demo:

```text
Compile Notice     = 1 Gemini call
Simulate           = 0 Gemini calls
Generate Personas  = 0 Gemini calls
Fix Notice         = 1 Gemini call
Recompile          = 1 Gemini call
Re-simulate        = 0 Gemini calls
```

Total normal demo: **3 Gemini calls**.

Do not use Google Search grounding.

Do not call Gemini for each member.

Do not call Gemini for each persona.

Do not call Gemini to determine `INCLUDED` / `EXCLUDED`.

Set low temperature for the compiler, e.g. `0.1`.

Use structured JSON output and validate it with Pydantic.

If model output is invalid:

1. attempt Pydantic validation
2. retry the compile request at most once with the validation error
3. return a clear backend error after that

Do not create an unbounded retry loop.

---

# 4. Gemini Integration

Create:

```text
backend/app/services/llm/gemini_client.py
backend/app/services/llm/compiler.py
backend/app/services/llm/fixer.py
```

Recommended SDK shape:

```python
from google import genai
from google.genai import types

client = genai.Client(api_key=settings.gemini_api_key)

response = client.models.generate_content(
    model=settings.gemini_model,
    contents=prompt,
    config=types.GenerateContentConfig(
        temperature=0.1,
        response_mime_type="application/json",
        response_schema=NoticeCompilation,
    ),
)

compilation = NoticeCompilation.model_validate_json(response.text)
```

If the installed SDK/API version requires a newer equivalent structured-output syntax, use the current official `google-genai` API while preserving the same behavior:

- JSON output
- Pydantic schema
- deterministic validation
- no free-form parsing when avoidable

`.env.example`:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_ORIGIN=http://localhost:5173
```

---

# 5. Sample Notice

This exact sample should be available from `GET /api/demo`.

## Metadata

```text
Title: 2026년 상반기 직무역량 교육비 지원 안내
Notice date: 2026-04-01
Timezone: Asia/Seoul
```

## Notice Text

```text
2026년 상반기 직무역량 교육비 지원 안내

구성원 여러분의 직무 역량 강화를 위해 상반기 외부 교육비 지원 신청을 받습니다.

신청 대상은 2026년 3월 31일까지 입사한 정규직 및 계약직 구성원입니다.

계약직은 잔여 계약기간이 3개월 이상인 경우에만 신청할 수 있습니다.

현재 휴직 중인 구성원은 신청 대상에서 제외합니다.

다만, 팀장 이상은 고용형태와 관계없이 이번 교육 지원 대상에 포함되며, 리더십 심화과정을 선택할 수 있습니다.

지원 대상자는 교육 과정명, 교육 기간, 교육비를 작성하여 4월 10일 오후 6시까지 신청해 주세요.

본 안내는 전체 구성원에게 전달드립니다.
```

---

# 6. Intentional Problems in the Sample Notice

The notice is realistic but contains three important unresolved issues.

## U01 — Missing reference date

Text:

```text
계약직은 잔여 계약기간이 3개월 이상인 경우
```

Question:

```text
잔여 계약기간 3개월은 어느 날짜를 기준으로 계산하는가?
```

Candidate anchors that are explicitly present:

```text
notice-date = 2026-04-01
application-deadline = 2026-04-10T18:00:00+09:00
```

Gemini must **not** silently choose one.

---

## U02 — Contract Team Lead precedence

Rules imply:

```text
CONTRACT + remaining contract < 3 months → EXCLUDE
TEAM_LEAD+ → INCLUDE regardless of employment type
```

It is unclear whether the Team Lead exception overrides the contract-duration requirement.

Mark precedence as:

```text
UNSPECIFIED
```

---

## U03 — On-leave Team Lead precedence

Rules imply:

```text
ON_LEAVE → EXCLUDE
TEAM_LEAD+ → INCLUDE
```

It is unclear whether the Team Lead exception overrides leave exclusion.

Mark precedence as:

```text
UNSPECIFIED
```

---

# 7. Member Schema

Implement with Pydantic in the backend and matching TypeScript types in the frontend.

## Enums

```text
EmploymentType
- FULL_TIME
- CONTRACT
- INTERN
- PART_TIME
- VENDOR
- UNKNOWN
```

```text
EmploymentStatus
- ACTIVE
- ON_LEAVE
- TERMINATED
- UNKNOWN
```

```text
ManagerialLevel
- IC
- TEAM_LEAD
- DEPARTMENT_HEAD
- EXECUTIVE
- UNKNOWN
```

```text
Confidence
- HIGH
- MEDIUM
- LOW
- UNKNOWN
```

```text
FieldSource
- EXPLICIT
- NORMALIZED
- DERIVED
- UNKNOWN
```

## Member

```json
{
  "id": "M09",
  "name": "송아린",
  "department": "Product",
  "positionTitle": "팀장",
  "employmentType": "CONTRACT",
  "employmentStatus": "ACTIVE",
  "hireDate": "2025-06-01",
  "contractEndDate": "2026-06-30",
  "managerialLevel": "TEAM_LEAD",
  "customFields": {},
  "fieldMeta": {
    "managerialLevel": {
      "source": "NORMALIZED",
      "confidence": "HIGH"
    }
  }
}
```

Do **not** persist `remainingContractMonths`.

Always calculate contract threshold from:

```text
contractEndDate
referenceDate
calendar-month offset
```

Never approximate 3 months as 90 days.

Use calendar month arithmetic.

Example:

```text
2026-04-10 + 3 calendar months = 2026-07-10
```

---

# 8. Data Normalization Policy

Allowed normalization:

```text
정규직 → FULL_TIME
계약직 → CONTRACT
인턴 → INTERN
파트타임 → PART_TIME
휴직 / 육아휴직 → ON_LEAVE
팀장 → TEAM_LEAD
explicit ISO-like dates → ISO date
```

Allowed principle:

> **Normalize formats. Never fabricate facts.**

Forbidden inference examples:

```text
employment type missing → assume FULL_TIME
contractEndDate missing → assume one-year contract
"Senior" → assume TEAM_LEAD
job grade alone → assume management authority
hireDate missing → infer from another unrelated field
```

A missing required fact stays `null` / `UNKNOWN`.

---

# 9. Sample Organization

Create:

```text
backend/app/data/sample_members.json
```

Use these exact 18 synthetic members.

```json
[
  {
    "id": "M01",
    "name": "김민지",
    "department": "Product",
    "positionTitle": "프로덕트 매니저",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2025-08-18",
    "contractEndDate": null,
    "managerialLevel": "IC"
  },
  {
    "id": "M02",
    "name": "박준호",
    "department": "Design",
    "positionTitle": "팀장",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2024-02-01",
    "contractEndDate": null,
    "managerialLevel": "TEAM_LEAD"
  },
  {
    "id": "M03",
    "name": "이서연",
    "department": "Platform",
    "positionTitle": "개발자",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2026-03-31",
    "contractEndDate": null,
    "managerialLevel": "IC"
  },
  {
    "id": "M04",
    "name": "최현우",
    "department": "Growth",
    "positionTitle": "마케터",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2026-04-01",
    "contractEndDate": null,
    "managerialLevel": "IC"
  },
  {
    "id": "M05",
    "name": "정하늘",
    "department": "Finance",
    "positionTitle": "회계 담당",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ON_LEAVE",
    "hireDate": "2025-11-03",
    "contractEndDate": null,
    "managerialLevel": "IC"
  },
  {
    "id": "M06",
    "name": "오지훈",
    "department": "Sales",
    "positionTitle": "세일즈 매니저",
    "employmentType": "CONTRACT",
    "employmentStatus": "ACTIVE",
    "hireDate": "2025-12-01",
    "contractEndDate": "2026-07-09",
    "managerialLevel": "IC"
  },
  {
    "id": "M07",
    "name": "한유진",
    "department": "Content",
    "positionTitle": "콘텐츠 에디터",
    "employmentType": "CONTRACT",
    "employmentStatus": "ACTIVE",
    "hireDate": "2025-12-15",
    "contractEndDate": "2026-07-05",
    "managerialLevel": "IC"
  },
  {
    "id": "M08",
    "name": "임도윤",
    "department": "Data",
    "positionTitle": "데이터 분석가",
    "employmentType": "CONTRACT",
    "employmentStatus": "ACTIVE",
    "hireDate": "2026-02-20",
    "contractEndDate": "2026-07-01",
    "managerialLevel": "IC"
  },
  {
    "id": "M09",
    "name": "송아린",
    "department": "Product",
    "positionTitle": "팀장",
    "employmentType": "CONTRACT",
    "employmentStatus": "ACTIVE",
    "hireDate": "2025-06-01",
    "contractEndDate": "2026-06-30",
    "managerialLevel": "TEAM_LEAD"
  },
  {
    "id": "M10",
    "name": "배시우",
    "department": "Operations",
    "positionTitle": "팀장",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ON_LEAVE",
    "hireDate": "2025-03-10",
    "contractEndDate": null,
    "managerialLevel": "TEAM_LEAD"
  },
  {
    "id": "M11",
    "name": "강채원",
    "department": "HR",
    "positionTitle": "부서장",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2023-05-01",
    "contractEndDate": null,
    "managerialLevel": "DEPARTMENT_HEAD"
  },
  {
    "id": "M12",
    "name": "문태윤",
    "department": "Security",
    "positionTitle": "인턴",
    "employmentType": "INTERN",
    "employmentStatus": "ACTIVE",
    "hireDate": "2026-01-05",
    "contractEndDate": null,
    "managerialLevel": "IC"
  },
  {
    "id": "M13",
    "name": "윤서진",
    "department": "Marketing",
    "positionTitle": "마케팅 어시스턴트",
    "employmentType": "PART_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2025-09-01",
    "contractEndDate": null,
    "managerialLevel": "IC"
  },
  {
    "id": "M14",
    "name": "장도현",
    "department": "Platform",
    "positionTitle": "개발자",
    "employmentType": "CONTRACT",
    "employmentStatus": "ACTIVE",
    "hireDate": "2026-04-01",
    "contractEndDate": "2026-12-31",
    "managerialLevel": "IC"
  },
  {
    "id": "M15",
    "name": "신예은",
    "department": "Legal",
    "positionTitle": "법무 담당",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2026-03-01",
    "contractEndDate": null,
    "managerialLevel": "IC"
  },
  {
    "id": "M16",
    "name": "조우진",
    "department": "Product",
    "positionTitle": "팀장",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2026-03-31",
    "contractEndDate": null,
    "managerialLevel": "TEAM_LEAD"
  },
  {
    "id": "M17",
    "name": "남수아",
    "department": "Customer Success",
    "positionTitle": "CS 매니저",
    "employmentType": "CONTRACT",
    "employmentStatus": "ACTIVE",
    "hireDate": "2025-10-20",
    "contractEndDate": "2026-07-10",
    "managerialLevel": "IC"
  },
  {
    "id": "M18",
    "name": "권민석",
    "department": "Engineering",
    "positionTitle": "개발자",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "hireDate": "2025-01-15",
    "contractEndDate": null,
    "managerialLevel": "IC"
  }
]
```

---

# 10. Rule Model

Implement a small, explicit Rule AST.

Do not attempt to build a complete rules language.

## Supported operators

```text
EQ
NEQ
LT
LTE
GT
GTE
IN
NOT_IN
IS_NULL
IS_NOT_NULL
```

## Atomic Condition

Example:

```json
{
  "kind": "condition",
  "id": "hire-date",
  "field": "hireDate",
  "operator": "LTE",
  "value": {
    "kind": "literal",
    "type": "date",
    "value": "2026-03-31"
  },
  "sourceText": "2026년 3월 31일까지 입사한",
  "confidence": "HIGH",
  "requiresConfirmation": false
}
```

## Boolean Nodes

```json
{
  "kind": "all",
  "children": []
}
```

```json
{
  "kind": "any",
  "children": []
}
```

Pydantic may use a discriminated union on `kind`.

---

# 11. Relative Dates

Implement relative-date operands because this is critical to the sample.

Example:

```json
{
  "kind": "relative_date",
  "base": {
    "kind": "unresolved_reference",
    "uncertaintyId": "U01",
    "candidateAnchorIds": [
      "notice-date",
      "application-deadline"
    ]
  },
  "offset": {
    "months": 3,
    "days": 0
  }
}
```

Anchors:

```json
{
  "id": "notice-date",
  "type": "DATE",
  "value": "2026-04-01"
}
```

```json
{
  "id": "application-deadline",
  "type": "DATETIME",
  "value": "2026-04-10T18:00:00+09:00"
}
```

Use `dateutil.relativedelta`.

---

# 12. Exceptions

Example:

```json
{
  "id": "manager-exception",
  "when": {
    "kind": "condition",
    "id": "manager-level",
    "field": "managerialLevel",
    "operator": "IN",
    "value": {
      "kind": "literal",
      "type": "string_array",
      "value": [
        "TEAM_LEAD",
        "DEPARTMENT_HEAD",
        "EXECUTIVE"
      ]
    },
    "sourceText": "팀장 이상",
    "confidence": "HIGH",
    "requiresConfirmation": false
  },
  "effect": "INCLUDE",
  "precedence": "UNSPECIFIED",
  "sourceText": "팀장 이상은 고용형태와 관계없이 이번 교육 지원 대상에 포함"
}
```

Enums:

```text
ExceptionEffect
- INCLUDE
- EXCLUDE
```

```text
RulePrecedence
- OVERRIDE_BASELINE
- BASELINE_WINS
- UNSPECIFIED
```

If baseline and exception disagree and precedence is `UNSPECIFIED`, final result is `CONFLICT`.

---

# 13. NoticeCompilation

Implement a validated model roughly equivalent to:

```json
{
  "version": "1.0",
  "title": "2026년 상반기 직무역량 교육비 지원 안내",
  "anchors": [],
  "baselineEligibility": {},
  "exceptions": [],
  "actions": [],
  "uncertainties": []
}
```

## Uncertainty

```json
{
  "id": "U01",
  "type": "MISSING_REFERENCE",
  "severity": "HIGH",
  "question": "계약직의 잔여 계약기간 3개월은 어느 날짜를 기준으로 계산하나요?",
  "candidateAnchorIds": [
    "notice-date",
    "application-deadline"
  ],
  "affectsRuleIds": [
    "contract-duration"
  ]
}
```

Supported uncertainty types for MVP:

```text
MISSING_REFERENCE
UNSPECIFIED_PRECEDENCE
AMBIGUOUS_BOUNDARY
MISSING_REQUIRED_FACT
OTHER
```

Severity:

```text
HIGH
MEDIUM
LOW
```

---

# 14. Expected Sample Compilation

The semantic baseline must become equivalent to:

```text
ALL
├─ hireDate <= 2026-03-31
├─ employmentStatus != ON_LEAVE
└─ ANY
   ├─ employmentType == FULL_TIME
   └─ ALL
      ├─ employmentType == CONTRACT
      └─ contractEndDate >= UNKNOWN_REFERENCE + 3 calendar months
```

Manager exception:

```text
WHEN managerialLevel IN
  TEAM_LEAD
  DEPARTMENT_HEAD
  EXECUTIVE

EFFECT INCLUDE
PRECEDENCE UNSPECIFIED
```

The UI does not need to display the tree literally.

It should render friendly cards.

---

# 15. Three-Valued Rule Engine

Every atomic condition returns:

```text
TRUE
FALSE
UNKNOWN
```

Use an enum, not Python booleans with `None`.

## AND

```text
if any child == FALSE:
    FALSE
else if any child == UNKNOWN:
    UNKNOWN
else:
    TRUE
```

## OR

```text
if any child == TRUE:
    TRUE
else if any child == UNKNOWN:
    UNKNOWN
else:
    FALSE
```

Important:

```text
UNKNOWN is not FALSE.
```

An unknown rule in an irrelevant branch must not make the whole member unknown.

Example:

```text
hireDate is after cutoff = FALSE
contract reference = UNKNOWN

AND result = FALSE
```

Final member can be confidently excluded.

---

# 16. Unresolved Reference Evaluation

This is an important product behavior.

Suppose:

```text
contractEndDate >= referenceDate + 3 months
```

and `referenceDate` has two candidates.

Evaluate the condition for every candidate.

Collapse results:

```text
TRUE + TRUE   → TRUE
FALSE + FALSE → FALSE
TRUE + FALSE  → UNKNOWN
FALSE + TRUE  → UNKNOWN
```

This means:

> An ambiguous phrase only blocks the decision when different reasonable interpretations actually change the result.

This behavior should be visible in member reasoning.

Example:

```text
오지훈
Contract ends 2026-07-09

Notice date reference:
threshold = 2026-07-01
→ PASS

Deadline reference:
threshold = 2026-07-10
→ FAIL

Result:
NEEDS_CLARIFICATION
```

---

# 17. Final Member Status

Use exactly:

```text
INCLUDED
EXCLUDED
NEEDS_CLARIFICATION
CONFLICT
```

Reason codes:

```text
RULE_AMBIGUITY
MISSING_MEMBER_FIELD
MISSING_REFERENCE
UNSPECIFIED_PRECEDENCE
CONTRADICTORY_RULES
```

Each result should include enough explanation for the UI.

Suggested response shape:

```json
{
  "memberId": "M06",
  "status": "NEEDS_CLARIFICATION",
  "reasonCodes": ["MISSING_REFERENCE"],
  "summary": "잔여 계약기간 기준일에 따라 결과가 달라집니다.",
  "evaluations": []
}
```

---

# 18. Expected Sample Simulation BEFORE Fix

The deterministic sample should produce:

```text
Total                 18
INCLUDED               8
EXCLUDED               5
NEEDS_CLARIFICATION    3
CONFLICT               2
```

Expected groups:

## INCLUDED

```text
M01 김민지
M02 박준호
M03 이서연
M11 강채원
M15 신예은
M16 조우진
M17 남수아
M18 권민석
```

## EXCLUDED

```text
M04 최현우
M05 정하늘
M12 문태윤
M13 윤서진
M14 장도현
```

## NEEDS_CLARIFICATION

```text
M06 오지훈
M07 한유진
M08 임도윤
```

## CONFLICT

```text
M09 송아린
M10 배시우
```

Write tests so this exact sample result is stable.

---

# 19. Persona Generator

Do not ask Gemini to randomly invent personas.

Generate personas deterministically from compiled rules.

Create:

```text
backend/app/services/engine/persona_generator.py
```

## Date threshold rule

For:

```text
hireDate <= 2026-03-31
```

Generate:

```text
2026-03-30
2026-03-31
2026-04-01
```

Labels:

```text
One day before cutoff
Exactly on cutoff
One day after cutoff
```

## Resolved relative threshold

For:

```text
contractEndDate >= 2026-07-10
```

Generate:

```text
2026-07-09
2026-07-10
2026-07-11
```

## Enum rule

Generate:

- an allowed value
- another allowed value when useful
- one clearly excluded value

## Pairwise edge cases

Generate intentional combinations derived from the actual rules:

```text
CONTRACT + TEAM_LEAD
ON_LEAVE + TEAM_LEAD
CONTRACT + exact threshold
CONTRACT + one day short
```

Cap at about 8–12 personas.

Do not produce combinatorial explosion.

Suggested persona shape:

```json
{
  "id": "P01",
  "label": "Exactly on hire-date cutoff",
  "member": {},
  "generatedFromRuleIds": ["hire-date"]
}
```

---

# 20. Findings

Findings should come from:

1. compiler-declared structured uncertainties
2. deterministic simulation behavior
3. conflict detection

The LLM must not invent unsupported issues after the fact.

Suggested finding:

```json
{
  "id": "F01",
  "type": "MISSING_REFERENCE",
  "severity": "HIGH",
  "title": "잔여 계약기간 기준일이 없습니다",
  "question": "잔여 계약기간 3개월은 공지일과 신청 마감일 중 어느 날짜를 기준으로 계산하나요?",
  "affectedRuleIds": ["contract-duration"],
  "affectedMemberIds": ["M06", "M07", "M08"]
}
```

Order findings:

1. HIGH
2. number of affected members
3. deterministic conflict before stylistic concern

Do not flood the screen.

Show the top 3 findings by default.

---

# 21. Fix Notice

Endpoint:

```text
POST /api/fix
```

Gemini receives:

- original notice
- validated compilation
- deterministic findings

Prompt requirements:

```text
Resolve only the listed ambiguities/conflicts.
Preserve the original purpose and tone.
Do not add new eligibility requirements unless required to make a listed rule explicit.
Do not invent organizational facts.
Return the full revised notice.
Also return a concise list of changes.
```

For the sample, the expected semantic fix is equivalent to:

```text
계약직은 신청 마감일인 2026년 4월 10일을 기준으로 계약 종료일까지 3개월 이상 남아 있어야 합니다.

팀장 이상에게도 위의 입사일, 고용형태, 계약기간 및 휴직 제외 조건을 동일하게 적용합니다. 해당 조건을 충족한 팀장 이상은 리더십 심화과정을 선택할 수 있습니다.
```

Important architecture rule:

**Do not patch the old Rule AST directly.**

Always:

```text
fixed notice
→ Gemini /compile again
→ NEW compilation
→ deterministic /simulate again
```

This is the closed loop.

---

# 22. Expected Sample Simulation AFTER Fix

When the fixed notice uses:

```text
reference date = 2026-04-10
```

and explicitly says Team Leads must satisfy the same eligibility conditions:

```text
Total                 18
INCLUDED               8
EXCLUDED              10
NEEDS_CLARIFICATION    0
CONFLICT               0
```

Final hero result:

```text
Send to 8 people, not 18.
```

Also show:

```text
0 unresolved rules
```

only when actually true.

---

# 23. API Design

## GET `/api/health`

Response:

```json
{
  "status": "ok"
}
```

---

## GET `/api/demo`

Response:

```json
{
  "notice": {
    "title": "2026년 상반기 직무역량 교육비 지원 안내",
    "noticeDate": "2026-04-01",
    "timezone": "Asia/Seoul",
    "text": "..."
  },
  "members": []
}
```

---

## POST `/api/compile`

Request:

```json
{
  "noticeText": "...",
  "noticeDate": "2026-04-01",
  "timezone": "Asia/Seoul"
}
```

Response:

```json
{
  "compilation": {}
}
```

Uses Gemini.

---

## POST `/api/simulate`

Request:

```json
{
  "compilation": {},
  "members": [],
  "generatePersonas": true
}
```

Response:

```json
{
  "memberResults": [],
  "personas": [],
  "personaResults": [],
  "findings": [],
  "summary": {
    "total": 18,
    "included": 8,
    "excluded": 5,
    "needsClarification": 3,
    "conflict": 2
  }
}
```

This endpoint must **not** call Gemini.

---

## POST `/api/fix`

Request:

```json
{
  "originalNotice": "...",
  "compilation": {},
  "findings": []
}
```

Response:

```json
{
  "revisedNotice": "...",
  "changes": [
    {
      "findingId": "F01",
      "description": "잔여 계약기간 기준일을 신청 마감일로 명시"
    }
  ]
}
```

Uses Gemini.

---

## Optional POST `/api/members/normalize`

Do not implement until the main loop is finished.

---

# 24. Backend Structure

Create approximately:

```text
noticeLab/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ config.py
│  │  │
│  │  ├─ api/
│  │  │  ├─ demo.py
│  │  │  ├─ compile.py
│  │  │  ├─ simulate.py
│  │  │  └─ fix.py
│  │  │
│  │  ├─ models/
│  │  │  ├─ member.py
│  │  │  ├─ rule.py
│  │  │  ├─ compilation.py
│  │  │  └─ simulation.py
│  │  │
│  │  ├─ services/
│  │  │  ├─ llm/
│  │  │  │  ├─ gemini_client.py
│  │  │  │  ├─ compiler.py
│  │  │  │  └─ fixer.py
│  │  │  │
│  │  │  └─ engine/
│  │  │     ├─ evaluator.py
│  │  │     ├─ date_resolver.py
│  │  │     ├─ conflict_detector.py
│  │  │     ├─ persona_generator.py
│  │  │     └─ findings.py
│  │  │
│  │  └─ data/
│  │     ├─ sample_notice.txt
│  │     └─ sample_members.json
│  │
│  ├─ tests/
│  │  ├─ test_evaluator.py
│  │  ├─ test_date_resolver.py
│  │  └─ test_sample_simulation.py
│  │
│  ├─ requirements.txt
│  └─ .env.example
│
└─ frontend/
```

Suggested Python requirements:

```text
fastapi
uvicorn[standard]
pydantic
pydantic-settings
python-dotenv
python-dateutil
google-genai
pytest
httpx
```

---

# 25. Frontend Structure

```text
frontend/
├─ src/
│  ├─ api/
│  │  └─ client.ts
│  │
│  ├─ components/
│  │  ├─ NoticeInput.tsx
│  │  ├─ CompilerPanel.tsx
│  │  ├─ RuleCard.tsx
│  │  ├─ UncertaintyCard.tsx
│  │  ├─ PersonaSimulation.tsx
│  │  ├─ PersonaCard.tsx
│  │  ├─ BlastRadius.tsx
│  │  ├─ FindingsPanel.tsx
│  │  ├─ FixNoticePanel.tsx
│  │  └─ BeforeAfter.tsx
│  │
│  ├─ types/
│  │  ├─ member.ts
│  │  ├─ rules.ts
│  │  └─ simulation.ts
│  │
│  ├─ pages/
│  │  └─ HomePage.tsx
│  │
│  ├─ App.tsx
│  └─ main.tsx
│
└─ .env.example
```

Frontend env:

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

# 26. Frontend State Machine

Use:

```text
IDLE
LOADING_DEMO
COMPILING
COMPILED
SIMULATING
RESULT
FIXING
RETESTING
RETESTED
ERROR
```

`useReducer` is sufficient.

Do not add Redux/Zustand unless a concrete need appears.

---

# 27. Primary Page UX

Prefer one vertically progressing page.

Do not create six separate routes.

## Section 1 — Hero / Notice Input

Desktop layout:

```text
------------------------------------------------------------
Notice Lab

Don't send it yet.
Test your notice before humans do.

[ large notice textarea                     ]
[ Try Sample Notice ] [ Test Notice ]
------------------------------------------------------------
```

The sample button should load the notice and immediately allow the complete demo.

---

## Section 2 — Notice Compiler

Show the original notice on one side and visual rules on the other when space allows.

Friendly rule cards:

```text
JOINED BY
Mar 31, 2026
```

```text
EMPLOYMENT
Full-time OR Contract
```

```text
IF CONTRACT
Remaining contract ≥ 3 months

⚠ Reference date missing
```

```text
EXCLUDE
On leave
```

```text
EXCEPTION
Team Lead+

⚠ Priority unclear
```

Also include a small label:

```text
AI interpretation — review before relying on it
```

Do not hide the AI interpretation.

---

# 28. Persona Simulation UI

Show a few representative generated personas first.

Example:

```text
오지훈
Contract
Ends Jul 09

Apr 01 reference → Pass
Apr 10 reference → Fail

NEEDS CLARIFICATION
```

Example:

```text
송아린
Contract · Team Lead
Ends Jun 30

Contract rule → Exclude
Manager exception → Include

CONFLICT
```

Animations should be lightweight.

Do not spend core implementation time on sophisticated motion.

A simple sequence / highlight is enough.

---

# 29. Blast Radius

Represent all 18 members as compact people tiles / avatars.

Four visual states:

```text
Included
Excluded
Needs clarification
Conflict
```

Before fixing, do **not** claim that unresolved members definitely should not receive the notice.

Show:

```text
18 people received this notice
8 definitely match
5 definitely don't
5 need review
```

or equivalent.

After successful fix, show:

```text
Send to 8 people, not 18.
```

This is the strong final demo line.

---

# 30. Findings UI

Default to the top three findings.

Example:

```text
1. Missing reference date
When should "3 months remaining" be measured?
Affected members: 3
```

```text
2. Conflicting manager exception
Does Team Lead status override the contract-duration requirement?
Affected members: 1
```

```text
3. Conflicting leave exception
Does Team Lead status override the on-leave exclusion?
Affected members: 1
```

Primary CTA:

```text
Fix Notice
```

---

# 31. Fix & Re-test UX

After clicking `Fix Notice`:

1. call `/api/fix`
2. show revised notice
3. automatically or explicitly trigger re-test
4. call `/api/compile` with revised text
5. call `/api/simulate` with the same 18 sample members
6. show before / after

Before:

```text
8 Included
5 Excluded
3 Need clarification
2 Conflicts
```

After:

```text
8 Included
10 Excluded
0 Need clarification
0 Conflicts
```

Final card:

```text
0 unresolved rules

Send to 8 people, not 18.
```

---

# 32. UI Design Direction

Goal:

**technical tool + clean consumer demo**

Not:

- enterprise dashboard overload
- generic chatbot
- giant form
- spreadsheet-first experience

Recommended visual direction:

- white / very light neutral background
- dark primary text
- one accent color
- soft cards
- clear state badges
- generous whitespace
- rule graph/card feel
- people tiles for Blast Radius

The first 5 seconds should communicate:

```text
Notice → executable rules
```

The next 10 seconds:

```text
rules → simulated people
```

The final seconds:

```text
problem → fix → clean rerun
```

---

# 33. Required Backend Tests

Implement at least these.

## T1 — exact date boundary

```text
hireDate = 2026-03-31
condition hireDate <= 2026-03-31
→ TRUE
```

## T2 — after boundary

```text
hireDate = 2026-04-01
→ FALSE
```

## T3 — calendar month short

```text
reference = 2026-04-10
required = +3 months
threshold = 2026-07-10
contractEndDate = 2026-07-09
→ FALSE
```

## T4 — exact calendar month

```text
contractEndDate = 2026-07-10
→ TRUE
```

## T5 — unresolved reference changes outcome

```text
candidate A → TRUE
candidate B → FALSE
→ UNKNOWN
```

## T6 — unresolved reference does not change outcome

```text
candidate A → TRUE
candidate B → TRUE
→ TRUE
```

## T7 — on leave

```text
ACTIVE eligibility otherwise true
employmentStatus = ON_LEAVE
→ baseline FALSE
```

## T8 — unspecified exception precedence

```text
baseline EXCLUDE
manager exception INCLUDE
precedence UNSPECIFIED
→ CONFLICT
```

## T9 — irrelevant unknown

```text
AND(
  hireDate after cutoff = FALSE,
  another condition = UNKNOWN
)

→ FALSE
```

Final:

```text
EXCLUDED
not NEEDS_CLARIFICATION
```

## T10 — complete sample

Assert exact counts:

```text
8 INCLUDED
5 EXCLUDED
3 NEEDS_CLARIFICATION
2 CONFLICT
```

---

# 34. Compiler Prompt Requirements

Create a strong system/developer prompt in backend code.

It must tell Gemini:

```text
You are a notice-to-rule compiler.

Your task is to convert the notice into executable structured rules.

Never invent facts that are not explicitly in the notice or supplied metadata.

If a temporal reference is missing, preserve it as an unresolved reference.

If two rules can conflict and the notice does not specify priority, use UNSPECIFIED precedence.

Preserve the exact source text for each interpreted rule.

Do not decide whether a rule is reasonable.

Do not rewrite the notice.

Do not decide member eligibility.

Return only the requested structured schema.
```

Also provide the supported Member fields and operators in the prompt.

The compiler should prefer supported fields.

If the notice depends on an unsupported field:

- put it into `customFields` semantics only if safely representable
- otherwise emit an uncertainty rather than hallucinating support

---

# 35. AI Confidence Policy

Do not show fake precision such as:

```text
87.3% confidence
```

Use categorical confidence:

```text
HIGH
MEDIUM
LOW
UNKNOWN
```

Meaning:

```text
HIGH
Direct, explicit mapping from notice text.

MEDIUM
Normalization is likely but user review is worthwhile.

LOW
Interpretation is plausible but significantly ambiguous.

UNKNOWN
Cannot safely interpret.
```

The UI should prioritize:

```text
Needs confirmation
```

over decorative numeric confidence.

---

# 36. Safety / Trust UX

The compiler output is always visible.

The UI should make it clear that:

```text
AI interpreted:
"2026년 3월 31일까지"
→ hireDate <= 2026-03-31
```

For the MVP, full manual rule editing is optional.

If easy, add a simple "Review" state.

Do not let manual rule editing delay the core loop.

Most important behavior:

**unknown facts remain unknown.**

---

# 37. Error Handling

Frontend should show friendly errors for:

```text
backend unavailable
Gemini quota/rate limit
Gemini invalid structured output
compile timeout
fix timeout
```

Do not expose raw stack traces.

Backend logs can include diagnostic details but never log `GEMINI_API_KEY`.

If Gemini is unavailable, the sample engine should still be testable through backend unit tests and a hardcoded fixture.

Optional developer fallback:

```text
backend/app/data/sample_compilation.json
```

Use it only for local/testing or an explicit demo fallback.

Do not silently pretend a live Gemini compile happened if it did not.

---

# 38. CORS

Allow local Vite frontend:

```text
http://localhost:5173
```

Configure production origin by environment variable.

Do not use unrestricted `*` with credentials.

No credentials are needed for this MVP.

---

# 39. Development Order — Follow This

## Phase 1 — deterministic backend first

1. create backend project
2. create Pydantic Member models
3. create Rule AST
4. create NoticeCompilation models
5. create tri-state evaluator
6. implement calendar-month date resolver
7. implement exception/conflict resolution
8. create 18 sample members
9. create a hardcoded sample compilation fixture
10. implement `/api/simulate`
11. make all required tests pass

Do **not** start Gemini integration before the engine tests work.

## Phase 2 — basic frontend

12. create React/Vite frontend
13. implement hero/input
14. implement Rule Card rendering
15. implement Member/Persona cards
16. implement Blast Radius
17. implement Findings
18. connect `/api/demo` + `/api/simulate`

At this point the app should already be demoable with fixtures.

## Phase 3 — Gemini compile

19. add `google-genai`
20. add backend Gemini client
21. implement compiler prompt
22. implement structured output
23. implement `/api/compile`
24. validate live sample notice compilation
25. handle one validation retry

## Phase 4 — closed loop

26. implement deterministic Persona Generator
27. implement `/api/fix`
28. call Gemini fixer
29. recompile returned text
30. rerun exact sample members
31. implement Before / After UI

## Phase 5 — polish / deploy

32. loading states
33. simple transitions
34. responsive desktop layout
35. deploy frontend/backend
36. verify public URLs
37. record demo

Only after all above:

38. optional raw member input
39. optional CSV paste

---

# 40. Local Setup Target

Expected workflow from repository root:

Backend:

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Expected:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
Health:   http://localhost:8000/api/health
```

---

# 41. Definition of Done

The MVP is complete when a reviewer can do this without explanation:

1. open deployed URL
2. click **Try Sample Notice**
3. see the notice become visible executable rules
4. see boundary personas / members tested
5. understand that some people are clear, some ambiguous, some conflicting
6. see the Blast Radius
7. see three concrete findings
8. click **Fix Notice**
9. see the revised notice
10. see it recompiled and rerun
11. see ambiguity/conflict go to zero
12. see:

```text
Send to 8 people, not 18.
```

The experience should demonstrate why this is not replaceable by merely opening a blank chatbot.

---

# 42. Architecture Summary

```text
                    ┌──────────────────────────┐
                    │      React Frontend      │
                    └────────────┬─────────────┘
                                 │
                        notice / members
                                 │
                    ┌────────────▼─────────────┐
                    │        FastAPI           │
                    └───────┬─────────┬────────┘
                            │         │
                /compile    │         │ /simulate
                            │         │
                   ┌────────▼───┐   ┌─▼─────────────────┐
                   │   Gemini   │   │ Deterministic     │
                   │ Compiler   │   │ Rule Engine       │
                   └────────────┘   │ - tri-state       │
                                    │ - dates           │
                                    │ - conflicts       │
                                    │ - personas        │
                                    └─────────┬─────────┘
                                              │
                                           findings
                                              │
                                    ┌─────────▼─────────┐
                                    │   Gemini Fixer    │
                                    └─────────┬─────────┘
                                              │
                                       revised notice
                                              │
                                       compile again
                                              │
                                       simulate again
```

---

# 43. Non-negotiable Product Rules

1. **LLM compiles. Code decides.**
2. Never fabricate missing facts.
3. Never silently resolve an ambiguous reference date.
4. Never silently resolve unspecified rule precedence.
5. Keep AI interpretation visible.
6. Generate edge cases from rules, not random LLM personas.
7. Simulation must be reproducible.
8. Fix must go through recompile + re-execution.
9. Sample demo must work without uploading organization data.
10. Do not sacrifice the core loop for optional import features.

---

# 44. First Codex Action

Start now.

First inspect the current directory.

If it is empty, scaffold:

```text
backend/
frontend/
```

Then implement **Phase 1 only first**:

```text
Member models
Rule models
NoticeCompilation
tri-state evaluator
calendar-month resolver
conflict handling
sample members
sample compilation fixture
simulation endpoint
pytest tests
```

Run the tests.

Do not proceed to Gemini or UI until the deterministic core passes.

After Phase 1 passes, continue through the phases in this file without changing the product scope.
