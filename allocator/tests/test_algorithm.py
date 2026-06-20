import pytest
from allocator.algorithm import (
    pref_term, skill_term, workload_term, priority_term,
    normalized_weighted_score, run_allocation
)
from allocator.schema import (
    Group, GroupSkill, Availability, Preference,
    Project, RequiredSkill, CriteriaWeights,
    AllocateRequest, Lock
)


class TestScoringFunctions:
    def test_pref_term_first_choice(self):
        group = Group(
            id="g1",
            preferences=[Preference(projectId="p1", rank=1)]
        )
        project = Project(id="p1", capacitySlots=1)
        assert pref_term(group, project) == 1.0

    def test_pref_term_last_choice(self):
        group = Group(
            id="g1",
            preferences=[Preference(projectId="p1", rank=5)]
        )
        project = Project(id="p1", capacitySlots=1)
        assert pref_term(group, project) == 0.0

    def test_pref_term_no_preference(self):
        group = Group(id="g1", preferences=[])
        project = Project(id="p1", capacitySlots=1)
        assert pref_term(group, project) == 0.0

    def test_skill_term_perfect_match(self):
        group = Group(
            id="g1",
            skills=[GroupSkill(skillId="python", level=5)]
        )
        project = Project(
            id="p1",
            capacitySlots=1,
            requiredSkills=[RequiredSkill(skillId="python", minLevel=3, importance=1.0)]
        )
        result = skill_term(group, project)
        assert result == 1.0

    def test_skill_term_partial_match(self):
        group = Group(
            id="g1",
            skills=[GroupSkill(skillId="python", level=2)]
        )
        project = Project(
            id="p1",
            capacitySlots=1,
            requiredSkills=[RequiredSkill(skillId="python", minLevel=4, importance=1.0)]
        )
        result = skill_term(group, project)
        assert result == 0.5

    def test_skill_term_no_requirements(self):
        group = Group(id="g1", skills=[])
        project = Project(id="p1", capacitySlots=1, requiredSkills=[])
        assert skill_term(group, project) == 1.0

    def test_skill_term_missing_skill(self):
        group = Group(id="g1", skills=[])
        project = Project(
            id="p1",
            capacitySlots=1,
            requiredSkills=[RequiredSkill(skillId="python", minLevel=3, importance=1.0)]
        )
        assert skill_term(group, project) == 0.0

    def test_workload_term_sufficient_hours(self):
        group = Group(
            id="g1",
            availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=20)]
        )
        project = Project(id="p1", capacitySlots=1, estimatedHoursPerWeek=15)
        result = workload_term(group, project)
        assert result >= 1.0

    def test_workload_term_insufficient_hours(self):
        group = Group(
            id="g1",
            availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=10)]
        )
        project = Project(id="p1", capacitySlots=1, estimatedHoursPerWeek=20)
        result = workload_term(group, project)
        assert result == 0.5

    def test_workload_term_no_hours_needed(self):
        group = Group(id="g1", availability=[])
        project = Project(id="p1", capacitySlots=1, estimatedHoursPerWeek=0)
        assert workload_term(group, project) == 1.0

    def test_workload_term_no_availability(self):
        group = Group(id="g1", availability=[])
        project = Project(id="p1", capacitySlots=1, estimatedHoursPerWeek=10)
        assert workload_term(group, project) == 0.0

    def test_priority_term(self):
        project = Project(id="p1", capacitySlots=1, priority=0.8)
        assert priority_term(project) == 0.8

    def test_normalized_weighted_score(self):
        group = Group(
            id="g1",
            skills=[GroupSkill(skillId="python", level=4)],
            availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=15)],
            preferences=[Preference(projectId="p1", rank=1)]
        )
        project = Project(
            id="p1",
            capacitySlots=1,
            estimatedHoursPerWeek=10,
            priority=0.7,
            requiredSkills=[RequiredSkill(skillId="python", minLevel=3, importance=1.0)]
        )
        criteria = CriteriaWeights()
        
        score, pref_t, skill_t, work_t, prio_t = normalized_weighted_score(group, project, criteria)
        
        assert 0 <= score <= 1
        assert pref_t == 1.0  # First preference
        assert skill_t == 1.0  # Skill level 4 >= minLevel 3
        assert work_t == 1.0   # 15 hours >= 10 needed
        assert prio_t == 0.7   # Project priority

    def test_normalized_weighted_score_zero_weights(self):
        group = Group(
            id="g1",
            skills=[GroupSkill(skillId="python", level=4)],
            availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=15)],
            preferences=[Preference(projectId="p1", rank=1)]
        )
        project = Project(
            id="p1",
            capacitySlots=1,
            estimatedHoursPerWeek=10,
            priority=0.7,
            requiredSkills=[RequiredSkill(skillId="python", minLevel=3, importance=1.0)]
        )
        criteria = CriteriaWeights(
            weight_skill=0.0,
            weight_preference=0.0,
            weight_workload=0.0,
            weight_priority=0.0
        )

        score, pref_t, skill_t, work_t, prio_t = normalized_weighted_score(group, project, criteria)

        assert pref_t == 1.0
        assert skill_t == 1.0
        assert work_t == 1.0
        assert prio_t == 0.7
        assert score == pytest.approx((pref_t + skill_t + work_t + prio_t) / 4)


class TestAllocationIntegration:
    def test_simple_allocation(self):
        """Test basic allocation with one group and one project"""
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            groups=[
                Group(
                    id="g1",
                    skills=[GroupSkill(skillId="python", level=3)],
                    availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=20)],
                    preferences=[Preference(projectId="p1", rank=1)]
                )
            ],
            projects=[
                Project(
                    id="p1",
                    capacitySlots=1,
                    estimatedHoursPerWeek=15,
                    priority=0.5,
                    requiredSkills=[RequiredSkill(skillId="python", minLevel=2, importance=1.0)]
                )
            ]
        )
        
        response = run_allocation(req)
        
        assert len(response.allocations) == 1
        assert len(response.unallocated) == 0
        assert response.allocations[0].groupId == "g1"
        assert response.allocations[0].projectId == "p1"
        assert response.allocations[0].score is not None

    def test_allocation_with_locks(self):
        """Test allocation with locked assignments"""
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            locks=[Lock(projectId="p1", groupId="g1", status="locked")],
            groups=[Group(id="g1"), Group(id="g2")],
            projects=[
                Project(id="p1", capacitySlots=1),
                Project(id="p2", capacitySlots=1)
            ]
        )
        
        response = run_allocation(req)

        # g1 should be locked to p1
        g1_allocation = next((a for a in response.allocations if a.groupId == "g1"), None)
        assert g1_allocation is not None
        assert g1_allocation.projectId == "p1"

        # Ensure p1 is not over-allocated beyond lock
        p1_groups = [a.groupId for a in response.allocations if a.projectId == "p1"]
        assert p1_groups == ["g1"]

    def test_capacity_constraints(self):
        """Test that capacity constraints are respected"""
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            groups=[Group(id="g1"), Group(id="g2"), Group(id="g3")],
            projects=[Project(id="p1", capacitySlots=2)]  # Only 2 slots
        )
        
        response = run_allocation(req)
        
        # Should not allocate more than 2 groups to p1
        p1_allocations = [a for a in response.allocations if a.projectId == "p1"]
        assert len(p1_allocations) <= 2

    def test_skill_constraints(self):
        """Test that skill requirements are enforced"""
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            groups=[
                Group(
                    id="g1",
                    skills=[GroupSkill(skillId="python", level=1)]  # Too low
                )
            ],
            projects=[
                Project(
                    id="p1",
                    capacitySlots=1,
                    requiredSkills=[RequiredSkill(skillId="python", minLevel=3, importance=1.0)]
                )
            ]
        )
        
        response = run_allocation(req)
        
        # g1 should not be allocated due to insufficient skill level
        assert len(response.allocations) == 0
        assert "g1" in response.unallocated

    def test_unallocated_groups(self):
        """Test handling of unallocated groups"""
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            groups=[Group(id="g1"), Group(id="g2")],
            projects=[Project(id="p1", capacitySlots=1)]  # Only 1 slot for 2 groups
        )
        
        response = run_allocation(req)
        
        assert len(response.allocations) == 1
        assert len(response.unallocated) == 1
        assert response.metrics["allocated"] == 1
        assert response.metrics["unallocated"] == 1

    def test_allocation_reproducibility(self):
        """Ensure identical inputs yield identical outputs across repeated runs"""

        def make_request() -> AllocateRequest:
            return AllocateRequest(
                runId="deterministic-test",
                criteria=CriteriaWeights(),
                groups=[
                    Group(
                        id="g1",
                        members=["u1"],
                        seniority=2,
                        skills=[GroupSkill(skillId="python", level=4)],
                        availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=18)],
                        preferences=[
                            Preference(projectId="p1", rank=1),
                            Preference(projectId="p2", rank=2),
                        ],
                    ),
                    Group(
                        id="g2",
                        members=["u2"],
                        seniority=1,
                        skills=[GroupSkill(skillId="data", level=4)],
                        availability=[Availability(fromWeek=2, toWeek=8, hoursPerWeek=18)],
                        preferences=[
                            Preference(projectId="p2", rank=1),
                            Preference(projectId="p1", rank=2),
                        ],
                    ),
                ],
                projects=[
                    Project(
                        id="p1",
                        capacitySlots=1,
                        estimatedHoursPerWeek=15,
                        priority=0.7,
                        requiredSkills=[
                            RequiredSkill(skillId="python", minLevel=3, importance=1.0)
                        ],
                    ),
                    Project(
                        id="p2",
                        capacitySlots=1,
                        estimatedHoursPerWeek=15,
                        priority=0.6,
                        requiredSkills=[
                            RequiredSkill(skillId="data", minLevel=3, importance=1.0)
                        ],
                    ),
                ],
            )

        runs = [run_allocation(make_request()).model_dump() for _ in range(3)]

        # All runs must produce exactly identical allocations, metrics, and unallocated lists
        assert runs[0] == runs[1] == runs[2], "Allocation results differ across identical runs"

    def test_response_metrics(self):
        """Test that response includes proper metrics"""
        req = AllocateRequest(
            runId="test",
            criteria=CriteriaWeights(),
            groups=[Group(id="g1")],
            projects=[Project(id="p1", capacitySlots=1)]
        )
        
        response = run_allocation(req)
        
        assert "groups" in response.metrics
        assert "projects" in response.metrics
        assert "allocated" in response.metrics
        assert "unallocated" in response.metrics
        assert "byProject" in response.metrics
        assert response.allocator_version == "v1.0.0"
        assert response.used_ml is False
