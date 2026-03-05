'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export interface Project {
  id: string;
  name: string;
  subtitle: string | null;
  role: 'user' | 'admin' | 'owner';
  memberCount: number;
  isCurrent: boolean;
}

export function useProjects() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (name: string, subtitle?: string) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subtitle: subtitle || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const newProject = await response.json();
      toast.success(`Project "${name}" created`);
      
      // Switch to new project and redirect
      await fetch('/api/projects/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProject.id }),
      });

      // Trigger session update to refresh JWT with new project context
      await updateSession();

      window.location.href = '/';
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
      return false;
    }
  }, [updateSession]);

  const switchProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch('/api/projects/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch project');
      }

      // Trigger session update to refresh JWT with new project context
      await updateSession();

      toast.success('Project switched');
      window.location.reload();
      return true;
    } catch (err) {
      toast.error('Failed to switch project');
      return false;
    }
  }, [updateSession]);

  const resignFromProject = useCallback(async (projectId: string, name: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/resign`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resign from project');
      }

      toast.success(`You have left ${name}`);
      await fetchProjects();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resign');
      return false;
    }
  }, [fetchProjects]);

  const deleteProject = useCallback(async (projectId: string, name: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }

      toast.success(`Project "${name}" deleted`);
      await fetchProjects();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
      return false;
    }
  }, [fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    refresh: fetchProjects,
    createProject,
    switchProject,
    resignFromProject,
    deleteProject,
  };
}
