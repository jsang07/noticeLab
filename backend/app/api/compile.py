from fastapi import APIRouter

from ..models.requests import CompileRequest, CompileResponse
from ..services.llm.compiler import compile_notice

router = APIRouter()


@router.post("/compile", response_model=CompileResponse)
def compile(request: CompileRequest):
    return CompileResponse(compilation=compile_notice(request), source="gemini")
