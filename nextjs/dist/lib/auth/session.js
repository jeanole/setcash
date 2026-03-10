"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = getCurrentUser;
const auth_1 = require("../../auth");
// ---------------------------------------------------------------------------
// getCurrentUser — server-side helper for server components and API routes
// Returns the authenticated user or null if unauthenticated
// ---------------------------------------------------------------------------
async function getCurrentUser() {
    var _a, _b, _c, _d;
    const session = await (0, auth_1.auth)();
    if (!((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.id) || !((_b = session === null || session === void 0 ? void 0 : session.user) === null || _b === void 0 ? void 0 : _b.email)) {
        return null;
    }
    return {
        id: session.user.id,
        email: session.user.email,
        role: (_c = session.user.role) !== null && _c !== void 0 ? _c : 'user',
        currentProjectId: (_d = session.user.currentProjectId) !== null && _d !== void 0 ? _d : null,
    };
}
