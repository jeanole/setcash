// ============================================================================
// Settings API Client - Members, Positions, Projects
// ============================================================================

import type { 
  ProjectMember, 
  ProjectPosition, 
  ProjectWithRole, 
  ProjectRole,
  Project 
} from '@/lib/types';

const API_BASE = '/api';

async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Members API
// ============================================================================

export async function getProjectMembers(): Promise<ProjectMember[]> {
  return fetchWithError<ProjectMember[]>(`${API_BASE}/members`);
}

export interface InviteMemberData {
  email: string;
  role: ProjectRole;
  positionId?: string | null;
}

export async function inviteMember(data: InviteMemberData): Promise<ProjectMember> {
  return fetchWithError<ProjectMember>(`${API_BASE}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateMemberRole(memberId: string, role: ProjectRole): Promise<void> {
  return fetchWithError(`${API_BASE}/members/${memberId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}

export async function updateMemberPosition(memberId: string, positionId: string | null): Promise<void> {
  return fetchWithError(`${API_BASE}/members/${memberId}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionId }),
  });
}

export async function removeMember(memberId: string): Promise<void> {
  return fetchWithError(`${API_BASE}/members/${memberId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Positions API
// ============================================================================

export async function getProjectPositions(): Promise<ProjectPosition[]> {
  return fetchWithError<ProjectPosition[]>(`${API_BASE}/positions`);
}

export async function createPosition(name: string): Promise<ProjectPosition> {
  return fetchWithError<ProjectPosition>(`${API_BASE}/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function updatePosition(positionId: string, name: string): Promise<void> {
  return fetchWithError(`${API_BASE}/positions/${positionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function deletePosition(positionId: string): Promise<void> {
  return fetchWithError(`${API_BASE}/positions/${positionId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Projects API
// ============================================================================

export async function getUserProjects(): Promise<ProjectWithRole[]> {
  return fetchWithError<ProjectWithRole[]>(`${API_BASE}/projects/my-projects`);
}

export interface CreateProjectData {
  name: string;
  subtitle?: string;
}

export async function createProject(data: CreateProjectData): Promise<Project> {
  return fetchWithError<Project>(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface UpdateProjectData {
  name?: string;
  subtitle?: string;
}

export async function updateProject(projectId: string, data: UpdateProjectData): Promise<void> {
  return fetchWithError(`${API_BASE}/projects/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  return fetchWithError(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function resignFromProject(projectId: string): Promise<void> {
  return fetchWithError(`${API_BASE}/projects/${projectId}/resign`, {
    method: 'POST',
  });
}

export async function switchProject(projectId: string): Promise<void> {
  return fetchWithError(`${API_BASE}/projects/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
}

// ============================================================================
// Project OCR Settings API
// ============================================================================

/** @deprecated Use ProjectOcrSettings */
export type OcrSettings = ProjectOcrSettings;

export interface ProjectOcrSettings {
  ocrEnabled: boolean;
  ocrProvider: string | null;
  /** Masked API key (e.g. "...abc4") — never the plaintext value */
  ocrApiKey: string | null;
  ocrBaseUrl: string | null;
}

export interface UpdateProjectOcrSettingsData {
  ocrEnabled?: boolean;
  ocrProvider?: 'openai' | 'gemini' | 'claude' | 'custom';
  /** Provide plaintext key to update; empty string to clear; omit to leave unchanged */
  ocrApiKey?: string;
  ocrBaseUrl?: string | null;
}

export async function getProjectOcrSettings(): Promise<ProjectOcrSettings> {
  return fetchWithError<ProjectOcrSettings>(`${API_BASE}/project-settings`);
}

export async function updateProjectOcrSettings(
  data: UpdateProjectOcrSettingsData
): Promise<ProjectOcrSettings> {
  return fetchWithError<ProjectOcrSettings>(`${API_BASE}/project-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
