import pytest
from fastapi.testclient import TestClient
from allocator.app import app
from allocator.schema import AllocateRequest, CriteriaWeights, Group, Project


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_request():
    return {
        "runId": "test-run",
        "criteria": {
            "weight_skill": 0.5,
            "weight_preference": 0.3,
            "weight_workload": 0.1,
            "weight_priority": 0.1,
            "avoid_penalty": -0.5
        },
        "locks": [],
        "groups": [
            {
                "id": "g1",
                "members": ["u1"],
                "seniority": 1,
                "skills": [{"skillId": "python", "level": 3}],
                "availability": [{"fromWeek": 2, "toWeek": 8, "hoursPerWeek": 20}],
                "preferences": [{"projectId": "p1", "rank": 1}]
            }
        ],
        "projects": [
            {
                "id": "p1",
                "title": "Test Project",
                "capacitySlots": 1,
                "estimatedHoursPerWeek": 15,
                "priority": 0.5,
                "requiredSkills": [{"skillId": "python", "minLevel": 2, "importance": 1.0}],
                "tags": ["test"]
            }
        ]
    }


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get("/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestAllocateEndpoint:
    def test_allocate_success(self, client, sample_request):
        response = client.post("/v1/allocate", json=sample_request)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "allocations" in data
        assert "unallocated" in data
        assert "metrics" in data
        assert "allocator_version" in data
        assert "used_ml" in data
        
        # Check allocation result
        assert len(data["allocations"]) == 1
        assert data["allocations"][0]["groupId"] == "g1"
        assert data["allocations"][0]["projectId"] == "p1"
        assert data["allocations"][0]["status"] == "proposed"
        
        # Check metrics
        assert data["metrics"]["groups"] == 1
        assert data["metrics"]["projects"] == 1
        assert data["metrics"]["allocated"] == 1
        assert data["metrics"]["unallocated"] == 0

    def test_allocate_invalid_request(self, client):
        invalid_request = {
            "runId": "test",
            "criteria": {"weight_skill": 1.5},  # Invalid weight > 1
            "groups": [],
            "projects": []
        }
        
        response = client.post("/v1/allocate", json=invalid_request)
        assert response.status_code == 422  # Validation error

    def test_allocate_missing_fields(self, client):
        incomplete_request = {
            "runId": "test"
            # Missing required fields
        }
        
        response = client.post("/v1/allocate", json=incomplete_request)
        assert response.status_code == 422

    def test_allocate_with_authorization_header(self, client, sample_request):
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/v1/allocate", json=sample_request, headers=headers)
        
        assert response.status_code == 200

    def test_allocate_empty_groups_projects(self, client):
        empty_request = {
            "runId": "test",
            "criteria": {
                "weight_skill": 0.5,
                "weight_preference": 0.3,
                "weight_workload": 0.1,
                "weight_priority": 0.1
            },
            "groups": [],
            "projects": []
        }
        
        response = client.post("/v1/allocate", json=empty_request)
        assert response.status_code == 200
        
        data = response.json()
        assert data["allocations"] == []
        assert data["unallocated"] == []

    def test_allocate_complex_scenario(self, client):
        complex_request = {
            "runId": "complex-test",
            "criteria": {
                "weight_skill": 0.4,
                "weight_preference": 0.3,
                "weight_workload": 0.2,
                "weight_priority": 0.1
            },
            "locks": [
                {"projectId": "p2", "groupId": "g2", "status": "locked"}
            ],
            "groups": [
                {
                    "id": "g1",
                    "skills": [{"skillId": "python", "level": 4}],
                    "availability": [{"fromWeek": 2, "toWeek": 10, "hoursPerWeek": 25}],
                    "preferences": [
                        {"projectId": "p1", "rank": 1},
                        {"projectId": "p2", "rank": 2}
                    ]
                },
                {
                    "id": "g2",
                    "skills": [{"skillId": "java", "level": 3}],
                    "availability": [{"fromWeek": 3, "toWeek": 9, "hoursPerWeek": 20}]
                },
                {
                    "id": "g3",
                    "skills": [{"skillId": "python", "level": 2}],
                    "availability": [{"fromWeek": 2, "toWeek": 8, "hoursPerWeek": 15}]
                }
            ],
            "projects": [
                {
                    "id": "p1",
                    "capacitySlots": 2,
                    "estimatedHoursPerWeek": 20,
                    "priority": 0.8,
                    "requiredSkills": [{"skillId": "python", "minLevel": 3, "importance": 0.9}]
                },
                {
                    "id": "p2",
                    "capacitySlots": 1,
                    "estimatedHoursPerWeek": 15,
                    "priority": 0.6,
                    "requiredSkills": [{"skillId": "java", "minLevel": 2, "importance": 0.8}]
                }
            ]
        }
        
        response = client.post("/v1/allocate", json=complex_request)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check that g2 is locked to p2
        g2_allocation = next((a for a in data["allocations"] if a["groupId"] == "g2"), None)
        assert g2_allocation is not None
        assert g2_allocation["projectId"] == "p2"
        
        # Check capacity constraints
        p1_allocations = [a for a in data["allocations"] if a["projectId"] == "p1"]
        assert len(p1_allocations) <= 2  # p1 has capacity of 2

    def test_allocate_skill_constraints(self, client):
        request_with_skills = {
            "runId": "skill-test",
            "criteria": {
                "weight_skill": 1.0,
                "weight_preference": 0.0,
                "weight_workload": 0.0,
                "weight_priority": 0.0
            },
            "groups": [
                {
                    "id": "g1",
                    "skills": [{"skillId": "python", "level": 1}]  # Too low
                }
            ],
            "projects": [
                {
                    "id": "p1",
                    "capacitySlots": 1,
                    "requiredSkills": [{"skillId": "python", "minLevel": 3, "importance": 1.0}]
                }
            ]
        }
        
        response = client.post("/v1/allocate", json=request_with_skills)
        assert response.status_code == 200
        
        data = response.json()
        # Group should not be allocated due to insufficient skill
        assert len(data["allocations"]) == 0
        assert "g1" in data["unallocated"]


class TestAppConfiguration:
    def test_app_title_and_version(self):
        assert app.title == "Allocator Service"
        assert app.version == "v1.0.0"

    def test_endpoints_exist(self, client):
        response = client.get("/docs")
        assert response.status_code == 200
