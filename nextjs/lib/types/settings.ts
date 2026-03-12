// ============================================================================
// Settings-related Type Definitions
// ============================================================================

export type ProjectRole = 'user' | 'admin' | 'owner';

export interface ProjectMember {
  id: string;
  projectId: string;
  userEmail: string;
  role: ProjectRole;
  positionId: string | null;
  position?: ProjectPosition | null;
}

export interface ProjectPosition {
  id: string;
  projectId: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  subtitle: string | null;
  createdAt: string;
}

export interface ProjectWithRole extends Project {
  role: ProjectRole;
  memberCount: number;
  isCurrent?: boolean;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  key: string;
  value: string;
}

export type SettingsTab = 'general' | 'members' | 'positions' | 'projects';

export interface TabConfig {
  id: SettingsTab;
  label: string;
  href: string;
  requiredRole: ProjectRole | 'any';
}

export const SETTINGS_TABS: TabConfig[] = [
  { id: 'general', label: 'General', href: '/settings', requiredRole: 'any' },
  { id: 'members', label: 'Members', href: '/settings/members', requiredRole: 'admin' },
  { id: 'positions', label: 'Positions', href: '/settings/positions', requiredRole: 'admin' },
  { id: 'projects', label: 'Projects', href: '/settings/projects', requiredRole: 'any' },
];
