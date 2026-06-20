import time
import pytest
import random
from typing import List

from allocator.schema import (
    Group, Project, GroupSkill, Availability, Preference, 
    RequiredSkill, AllocateRequest, CriteriaWeights
)
from allocator.algorithm import run_allocation


def generate_groups(num_groups: int, num_skills: int = 10, num_projects: int = 50) -> List[Group]:
    """Generate test groups with random skills, availability, and preferences."""
    groups = []
    
    for i in range(num_groups):
        # Generate random skills (2-5 skills per group)
        num_group_skills = random.randint(2, 5)
        skills = []
        skill_ids = random.sample([f"skill_{j}" for j in range(num_skills)], num_group_skills)
        for skill_id in skill_ids:
            skills.append(GroupSkill(skillId=skill_id, level=random.randint(1, 5)))
        
        # Generate availability (1-2 availability periods)
        num_periods = random.randint(1, 2)
        availability = []
        for _ in range(num_periods):
            from_week = random.randint(2, 8)
            to_week = random.randint(from_week, 12)
            hours = random.randint(5, 40)
            availability.append(Availability(
                fromWeek=from_week,
                toWeek=to_week,
                hoursPerWeek=hours
            ))
        
        # Generate preferences (top 3-5 projects)
        num_prefs = random.randint(3, min(5, num_projects))
        project_ids = random.sample([f"project_{j}" for j in range(num_projects)], num_prefs)
        preferences = []
        for rank, project_id in enumerate(project_ids, 1):
            preferences.append(Preference(projectId=project_id, rank=rank))
        
        # Generate members (1-4 members per group)
        num_members = random.randint(1, 4)
        members = [f"student_{i}_{j}" for j in range(num_members)]
        
        groups.append(Group(
            id=f"group_{i}",
            members=members,
            seniority=random.randint(1, 3),
            skills=skills,
            availability=availability,
            preferences=preferences
        ))
    
    return groups


def generate_projects(num_projects: int, num_skills: int = 10) -> List[Project]:
    """Generate test projects with random requirements and capacities."""
    projects = []
    
    for i in range(num_projects):
        # Generate required skills (0-3 skills per project)
        num_req_skills = random.randint(0, 3)
        required_skills = []
        if num_req_skills > 0:
            skill_ids = random.sample([f"skill_{j}" for j in range(num_skills)], num_req_skills)
            for skill_id in skill_ids:
                required_skills.append(RequiredSkill(
                    skillId=skill_id,
                    minLevel=random.randint(1, 4),
                    importance=random.uniform(0.3, 1.0)
                ))
        
        projects.append(Project(
            id=f"project_{i}",
            title=f"Project {i}",
            capacitySlots=random.randint(1, 3),
            estimatedHoursPerWeek=random.randint(10, 30),
            priority=random.uniform(0.0, 1.0),
            requiredSkills=required_skills
        ))
    
    return projects


def measure_allocation_time(groups: List[Group], projects: List[Project]) -> tuple[float, int]:
    """Measure the time taken to allocate groups to projects."""
    criteria = CriteriaWeights()  # Use default weights
    
    request = AllocateRequest(
        runId="perf_test",
        groups=groups,
        projects=projects,
        criteria=criteria,
        locks=[]
    )
    
    start_time = time.time()
    response = run_allocation(request)
    end_time = time.time()
    
    execution_time = end_time - start_time
    num_allocated = len(response.allocations)
    
    return execution_time, num_allocated


class TestPerformance:
    """Performance tests for the allocation algorithm."""
    
    def test_small_dataset_baseline(self):
        """Baseline test with small dataset (10 groups, 20 projects)."""
        groups = generate_groups(10, num_skills=5, num_projects=20)
        projects = generate_projects(20, num_skills=5)
        
        execution_time, num_allocated = measure_allocation_time(groups, projects)
        
        print(f"\nSmall dataset:")
        print(f"  Groups: {len(groups)}, Projects: {len(projects)}")
        print(f"  Execution time: {execution_time:.4f} seconds")
        print(f"  Groups allocated: {num_allocated}/{len(groups)}")
        print(f"  Allocation rate: {num_allocated/len(groups)*100:.1f}%")
        
        # Should complete quickly
        assert execution_time < 5.0, f"Small dataset took too long: {execution_time:.4f}s"
        assert num_allocated > 0, "No groups were allocated"
    
    def test_medium_dataset(self):
        """Test with medium dataset (50 groups, 100 projects)."""
        groups = generate_groups(50, num_skills=15, num_projects=100)
        projects = generate_projects(100, num_skills=15)
        
        execution_time, num_allocated = measure_allocation_time(groups, projects)
        
        print(f"\nMedium dataset:")
        print(f"  Groups: {len(groups)}, Projects: {len(projects)}")
        print(f"  Execution time: {execution_time:.4f} seconds")
        print(f"  Groups allocated: {num_allocated}/{len(groups)}")
        print(f"  Allocation rate: {num_allocated/len(groups)*100:.1f}%")
        
        # Should complete in reasonable time
        assert execution_time < 30.0, f"Medium dataset took too long: {execution_time:.4f}s"
        assert num_allocated > 0, "No groups were allocated"
    
    @pytest.mark.slow
    def test_large_dataset(self):
        """Test with large dataset (200 groups, 300 projects)."""
        groups = generate_groups(200, num_skills=25, num_projects=300)
        projects = generate_projects(300, num_skills=25)
        
        execution_time, num_allocated = measure_allocation_time(groups, projects)
        
        print(f"\nLarge dataset:")
        print(f"  Groups: {len(groups)}, Projects: {len(projects)}")
        print(f"  Execution time: {execution_time:.4f} seconds")
        print(f"  Groups allocated: {num_allocated}/{len(groups)}")
        print(f"  Allocation rate: {num_allocated/len(groups)*100:.1f}%")
        
        # Should complete in reasonable time for large dataset
        assert execution_time < 120.0, f"Large dataset took too long: {execution_time:.4f}s"
        assert num_allocated > 0, "No groups were allocated"
    
    @pytest.mark.stress
    def test_stress_dataset(self):
        """Stress test with very large dataset (500 groups, 500 projects)."""
        groups = generate_groups(500, num_skills=30, num_projects=500)
        projects = generate_projects(500, num_skills=30)
        
        execution_time, num_allocated = measure_allocation_time(groups, projects)
        
        print(f"\nStress dataset:")
        print(f"  Groups: {len(groups)}, Projects: {len(projects)}")
        print(f"  Execution time: {execution_time:.4f} seconds")
        print(f"  Groups allocated: {num_allocated}/{len(groups)}")
        print(f"  Allocation rate: {num_allocated/len(groups)*100:.1f}%")
        
        # Should complete eventually, but may take longer
        assert execution_time < 60.0, f"Stress dataset took too long: {execution_time:.4f}s"
        assert num_allocated > 0, "No groups were allocated"
    
    def test_scaling_performance(self):
        """Test performance scaling with different dataset sizes."""
        sizes = [(10, 20), (25, 50), (50, 100), (100, 150)]
        results = []
        
        print(f"\nScaling performance test:")
        print(f"{'Groups':>8} {'Projects':>8} {'Time (s)':>10} {'Allocated':>10} {'Rate %':>8}")
        print("-" * 55)
        
        for num_groups, num_projects in sizes:
            groups = generate_groups(num_groups, num_skills=10, num_projects=num_projects)
            projects = generate_projects(num_projects, num_skills=10)
            
            execution_time, num_allocated = measure_allocation_time(groups, projects)
            allocation_rate = num_allocated / len(groups) * 100
            
            results.append((num_groups, num_projects, execution_time, num_allocated, allocation_rate))
            print(f"{num_groups:>8} {num_projects:>8} {execution_time:>10.4f} {num_allocated:>10} {allocation_rate:>7.1f}%")
        
        # Verify that algorithm scales reasonably
        for i in range(1, len(results)):
            prev_time = results[i-1][2]
            curr_time = results[i][2]
            scale_factor = results[i][0] / results[i-1][0]  # Group scaling factor
            
            # Time shouldn't scale worse than O(n^3) for reasonable datasets
            max_expected_time = prev_time * (scale_factor ** 3)
            assert curr_time < max_expected_time * 2, \
                f"Performance degraded too much: {curr_time:.4f}s vs expected max {max_expected_time * 2:.4f}s"
    
    def test_constrained_vs_unconstrained(self):
        """Compare performance with and without skill constraints."""
        num_groups, num_projects = 100, 150
        
        # Generate groups and projects with skills
        groups_constrained = generate_groups(num_groups, num_skills=20, num_projects=num_projects)
        projects_constrained = generate_projects(num_projects, num_skills=20)
        
        # Generate projects without skill requirements
        projects_unconstrained = []
        for i, proj in enumerate(projects_constrained):
            projects_unconstrained.append(Project(
                id=proj.id,
                title=proj.title,
                capacitySlots=proj.capacitySlots,
                estimatedHoursPerWeek=proj.estimatedHoursPerWeek,
                priority=proj.priority,
                requiredSkills=[]  # No skill requirements
            ))
        
        # Test constrained
        time_constrained, allocated_constrained = measure_allocation_time(
            groups_constrained, projects_constrained
        )
        
        # Test unconstrained
        time_unconstrained, allocated_unconstrained = measure_allocation_time(
            groups_constrained, projects_unconstrained
        )
        
        print(f"\nConstrained vs Unconstrained:")
        print(f"  With skill constraints:")
        print(f"    Time: {time_constrained:.4f}s, Allocated: {allocated_constrained}")
        print(f"  Without skill constraints:")
        print(f"    Time: {time_unconstrained:.4f}s, Allocated: {allocated_unconstrained}")
        print(f"  Constraint overhead: {time_constrained - time_unconstrained:.4f}s")
        
        # Both should complete in reasonable time
        assert time_constrained < 60.0, "Constrained allocation took too long"
        assert time_unconstrained < 60.0, "Unconstrained allocation took too long"
        
        # Usually unconstrained should allocate more groups
        # (but this isn't guaranteed due to other constraints)
        assert allocated_constrained > 0, "No groups allocated with constraints"
        assert allocated_unconstrained > 0, "No groups allocated without constraints"


if __name__ == "__main__":
    # Run basic performance tests
    test = TestPerformance()
    print("Running basic performance tests...")
    test.test_small_dataset_baseline()
    test.test_medium_dataset()
    test.test_scaling_performance()
    test.test_constrained_vs_unconstrained()
    print("\nAll basic performance tests completed successfully!")
