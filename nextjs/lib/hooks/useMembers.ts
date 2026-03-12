'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface Member {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'owner';
  positionId: string | null;
  positionName: string | null;
}

interface UseMembersOptions {
  projectId: string;
}

export function useMembers({ projectId }: UseMembersOptions) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      const data = await response.json();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const inviteMember = useCallback(async (email: string, role: string, positionId?: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, positionId: positionId || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to invite member');
      }

      toast.success(`${email} invited as ${role}`);
      await fetchMembers();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite member');
      return false;
    }
  }, [projectId, fetchMembers]);

  const updateMemberRole = useCallback(async (memberId: string, role: string) => {
    // Optimistic update
    const prevMembers = [...members];
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: role as Member['role'] } : m))
    );

    try {
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      toast.success('Role updated');
      return true;
    } catch (err) {
      // Rollback
      setMembers(prevMembers);
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
      return false;
    }
  }, [projectId, members]);

  const updateMemberPosition = useCallback(async (memberId: string, positionId: string | null) => {
    // Optimistic update
    const prevMembers = [...members];
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, positionId } : m))
    );

    try {
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update position');
      }

      toast.success('Position updated');
      return true;
    } catch (err) {
      // Rollback
      setMembers(prevMembers);
      toast.error(err instanceof Error ? err.message : 'Failed to update position');
      return false;
    }
  }, [projectId, members]);

  const removeMember = useCallback(async (memberId: string, email: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      toast.success(`${email} removed from project`);
      await fetchMembers();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
      return false;
    }
  }, [projectId, fetchMembers]);

  return {
    members,
    isLoading,
    error,
    refresh: fetchMembers,
    inviteMember,
    updateMemberRole,
    updateMemberPosition,
    removeMember,
  };
}
