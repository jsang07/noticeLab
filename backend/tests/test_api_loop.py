import importlib

from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings
from app.api.demo import read_text
from app.models.requests import FixResponse, FixChange


def test_explicit_fixture_closed_loop():
    client = TestClient(app)
    demo = client.get("/api/demo").json()
    notice = demo["notice"]
    body = {"noticeText": notice["text"], "noticeDate": notice["noticeDate"], "timezone": notice["timezone"]}
    compiled = client.post("/api/demo/compile", json=body)
    assert compiled.status_code == 200
    compilation = compiled.json()["compilation"]
    first = client.post("/api/simulate", json={"compilation": compilation, "members": demo["members"], "generatePersonas": True}).json()
    assert first["summary"] == dict(total=18, included=8, excluded=5, needsClarification=3, conflict=2)
    fixed = client.post("/api/demo/fix", json={"originalNotice": notice["text"], "compilation": compilation, "findings": first["findings"]})
    assert fixed.status_code == 200
    body["noticeText"] = fixed.json()["revisedNotice"]
    recompiled = client.post("/api/demo/compile", json=body).json()["compilation"]
    assert recompiled != compilation
    last = client.post("/api/simulate", json={"compilation": recompiled, "members": demo["members"], "personas": first["personas"]}).json()
    assert last["personas"] == first["personas"]
    assert last["summary"] == dict(total=18, included=8, excluded=10, needsClarification=0, conflict=0)
    assert last["findings"] == []


def test_live_routes_recompile_text_not_ast(monkeypatch, compilation, fixed_compilation, members):
    compiler = importlib.import_module("app.api.compile")
    fixer = importlib.import_module("app.api.fix")
    calls = []
    def compile_stub(request):
        calls.append(request.noticeText)
        return fixed_compilation if request.noticeText == "Revised source text" else compilation
    monkeypatch.setattr(compiler, "compile_notice", compile_stub)
    monkeypatch.setattr(fixer, "fix_notice", lambda request: FixResponse(revisedNotice="Revised source text",
        changes=[FixChange(findingId=request.findings[0].id, description="Proposed clarification")]))
    client = TestClient(app)
    request = {"noticeText": "Original source text", "noticeDate": "2026-04-01", "timezone": "Asia/Seoul"}
    first_compilation = client.post("/api/compile", json=request).json()["compilation"]
    member_payload = [m.model_dump(mode="json") for m in members]
    before = client.post("/api/simulate", json={"compilation": first_compilation, "members": member_payload}).json()
    fix = client.post("/api/fix", json={"originalNotice": request["noticeText"], "compilation": first_compilation, "findings": before["findings"]}).json()
    request["noticeText"] = fix["revisedNotice"]
    new_compilation = client.post("/api/compile", json=request).json()["compilation"]
    after = client.post("/api/simulate", json={"compilation": new_compilation, "members": member_payload, "personas": before["personas"]}).json()
    assert calls == ["Original source text", "Revised source text"]
    assert after["summary"]["excluded"] == 10
    assert after["personas"] == before["personas"]


def test_missing_key_is_not_silent_fallback(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    response = TestClient(app).post("/api/compile", json={"noticeText": read_text("sample_notice.txt"), "noticeDate": "2026-04-01"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "GEMINI_NOT_CONFIGURED"


def test_fixture_rejects_custom_notice_and_metadata():
    client = TestClient(app)
    assert client.post("/api/demo/compile", json={"noticeText": "Different notice", "noticeDate": "2026-04-01", "timezone": "Asia/Seoul"}).status_code == 422
    assert client.post("/api/demo/compile", json={"noticeText": read_text("sample_notice.txt"), "noticeDate": "2027-04-01", "timezone": "Asia/Seoul"}).status_code == 422


def test_cors():
    client = TestClient(app)
    allowed = client.options("/api/simulate", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in allowed.headers
    rejected = client.options("/api/simulate", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in rejected.headers


def test_simulation_never_calls_gemini(monkeypatch, compilation, members):
    from google import genai
    def forbidden(*args, **kwargs):
        raise AssertionError("Simulation must not instantiate an LLM client")
    monkeypatch.setattr(genai, "Client", forbidden)
    response = TestClient(app).post("/api/simulate", json={"compilation": compilation.model_dump(mode="json"), "members": [m.model_dump(mode="json") for m in members]})
    assert response.status_code == 200
    assert len(response.json()["personas"]) >= 8
