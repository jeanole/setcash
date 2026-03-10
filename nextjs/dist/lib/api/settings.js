"use strict";
// ============================================================================
// Settings API Client - Members, Positions, Projects
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectMembers = getProjectMembers;
exports.inviteMember = inviteMember;
exports.updateMemberRole = updateMemberRole;
exports.updateMemberPosition = updateMemberPosition;
exports.removeMember = removeMember;
exports.getProjectPositions = getProjectPositions;
exports.createPosition = createPosition;
exports.updatePosition = updatePosition;
exports.deletePosition = deletePosition;
exports.getUserProjects = getUserProjects;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
exports.resignFromProject = resignFromProject;
exports.switchProject = switchProject;
exports.getProjectOcrSettings = getProjectOcrSettings;
exports.updateProjectOcrSettings = updateProjectOcrSettings;
const API_BASE = '/api';
async function fetchWithError(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
}
// ============================================================================
// Members API
// ============================================================================
async function getProjectMembers() {
    return fetchWithError(`${API_BASE}/members`);
}
async function inviteMember(data) {
    return fetchWithError(`${API_BASE}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
async function updateMemberRole(memberId, role) {
    return fetchWithError(`${API_BASE}/members/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
    });
}
async function updateMemberPosition(memberId, positionId) {
    return fetchWithError(`${API_BASE}/members/${memberId}/position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId }),
    });
}
async function removeMember(memberId) {
    return fetchWithError(`${API_BASE}/members/${memberId}`, {
        method: 'DELETE',
    });
}
// ============================================================================
// Positions API
// ============================================================================
async function getProjectPositions() {
    return fetchWithError(`${API_BASE}/positions`);
}
async function createPosition(name) {
    return fetchWithError(`${API_BASE}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}
async function updatePosition(positionId, name) {
    return fetchWithError(`${API_BASE}/positions/${positionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}
async function deletePosition(positionId) {
    return fetchWithError(`${API_BASE}/positions/${positionId}`, {
        method: 'DELETE',
    });
}
// ============================================================================
// Projects API
// ============================================================================
async function getUserProjects() {
    return fetchWithError(`${API_BASE}/projects/my-projects`);
}
async function createProject(data) {
    return fetchWithError(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
async function updateProject(projectId, data) {
    return fetchWithError(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
async function deleteProject(projectId) {
    return fetchWithError(`${API_BASE}/projects/${projectId}`, {
        method: 'DELETE',
    });
}
async function resignFromProject(projectId) {
    return fetchWithError(`${API_BASE}/projects/${projectId}/resign`, {
        method: 'POST',
    });
}
async function switchProject(projectId) {
    return fetchWithError(`${API_BASE}/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
    });
}
async function getProjectOcrSettings() {
    return fetchWithError(`${API_BASE}/project-settings`);
}
async function updateProjectOcrSettings(data) {
    return fetchWithError(`${API_BASE}/project-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
