from fastapi import APIRouter

from ..models.simulation import SimulationRequest, SimulationResponse, Summary
from ..services.engine.conflict_detector import resolve_member
from ..services.engine.findings import build_findings
from ..services.engine.persona_generator import generate_personas

router = APIRouter()


@router.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest):
    results = [resolve_member(request.compilation, member) for member in request.members]
    personas = request.personas if request.personas is not None else generate_personas(request.compilation) if request.generatePersonas else []
    persona_results = [resolve_member(request.compilation, persona.member) for persona in personas]
    counts = {status: sum(r.status == status for r in results) for status in
              ("INCLUDED", "EXCLUDED", "NEEDS_CLARIFICATION", "CONFLICT")}
    return SimulationResponse(memberResults=results, personas=personas, personaResults=persona_results,
                              findings=build_findings(request.compilation, results, persona_results),
                              summary=Summary(total=len(results), included=counts["INCLUDED"], excluded=counts["EXCLUDED"],
                                              needsClarification=counts["NEEDS_CLARIFICATION"], conflict=counts["CONFLICT"]))
