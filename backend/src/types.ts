export interface AllocationRecord {
  id: string;
  runId: string;
  create_time: Date;
  project_count: number;
  user_count: number;
  status: 'completed' | 'partial' | 'failed';
}

export interface AllocationDetail {
  runId: string;
  timestamp: Date;
  assignments: Array<{
    id: string;
    projectId: string;
    projectName?: string;
    groupId: string;
    groupName?: string;
    status: 'completed' | 'partial' | 'failed';
    score: number;
    members: Array<{
      userId: string;
      userName?: string;
    }>;
  }>;
  stats: {
    totalGroups: number;
    assignedGroups: number;
    avgScore: number;
    totalProjects: number;
    availableProjectSlots: number;
    projectCapacities: Array<{
      projectName?: string;
      assigned: number;
      capacity: number;
    }>
  };
}

export interface AllocationRequest {
  runId: string;
  weights?: {
    weight_skill: number;
    weight_preference: number;
    weight_workload: number;
    weight_priority: number;
    avoid_penalty: number;
  };
}

export interface AllocationResponse {
  ok: boolean;
  message?: string;
  error?: string;
  results?: {
    project_count: number;
    user_count: number;
    allocations: Array<{
      project_id: string;
      group_id: string;
      score: number;
    }>;
  };
}

export interface ImportReport {
  ok: boolean;
  errors: ImportError[];
  errorFiles: {file: string; path: string}[];
  counts: Record<string, number>;
}

export type ImportError = {
  file: string;
  row: number;
  message: string;
};