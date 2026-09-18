"""One provider, bounded calls, structured JSON only. No eligibility decisions here."""
import logging
from copy import deepcopy
from typing import Callable, TypeVar

import httpx
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from ...config import get_settings

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    def __init__(self, code: str, message: str, status: int = 502):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


def json_schema_for(model: type[BaseModel]) -> dict:
    """Derive a provider schema from Pydantic without required cyclic refs.

    Gemini's JSON Schema field accepts anyOf; the discriminated alternatives
    remain disjoint because their kind constants differ. Pydantic is the final
    validator. Gemini 2.5 restricts required cyclic refs; unroll boolean groups
    into four finite levels. This covers the MVP's all/any/all tree while keeping
    the internal Rule AST recursive and unchanged. Never parse free-form text.
    """
    def adapt(value):
        if isinstance(value, list):
            return [adapt(item) for item in value]
        if not isinstance(value, dict):
            return value
        output = {}
        for key, item in value.items():
            if key in ("discriminator", "default", "title"):
                continue
            if key == "const":
                output["enum"] = [item]
            else:
                output["anyOf" if key == "oneOf" else key] = adapt(item)
        return output
    schema = adapt(model.model_json_schema())
    definitions = schema.get("$defs", {})
    if "AllNode" in definitions and "AnyNode" in definitions:
        templates = {kind: definitions.pop(kind) for kind in ("AllNode", "AnyNode")}
        for level in range(1, 5):
            for kind, template in templates.items():
                group = deepcopy(template)
                alternatives = [{"$ref": "#/$defs/Condition"}]
                if level > 1:
                    alternatives += [{"$ref": f"#/$defs/{name}Level{level-1}"} for name in templates]
                group["properties"]["children"]["items"] = {"anyOf": alternatives}
                definitions[f"{kind}Level{level}"] = group
        def redirect(value):
            if isinstance(value, list):
                for item in value:
                    redirect(item)
            elif isinstance(value, dict):
                if value.get("$ref") in ("#/$defs/AllNode", "#/$defs/AnyNode"):
                    value["$ref"] += "Level4"
                for item in value.values():
                    redirect(item)
        redirect(schema)
    return schema


def generate_validated(model: type[T], system: str, prompt: str, *,
                       validation_retries: int = 0, validate: Callable[[T], None] | None = None) -> T:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise LLMError("GEMINI_NOT_CONFIGURED", "Gemini API 키가 설정되어 있지 않습니다. backend/.env의 GEMINI_API_KEY를 설정하거나 Sample fixture 모드를 사용해 주세요.", 503)
    try:
        # Disable SDK automatic retries: compile has at most one validation retry.
        with genai.Client(api_key=settings.gemini_api_key,
                          http_options=types.HttpOptions(timeout=40000, retry_options=types.HttpRetryOptions(attempts=1))) as client:
            for attempt in range(validation_retries + 1):
                response = client.models.generate_content(
                    model=settings.gemini_model, contents=prompt,
                    config=types.GenerateContentConfig(system_instruction=system, temperature=0.1,
                        response_mime_type="application/json", response_json_schema=json_schema_for(model),
                        max_output_tokens=16000),
                )
                try:
                    if not response.text:
                        raise ValueError("Empty or blocked model response")
                    result = model.model_validate_json(response.text)
                    if validate:
                        validate(result)
                    return result
                except (ValidationError, ValueError) as error:
                    logger.warning("Gemini structured output failed validation (attempt %s)", attempt + 1)
                    if attempt == validation_retries:
                        raise LLMError("INVALID_STRUCTURED_OUTPUT", "Gemini의 규칙 출력을 검증하지 못했습니다. 공지의 조건을 더 명확히 작성한 뒤 다시 시도해 주세요.") from error
                    # Do not include full user values in diagnostics or logs.
                    details = [{"loc": list(e["loc"]), "message": e["msg"]} for e in error.errors(include_input=False, include_context=False)] if isinstance(error, ValidationError) else str(error)
                    prompt += f"\nYour previous response failed validation: {details}. Return the entire corrected JSON; do not omit any notice conditions."
    except LLMError:
        raise
    except errors.APIError as error:
        logger.warning("Gemini API error, HTTP %s", error.code)
        if error.code == 429:
            raise LLMError("GEMINI_RATE_LIMIT", "Gemini 요청 한도에 도달했습니다. 사용량 또는 요금제 한도를 확인하고 잠시 후 다시 시도해 주세요.", 429) from error
        if error.code in (401, 403):
            raise LLMError("GEMINI_AUTH", "Gemini API 키 또는 프로젝트 접근 권한을 확인해 주세요.", 503) from error
        raise LLMError("GEMINI_UNAVAILABLE", "Gemini가 요청을 처리하지 못했습니다. 모델 설정과 서비스 상태를 확인한 뒤 다시 시도해 주세요.") from error
    except (httpx.TimeoutException, TimeoutError) as error:
        raise LLMError("GEMINI_TIMEOUT", "Gemini 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.", 504) from error
    except (httpx.RequestError, ConnectionError) as error:
        raise LLMError("GEMINI_CONNECTION", "Gemini에 연결할 수 없습니다. 서버 네트워크 상태를 확인해 주세요.", 503) from error
    raise LLMError("INVALID_STRUCTURED_OUTPUT", "유효한 구조화 출력을 받지 못했습니다.")
