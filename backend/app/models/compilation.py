from datetime import date, datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, model_validator

from .member import Model
from .rule import RuleNode, conditions


class Anchor(Model):
    id: str
    type: Literal["DATE", "DATETIME"]
    value: str

    @model_validator(mode="after")
    def valid_date(self):
        if self.type == "DATE":
            date.fromisoformat(self.value)
        else:
            parsed = datetime.fromisoformat(self.value)
            if parsed.tzinfo is None:
                raise ValueError("Datetime anchors must include a timezone offset")
        return self


class ExceptionRule(Model):
    id: str
    when: RuleNode
    effect: Literal["INCLUDE", "EXCLUDE"]
    precedence: Literal["OVERRIDE_BASELINE", "BASELINE_WINS", "UNSPECIFIED"]
    sourceText: str = Field(min_length=1)


class Action(Model):
    id: str
    description: str
    when: RuleNode | None = None
    deadlineAnchorId: str | None = None
    sourceText: str


class Uncertainty(Model):
    id: str
    type: Literal["MISSING_REFERENCE", "UNSPECIFIED_PRECEDENCE", "AMBIGUOUS_BOUNDARY", "MISSING_REQUIRED_FACT", "OTHER"]
    severity: Literal["HIGH", "MEDIUM", "LOW"]
    question: str
    candidateAnchorIds: list[str] = Field(default_factory=list)
    affectsRuleIds: list[str] = Field(min_length=1)


class NoticeCompilation(Model):
    version: Literal["1.0"] = "1.0"
    title: str
    timezone: str = "Asia/Seoul"
    anchors: list[Anchor] = Field(max_length=20)
    baselineEligibility: RuleNode
    exceptions: list[ExceptionRule] = Field(max_length=8)
    actions: list[Action] = Field(max_length=20)
    uncertainties: list[Uncertainty] = Field(max_length=30)

    @model_validator(mode="after")
    def validate_links(self):
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("Use a valid IANA timezone") from error
        nodes = conditions(self.baselineEligibility)
        for exception in self.exceptions:
            nodes += conditions(exception.when)
        for action in self.actions:
            if action.when:
                nodes += conditions(action.when)
        if len(nodes) > 100:
            raise ValueError("At most 100 conditions are supported")
        rule_ids = [n.id for n in nodes] + [e.id for e in self.exceptions] + [a.id for a in self.actions]
        anchor_ids = [a.id for a in self.anchors]
        uncertainty_ids = [u.id for u in self.uncertainties]
        for ids in (rule_ids, anchor_ids, uncertainty_ids):
            if len(ids) != len(set(ids)):
                raise ValueError("IDs must be unique within their namespace")
        for uncertainty in self.uncertainties:
            if not set(uncertainty.affectsRuleIds) <= set(rule_ids):
                raise ValueError("Uncertainty refers to missing rules")
            if not set(uncertainty.candidateAnchorIds) <= set(anchor_ids):
                raise ValueError("Uncertainty refers to missing anchors")
        for node in nodes:
            if node.value.kind == "relative_date":
                base = node.value.base
                ids = [base.anchorId] if base.kind == "anchor_reference" else base.candidateAnchorIds
                if not set(ids) <= set(anchor_ids):
                    raise ValueError("Relative date refers to missing anchors")
                if base.kind == "unresolved_reference":
                    uncertainty = next((u for u in self.uncertainties if u.id == base.uncertaintyId), None)
                    if not uncertainty or node.id not in uncertainty.affectsRuleIds:
                        raise ValueError("Unresolved reference must link to an uncertainty affecting this rule")
        for action in self.actions:
            if action.deadlineAnchorId and action.deadlineAnchorId not in anchor_ids:
                raise ValueError("Action refers to missing deadline anchor")
        return self
