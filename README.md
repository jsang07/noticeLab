# Notice Lab

**Don't send it yet. Test your notice before humans do.**

공지문 → Gemini 컴파일 → 검증된 Rule AST → Python 시뮬레이션 → Findings → 수정문 → 새 컴파일 → 동일한 입력 재검증.

**LLM compiles. Code decides.** 로그인, 데이터베이스, 메시지 발송 기능은 없습니다.

## 현재 구현과 검증

- React + TypeScript + Vite 단일 페이지: 원문 입력, 규칙 카드, 조건별 판정 근거, Persona, Blast Radius, Findings, 수정문, Before / After.
- 대상자 소스 `NONE / SAMPLE / CUSTOM`: XLSX·CSV·TSV 붙여넣기, 다중 시트 선택, 타입 추론, 미리보기, 5종 XLSX 템플릿 다운로드.
- FastAPI + Pydantic v2: 3값 논리, 달력 월 계산, 후보 기준일별 판정, 예외 충돌, 결정론적 Persona 생성.
- Gemini `gemini-2.5-flash` compiler/fixer: 공식 `google-genai`, JSON Schema, Pydantic 및 원문 인용 검증, 컴파일 검증 재시도 최대 1회.
- 수정 전 **8 included / 5 excluded / 3 needs clarification / 2 conflict**.
- 수정 후 **8 included / 10 excluded / 0 needs clarification / 0 conflict**.
- 기존 35개 테스트를 유지하며 **backend 67개**, **브라우저 E2E 15개** 통과. TypeScript 검사와 프로덕션 빌드 통과.
- 화면은 한국어 중심으로 표시합니다. 내부 enum·Rule ID·API 스키마·판정 로직은 유지하며, 일반 공지의 기준일은 브라우저 로컬 오늘 날짜입니다. 샘플 실행 시에만 제공된 샘플 날짜를 사용합니다.
- 실제 Gemini 호출은 API 키 미설정으로 아직 검증하지 않았습니다. SDK 직렬화, 응답 검증, 재시도, 오류 처리는 모의 응답으로 검증했습니다.
- 이번 단계는 로컬 핵심 흐름에 집중했습니다. Docker 및 공개 배포는 아직 추가하지 않았습니다.

## 로컬 실행

Python 3.11+와 Node.js 22.12+가 필요합니다. 아래 명령은 저장소 루트에서 시작합니다.

### 1. Backend

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

이미 `.env`가 있다면 덮어쓰지 마세요. 재현 가능한 패키지 버전은 `backend/requirements.lock.txt`에도 기록했습니다.

기존 명세처럼 `backend/.venv`에 가상환경을 만들어 실행해도 됩니다.

### 2. Frontend — 별도 터미널

```powershell
cd frontend
npm install
npm run dev
```

- 앱: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- Health: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- API 문서: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

기본 프론트엔드는 Vite `/api` 프록시를 사용합니다. 다른 백엔드 주소를 사용할 때만 `frontend/.env`의 `VITE_API_BASE_URL`을 설정하고, 백엔드 `FRONTEND_ORIGIN`을 프론트엔드 origin과 맞추세요.

## 두 가지 실행 모드

### Sample fixture — 키 없이 데모

1. 키가 없으면 샘플 체험으로 동작합니다. 일반 사용자 화면에는 개발용 모드 선택기가 표시되지 않습니다.
2. **샘플 공지로 체험**을 누릅니다.
3. 규칙, 후보 기준일별 Pass/Fail, 생성된 경계 사례, 18명 대상자와 3개 Findings를 확인합니다.
4. **공지 수정 후 재검증**을 누릅니다.
5. 준비된 수정문을 별도의 픽스처 컴파일 요청에 전달하고, 새로운 AST로 **같은 18명과 원래 생성한 12개 Persona**를 실행합니다.
6. **전체 18명 대신 실제 대상 8명에게 보내세요.** 결과를 확인합니다.

픽스처는 지정된 샘플 원문과 수정문만 지원합니다. 원문이나 메타데이터를 변경하면 거절합니다. 화면과 API 경로에서 픽스처임을 표시하며, Gemini가 실패했을 때 자동으로 픽스처로 대체하지 않습니다. 비활성화하려면 `ENABLE_DEMO_FIXTURES=false`로 설정하세요.

### Gemini live — 실제 컴파일과 수정

`backend/.env`에만 키를 설정합니다. 키는 프론트엔드로 전송하지 않습니다.

```dotenv
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_ORIGIN=http://localhost:5173
ENABLE_DEMO_FIXTURES=true
```

Gemini가 설정된 환경에서는 자동으로 해당 모드를 사용합니다. **샘플 공지로 체험** 또는 직접 공지를 입력한 뒤 **내 공지 테스트**로 시작합니다. 일반 공지는 기본적으로 대상자 없이 자동 생성 경계 사례만 검사하며, 샘플 조직 또는 사용자가 가져온 대상자 데이터를 선택할 수 있습니다.

XLSX는 브라우저에서 `read-excel-file`, CSV/TSV는 `Papa Parse`로 읽은 뒤 하나의 정규화 파이프라인을 거칩니다. 커스텀 열의 이름과 추론 타입은 `availableMemberFields`로 컴파일러에 전달하지만, 이름을 포함한 대상자 행 값은 Gemini 요청에 포함하지 않습니다. 대상자 행은 결정론적 `/api/simulate` 요청에만 사용됩니다. Fix → Re-test는 최초 실행 시 복사해 둔 동일한 대상자와 Persona를 재사용합니다.

개발·회귀 테스트에서 모드를 직접 선택하려면 `frontend/.env.local`에 `VITE_ENABLE_DEV_MODE=true`를 설정하고 Vite를 재시작하세요. 기본값은 숨김이며, 프로덕션 빌드에서는 이 플래그를 설정하지 않습니다. 브라우저 테스트는 실제 Gemini 요청을 차단하고 샘플 API 및 모의 오류만 사용합니다.

정상적인 전체 흐름은 **3회 호출**입니다: compile 1회 → fix 1회 → recompile 1회. 시뮬레이션과 Persona 생성에는 AI 호출이 없습니다. 컴파일 출력 검증 실패 때만 최대 1회 추가 호출합니다. SDK 자동 재시도는 끄고, 각 호출 제한은 40초로 설정했습니다. 재컴파일 실패 후 UI 재시도는 이미 받은 수정문을 재사용합니다.

샘플의 수정 정책은 명세에 정해진 신청 마감일 기준 및 관리자 동일 조건 적용입니다. 다른 공지의 정책 선택은 수정안의 제안으로 표시하고 사람이 검토해야 합니다. 누락된 구성원 사실은 수정문으로 만들어 내지 않습니다.

## 테스트

루트 가상환경을 사용하는 경우:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

```powershell
cd frontend
npm run typecheck
npm run build
# Backend와 Vite 서버를 실행한 상태에서:
npm run test:e2e
```

E2E는 설치된 Chrome을 사용합니다. Edge를 사용하려면 `$env:PLAYWRIGHT_CHANNEL='msedge'`를 설정하세요. Chromium만 사용할 환경이라면 Playwright 설정의 channel을 해당 환경에 맞게 바꾸고 브라우저를 설치하세요. 테스트는 데스크톱과 390px 모바일, 실제 로컬 API의 전체 샘플 흐름, 오류 후 복구와 동일 입력 재사용을 확인합니다. 스크린샷은 `frontend/test-results/`에 생성됩니다.

현재 Windows Codex 샌드박스에서는 Vite의 상위 경로 접근 및 Playwright 프로세스 정리에 추가 실행 권한이 필요했습니다. 일반 로컬 터미널에는 해당 제한이 없습니다.

### 실제 Gemini 스모크 테스트

키 설정 후 다음 명령은 실제 모델을 **정상 기준 3회** 호출합니다. 키가 없으면 호출 없이 종료합니다.

```powershell
cd backend
..\.venv\Scripts\python.exe scripts\live_smoke.py
```

실제 모델이 명세와 다른 규칙을 반환하면 테스트가 실패합니다. 이를 하드코딩한 결과로 숨기지 않습니다.

## 구조

```text
backend/app/
  api/                 demo, compile, simulate, fix
  models/              member, rule, compilation, simulation, requests
  services/engine/     evaluator, date_resolver, conflict_detector, persona_generator, findings
  services/llm/        gemini_client, compiler, fixer
  data/                정확한 샘플 18명, 원문/수정문, 독립적인 AST 픽스처
backend/tests/         엔진, API 전체 흐름, Persona, Gemini 계약 테스트
frontend/src/
  api/                 타입 지정 HTTP 클라이언트
  components/          Rule Cards, Persona, Blast Radius, Findings, Before / After
  targetImport/        XLSX·CSV·TSV 파서, 헤더 정규화, 타입 추론, Member 변환
  pages/HomePage.tsx    useReducer 상태와 전체 흐름
  public/templates/    기본·회사·학교·학원·동아리/협회 XLSX 템플릿
frontend/tests/        Playwright E2E
```

엔진은 `TRUE / FALSE / UNKNOWN`을 사용합니다. 불필요한 가지의 `UNKNOWN`은 최종 판정을 막지 않습니다. 기준일 후보가 모두 같은 결과이면 그 결과를 사용하고, 후보별 결과가 다를 때만 확인을 요청합니다. 날짜는 `dateutil.relativedelta`로 계산합니다. 서로 반대되는 포함/제외 효과에 우선순위가 없으면 `CONFLICT`입니다.

Persona 생성은 AST의 날짜 경계, enum 값, 예외와 기본 조건의 조합으로 제한된 테스트를 생성합니다. 실제 구성원을 정규화하는 기능이 아니며, 합성 테스트 입력은 화면에서 별도로 표시됩니다. 재실행 요청의 `personas`는 이전 입력을 동결하며, 빈 배열도 그대로 존중합니다.

Gemini 2.5의 필수 순환 참조 제약을 피하기 위해 공급자용 JSON Schema에서 boolean 노드를 4단계로 펼칩니다. 내부 AST와 엔진은 재귀 구조를 그대로 사용합니다. 지원 범위를 넘거나 안전하게 해석할 수 없는 조건은 확인이 필요한 규칙으로 유지합니다.

Gemini 구현 참고: [Google 공식 구조화 출력 문서](https://ai.google.dev/gemini-api/docs/generate-content/structured-output). 모델 이름은 명세대로 유지하며 환경변수로 변경할 수 있습니다.

## API

| 경로 | 역할 | 모델 호출 |
| --- | --- | --- |
| `GET /api/health` | 상태 확인 | 없음 |
| `GET /api/demo` | 샘플 공지·구성원·모드 사용 가능 여부 | 없음 |
| `POST /api/compile` | Gemini → 검증된 NoticeCompilation | 1회, 검증 실패 시 추가 최대 1회 |
| `POST /api/simulate` | 규칙 평가·Persona·Findings·집계 | 없음 |
| `POST /api/fix` | Gemini → 수정문·변경 목록 | 1회 |
| `POST /api/demo/compile` | 명시적인 원문/수정문 픽스처 선택 | 없음 |
| `POST /api/demo/fix` | 명시적인 샘플 수정문 | 없음 |

현재 폴더는 Git 저장소로 초기화되어 있지 않아 이전 커밋 기준 diff는 제공할 수 없습니다. 기존 파일과 결정론적 엔진을 유지하면서 미완성 부분을 이어서 구현했습니다.
