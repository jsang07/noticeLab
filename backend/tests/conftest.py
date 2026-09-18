import json
from pathlib import Path

import pytest

from app.models.compilation import NoticeCompilation
from app.models.member import Member

DATA = Path(__file__).resolve().parents[1] / "app" / "data"


@pytest.fixture
def compilation():
    return NoticeCompilation.model_validate_json((DATA / "sample_compilation.json").read_text(encoding="utf-8"))


@pytest.fixture
def fixed_compilation():
    return NoticeCompilation.model_validate_json((DATA / "fixed_compilation.json").read_text(encoding="utf-8"))


@pytest.fixture
def members():
    return [Member.model_validate(m) for m in json.loads((DATA / "sample_members.json").read_text(encoding="utf-8"))]
