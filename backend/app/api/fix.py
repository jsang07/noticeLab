from fastapi import APIRouter

from ..models.requests import FixRequest, FixResponse
from ..services.llm.fixer import fix_notice

router = APIRouter()


@router.post("/fix", response_model=FixResponse)
def fix(request: FixRequest):
    return fix_notice(request)
