from enum import Enum
from typing import Any, Literal

from pydantic import Field, model_validator

from .compilation import NoticeCompilation
from .member import Member, Model


class Truth(str, Enum):
    TRUE = "TRUE"
    FALSE = "FALSE"
    UNKNOWN = "UNKNOWN"


Status = Literal["INCLUDED", "EXCLUDED", "NEEDS_CLARIFICATION", "CONFLICT"]
ReasonCode = Literal["RULE_AMBIGUITY", "MISSING_MEMBER_FIELD", "MISSING_REFERENCE", "UNSPECIFIED_PRECEDENCE", "CONTRADICTORY_RULES"]


class CandidateEvaluation(Model):
    anchorId: str
    threshold: str
    result: Truth


class Evaluation(Model):
    ruleId: str
    sourceText: str
    field: str
    operator: str
    actual: Any = None
    expected: Any = None
    result: Truth
    reasonCodes: list[ReasonCode] = Field(default_factory=list)
    candidates: list[CandidateEvaluation] = Field(default_factory=list)


class MemberResult(Model):
    memberId: str
    status: Status
    baselineResult: Truth
    reasonCodes: list[ReasonCode]
    summary: str
    evaluations: list[Evaluation]
    decisiveRuleIds: list[str]
    applicableExceptionIds: list[str]


class Persona(Model):
    id: str
    label: str
    member: Member
    generatedFromRuleIds: list[str]


class Finding(Model):
    id: str
    type: str
    severity: Literal["HIGH", "MEDIUM", "LOW"]
    title: str
    question: str
    affectedRuleIds: list[str]
    affectedMemberIds: list[str]
    affectedPersonaIds: list[str] = Field(default_factory=list)


class Summary(Model):
    total: int
    included: int
    excluded: int
    needsClarification: int
    conflict: int


class SimulationRequest(Model):
    compilation: NoticeCompilation
    members: list[Member] = Field(max_length=500)
    generatePersonas: bool = True
    # Supplying the original cases freezes inputs for an exact before/after replay.
    personas: list[Persona] | None = Field(default=None, max_length=12)

    @model_validator(mode="after")
    def unique_members(self):
        if len({m.id for m in self.members}) != len(self.members):
            raise ValueError("Member IDs must be unique")
        if self.personas is not None:
            ids = [p.id for p in self.personas]
            if len(ids) != len(set(ids)) or any(p.id != p.member.id for p in self.personas):
                raise ValueError("Persona IDs must be unique and match member IDs")
        return self


class SimulationResponse(Model):
    memberResults: list[MemberResult]
    personas: list[Persona]
    personaResults: list[MemberResult]
    findings: list[Finding]
    summary: Summary
