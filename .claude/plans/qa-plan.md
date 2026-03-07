# QA Test Plan

## Feature
PROJ-15: V-Geld (Advance Money)
Spec: features/PROJ-15-vgeld-advance-money.md

## Context Summary
V-Geld is a cash advance tracking feature. Users receive advance money (V-Geld) and their balance is calculated as received minus spent (from confirmed bills). The feature needs to be ported from Express (`routes/vgeld.js`, `public/js/vgeld.js`) to Next.js.

**Key Files to Check:**
- `nextjs/app/api/vgeld/route.ts` - GET/POST API route handler
- `nextjs/app/api/vgeld/[id]/route.ts` - DELETE route handler
- `nextjs/app/api/vgeld/analysis/route.ts` - Analysis endpoint
- `nextjs/app/api/vgeld/balance/route.ts` - Balance endpoint
- `nextjs/app/(protected)/vgeld/page.tsx` - V-Geld page
- `nextjs/components/layout/Sidebar.tsx` - Sidebar balance display
- `nextjs/prisma/schema.prisma` - Vgeld model (confirmed exists)

**Express Reference:**
- `routes/vgeld.js` - Express V-Geld API routes
- `public/js/vgeld.js` - Frontend JS module

## Pre-Test Checks

1. Verify Next.js API routes exist at `nextjs/app/api/vgeld/`
2. Verify Next.js page exists at `nextjs/app/(protected)/vgeld/`
3. Verify sidebar component displays V-Geld balance
4. Verify Prisma schema has Vgeld model

## Acceptance Criteria to Test

### AC-1: Sidebar Balance Display
- [ ] Current user's V-Geld balance shown in sidebar
- [ ] Balance formula: Total Received - Total Spent (confirmed bills only)
- [ ] Balance updates on project switch
- [ ] Format: "V-Geld: X,XXX.XX" with euro symbol and 2 decimals
- [ ] Negative balances in red text
- [ ] Zero balance shows "0.00"

### AC-2: Page Route /vgeld
- [ ] V-Geld page accessible from sidebar navigation
- [ ] Page uses protected layout (requires auth)
- [ ] Page displays within main content area
- [ ] Loading skeleton while data fetches
- [ ] Empty state: "No V-Geld transfers recorded"

### AC-3: User View (Transfer History)
- [ ] List of V-Geld transfers received by current user
- [ ] Each transfer shows: Date (DD.MM.YYYY), Amount, From, Created By
- [ ] Sorted by date descending (newest first)
- [ ] Empty state for no transfers

### AC-4: Admin View (Summary Table)
- [ ] All User V-Geld Summary Table
- [ ] Columns: User, Received, Spent, Remaining, % Used
- [ ] Negative remaining in red
- [ ] High usage (>80%) in orange
- [ ] Zero usage shows "0%"
- [ ] "Add V-Geld Transfer" button

### AC-5: Add Transfer Modal (Admin Only)
- [ ] Modal triggered by button
- [ ] Form: Amount (required, >0), To (dropdown of members), From (optional, default "External")
- [ ] Zod validation on both client and server
- [ ] Success: modal closes, list/table refreshes, sidebar updates
- [ ] Error: inline validation errors

### AC-6: Delete Transfer (Admin Only)
- [ ] Delete button per row (admin only)
- [ ] Confirmation dialog
- [ ] On confirm: delete, refresh, update sidebar balance
- [ ] On cancel: close dialog, no action
- [ ] Deleting causing negative balance is allowed

### API Tests
| Endpoint | Method | Auth | Expected |
|----------|--------|------|----------|
| `/api/vgeld` | GET | Project Access | 200 with array of transfers |
| `/api/vgeld` | POST | Project Admin | 200 with `{ ok: true, id }` |
| `/api/vgeld/[id]` | DELETE | Project Admin | 200 with `{ ok: true }` |
| `/api/vgeld/analysis` | GET | Project Access | 200 with user summaries |
| `/api/vgeld/balance` | GET | Project Access | 200 with `{ balance: number }` |

## Security Audit Scope

### Authentication
- [ ] Cannot access /api/vgeld without login (401)
- [ ] Cannot access /api/vgeld/analysis without login (401)
- [ ] Cannot access /api/vgeld/balance without login (401)
- [ ] Cannot access /vgeld page without login (redirect to login)

### Authorization
- [ ] Non-admin cannot POST /api/vgeld (403)
- [ ] Non-admin cannot DELETE /api/vgeld/[id] (403)
- [ ] Cross-project isolation (cannot access other project V-Geld)

### Input Validation
- [ ] Negative amount rejected
- [ ] Zero amount rejected
- [ ] Non-numeric amount rejected
- [ ] XSS in `from` field blocked
- [ ] SQL injection in `to` field blocked
- [ ] Non-member recipient rejected (400)
- [ ] Max length on `from` field (100 chars)

### Rate Limiting
- [ ] POST endpoint rate-limited
- [ ] DELETE endpoint rate-limited

## Edge Cases to Test
- [ ] Negative balance display
- [ ] Delete making balance negative (allowed)
- [ ] Non-member recipient (400 error)
- [ ] Zero V-Geld (sidebar shows 0.00)
- [ ] V-Geld with no bills (full remaining)
- [ ] Very large amounts (formatting)
- [ ] Decimal amounts (2 decimal places)
- [ ] Project switch updates balance
- [ ] Empty from field defaults to "External"
- [ ] Special characters in from field (XSS prevention)

## Regression Test Scope
- [ ] Bills feature still works
- [ ] Budget matrix still works
- [ ] Sidebar navigation works
- [ ] Authentication works
- [ ] Project switching works

## Responsive / Cross-Browser Scope

### Breakpoints
- [ ] 375px (mobile)
- [ ] 768px (tablet)
- [ ] 1440px (desktop)

### Browsers
- [ ] Chrome
- [ ] Firefox
- [ ] Safari

## Commit Message
`test(PROJ-15): QA Round 1 results`
