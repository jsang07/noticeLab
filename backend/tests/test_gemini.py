import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from google import genai
from google.genai import errors

from app.main import app
from app.config import get_settings
from app.api.demo import read_text
from app.models.compilation import NoticeCompilation
from app.models.requests import CompileRequest, FixRequest
from app.services.llm import gemini_client
from app.services.llm.compiler import compile_notice
from app.services.llm.fixer import fix_notice
from app.services.engine.findings import build_findings
from app.services.engine.conflict_detector import resolve_member


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key-never-real")
    factory = MagicMock()
    client = factory.return_value.__enter__.return_value
    monkeypatch.setattr(gemini_client.genai, "Client", factory)
    return factory, client.models.generate_content


def request():
    return CompileRequest(noticeText=read_text("sample_notice.txt"), noticeDate="2026-04-01", timezone="Asia/Seoul")


def test_compile_one_call_and_guardrails(provider, compilation):
    factory, generate = provider
    generate.return_value = SimpleNamespace(text=compilation.model_dump_json())
    assert compile_notice(request()) == compilation
    assert generate.call_count == 1
    kwargs = generate.call_args.kwargs
    assert kwargs["model"] == "gemini-2.5-flash"
    assert kwargs["config"].temperature == 0.1
    assert kwargs["config"].response_mime_type == "application/json"
    assert kwargs["config"].response_json_schema
    assert not kwargs["config"].tools
    assert factory.call_args.kwargs["http_options"].retry_options.attempts == 1


def test_compile_sends_field_descriptors_without_target_rows(provider, compilation):
    _, generate = provider
    generate.return_value = SimpleNamespace(text=compilation.model_dump_json())
    enriched = CompileRequest.model_validate({**request().model_dump(), "availableMemberFields": [
        {"field": "customFields.학년", "label": "학년", "type": "NUMBER"},
        {"field": "customFields.입학일", "label": "입학일", "type": "DATE"},
    ]})
    compile_notice(enriched)
    contents = generate.call_args.kwargs["contents"]
    assert "customFields.학년" in contents and '"type": "NUMBER"' in contents
    assert "김학생" not in contents and "members" not in contents


def test_compile_repairs_validation_once(provider, compilation):
    _, generate = provider
    generate.side_effect = [SimpleNamespace(text='{"version":"bad"}'), SimpleNamespace(text=compilation.model_dump_json())]
    assert compile_notice(request()) == compilation
    assert generate.call_count == 2
    assert "failed validation" in generate.call_args.kwargs["contents"]


def test_compile_stops_after_second_invalid_response(provider):
    _, generate = provider
    generate.return_value = SimpleNamespace(text="not json")
    response = TestClient(app).post("/api/compile", json=request().model_dump(mode="json"))
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "INVALID_STRUCTURED_OUTPUT"
    assert generate.call_count == 2
    assert "test-key" not in response.text


def test_invented_source_rejected(provider, compilation):
    _, generate = provider
    invalid = compilation.model_copy(deep=True)
    invalid.baselineEligibility.children[0].sourceText = "An invented requirement"
    generate.return_value = SimpleNamespace(text=invalid.model_dump_json())
    with pytest.raises(gemini_client.LLMError):
        compile_notice(request())
    assert generate.call_count == 2


@pytest.mark.parametrize("error,status,code", [
    (errors.ClientError(429, {"error": {"message": "Quota exceeded"}}), 429, "GEMINI_RATE_LIMIT"),
    (httpx.ReadTimeout("timeout"), 504, "GEMINI_TIMEOUT"),
    (httpx.ConnectError("offline"), 503, "GEMINI_CONNECTION"),
    (errors.ClientError(403, {"error": {"message": "Forbidden"}}), 503, "GEMINI_AUTH"),
])
def test_provider_errors_no_retry(provider, error, status, code):
    _, generate = provider
    generate.side_effect = error
    response = TestClient(app).post("/api/compile", json=request().model_dump(mode="json"))
    assert response.status_code == status
    assert response.json()["detail"]["code"] == code
    assert generate.call_count == 1


def test_fixer_only_changes_text(provider, compilation, members):
    _, generate = provider
    before = compilation.model_dump_json()
    findings = build_findings(compilation, [resolve_member(compilation, m) for m in members], [])
    generate.return_value = SimpleNamespace(text=json.dumps({"revisedNotice": read_text("fixed_notice.txt"), "changes": [{"findingId": f.id, "description": "Clarification"} for f in findings]}))
    result = fix_notice(FixRequest(originalNotice=request().noticeText, compilation=compilation, findings=findings))
    assert result.revisedNotice == read_text("fixed_notice.txt")
    assert compilation.model_dump_json() == before
    assert generate.call_count == 1
    assert "sampleResolution" in generate.call_args.kwargs["contents"]


def test_real_sdk_serializes_schema_without_network(monkeypatch, compilation):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key-never-real")
    real_client = genai.Client
    requests = []
    def handler(http_request):
        body = json.loads(http_request.content)
        requests.append(body)
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert body["generationConfig"]["responseJsonSchema"]["properties"]["baselineEligibility"]
        return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [{"text": compilation.model_dump_json()}]}, "finishReason": "STOP"}]})
    def factory(**kwargs):
        kwargs["http_options"].client_args = {"transport": httpx.MockTransport(handler)}
        return real_client(**kwargs)
    monkeypatch.setattr(gemini_client.genai, "Client", factory)
    assert compile_notice(request()) == compilation
    assert len(requests) == 1


def test_provider_schema_has_no_cycles():
    schema = gemini_client.json_schema_for(NoticeCompilation)
    def walk(value, path=()):
        if isinstance(value, list):
            for item in value:
                walk(item, path)
        elif isinstance(value, dict):
            if "$ref" in value:
                name = value["$ref"].split("/")[-1]
                assert name not in path, "Gemini 2.5 must not receive required cyclic refs"
                walk(schema["$defs"][name], (*path, name))
            else:
                for key, item in value.items():
                    if key != "$defs":
                        walk(item, path)
    walk(schema)
