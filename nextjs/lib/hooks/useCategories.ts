'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface Category {
  id: string;
  name: string;
  budget: number;
  billCount: number;
}

interface UseCategoriesOptions {
  projectId: string;
}

export function useCategories({ projectId }: UseCategoriesOptions) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/categories`);
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(async (name: string, budget: number = 0) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, budget }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create category');
      }

      toast.success(`Category "${name}" created`);
      await fetchCategories();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create category');
      return false;
    }
  }, [projectId, fetchCategories]);

  const updateCategory = useCallback(async (categoryId: string, data: { name?: string; budget?: number }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to update category');
      }

      toast.success('Category updated');
      await fetchCategories();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update category');
      return false;
    }
  }, [projectId, fetchCategories]);

  const deleteCategory = useCallback(async (categoryId: string, name: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      toast.success(`Category "${name}" deleted`);
      await fetchCategories();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
      return false;
    }
  }, [projectId, fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refresh: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
