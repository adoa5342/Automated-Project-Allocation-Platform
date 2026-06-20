# Allocation Engine

This project implements a **constraint programming (CP-SAT)**-based allocation engine built using **Google OR-Tools**. It assigns groups (such as teams or individuals) to projects based on weighted criteria including skills, preferences, workload, and project priority.

---

## 1. Setup and Installation

Clone the repository and install dependencies:

```bash
cd allocator
python -m pip install -r requirements.txt
python app.py
```

---

## 2. Run the API with Uvicorn

Start the API from the project root:

```bash
python -m uvicorn allocator.app:app --reload
```

Then open the Swagger UI in your browser:

```
http://127.0.0.1:8000/docs
```

---

## 3. Using the API via Swagger UI

Locate the endpoint:

```
POST /allocate/v1/allocate
```

Click **Try it out** and paste a JSON payload in this format:

```json
{
  "runId": "string",
  "cohort": "string",
  "criteria": {
    "weight_skill": 0.5,
    "weight_preference": 0.3,
    "weight_workload": 0.1,
    "weight_priority": 0.1,
    "avoid_penalty": -0.5
  },
  "locks": [
    { "projectId": "string", "userId": "string", "status": "locked" }
  ],
  "groups": [
    {
      "id": "string",
      "members": ["string"],
      "seniority": 1,
      "skills": [{ "skillId": "string", "level": 1 }],
      "availability": [{ "fromWeek": 2, "toWeek": 2, "hoursPerWeek": 0 }],
      "preferences": [{ "projectId": "string", "rank": 1 }]
    }
  ],
  "projects": [
    {
      "id": "string",
      "title": "string",
      "capacitySlots": 1,
      "estimatedHoursPerWeek": 0,
      "priority": 0,
      "cohort": "string",
      "dueWeek": 2,
      "requiredSkills": [
        { "skillId": "string", "minLevel": 1, "importance": 1 }
      ],
      "tags": ["string"],
      "description": "string"
    }
  ]
}
```

---

## 4. Execute and Review Results

Click **Execute** in Swagger UI. The response includes:

- **Allocations:** which groups were assigned to which projects.
- **Unallocated groups:** groups that could not be matched under current constraints.
- **Project summary:** capacity, number of assigned groups, and overcapacity flags.

You can adjust the `criteria` weights to observe how allocations change.

---

## 5. Understanding the Algorithm

### What It Does

The algorithm finds the **optimal allocation** of groups to projects that maximizes a weighted score while respecting multiple constraints.

### Why It Uses OR-Tools CP-SAT

- **Deterministic and explainable:** produces reproducible results.
- **Constraint-driven:** handles complex rules such as capacity, locks, and skill matching.
- **Flexible:** criteria weights and constraints can be easily modified.
- **Optimized:** uses OR-Tools’ CP-SAT solver for efficient computation.

### How It Works

#### Step 1. Variable Creation
Each possible group-project pair is represented by a binary variable `x[g, p]`:

- `x[g, p] = 1` if group *g* is assigned to project *p*.
- `x[g, p] = 0` otherwise.

#### Step 2. Constraints

- **Group constraint:** each group can be assigned to at most one project.
- **Capacity constraint:** each project cannot exceed its available capacity slots.
- **Skill constraint:** groups must meet project minimum skill requirements.
- **Lock constraint:** honors manual assignments (`locked`, `confirmed`, or `excluded`).
- **Student constraint:** ensures a student cannot appear in multiple allocations.

#### Step 3. Scoring and Objective Function

Each group-project pair is scored based on normalized metrics:

```
score = weighted_sum(skill_term, pref_term, workload_term, priority_term)
```

- **Skill term:** measures how well a group's skills meet project requirements.
- **Preference term:** rewards matches aligned with group preferences.
- **Workload term:** balances expected weekly workload.
- **Priority term:** favors high-priority projects.

The total score is normalized and combined using the provided criteria weights, then the model maximizes the total weighted score across all valid assignments.

#### Step 4. Solving

The CP-SAT solver finds the allocation that maximizes the total score within 30 seconds, satisfying all constraints.

#### Step 5. Output

The solver returns:

- A list of allocations with detailed per-term scores (skill, preference, workload, priority).
- A list of unallocated groups.
- A project summary showing allocation counts and overcapacity status.

---

## 6. Example Adjustments

| Scenario | Adjustment | Outcome |
|-----------|-------------|----------|
| Prioritize project fit | Increase `weight_skill` | Allocations favor skill match quality |
| Emphasize group preference | Increase `weight_preference` | Allocations align more with preferences |
| Promote workload balance | Increase `weight_workload` | Distributes work more evenly |
| Fill critical projects first | Increase `weight_priority` | High-priority projects staffed first |

---

## 7. Technical Notes

- **Solver:** Google OR-Tools CP-SAT
- **Max runtime:** 30 seconds
- **Version:** v1.0.0
- **Machine Learning:** Not used (pure optimization-based model)

---

