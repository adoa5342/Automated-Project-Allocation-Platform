import pytest
from pydantic import ValidationError
from allocator.schema import (
    Group, GroupSkill, Availability, Preference,
    Project, RequiredSkill, CriteriaWeights, Lock,
    AllocateRequest, AllocateResponse, AllocationOut
)


class TestGroupModels:
    def test_group_skill_valid(self):
        skill = GroupSkill(skillId="python", level=3)
        assert skill.skillId == "python"
        assert skill.level == 3

    def test_group_skill_invalid_level(self):
        with pytest.raises(ValidationError):
            GroupSkill(skillId="python", level=0)
        with pytest.raises(ValidationError):
            GroupSkill(skillId="python", level=6)

    def test_availability_valid(self):
        avail = Availability(fromWeek=2, toWeek=8, hoursPerWeek=20)
        assert avail.fromWeek == 2
        assert avail.toWeek == 8
        assert avail.hoursPerWeek == 20

    def test_availability_invalid_weeks(self):
        with pytest.raises(ValidationError):
            Availability(fromWeek=1, toWeek=8, hoursPerWeek=20)
        with pytest.raises(ValidationError):
            Availability(fromWeek=2, toWeek=13, hoursPerWeek=20)

    def test_group_minimal(self):
        group = Group(id="g1")
        assert group.id == "g1"
        assert group.skills == []
        assert group.availability == []
        assert group.preferences == []

    def test_group_full(self):
        group = Group(
            id="g1",
            members=["u1", "u2"],
            seniority=2,
            skills=[GroupSkill(skillId="python", level=3)],
            availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=20)],
            preferences=[Preference(projectId="p1", rank=1)]
        )
        assert len(group.members) == 2
        assert group.seniority == 2
        assert len(group.skills) == 1


class TestProjectModels:
    def test_required_skill_valid(self):
        skill = RequiredSkill(skillId="java", minLevel=2, importance=0.8)
        assert skill.skillId == "java"
        assert skill.minLevel == 2
        assert skill.importance == 0.8

    def test_required_skill_invalid_importance(self):
        with pytest.raises(ValidationError):
            RequiredSkill(skillId="java", minLevel=2, importance=1.5)

    def test_project_minimal(self):
        project = Project(id="p1", capacitySlots=2)
        assert project.id == "p1"
        assert project.capacitySlots == 2
        assert project.priority == 0.0
        assert project.requiredSkills == []

    def test_project_full(self):
        project = Project(
            id="p1",
            title="Test Project",
            capacitySlots=3,
            estimatedHoursPerWeek=15,
            priority=0.7,
            cohort="2025A",
            dueWeek=10,
            requiredSkills=[RequiredSkill(skillId="python", minLevel=2, importance=0.9)],
            tags=["ml", "data"],
            description="A test project"
        )
        assert project.title == "Test Project"
        assert project.priority == 0.7
        assert len(project.tags) == 2


class TestCriteriaWeights:
    def test_default_weights(self):
        criteria = CriteriaWeights()
        assert criteria.weight_skill == 0.5
        assert criteria.weight_preference == 0.3
        assert criteria.weight_workload == 0.1
        assert criteria.weight_priority == 0.1
        assert criteria.avoid_penalty == -0.5

    def test_custom_weights(self):
        criteria = CriteriaWeights(
            weight_skill=0.6,
            weight_preference=0.2,
            weight_workload=0.1,
            weight_priority=0.1
        )
        assert criteria.weight_skill == 0.6

    def test_invalid_weights(self):
        with pytest.raises(ValidationError):
            CriteriaWeights(weight_skill=1.5)


class TestAllocateRequest:
    def test_minimal_request(self):
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            groups=[Group(id="g1")],
            projects=[Project(id="p1", capacitySlots=1)]
        )
        assert req.runId == "test"
        assert len(req.groups) == 1
        assert len(req.projects) == 1
        assert req.locks == []

    def test_request_with_locks(self):
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            locks=[Lock(projectId="p1", groupId="g1", status="locked")],
            groups=[Group(id="g1")],
            projects=[Project(id="p1", capacitySlots=1)]
        )
        assert len(req.locks) == 1
        assert req.locks[0].status == "locked"


class TestAllocationOut:
    def test_allocation_minimal(self):
        alloc = AllocationOut(groupId="g1", projectId="p1")
        assert alloc.groupId == "g1"
        assert alloc.projectId == "p1"
        assert alloc.status == "proposed"

    def test_allocation_full(self):
        alloc = AllocationOut(
            groupId="g1",
            projectId="p1",
            status="final",
            rank=1,
            score=0.85,
            skill_fit=0.9,
            pref_term=0.8,
            workload_term=0.7,
            priority_term=0.6
        )
        assert alloc.status == "final"
        assert alloc.score == 0.85


class TestAllocateResponse:
    def test_response_structure(self):
        response = AllocateResponse(
            allocations=[AllocationOut(groupId="g1", projectId="p1")],
            unallocated=["g2"],
            metrics={"total": 2},
            allocator_version="v1.0.0"
        )
        assert len(response.allocations) == 1
        assert len(response.unallocated) == 1
        assert response.used_ml is False
