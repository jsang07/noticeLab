from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from app.main import app
from app.api.simulate import simulate
from app.models.member import Member
from app.models.compilation import NoticeCompilation
from app.models.simulation import SimulationRequest


def test_exact_sample_groups(compilation, members):
    result = simulate(SimulationRequest(compilation=compilation, members=members, generatePersonas=False))
    assert result.summary.model_dump() == dict(total=18, included=8, excluded=5, needsClarification=3, conflict=2)
    for status, ids in {
        "INCLUDED": ["M01", "M02", "M03", "M11", "M15", "M16", "M17", "M18"],
        "EXCLUDED": ["M04", "M05", "M12", "M13", "M14"],
        "NEEDS_CLARIFICATION": ["M06", "M07", "M08"], "CONFLICT": ["M09", "M10"],
    }.items():
        assert [r.memberId for r in result.memberResults if r.status == status] == ids
    assert [f.affectedMemberIds for f in result.findings] == [["M06", "M07", "M08"], ["M09"], ["M10"]]


def test_fixed_sample(fixed_compilation, members):
    result = simulate(SimulationRequest(compilation=fixed_compilation, members=members, generatePersonas=False))
    assert result.summary.model_dump() == dict(total=18, included=8, excluded=10, needsClarification=0, conflict=0)
    assert result.findings == []


def test_api_simulation(compilation, members):
    client = TestClient(app)
    assert client.get("/api/health").json() == {"status": "ok"}
    payload = SimulationRequest(compilation=compilation, members=members).model_dump(mode="json")
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    assert response.json()["summary"]["conflict"] == 2
    payload["members"][0]["employmentType"] = "made-up"
    assert client.post("/api/simulate", json=payload).status_code == 422


def test_member_defaults_never_fabricate():
    member = Member(id="missing")
    assert member.employmentType == "UNKNOWN"
    assert member.hireDate is None
    assert member.contractEndDate is None
    with pytest.raises(ValidationError):
        Member(id="bad", remainingContractMonths=3)


def test_dangling_reference_rejected(compilation):
    payload = compilation.model_dump()
    payload["anchors"] = []
    with pytest.raises(ValidationError):
        NoticeCompilation.model_validate(payload)


def test_empty_boolean_rejected(compilation):
    payload = compilation.model_dump()
    payload["baselineEligibility"] = {"kind": "all", "children": []}
    with pytest.raises(ValidationError):
        NoticeCompilation.model_validate(payload)
