from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.simulate import router as simulate_router
from .api.demo import router as demo_router
from .api.compile import router as compile_router
from .api.fix import router as fix_router
from .config import get_settings
from .services.llm.gemini_client import LLMError

app = FastAPI(title="Notice Lab", version="1.0.0", description="LLM compiles. Code decides.")
app.include_router(simulate_router, prefix="/api")
app.include_router(demo_router, prefix="/api")
app.include_router(compile_router, prefix="/api")
app.include_router(fix_router, prefix="/api")
app.add_middleware(CORSMiddleware, allow_origins=[get_settings().frontend_origin],
                   allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.exception_handler(LLMError)
async def llm_error_handler(request, error: LLMError):
    return JSONResponse(status_code=error.status, content={"detail": {"code": error.code, "message": error.message}})


@app.get("/api/health")
def health():
    return {"status": "ok"}
