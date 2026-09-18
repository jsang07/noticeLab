from datetime import date
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmploymentType(str, Enum):
    FULL_TIME = "FULL_TIME"
    CONTRACT = "CONTRACT"
    INTERN = "INTERN"
    PART_TIME = "PART_TIME"
    VENDOR = "VENDOR"
    UNKNOWN = "UNKNOWN"


class EmploymentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ON_LEAVE = "ON_LEAVE"
    TERMINATED = "TERMINATED"
    UNKNOWN = "UNKNOWN"


class ManagerialLevel(str, Enum):
    IC = "IC"
    TEAM_LEAD = "TEAM_LEAD"
    DEPARTMENT_HEAD = "DEPARTMENT_HEAD"
    EXECUTIVE = "EXECUTIVE"
    UNKNOWN = "UNKNOWN"


class Confidence(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"


class FieldSource(str, Enum):
    EXPLICIT = "EXPLICIT"
    NORMALIZED = "NORMALIZED"
    DERIVED = "DERIVED"
    UNKNOWN = "UNKNOWN"


class FieldMeta(Model):
    source: FieldSource = FieldSource.UNKNOWN
    confidence: Confidence = Confidence.UNKNOWN


class Member(Model):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(default="Unknown member", max_length=120)
    department: str | None = None
    positionTitle: str | None = None
    employmentType: EmploymentType = EmploymentType.UNKNOWN
    employmentStatus: EmploymentStatus = EmploymentStatus.UNKNOWN
    hireDate: date | None = None
    contractEndDate: date | None = None
    managerialLevel: ManagerialLevel = ManagerialLevel.UNKNOWN
    customFields: dict[str, Any] = Field(default_factory=dict)
    fieldMeta: dict[str, FieldMeta] = Field(default_factory=dict)
