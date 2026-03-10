"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCategories = useCategories;
const react_1 = require("react");
const sonner_1 = require("sonner");
function useCategories({ projectId }) {
    const [categories, setCategories] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchCategories = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/categories`);
            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }
            const data = await response.json();
            setCategories(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            sonner_1.toast.error('Failed to load categories');
        }
        finally {
            setIsLoading(false);
        }
    }, [projectId]);
    (0, react_1.useEffect)(() => {
        fetchCategories();
    }, [fetchCategories]);
    const createCategory = (0, react_1.useCallback)(async (name, budget = 0) => {
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
            sonner_1.toast.success(`Category "${name}" created`);
            await fetchCategories();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to create category');
            return false;
        }
    }, [projectId, fetchCategories]);
    const updateCategory = (0, react_1.useCallback)(async (categoryId, data) => {
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
            sonner_1.toast.success('Category updated');
            await fetchCategories();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to update category');
            return false;
        }
    }, [projectId, fetchCategories]);
    const deleteCategory = (0, react_1.useCallback)(async (categoryId, name) => {
        try {
            const response = await fetch(`/api/projects/${projectId}/categories/${categoryId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete category');
            }
            sonner_1.toast.success(`Category "${name}" deleted`);
            await fetchCategories();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to delete category');
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
