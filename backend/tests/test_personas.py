from datetime import date

from app.api.simulate import simulate
from app.models.simulation import SimulationRequest
from app.models.rule import conditions
from app.models.compilation import NoticeCompilation
from app.services.engine.persona_generator import generate_personas


def test_reproducible_rule_driven_suite(compilation):
    personas = generate_personas(compilation)
    assert 8 <= len(personas) <= 12
    assert personas == generate_personas(compilation)
    assert {date(2026, 3, 30), date(2026, 3, 31), date(2026, 4, 1)} <= {p.member.hireDate for p in personas}
    assert {date(2026, 7, 9), date(2026, 7, 10), date(2026, 7, 11)} <= {p.member.contractEndDate for p in personas}
    assert any(p.member.employmentType == "CONTRACT" and p.member.managerialLevel == "TEAM_LEAD" for p in personas)
    assert any(p.member.employmentStatus == "ON_LEAVE" and p.member.managerialLevel == "TEAM_LEAD" for p in personas)
    assert all(p.generatedFromRuleIds for p in personas)


def test_thresholds_follow_ast_not_sample(compilation):
    hire = next(r for r in conditions(compilation.baselineEligibility) if r.id == "hire-date")
    hire.value.value = "2027-02-28"
    assert {date(2027, 2, 27), date(2027, 2, 28), date(2027, 3, 1)} <= {p.member.hireDate for p in generate_personas(compilation)}


def test_fixed_reference_boundary_cases(fixed_compilation):
    personas = generate_personas(fixed_compilation)
    assert {date(2026, 7, 9), date(2026, 7, 10), date(2026, 7, 11)} <= {p.member.contractEndDate for p in personas}


def test_exact_replay(compilation, fixed_compilation, members):
    before = simulate(SimulationRequest(compilation=compilation, members=members))
    after = simulate(SimulationRequest(compilation=fixed_compilation, members=members, personas=before.personas))
    assert before.personas == after.personas
    assert [r.memberId for r in before.personaResults] == [r.memberId for r in after.personaResults]
    assert all(r.status in ("INCLUDED", "EXCLUDED") for r in after.personaResults)
    assert after.findings == []
    assert after.summary.model_dump() == dict(total=18, included=8, excluded=10, needsClarification=0, conflict=0)


def test_empty_replay_does_not_regenerate(compilation, members):
    result = simulate(SimulationRequest(compilation=compilation, members=members, personas=[]))
    assert result.personas == []


def test_disabled_generation(compilation):
    result = simulate(SimulationRequest(compilation=compilation, members=[], generatePersonas=False))
    assert result.personas == []


def test_null_checks_generate_valid_synthetic_members():
    for field in ("hireDate", "employmentType"):
        for operator in ("IS_NULL", "IS_NOT_NULL"):
            compilation = NoticeCompilation.model_validate({"title": "Null check", "anchors": [],
                "baselineEligibility": {"kind": "condition", "id": "null", "field": field, "operator": operator,
                    "value": {"kind": "literal", "type": "null", "value": None}, "sourceText": "Explicit null test", "confidence": "HIGH", "requiresConfirmation": False},
                "exceptions": [], "actions": [], "uncertainties": []})
            assert generate_personas(compilation)
