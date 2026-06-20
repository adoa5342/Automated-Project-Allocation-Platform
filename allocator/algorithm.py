from ortools.sat.python import cp_model
from allocator.schema import AllocateRequest, AllocateResponse, AllocationOut

# Normalized terms in [0,1]

TOP_N = 5  # top-5 ranking

def _find_pref(group, project):
    for pref in group.preferences:
        if pref.projectId == project.id:
            return pref
    return None

def pref_term(group, project, top_n: int = TOP_N) -> float:
    pref = _find_pref(group, project)
    if not pref or pref.rank is None:
        return 0.0
    r = max(1, min(top_n, int(pref.rank)))
    if top_n <= 1:
        return 1.0
    return 1.0 - (r - 1) / float(top_n - 1)

def skill_term(group, project) -> float:
    reqs = getattr(project, "requiredSkills", [])
    if not reqs:
        return 1.0
    levels = {s.skillId: s.level for s in group.skills}
    total_imp, acc = 0.0, 0.0
    for r in reqs:
        imp = float(r.importance)
        total_imp += imp
        lvl = float(levels.get(r.skillId, 0))
        ratio = 0.0 if r.minLevel <= 0 else min(1.0, lvl / float(r.minLevel))
        acc += imp * ratio
    return 0.0 if total_imp == 0.0 else acc / total_imp

def workload_term(group, project) -> float:
    need = getattr(project, "estimatedHoursPerWeek", 0) or 0
    if need <= 0:
        return 1.0
    if not group.availability:
        return 0.0
    avg_hours = sum(a.hoursPerWeek for a in group.availability) / len(group.availability)
    return min(1.0, avg_hours / float(need))

def priority_term(project) -> float:
    return float(getattr(project, "priority", 0.0))

def normalized_weighted_score(group, project, criteria):
    pref_t = pref_term(group, project)
    skill_t = skill_term(group, project)
    work_t = workload_term(group, project)
    prio_t = priority_term(project)

    w_pref = float(criteria.weight_preference)
    w_skill = float(criteria.weight_skill)
    w_work = float(criteria.weight_workload)
    w_prio = float(criteria.weight_priority)
    sum_w = w_pref + w_skill + w_work + w_prio
    if sum_w <= 0:
        w_pref = w_skill = w_work = w_prio = 1.0
        sum_w = 4.0

    score = (w_pref*pref_t + w_skill*skill_t + w_work*work_t + w_prio*prio_t) / sum_w
    
    # print(f"DEBUG: Score for Group {group.id} vs Project {project.id} "
    #   f"=> pref={pref_t}, skill={skill_t}, workload={work_t}, prio={prio_t}")

    return score, pref_t, skill_t, work_t, prio_t

# CP-SAT model

def create_vars(model, groups, projects):
    return {(g, p): model.NewBoolVar(f"x_g{g}_p{p}")
            for g in range(len(groups)) for p in range(len(projects))}

def add_group_constraints(model, x, groups, projects):
    for g in range(len(groups)):
        model.Add(sum(x[(g, p)] for p in range(len(projects))) <= 1)

def add_capacity_constraints(model, x, groups, projects, locked_pairs=None):
    locked_pairs = locked_pairs or set()
    for p, proj in enumerate(projects):
        cap = getattr(proj, "capacitySlots", 1)
        model.Add(sum(x[(g, p)] for g in range(len(groups)) if (g, p) not in locked_pairs) <= cap)

        
def add_student_constraints(model, x, groups, projects):
    student_to_groups = {}
    for g, group in enumerate(groups):
        for member in group.members or []:
            student_to_groups.setdefault(member, []).append(g)

    for student, g_list in student_to_groups.items():
        if len(g_list) > 1: 
            for p in range(len(projects)):
                model.Add(sum(x[(g, p)] for g in g_list) <= 1)

def add_skill_constraints(model, x, groups, projects):
    for g, group in enumerate(groups):
        levels = {s.skillId: s.level for s in group.skills}
        for p, proj in enumerate(projects):
            valid = True
            for req in getattr(proj, "requiredSkills", []):
                if levels.get(req.skillId, 0) < req.minLevel:
                    valid = False
                    break
            if not valid:
                # print(f"DEBUG: Group {group.id} ruled out for Project {proj.id} "
                #       f"because of missing skill(s). Levels={levels}, Reqs={[ (r.skillId, r.minLevel) for r in proj.requiredSkills ]}")
                model.Add(x[(g, p)] == 0)

def add_lock_constraints(model, x, groups, projects, locks):
    # Build lookup maps for convenience
    group_index = {g.id: i for i, g in enumerate(groups)}
    project_index = {p.id: j for j, p in enumerate(projects)}

    locked_pairs = set()

    for lock in locks:
        g = group_index.get(lock.groupId)  
        p = project_index.get(lock.projectId)
        if g is None or p is None:
            continue

        if lock.status in ("locked", "confirmed"):
            model.Add(x[(g, p)] == 1)
            locked_pairs.add((g, p))
        elif lock.status == "excluded":
            model.Add(x[(g, p)] == 0)

    return locked_pairs

def set_objective(model, x, groups, projects, criteria):
    model.Maximize(sum(
        normalized_weighted_score(groups[g], projects[p], criteria)[0] * x[(g, p)]
        for g in range(len(groups)) for p in range(len(projects))
    ))


# Solve + extract
def solve_model(model, x, groups, projects, criteria):
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    status = solver.Solve(model)

    allocations, unallocated = [], []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for g, group in enumerate(groups):
            placed = False
            for p, proj in enumerate(projects):
                if solver.Value(x[(g, p)]):
                    # print(f"DEBUG: Group {group.id} assigned to Project {proj.id}")
                    score, pref_t, skill_t, work_t, prio_t = normalized_weighted_score(group, proj, criteria)
                    pref = _find_pref(group, proj)
                    rank = getattr(pref, "rank", None) if pref else None
                    allocations.append(AllocationOut(
                        groupId=group.id,
                        projectId=proj.id,
                        status="proposed",
                        rank=rank,
                        score=float(score),
                        skill_fit=float(skill_t),
                        pref_term=float(pref_t),
                        workload_term=float(work_t),
                        priority_term=float(prio_t),
                    ))
                    placed = True
            if not placed:
                # print(f"DEBUG: Group {group.id} was not placed in any project.")
                unallocated.append(group.id)
    return allocations, unallocated

def build_project_summary(projects, allocations):
    summary = {
        p.id: {
            "title": getattr(p, "title", None),
            "slots": getattr(p, "capacitySlots", 1),
            "count": 0,
            "groups": [],
            "overCapacity": False
        }
        for p in projects
    }
    for a in allocations:
        pid = a.projectId
        if pid not in summary:
            summary[pid] = {"title": None, "slots": None, "count": 0, "groups": [], "overCapacity": False}
        summary[pid]["count"] += 1
        summary[pid]["groups"].append(a.groupId)

    for pid, info in summary.items():
        if info["count"] > info["slots"]:
            info["overCapacity"] = True

    return summary

# Entrypoint
def run_allocation(req: AllocateRequest, weights: dict = None) -> AllocateResponse:
    groups, projects = req.groups, req.projects
    
    # print("DEBUG: Groups:", [g.id for g in groups])
    # print("DEBUG: Projects:", [p.id for p in projects])
    
    model = cp_model.CpModel()

    x = create_vars(model, groups, projects)
    add_group_constraints(model, x, groups, projects)
    locked_pairs = add_lock_constraints(model, x, groups, projects, req.locks)
    add_capacity_constraints(model, x, groups, projects, locked_pairs)      
    add_skill_constraints(model, x, groups, projects)
    set_objective(model, x, groups, projects, req.criteria)
    allocations, unallocated = solve_model(model, x, groups, projects, req.criteria)
    proj_summary = build_project_summary(projects, allocations)

    return AllocateResponse(
        allocations=allocations,
        unallocated=unallocated,
        metrics={
            "groups": len(groups),
            "projects": len(projects),
            "allocated": len(allocations),
            "unallocated": len(unallocated),
            "byProject": proj_summary,
        },
        allocator_version="v1.0.0",
        used_ml=False,
    )
