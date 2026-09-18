from datetime import date
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator

from .compilation import NoticeCompilation
from .member import Model
from .rule import conditions
from .simulation import Finding


class AvailableMemberField(Model):
    field: str = Field(pattern=r"^(name|department|positionTitle|employmentType|employmentStatus|hireDate|contractEndDate|managerialLevel|customFields\.[^\s.].*)$", max_length=160)
    label: str = Field(min_length=1, max_length=120)
    type: Literal["STRING", "NUMBER", "DATE", "BOOLEAN"]


class CompileRequest(Model):
    noticeText: str = Field(min_length=1, max_length=20000)
    noticeDate: date
    timezone: str = "Asia/Seoul"
    availableMemberFields: list[AvailableMemberField] = Field(default_factory=list, max_length=100)

    @field_validator("noticeText")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("Notice must not be blank")
        return value

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("Use a valid IANA timezone") from error
        return value


class CompileResponse(Model):
    compilation: NoticeCompilation
    source: Literal["gemini", "fixture"]


class FixRequest(Model):
    originalNotice: str = Field(min_length=1, max_length=20000)
    compilation: NoticeCompilation
    findings: list[Finding] = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def linked_findings(self):
        nodes = conditions(self.compilation.baselineEligibility)
        for exception in self.compilation.exceptions:
            nodes += conditions(exception.when)
        for action in self.compilation.actions:
            if action.when:
                nodes += conditions(action.when)
        rule_ids = {r.id for r in nodes} | {e.id for e in self.compilation.exceptions} | {a.id for a in self.compilation.actions}
        if len({f.id for f in self.findings}) != len(self.findings):
            raise ValueError("Finding IDs must be unique")
        for finding in self.findings:
            if not finding.affectedRuleIds or not set(finding.affectedRuleIds) <= rule_ids:
                raise ValueError("Findings must link to existing rules")
        return self


class FixChange(Model):
    findingId: str
    description: str = Field(min_length=1, max_length=1200)


class FixResponse(Model):
    revisedNotice: str = Field(min_length=1, max_length=20000)
    changes: list[FixChange] = Field(min_length=1, max_length=40)
