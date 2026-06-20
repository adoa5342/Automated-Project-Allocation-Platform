from typing import List, Dict, Optional, Literal, Any
from pydantic import BaseModel, Field, conint, confloat

# Enums
Pref = Literal["like", "neutral", "avoid"]
LockStatus = Literal["locked", "confirmed"]
AllocStatus = Literal["proposed", "locked", "final"]

# Group models
class GroupSkill(BaseModel):
    skillId: str
    level: conint(ge=1, le=5)

class Availability(BaseModel):
    fromWeek: conint(ge=2, le=12)
    toWeek: conint(ge=2, le=12)
    hoursPerWeek: conint(ge=0)

class Preference(BaseModel):
    projectId: str
    rank: conint(ge=1, le=5)

class Group(BaseModel):
    id: str
    members: Optional[List[str]] = None  
    seniority: Optional[conint(ge=1, le=3)] = None
    skills: List[GroupSkill] = Field(default_factory=list)
    availability: List[Availability] = Field(default_factory=list)
    preferences: List[Preference] = Field(default_factory=list)

# Project models
class RequiredSkill(BaseModel):
    skillId: str
    minLevel: conint(ge=1, le=5)
    importance: confloat(ge=0.0, le=1.0)

class Project(BaseModel):
    id: str
    title: Optional[str] = None
    capacitySlots: conint(ge=1)
    estimatedHoursPerWeek: conint(ge=0) = 0
    priority: confloat(ge=0.0, le=1.0) = 0.0
    cohort: Optional[str] = None
    dueWeek: Optional[conint(ge=2, le=12)] = None
    requiredSkills: List[RequiredSkill] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None

# Global knobs
class CriteriaWeights(BaseModel):
    weight_skill: confloat(ge=0.0, le=1.0) = 0.5
    weight_preference: confloat(ge=0.0, le=1.0) = 0.3
    weight_workload: confloat(ge=0.0, le=1.0) = 0.1
    weight_priority: confloat(ge=0.0, le=1.0) = 0.1
    avoid_penalty: confloat(le=0.0) = -0.5

class Lock(BaseModel):
    projectId: str
    groupId: str
    status: LockStatus

# Request + Response
class AllocateRequest(BaseModel):
    runId: str
    cohort: Optional[str] = None
    criteria: CriteriaWeights
    locks: List[Lock] = Field(default_factory=list)
    groups: List[Group]
    projects: List[Project]

class AllocationOut(BaseModel):
    groupId: str           
    projectId: str
    status: AllocStatus = "proposed"
    rank: Optional[int] = None
    score: Optional[confloat(ge=0.0, le=1.0)] = None
    skill_fit: Optional[confloat(ge=0.0, le=1.0)] = None
    pref_term: Optional[confloat(ge=0.0, le=1.0)] = None
    workload_term: Optional[confloat(ge=0.0, le=1.0)] = None
    priority_term: Optional[confloat(ge=0.0, le=1.0)] = None

class AllocateResponse(BaseModel):
    allocations: List[AllocationOut]
    unallocated: List[str]
    metrics: Dict[str, Any]  
    allocator_version: str
    used_ml: bool = False
