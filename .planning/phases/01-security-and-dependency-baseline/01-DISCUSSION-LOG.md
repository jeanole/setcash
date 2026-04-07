# Phase 1: Security and Dependency Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 01-security-and-dependency-baseline
**Areas discussed:** Path traversal, Role re-fetch, Origin validation, Dep cleanup

---

## Path Traversal

| Option | Description | Selected |
|--------|-------------|----------|
| Shared helper | Extract to lib/upload.ts — one guard function reused everywhere | |
| Inline each | Copy the 3-line pattern into each route — simpler, no new abstraction | |
| You decide | Claude picks the best approach based on codebase patterns | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on shared helper vs inline pattern. The existing guard in bug-reports/screenshots is the reference.

---

## Role Re-fetch

### Scope
| Option | Description | Selected |
|--------|-------------|----------|
| Critical writes only | Bill status change, bill delete, admin actions — ~5 routes | |
| All admin-gated | Every route checking isAdmin/isSuperAdmin — ~20 routes | |
| You decide | Claude picks based on risk/effort tradeoff | ✓ |

**User's choice:** You decide

### Rejection behavior
| Option | Description | Selected |
|--------|-------------|----------|
| 403 Forbidden | Return 403 with error message — simple | |
| Force re-auth | Invalidate session and redirect to login — user gets fresh JWT | ✓ |

**User's choice:** Force re-auth
**Notes:** When JWT role doesn't match DB, invalidate session so user gets fresh JWT.

---

## Origin Validation

### Implementation location
| Option | Description | Selected |
|--------|-------------|----------|
| Middleware | Single check in middleware.ts — covers all routes automatically | ✓ |
| Shared helper | Helper in lib/auth.ts called by each mutation route | |
| You decide | Claude picks best approach | |

**User's choice:** Middleware

### Exemptions
| Option | Description | Selected |
|--------|-------------|----------|
| Telegram webhook | /api/telegram/webhook needs external POSTs | |
| No exemptions | All mutation routes must match Origin | |
| You decide | Claude audits and exempts what's needed | ✓ |

**User's choice:** You decide
**Notes:** Claude to audit routes and determine which need cross-origin access.

---

## Dep Cleanup

### Migration script
| Option | Description | Selected |
|--------|-------------|----------|
| Archive it | Move to scripts/archive/ | |
| Delete it | Remove entirely — git history preserves it | ✓ |

**User's choice:** Delete it

### Lockfile
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, clean install | rm node_modules && npm install | ✓ |
| Minimal change | Just edit package.json, lockfile updates later | |

**User's choice:** Yes, clean install

---

## Claude's Discretion

- Path traversal: shared helper vs inline pattern
- Role re-fetch: scope of routes to patch
- Origin validation: which routes to exempt

## Deferred Ideas

None
