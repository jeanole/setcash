"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMembers = useMembers;
const react_1 = require("react");
const sonner_1 = require("sonner");
function useMembers({ projectId }) {
    const [members, setMembers] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchMembers = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/members`);
            if (!response.ok) {
                throw new Error('Failed to fetch members');
            }
            const data = await response.json();
            setMembers(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            sonner_1.toast.error('Failed to load members');
        }
        finally {
            setIsLoading(false);
        }
    }, [projectId]);
    (0, react_1.useEffect)(() => {
        fetchMembers();
    }, [fetchMembers]);
    const inviteMember = (0, react_1.useCallback)(async (email, role, positionId) => {
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
            sonner_1.toast.success(`${email} invited as ${role}`);
            await fetchMembers();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to invite member');
            return false;
        }
    }, [projectId, fetchMembers]);
    const updateMemberRole = (0, react_1.useCallback)(async (memberId, role) => {
        // Optimistic update
        const prevMembers = [...members];
        setMembers((prev) => prev.map((m) => (m.id === memberId ? Object.assign(Object.assign({}, m), { role: role }) : m)));
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
            sonner_1.toast.success('Role updated');
            return true;
        }
        catch (err) {
            // Rollback
            setMembers(prevMembers);
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to update role');
            return false;
        }
    }, [projectId, members]);
    const updateMemberPosition = (0, react_1.useCallback)(async (memberId, positionId) => {
        // Optimistic update
        const prevMembers = [...members];
        setMembers((prev) => prev.map((m) => (m.id === memberId ? Object.assign(Object.assign({}, m), { positionId }) : m)));
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
            sonner_1.toast.success('Position updated');
            return true;
        }
        catch (err) {
            // Rollback
            setMembers(prevMembers);
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to update position');
            return false;
        }
    }, [projectId, members]);
    const removeMember = (0, react_1.useCallback)(async (memberId, email) => {
        try {
            const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to remove member');
            }
            sonner_1.toast.success(`${email} removed from project`);
            await fetchMembers();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to remove member');
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
