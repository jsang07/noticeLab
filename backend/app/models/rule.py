from datetime import date
from typing import Annotated, Literal, Union

from pydantic import Field, model_validator

from .member import Confidence, EmploymentStatus, EmploymentType, ManagerialLevel, Model

Operator = Literal["EQ", "NEQ", "LT", "LTE", "GT", "GTE", "IN", "NOT_IN", "IS_NULL", "IS_NOT_NULL"]
ENUM_FIELDS = {"employmentType": EmploymentType, "employmentStatus": EmploymentStatus, "managerialLevel": ManagerialLevel}
DATE_FIELDS = {"hireDate", "contractEndDate"}
STRING_FIELDS = {"name", "department", "positionTitle"}


class LiteralValue(Model):
    kind: Literal["literal"] = "literal"
    type: Literal["date", "string", "string_array", "number", "number_array", "boolean", "null"]
    value: str | list[str] | list[int | float] | float | bool | None

    @model_validator(mode="after")
    def validate_literal(self):
        valid = {"date": isinstance(self.value, str), "string": isinstance(self.value, str),
                 "string_array": isinstance(self.value, list) and all(isinstance(v, str) for v in self.value),
                 "number": type(self.value) in (int, float),
                 "number_array": isinstance(self.value, list) and all(type(v) in (int, float) for v in self.value),
                 "boolean": isinstance(self.value, bool), "null": self.value is None}
        if not valid[self.type]:
            raise ValueError("Literal type and value disagree")
        if self.type == "date":
            date.fromisoformat(self.value)
        return self


class AnchorReference(Model):
    kind: Literal["anchor_reference"] = "anchor_reference"
    anchorId: str


class UnresolvedReference(Model):
    kind: Literal["unresolved_reference"] = "unresolved_reference"
    uncertaintyId: str
    candidateAnchorIds: list[str] = Field(default_factory=list, max_length=10)


class Offset(Model):
    months: int = Field(default=0, ge=-1200, le=1200)
    days: int = Field(default=0, ge=-36600, le=36600)


class RelativeDate(Model):
    kind: Literal["relative_date"] = "relative_date"
    base: Annotated[AnchorReference | UnresolvedReference, Field(discriminator="kind")]
    offset: Offset


class Condition(Model):
    kind: Literal["condition"] = "condition"
    id: str = Field(min_length=1, max_length=100)
    field: str
    operator: Operator
    value: Annotated[LiteralValue | RelativeDate, Field(discriminator="kind")]
    sourceText: str = Field(min_length=1)
    confidence: Confidence
    requiresConfirmation: bool

    @model_validator(mode="after")
    def check_operand(self):
        if self.field not in DATE_FIELDS | STRING_FIELDS | set(ENUM_FIELDS) and not self.field.startswith("customFields."):
            raise ValueError(f"Unsupported member field: {self.field}")
        if self.operator in ("IS_NULL", "IS_NOT_NULL"):
            if self.value.kind != "literal" or self.value.type != "null":
                raise ValueError("Null checks require a null literal")
            return self
        if self.field in DATE_FIELDS:
            if self.value.kind == "literal" and self.value.type != "date":
                raise ValueError("Date fields require date operands")
            if self.operator in ("IN", "NOT_IN"):
                raise ValueError("Date membership is unsupported")
        elif self.value.kind == "relative_date":
            raise ValueError("Relative dates require a date field")
        if self.operator in ("IN", "NOT_IN"):
            if self.value.kind != "literal" or self.value.type not in ("string_array", "number_array"):
                raise ValueError("Membership requires an array literal")
        elif self.value.kind == "literal" and self.value.type in ("string_array", "number_array"):
            raise ValueError("Arrays require IN or NOT_IN")
        if self.field in ENUM_FIELDS:
            if self.operator not in ("EQ", "NEQ", "IN", "NOT_IN"):
                raise ValueError("Enums support equality and membership only")
            values = self.value.value if isinstance(self.value.value, list) else [self.value.value]
            allowed = {v.value for v in ENUM_FIELDS[self.field] if v.value != "UNKNOWN"}
            if any(v not in allowed for v in values):
                raise ValueError("Unknown/invalid enum operand")
            if self.value.type == "number_array":
                raise ValueError("Enums require text operands")
        if self.field in STRING_FIELDS and self.value.kind == "literal" and self.value.type not in ("string", "string_array"):
            raise ValueError("Text fields require text operands")
        return self


class AllNode(Model):
    kind: Literal["all"] = "all"
    children: list["RuleNode"] = Field(min_length=1, max_length=24)


class AnyNode(Model):
    kind: Literal["any"] = "any"
    children: list["RuleNode"] = Field(min_length=1, max_length=24)


RuleNode = Annotated[Union[Condition, AllNode, AnyNode], Field(discriminator="kind")]
AllNode.model_rebuild()
AnyNode.model_rebuild()


def conditions(node: RuleNode) -> list[Condition]:
    if node.kind == "condition":
        return [node]
    return [condition for child in node.children for condition in conditions(child)]
