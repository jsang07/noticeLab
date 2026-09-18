import json
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import Field

from ..config import DATA, get_settings
from ..models.compilation import NoticeCompilation
from ..models.member import Member, Model
from ..models.requests import FixRequest, FixResponse, FixChange

router = APIRouter()


def read_text(name: str) -> str:
    return (DATA / name).read_text(encoding="utf-8").strip()


def load_compilation(fixed: bool = False) -> NoticeCompilation:
    return NoticeCompilation.model_validate_json(read_text("fixed_compilation.json" if fixed else "sample_compilation.json"))


@router.get("/demo")
def demo():
    settings = get_settings()
    return {
        "notice": {"title": "2026년 상반기 직무역량 교육비 지원 안내", "noticeDate": "2026-04-01",
                   "timezone": "Asia/Seoul", "text": read_text("sample_notice.txt")},
        "members": [Member.model_validate(m) for m in json.loads(read_text("sample_members.json"))],
        "capabilities": {"geminiConfigured": bool(settings.gemini_api_key), "demoFixtures": settings.enable_demo_fixtures},
    }


class DemoCompileRequest(Model):
    noticeText: str = Field(min_length=1, max_length=20000)
    noticeDate: date
    timezone: str


@router.post("/demo/compile")
def fixture_compile(request: DemoCompileRequest):
    if not get_settings().enable_demo_fixtures:
        raise HTTPException(404, "샘플 픽스처 모드가 비활성화되어 있습니다.")
    if request.noticeDate != date(2026, 4, 1) or request.timezone != "Asia/Seoul":
        raise HTTPException(422, "샘플 모드에서는 제공된 공지 날짜와 시간대만 사용할 수 있습니다.")
    for fixed, filename in [(False, "sample_notice.txt"), (True, "fixed_notice.txt")]:
        if request.noticeText.strip() == read_text(filename):
            return {"compilation": load_compilation(fixed), "source": "fixture"}
    raise HTTPException(422, "샘플 모드는 제공된 원문과 수정문만 지원합니다. 직접 작성한 공지는 Gemini 모드를 사용해 주세요.")


@router.post("/demo/fix", response_model=FixResponse)
def fixture_fix(request: FixRequest):
    if not get_settings().enable_demo_fixtures:
        raise HTTPException(404, "샘플 픽스처 모드가 비활성화되어 있습니다.")
    if request.originalNotice.strip() != read_text("sample_notice.txt") or request.compilation != load_compilation():
        raise HTTPException(422, "샘플 수정은 제공된 원문과 샘플 규칙에만 적용할 수 있습니다.")
    descriptions = {"MISSING_REFERENCE": "잔여 계약기간 기준일을 신청 마감일인 2026년 4월 10일로 명시합니다.",
                    "UNSPECIFIED_PRECEDENCE": "팀장 이상에게도 입사일, 고용형태, 계약기간 및 휴직 제외 조건을 동일하게 적용합니다."}
    return FixResponse(revisedNotice=read_text("fixed_notice.txt"), changes=[FixChange(findingId=f.id,
        description=descriptions.get(f.type, "샘플 정책에 따라 모호한 조건을 명시합니다.")) for f in request.findings])
