'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface Position {
  id: string;
  name: string;
  memberCount: number;
}

interface UsePositionsOptions {
  projectId: string;
}

export function usePositions({ projectId }: UsePositionsOptions) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/positions`);
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      const data = await response.json();
      setPositions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load positions');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const createPosition = useCallback(async (name: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create position');
      }

      toast.success(`Position "${name}" created`);
      await fetchPositions();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create position');
      return false;
    }
  }, [projectId, fetchPositions]);

  const updatePosition = useCallback(async (positionId: string, name: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/positions/${positionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update position');
      }

      toast.success('Position renamed');
      await fetchPositions();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update position');
      return false;
    }
  }, [projectId, fetchPositions]);

  const deletePosition = useCallback(async (positionId: string, name: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/positions/${positionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete position');
      }

      toast.success(`Position "${name}" deleted`);
      await fetchPositions();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete position');
      return false;
    }
  }, [projectId, fetchPositions]);

  return {
    positions,
    isLoading,
    error,
    refresh: fetchPositions,
    createPosition,
    updatePosition,
    deletePosition,
  };
}
