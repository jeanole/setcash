'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface Motive {
  id: string;
  name: string;
  budget: number;
  billCount: number;
}

interface UseMotivesOptions {
  projectId: string;
}

export function useMotives({ projectId }: UseMotivesOptions) {
  const [motives, setMotives] = useState<Motive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMotives = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/motives`);
      if (!response.ok) {
        throw new Error('Failed to fetch motives');
      }
      const data = await response.json();
      setMotives(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load motives');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMotives();
  }, [fetchMotives]);

  const createMotive = useCallback(async (name: string, budget: number = 0) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/motives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, budget }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create motive');
      }

      toast.success(`Motive "${name}" created`);
      await fetchMotives();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create motive');
      return false;
    }
  }, [projectId, fetchMotives]);

  const updateMotive = useCallback(async (motiveId: string, data: { name?: string; budget?: number }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/motives/${motiveId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to update motive');
      }

      toast.success('Motive updated');
      await fetchMotives();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update motive');
      return false;
    }
  }, [projectId, fetchMotives]);

  const deleteMotive = useCallback(async (motiveId: string, name: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/motives/${motiveId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete motive');
      }

      toast.success(`Motive "${name}" deleted`);
      await fetchMotives();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete motive');
      return false;
    }
  }, [projectId, fetchMotives]);

  return {
    motives,
    isLoading,
    error,
    refresh: fetchMotives,
    createMotive,
    updateMotive,
    deleteMotive,
  };
}
