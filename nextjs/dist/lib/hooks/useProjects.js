"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useProjects = useProjects;
const react_1 = require("react");
const sonner_1 = require("sonner");
const navigation_1 = require("next/navigation");
const react_2 = require("next-auth/react");
function useProjects() {
    const router = (0, navigation_1.useRouter)();
    const { update: updateSession } = (0, react_2.useSession)();
    const [projects, setProjects] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchProjects = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }
            const data = await response.json();
            setProjects(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            sonner_1.toast.error('Failed to load projects');
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        fetchProjects();
    }, [fetchProjects]);
    const createProject = (0, react_1.useCallback)(async (name, subtitle) => {
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
            sonner_1.toast.success(`Project "${name}" created`);
            // Switch to new project
            const switchResponse = await fetch('/api/projects/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: newProject.id }),
            });
            if (!switchResponse.ok) {
                throw new Error('Project created but failed to switch');
            }
            const switchData = await switchResponse.json();
            // Trigger session update to refresh JWT with new project context
            await updateSession({
                currentProjectId: switchData.currentProjectId,
                currentProjectRole: switchData.currentProjectRole,
                currentProjectName: switchData.currentProjectName,
            });
            window.location.href = '/dashboard';
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to create project');
            return false;
        }
    }, [updateSession]);
    const switchProject = (0, react_1.useCallback)(async (projectId) => {
        try {
            const response = await fetch('/api/projects/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            if (!response.ok) {
                throw new Error('Failed to switch project');
            }
            // Get the response data with new project info
            const data = await response.json();
            // Trigger session update to refresh JWT with new project context
            // This will trigger the JWT callback with trigger: 'update'
            await updateSession({
                currentProjectId: data.currentProjectId,
                currentProjectRole: data.currentProjectRole,
                currentProjectName: data.currentProjectName,
            });
            sonner_1.toast.success(`Switched to ${data.currentProjectName || 'project'}`);
            // Navigate to dashboard after successful switch
            window.location.href = '/dashboard';
            return true;
        }
        catch (err) {
            sonner_1.toast.error('Failed to switch project');
            return false;
        }
    }, [updateSession]);
    const resignFromProject = (0, react_1.useCallback)(async (projectId, name) => {
        try {
            const response = await fetch(`/api/projects/${projectId}/resign`, {
                method: 'POST',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to resign from project');
            }
            sonner_1.toast.success(`You have left ${name}`);
            await fetchProjects();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to resign');
            return false;
        }
    }, [fetchProjects]);
    const deleteProject = (0, react_1.useCallback)(async (projectId, name) => {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete project');
            }
            sonner_1.toast.success(`Project "${name}" deleted`);
            await fetchProjects();
            return true;
        }
        catch (err) {
            sonner_1.toast.error(err instanceof Error ? err.message : 'Failed to delete project');
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
