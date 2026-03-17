// ============================================================================
// Members API Client
// ============================================================================

export interface ProjectMemberName {
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

export async function getProjectMemberNames(projectId: string): Promise<ProjectMemberName[]> {
  const response = await fetch(`/api/projects/${projectId}/members/names`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}
