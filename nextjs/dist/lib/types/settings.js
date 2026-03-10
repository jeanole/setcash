"use strict";
// ============================================================================
// Settings-related Type Definitions
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTINGS_TABS = void 0;
exports.SETTINGS_TABS = [
    { id: 'general', label: 'General', href: '/settings', requiredRole: 'any' },
    { id: 'members', label: 'Members', href: '/settings/members', requiredRole: 'admin' },
    { id: 'positions', label: 'Positions', href: '/settings/positions', requiredRole: 'admin' },
    { id: 'projects', label: 'Projects', href: '/settings/projects', requiredRole: 'any' },
];
