// ============================================================================
// Super Admin Component Types
// ============================================================================

export interface Project {
  id: string;
  name: string;
  subtitle: string | null;
  createdAt: string;
  memberCount: number;
}

export interface User {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  projectCount: number;
}

export interface Member {
  id: string;
  email: string;
  projectRole: 'user' | 'admin' | 'owner';
  positionId: string | null;
  positionName: string;
}

export interface Position {
  id: string;
  name: string;
  projectId: string;
}

export interface PositionWithCount extends Position {
  memberCount: number;
}

export type TabType = 'projects' | 'users';
