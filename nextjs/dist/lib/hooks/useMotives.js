"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMotives = useMotives;
const react_1 = require("react");
const sonner_1 = require("sonner");
function useMotives({ projectId }) {
    const [motives, setMotives] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchMotives = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/motives`);
            if (!response.ok) {
                throw new Error('Failed to fetch motives');
            }
            const data = await response.json();
            setMotives(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            sonner_1.toast.error('Failed to load motives');
        }
        finally {
            setIsLoading(false);
        }
    }, [projectId]);
    (0, react_1.useEffect)(() => {
        fetchMotives();
    }, [fetchMotives]);
    const createMotive = (0, react_1.useCallback)(async (name, budget = 0) => {
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
            sonner_1.toast.success(`Motive "${name}" created`);
            await fetchMotives();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to create motive');
            return false;
        }
    }, [projectId, fetchMotives]);
    const updateMotive = (0, react_1.useCallback)(async (motiveId, data) => {
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
            sonner_1.toast.success('Motive updated');
            await fetchMotives();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to update motive');
            return false;
        }
    }, [projectId, fetchMotives]);
    const deleteMotive = (0, react_1.useCallback)(async (motiveId, name) => {
        try {
            const response = await fetch(`/api/projects/${projectId}/motives/${motiveId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete motive');
            }
            sonner_1.toast.success(`Motive "${name}" deleted`);
            await fetchMotives();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to delete motive');
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
