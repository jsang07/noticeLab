"""Opt-in real Gemini smoke: 3 normal model calls. Never uses demo compilation routes."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def main() -> int:
    if not get_settings().gemini_api_key:
        print("GEMINI_API_KEY is not configured in backend/.env. No model calls were made.")
        return 2
    client = TestClient(app)
    demo = client.get("/api/demo").json()
    notice = demo["notice"]
    payload = {"noticeText": notice["text"], "noticeDate": notice["noticeDate"], "timezone": notice["timezone"]}
    print(f"Running live Gemini smoke with {get_settings().gemini_model}. Expected model calls: 3.")
    compiled = client.post("/api/compile", json=payload)
    compiled.raise_for_status()
    compilation = compiled.json()["compilation"]
    before_response = client.post("/api/simulate", json={"compilation": compilation, "members": demo["members"]})
    before_response.raise_for_status()
    before = before_response.json()
    print("Before:", before["summary"])
    assert before["summary"] == dict(total=18, included=8, excluded=5, needsClarification=3, conflict=2), "Live compiler did not preserve sample semantics"
    fixed = client.post("/api/fix", json={"originalNotice": notice["text"], "compilation": compilation, "findings": before["findings"]})
    fixed.raise_for_status()
    payload["noticeText"] = fixed.json()["revisedNotice"]
    recompiled = client.post("/api/compile", json=payload)
    recompiled.raise_for_status()
    new_compilation = recompiled.json()["compilation"]
    after_response = client.post("/api/simulate", json={"compilation": new_compilation, "members": demo["members"], "personas": before["personas"]})
    after_response.raise_for_status()
    after = after_response.json()
    print("After: ", after["summary"])
    assert after["summary"] == dict(total=18, included=8, excluded=10, needsClarification=0, conflict=0)
    assert before["personas"] == after["personas"]
    assert not new_compilation["uncertainties"] and not after["findings"]
    print("PASS: live compile -> fix -> fresh compile -> identical replay. Send to 8 people, not 18.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
