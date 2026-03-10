"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePositions = usePositions;
const react_1 = require("react");
const sonner_1 = require("sonner");
function usePositions({ projectId }) {
    const [positions, setPositions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchPositions = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/positions`);
            if (!response.ok) {
                throw new Error('Failed to fetch positions');
            }
            const data = await response.json();
            setPositions(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            sonner_1.toast.error('Failed to load positions');
        }
        finally {
            setIsLoading(false);
        }
    }, [projectId]);
    (0, react_1.useEffect)(() => {
        fetchPositions();
    }, [fetchPositions]);
    const createPosition = (0, react_1.useCallback)(async (name) => {
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
            sonner_1.toast.success(`Position "${name}" created`);
            await fetchPositions();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to create position');
            return false;
        }
    }, [projectId, fetchPositions]);
    const updatePosition = (0, react_1.useCallback)(async (positionId, name) => {
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
            sonner_1.toast.success('Position renamed');
            await fetchPositions();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to update position');
            return false;
        }
    }, [projectId, fetchPositions]);
    const deletePosition = (0, react_1.useCallback)(async (positionId, name) => {
        try {
            const response = await fetch(`/api/projects/${projectId}/positions/${positionId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete position');
            }
            sonner_1.toast.success(`Position "${name}" deleted`);
            await fetchPositions();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to delete position');
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
