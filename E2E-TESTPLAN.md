# SetCash — E2E Test Plan

**Version:** 1.0
**Date:** 2026-04-08
**Status:** Draft
**Framework:** Playwright (recommended)

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Test Infrastructure](#2-test-infrastructure)
3. [Test Suites](#3-test-suites)
   - 3.1 [Authentication & Registration](#31-authentication--registration)
   - 3.2 [Dashboard](#32-dashboard)
   - 3.3 [Bill Lifecycle](#33-bill-lifecycle)
   - 3.4 [Bill Images & OCR](#34-bill-images--ocr)
   - 3.5 [Bill Comments](#35-bill-comments)
   - 3.6 [Budget Matrix](#36-budget-matrix)
   - 3.7 [Spending Overview](#37-spending-overview)
   - 3.8 [Categories & Motives](#38-categories--motives)
   - 3.9 [Project Management](#39-project-management)
   - 3.10 [Member Management](#310-member-management)
   - 3.11 [Positions](#311-positions)
   - 3.12 [V-Geld (Advance Money)](#312-v-geld-advance-money)
   - 3.13 [Notifications](#313-notifications)
   - 3.14 [Reports & Exports](#314-reports--exports)
   - 3.15 [User Profile](#315-user-profile)
   - 3.16 [Settings — AI/OCR Configuration](#316-settings--aiocr-configuration)
   - 3.17 [Settings — Telegram Integration](#317-settings--telegram-integration)
   - 3.18 [Super-Admin Panel](#318-super-admin-panel)
   - 3.19 [Demo Account](#319-demo-account)
   - 3.20 [Navigation & Layout](#320-navigation--layout)
   - 3.21 [Authorization & RBAC](#321-authorization--rbac)
   - 3.22 [Session & Token Handling](#322-session--token-handling)
   - 3.23 [Rate Limiting](#323-rate-limiting)
   - 3.24 [Cross-Cutting Concerns](#324-cross-cutting-concerns)
4. [Test Data Strategy](#4-test-data-strategy)
5. [Priority Tiers](#5-priority-tiers)
6. [Browser Matrix](#6-browser-matrix)
7. [CI/CD Integration](#7-cicd-integration)

---

## 1. Overview & Goals

SetCash is a multi-tenant expense tracking app handling financial data. E2E tests must verify:

- **Correctness**: Bills, budgets, and calculations are accurate — zero silent failures
- **Security**: Role-based access control enforced at every layer
- **Multi-tenancy**: Project isolation — no cross-project data leaks
- **Resilience**: Error states, edge cases, and concurrent operations handled gracefully

### Scope

- All user-facing pages and workflows (21 protected pages, 6 public pages)
- 90+ API endpoints exercised through UI interactions
- 3 role levels (user, admin, superadmin) with permission boundaries
- External integrations mocked (Google OAuth, Telegram, OCR providers)

### Out of Scope

- Visual regression testing (separate tooling)
- Load/performance testing (separate tooling)
- Direct Telegram bot testing (requires external bot infrastructure)
- Real Google OAuth flow (mocked at provider level)

---

## 2. Test Infrastructure

### Framework Setup

```
nextjs/
├── e2e/
│   ├── playwright.config.ts       # Playwright configuration
│   ├── global-setup.ts            # DB seed, test users, test projects
│   ├── global-teardown.ts         # Cleanup test data
│   ├── fixtures/
│   │   ├── auth.fixture.ts        # Authenticated page fixtures per role
│   │   ├── project.fixture.ts     # Project with categories/motives/members
│   │   ├── bill.fixture.ts        # Bills in various statuses
│   │   └── images/                # Test images (JPEG, PNG, oversized, invalid)
│   ├── pages/                     # Page Object Models
│   │   ├── login.page.ts
│   │   ├── dashboard.page.ts
│   │   ├── bills-list.page.ts
│   │   ├── bill-detail.page.ts
│   │   ├── bill-new.page.ts
│   │   ├── budget.page.ts
│   │   ├── spending.page.ts
│   │   ├── vgeld.page.ts
│   │   ├── settings.page.ts
│   │   ├── members.page.ts
│   │   ├── categories.page.ts
│   │   ├── motives.page.ts
│   │   ├── positions.page.ts
│   │   ├── reports.page.ts
│   │   ├── profile.page.ts
│   │   └── superadmin.page.ts
│   └── suites/
│       ├── auth.spec.ts
│       ├── dashboard.spec.ts
│       ├── bills.spec.ts
│       ├── bill-images.spec.ts
│       ├── bill-comments.spec.ts
│       ├── budget.spec.ts
│       ├── spending.spec.ts
│       ├── categories-motives.spec.ts
│       ├── projects.spec.ts
│       ├── members.spec.ts
│       ├── positions.spec.ts
│       ├── vgeld.spec.ts
│       ├── notifications.spec.ts
│       ├── reports.spec.ts
│       ├── profile.spec.ts
│       ├── settings-ai.spec.ts
│       ├── settings-telegram.spec.ts
│       ├── superadmin.spec.ts
│       ├── demo-account.spec.ts
│       ├── navigation.spec.ts
│       ├── authorization.spec.ts
│       ├── session.spec.ts
│       ├── rate-limiting.spec.ts
│       └── cross-cutting.spec.ts
```

### Test Users (Seeded)

| User | Email | Role | Project Membership |
|------|-------|------|--------------------|
| Admin User | `admin@test.local` | admin | Project A (owner), Project B (admin) |
| Regular User | `user@test.local` | user | Project A (user) |
| Second User | `user2@test.local` | user | Project A (user), Project B (user) |
| No-Project User | `orphan@test.local` | user | None |
| Super Admin | `super@test.local` | superadmin | — (global access) |
| Demo User | `demo@test.local` | user (demo) | Example Project |
| Disabled User | `disabled@test.local` | user (isActive=false) | Project A |

### Test Projects (Seeded)

| Project | Categories | Motives | Bills | Budget Matrix |
|---------|-----------|---------|-------|---------------|
| Project A | 3 (Office, Travel, Food) | 3 (Operations, Marketing, R&D) | 10 (mixed statuses) | 9 cells populated |
| Project B | 2 (Supplies, Services) | 2 (Sales, Support) | 5 | 4 cells |
| Example Project | 2 | 2 | 3 (demo data) | 4 cells |

### Auth Fixture Pattern

```typescript
// Reusable authenticated contexts — avoid logging in per test
export const test = base.extend<{ adminPage: Page; userPage: Page; superPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    await use(await ctx.newPage());
    await ctx.close();
  },
  // ... same for user, super, demo
});
```

---

## 3. Test Suites

### 3.1 Authentication & Registration

**File:** `auth.spec.ts`
**Priority:** P0 (Critical)

#### Login — Credentials

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Valid login | Enter valid email/password → submit | Redirect to `/dashboard`, session cookie set |
| 2 | Invalid password | Enter valid email + wrong password | Error: "Invalid credentials", no redirect |
| 3 | Non-existent email | Enter unknown email | Error: "Invalid credentials" (same as #2, no info leak) |
| 4 | Case-insensitive email | Login with `Admin@Test.Local` | Succeeds (matches `admin@test.local`) |
| 5 | Disabled account | Login as `disabled@test.local` | Error: "Account not active" |
| 6 | Unverified email | Login before verifying | Error: "Email not verified" |
| 7 | Google-only account tries credentials | Enter email of Google-linked account with password | Error: "Use Google sign-in" |
| 8 | Empty email | Submit with blank email | Client-side validation prevents submit |
| 9 | Empty password | Submit with blank password | Client-side validation prevents submit |
| 10 | SQL injection in email field | Enter `' OR 1=1 --` in email | Error message, no bypass |

#### Login — Google OAuth (Mocked)

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 11 | First-time Google sign-in | OAuth callback with new email | User created, redirected to dashboard |
| 12 | Returning Google sign-in | OAuth callback with existing email | Session created, redirected to dashboard |

#### Registration

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 13 | Valid signup | Enter email + strong password | Success message, verification email sent |
| 14 | Weak password (no uppercase) | Enter `password1` | Validation error |
| 15 | Weak password (no digit) | Enter `Password` | Validation error |
| 16 | Weak password (< 8 chars) | Enter `Pa1` | Validation error |
| 17 | Duplicate email | Register with existing email | Error: "Email already registered" |
| 18 | Email verification | Click link from email | Account verified, can login |
| 19 | Expired verification token | Click link after expiry | Error: "Token expired" |
| 20 | Resend verification | Request resend on unverified account | New email sent |

#### Password Reset

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 21 | Request password reset | Enter registered email → submit | Success message (regardless of email existence — no info leak) |
| 22 | Reset with valid token | Click link → enter new password | Password changed, can login with new password |
| 23 | Reset with expired token | Click expired link | Error: "Token expired" |
| 24 | Reset with invalid token | Modify token in URL | Error: "Invalid token" |

#### Invite Flow

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 25 | Accept invite (new user) | Click invite link → set password → submit | Account created, added to project, redirected to dashboard |
| 26 | Accept invite (existing user) | Click invite link while logged in | Added to project, redirected |
| 27 | Expired invite token | Click link after 7 days | Error: "Invitation expired" |
| 28 | Already-used invite | Click same link twice | Error: "Invitation already used" |

#### Logout

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 29 | Logout | Click logout | Redirect to `/`, session cookie cleared |
| 30 | Access protected page after logout | Navigate to `/dashboard` | Redirect to `/` with callback URL |

---

### 3.2 Dashboard

**File:** `dashboard.spec.ts`
**Priority:** P0

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Dashboard loads with KPIs | Login → view dashboard | Pending bills count, monthly total, V-Geld balance displayed |
| 2 | Recent bills list | View dashboard | Shows last N bills for current project |
| 3 | KPI accuracy | Compare KPI values to raw bill data | Numbers match database aggregations |
| 4 | Empty project dashboard | Login as user in project with no bills | Empty state shown, "Create first bill" CTA |
| 5 | Dashboard updates after bill creation | Create a bill → return to dashboard | KPIs and recent list updated |
| 6 | Project-scoped data | Switch projects → view dashboard | KPIs reflect selected project only |

---

### 3.3 Bill Lifecycle

**File:** `bills.spec.ts`
**Priority:** P0 (Critical)

#### Bill Creation

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Create minimal bill | Fill date + vendor + amount → submit | Bill created in `draft` status, appears in list |
| 2 | Create full bill | Fill all fields (date, vendor, item, amounts brutto19/7/0, comment, type) → submit | Bill created with all fields persisted |
| 3 | Allocate to motive/category | Add motive allocation 60%/40%, category allocation 50%/50% | Allocations saved, percentages sum validated |
| 4 | Invalid allocation (>100%) | Set motive allocation 60% + 50% | Validation error: allocations exceed 100% |
| 5 | Auto bill number | Create two bills | Second bill has number = first + 1 |
| 6 | Bill number uniqueness under concurrency | Create two bills rapidly (API-level) | No duplicate bill numbers |
| 7 | Quota check | Upload when project at quota limit | Error: "Upload limit reached" |

#### Bill List & Filtering

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 8 | Default bill list | Navigate to `/bills` | Shows bills for current project, paginated (25/page) |
| 9 | Filter by status | Select "approved" filter | Only approved bills shown |
| 10 | Filter by date range | Set start/end date | Only bills within range shown |
| 11 | Filter by vendor | Type vendor name | Matching bills shown |
| 12 | Sort by date descending | Click date column header | Most recent first |
| 13 | Sort by amount | Click amount column header | Sorted numerically |
| 14 | Pagination | Navigate to page 2 | Next 25 bills shown, page indicator updates |
| 15 | Empty state | Filter with no matches | "No bills found" message |
| 16 | Admin sees all bills | Login as admin → view bills | All project bills visible |
| 17 | User sees own bills | Login as user → view bills | Only own bills visible (if restricted) |

#### Bill Status Workflow

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 18 | Draft → Confirmed | Author clicks "Confirm" on draft bill | Status changes to `confirmed` |
| 19 | Confirmed → Approved (admin) | Admin clicks "Approve" on confirmed bill | Status = `approved` |
| 20 | Confirmed → Rejected (admin) | Admin clicks "Reject" → enters reason | Status = `rejected`, notification sent to author |
| 21 | Rejected → Draft (author reverts) | Author reverts rejected bill | Status = `draft`, can edit and resubmit |
| 22 | Approved → Paid (admin) | Admin marks approved bill as paid | Status = `paid` |
| 23 | Self-approval | Author confirms then approves own bill | Status = `approved` (if feature allows) |
| 24 | User cannot approve others' bills | User clicks approve on another's bill | 403 error / button hidden |
| 25 | Status change audit trail | Change status → view bill history | EditLog entry created with old/new status |

#### Bill Editing

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 26 | Edit draft bill | Change vendor and amount | Changes saved, edit log entry created |
| 27 | Edit approved bill (admin) | Admin modifies amount on approved bill | Changes saved (or blocked depending on policy) |
| 28 | User cannot edit others' bills | User tries to edit another's bill | 403 / edit button hidden |
| 29 | Admin edits any bill | Admin modifies any user's bill | Changes saved |

#### Bill Deletion

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 30 | Delete own draft bill | Click delete → confirm | Bill removed from list, images deleted |
| 31 | Bulk delete bills | Select 3 bills → bulk delete | All 3 removed |
| 32 | Cannot delete approved bill (user) | User attempts delete on approved bill | Blocked (button hidden or error) |
| 33 | Admin can delete any bill | Admin deletes user's bill | Bill removed |

---

### 3.4 Bill Images & OCR

**File:** `bill-images.spec.ts`
**Priority:** P1

#### Image Upload

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Upload single image (JPEG) | Drop JPEG into upload zone | Preview shown, image saved |
| 2 | Upload single image (PNG) | Drop PNG into upload zone | Preview shown |
| 3 | Upload multiple images | Drop 3 images | All 3 previewed, sort order set |
| 4 | Upload oversized image | Drop 20MB image | Error: "File too large" |
| 5 | Upload invalid type (PDF) | Drop PDF file | Error: "Invalid file type" |
| 6 | Crop image before upload | Upload → open crop tool → crop → save | Cropped version saved |
| 7 | Camera capture (mobile) | Tap camera button → take photo | Photo uploaded as bill image |

#### Image Management (Bill Detail)

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 8 | View image gallery | Open bill with 3 images | Gallery with navigation arrows |
| 9 | Reorder images | Drag image 3 to position 1 | Sort order updated in DB |
| 10 | Replace image | Click replace on image → upload new | Old image replaced, filename changes |
| 11 | Delete image | Click delete on image → confirm | Image removed from bill and disk |
| 12 | Add more images to existing bill | Click "Add images" → upload 2 more | Images appended to gallery |

#### OCR Analysis

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 13 | Trigger OCR (admin) | Click "Analyse" on bill with image | OCR status = `pending` → `done`, fields extracted |
| 14 | OCR extracts fields | After analysis completes | Date, vendor, amounts populated, marked "to be checked" |
| 15 | Verify OCR field | Click checkmark on extracted field | Field marked as verified |
| 16 | Re-analyse bill | Click "Re-analyse" on already-analysed bill | Fields reset to unverified, new analysis runs |
| 17 | OCR failure | Analysis with bad API key | Status = `failed`, notification sent, manual entry still works |
| 18 | OCR on bill without images | Trigger analyse on imageless bill | Error or graceful handling |

---

### 3.5 Bill Comments

**File:** `bill-comments.spec.ts`
**Priority:** P2

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Add comment | Type comment → submit | Comment appears in thread with author and timestamp |
| 2 | Edit own comment | Click edit → modify text → save | Comment updated, "edited" indicator shown |
| 3 | Delete own comment | Click delete → confirm | Comment removed |
| 4 | Cannot edit others' comments | View another's comment | No edit button visible |
| 5 | Cannot delete others' comments | View another's comment | No delete button visible |
| 6 | Admin can delete any comment | Admin deletes user's comment | Comment removed |
| 7 | Empty comment blocked | Submit empty text | Validation error |
| 8 | Long comment | Submit 5000-char comment | Accepted and displayed (or truncation) |

---

### 3.6 Budget Matrix

**File:** `budget.spec.ts`
**Priority:** P0

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Matrix loads correctly | Navigate to `/budget` | Grid: categories (rows) x motives (columns), values displayed |
| 2 | Cell shows budget amount | View populated cell | Correct amount from DB |
| 3 | Edit cell (admin) | Click cell → type new amount → save | Value persisted, UI updated |
| 4 | Cell shows spending overlay | View cell with approved bills | Actual spend shown alongside budget |
| 5 | Over-budget cell highlighted | Cell where spend > budget | Red highlight / warning indicator |
| 6 | Bulk update cells | Edit 3 cells → bulk save | All 3 values persisted in one transaction |
| 7 | User cannot edit matrix | Login as user → view budget | Cells are read-only, no edit controls |
| 8 | Empty matrix | Project with no motives/categories | Empty state message |
| 9 | Large numbers display | Enter 1,000,000.00 in cell | No overflow, formatted correctly |
| 10 | Decimal precision | Enter 123.45 | Stored and displayed with 2 decimal places |
| 11 | Negative value rejected | Enter -500 | Validation error |
| 12 | Row/column totals | View matrix | Row totals and column totals calculated correctly |
| 13 | Spending weighted by allocation | Bill allocated 60% Motive A / 40% Motive B | Spending split correctly across matrix cells |

---

### 3.7 Spending Overview

**File:** `spending.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Spending page loads | Navigate to `/spending` | Spending breakdown by motive and category |
| 2 | Budget vs actual comparison | View spending for motive with budget | Shows budget, actual, and difference |
| 3 | Over-budget indicator | Motive where spend > budget | Warning/red indicator |
| 4 | Under-budget indicator | Motive where spend < budget | Green/neutral indicator |
| 5 | Filter by date range | Set date range | Spending recalculated for period |
| 6 | Only approved bills counted | Mix of draft/approved bills | Only approved amounts in totals |
| 7 | Project-scoped | Switch projects → view spending | Data reflects current project only |

---

### 3.8 Categories & Motives

**File:** `categories-motives.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | List categories | Navigate to settings > categories | All project categories displayed |
| 2 | Create category | Enter name + budget → save | Category added to list |
| 3 | Duplicate name rejected | Create category with existing name | Error: "Name already exists" |
| 4 | Whitespace-only name rejected | Enter "   " as name | Validation error (trimming applied) |
| 5 | Edit category name | Click edit → change name → save | Name updated |
| 6 | Edit category budget | Click edit → change budget → save | Budget updated |
| 7 | Delete unused category | Click delete on category with 0 bills | Category removed |
| 8 | Delete category with bills | Click delete on used category | Cascade handling (bills updated or block) |
| 9 | User cannot manage categories | Login as user → settings | No category management controls |
| 10 | List motives | Navigate to settings > motives | All project motives displayed |
| 11 | Create motive | Enter name + budget → save | Motive added |
| 12 | Delete motive | Delete unused motive | Motive removed, matrix column removed |
| 13 | Edit motive | Rename motive | Updated in matrix and bill allocations |

_(Tests 10-13 mirror category tests — motives use identical CRUD patterns)_

---

### 3.9 Project Management

**File:** `projects.spec.ts`
**Priority:** P0

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | List user's projects | Navigate to settings > projects | Shows projects user is member of |
| 2 | Create project | Enter name + subtitle → submit | Project created, user is owner |
| 3 | Switch project | Click different project in selector | Session updates, all pages show new project data |
| 4 | Switch updates JWT | Switch project → inspect session | `currentProjectId`, `currentProjectRole`, `currentProjectName` updated |
| 5 | Switch reloads bills | Switch project → navigate to bills | Bills from new project, not old |
| 6 | Edit project name | Change name → save | Name updated in header and project list |
| 7 | Delete project (owner) | Owner clicks delete → confirms | Project removed, user redirected to another project |
| 8 | Delete project (admin, non-owner) | Admin attempts delete | Blocked (only owner can delete) or allowed per policy |
| 9 | User cannot delete project | User attempts delete | No delete option visible |
| 10 | Resign from project | Click resign → confirm | Membership removed, project disappears from list |
| 11 | Resign from only project | Only project member resigns | Redirected to "no project" state or create project prompt |
| 12 | Cannot switch to non-member project | API call to switch to foreign project | 403 error |

---

### 3.10 Member Management

**File:** `members.spec.ts`
**Priority:** P0

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | List members (admin) | Navigate to settings > members | All project members with roles displayed |
| 2 | User cannot view member list | Login as user → navigate to members | Access denied or redirect |
| 3 | Invite new member | Enter email → send invite | Invitation token created, email sent |
| 4 | Invite existing member | Invite user already in project | Error: "Already a member" |
| 5 | Accept invitation (new user) | Click invite link → create account | Added to project with specified role |
| 6 | Accept invitation (existing user) | Click invite link while logged in | Added to project |
| 7 | Update member role | Change user from `user` to `admin` | Role updated, member sees admin features on refresh |
| 8 | Remove member | Click remove → confirm | Member removed, cannot access project |
| 9 | Cannot remove self | Admin tries to remove own membership via member list | Blocked or warning |
| 10 | Removed member loses access | After removal → member tries to access project | 403 or redirect |
| 11 | Admin cannot self-escalate to owner | Admin tries to set own role to owner | Blocked |
| 12 | Owner transfers ownership | Owner sets another admin as owner | Role transferred |

---

### 3.11 Positions

**File:** `positions.spec.ts`
**Priority:** P2

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | List positions | Navigate to settings > positions | All positions shown |
| 2 | Create position | Enter name → save | Position added |
| 3 | Edit position | Rename position | Name updated |
| 4 | Delete position | Delete position | Position removed, members unassigned |
| 5 | Assign member to position | Select position for member | Member's position updated |

---

### 3.12 V-Geld (Advance Money)

**File:** `vgeld.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | View V-Geld page | Navigate to `/vgeld` | Transfer list and balance shown |
| 2 | Create transfer (user) | Enter amount + recipient → submit | Transfer created in pending state |
| 3 | Admin confirms transfer | Admin clicks confirm on pending transfer | Transfer confirmed, balances updated |
| 4 | Delete transfer (admin) | Admin deletes transfer | Transfer removed, balances reverted |
| 5 | Balance calculation | Multiple transfers in/out | Balance correctly reflects all confirmed transfers |
| 6 | Sidebar balance widget | View sidebar | V-Geld balance shown correctly |
| 7 | Balance widget no project | User with no project selected | Widget handles gracefully (no 400 error) |
| 8 | V-Geld analysis (admin) | Navigate to V-Geld analysis | Summary of all transfers and balances per user |
| 9 | Pagination | Many transfers | Paginated correctly |

---

### 3.13 Notifications

**File:** `notifications.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Notification on bill rejection | Admin rejects user's bill | User sees notification |
| 2 | Notification on OCR failure | OCR analysis fails | User notified |
| 3 | Notification bell badge | Unread notifications exist | Badge with count shown |
| 4 | View notification list | Click notification bell | List of notifications displayed |
| 5 | Mark single as read | Click notification | Marked as read, badge count decrements |
| 6 | Mark all as read | Click "Mark all read" | All notifications cleared, badge removed |
| 7 | Notifications are project-scoped | Switch projects | Only current project notifications shown |

---

### 3.14 Reports & Exports

**File:** `reports.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Export budget matrix PDF | Click PDF export on budget page | PDF downloaded with correct matrix data |
| 2 | Export user report PDF | Generate user report for specific member | PDF with member's bills and totals |
| 3 | Export to Excel | Click Excel export | .xlsx file downloaded with bill data |
| 4 | Export to Google Sheets | Click Sheets sync (if configured) | Bills synced to configured sheet |
| 5 | Export respects project scope | Export from Project A | Only Project A data in export |
| 6 | User cannot access reports | Login as user → navigate to reports | Access denied |
| 7 | Admin can access reports | Login as admin → navigate to reports | Reports page loads |
| 8 | PDF filename sanitized | Export for user with special chars in email | Filename is safe (no injection) |

---

### 3.15 User Profile

**File:** `profile.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | View profile | Navigate to profile | Current user info displayed |
| 2 | Edit name | Change first/last name → save | Name updated, reflected in header |
| 3 | Change password | Enter current + new password → save | Password changed, can login with new password |
| 4 | Change password — wrong current | Enter wrong current password | Error: "Current password incorrect" |
| 5 | Change password — weak new | Enter weak new password | Validation error |
| 6 | Google-only user password section | Google account views profile | No password change option (or appropriate message) |

---

### 3.16 Settings — AI/OCR Configuration

**File:** `settings-ai.spec.ts`
**Priority:** P2

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | View OCR settings (admin) | Navigate to settings > AI Analysis | Current config displayed |
| 2 | Enable OCR | Toggle OCR on → save | OCR enabled for project |
| 3 | Configure provider | Select OpenAI → enter API key → save | Provider saved (key encrypted) |
| 4 | Disable OCR | Toggle OCR off | OCR disabled, analyse button hidden on bills |
| 5 | Invalid API key | Enter bad key → save | Saved (validation is at analysis time) |
| 6 | User cannot access AI settings | Login as user → navigate | No settings page visible |
| 7 | View OCR logs | Navigate to AI log viewer | Shows analysis history with statuses |

---

### 3.17 Settings — Telegram Integration

**File:** `settings-telegram.spec.ts`
**Priority:** P2

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | View Telegram settings (admin) | Navigate to settings > Telegram | Current config displayed |
| 2 | Generate link code | Click "Get link code" | 6-digit code displayed |
| 3 | Link status | After linking | Shows "Connected" with Telegram username |
| 4 | Unlink Telegram | Click "Unlink" | Telegram connection removed |
| 5 | User cannot manage Telegram config | Login as user → settings | Bot token config hidden |

---

### 3.18 Super-Admin Panel

**File:** `superadmin.spec.ts`
**Priority:** P1

#### User Management

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | List all users | Navigate to superadmin > users | All system users displayed |
| 2 | Create user | Enter email + name → submit | User created with generated password |
| 3 | Disable user | Toggle user active status off | User marked inactive, cannot login |
| 4 | Enable user | Toggle back on | User can login again |
| 5 | Delete user | Click delete → confirm | User and all memberships removed (transactional) |
| 6 | Reset user password | Click reset → confirm | New password generated, shown to admin |

#### Project Management

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 7 | List all projects | Navigate to superadmin > projects | All system projects displayed |
| 8 | Switch to any project | Select project superadmin is not member of | Switches successfully (no membership required) |
| 9 | Delete project (superadmin) | Delete any project | Project and all data removed |
| 10 | Update upload limits | Change project upload limit → save | Limit updated (number, not string) |

#### System Config

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 11 | View system config | Navigate to superadmin > config | Config key-values displayed |
| 12 | Update config value | Change external registration toggle | Config persisted |

#### Access Control

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 13 | Non-superadmin cannot access | Login as admin → navigate to superadmin routes | 403 / redirect |
| 14 | Superadmin nav hidden for regular users | Login as user | "System" nav item not visible |

---

### 3.19 Demo Account

**File:** `demo-account.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Demo login | Click "Try Demo" → auto-login | Logged in as demo user, Example Project selected |
| 2 | Cannot switch projects | Demo user tries to switch | Feature disabled or no other projects |
| 3 | Cannot send invitations | Demo user tries to invite | Blocked |
| 4 | Can create bills | Demo user creates a bill | Bill created in Example Project |
| 5 | Can view dashboard | Navigate to dashboard | KPIs and recent bills shown |
| 6 | Session marked as demo | Inspect session | `isDemoAccount: true`, `isExampleProject: true` |
| 7 | Demo data isolation | Demo user's bills | Not visible to other real users |

---

### 3.20 Navigation & Layout

**File:** `navigation.spec.ts`
**Priority:** P1

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Sidebar navigation (desktop) | Click each nav item | Correct page loads |
| 2 | Mobile hamburger menu | Resize to 375px → click menu | Sidebar slides in, all links work |
| 3 | Mobile menu closes on navigation | Click nav item in mobile menu | Menu closes, page loads |
| 4 | Active nav item highlighted | Navigate to bills page | "Bills" nav item highlighted |
| 5 | Admin-only nav items | Login as user | No "Settings" group in nav |
| 6 | Admin nav items visible | Login as admin | Settings, Members, etc. visible |
| 7 | Superadmin "System" nav item | Login as superadmin | "System" nav item visible |
| 8 | Project name in header | View header | Current project name displayed |
| 9 | Project switcher in header | Click project name | Dropdown with projects list |
| 10 | Dark mode toggle | Toggle theme | UI switches to dark mode, persists |
| 11 | Breadcrumb navigation | Navigate deep (bills > bill detail) | Breadcrumbs show path |
| 12 | 404 page | Navigate to `/nonexistent` | 404 page displayed |

---

### 3.21 Authorization & RBAC

**File:** `authorization.spec.ts`
**Priority:** P0 (Critical)

#### Route-Level Access

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Unauthenticated → protected page | Navigate to `/dashboard` without session | Redirect to `/` |
| 2 | Unauthenticated → protected API | `GET /api/bills` without session | 401 Unauthorized |
| 3 | User → admin page | User navigates to `/settings/members` | Redirect or 403 |
| 4 | User → admin API | `POST /api/projects/{id}/invite` as user | 403 Forbidden |
| 5 | Admin → superadmin page | Admin navigates to superadmin routes | 403 or hidden |
| 6 | Admin → superadmin API | `GET /api/admin/users` as admin | 403 |

#### Cross-Project Isolation

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 7 | User reads bill from other project | API: `GET /api/bills/{otherProjectBillId}` | 404 (not 403 — no info leak) |
| 8 | User creates bill in other project | Forge `projectId` in bill creation | Rejected — uses session projectId |
| 9 | Admin manages other project's members | API: `GET /api/projects/{otherProjectId}/members` | 403 |
| 10 | Budget matrix cross-project | API: bulk update with foreign motiveId/categoryId | Validated against current project |

#### Role Boundary Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 11 | User cannot change bill status (others) | `PATCH /api/bills/{id}/status` on other's bill | 403 |
| 12 | User cannot delete others' bills | `DELETE /api/bills/{id}` on other's bill | 403 |
| 13 | User cannot edit budget matrix | `POST /api/budget-matrix/bulk-update` as user | 403 |
| 14 | User cannot create categories | `POST /api/projects/{id}/categories` as user | 403 |
| 15 | Admin can approve any project bill | `PATCH /api/bills/{id}/status` as admin | 200 OK |
| 16 | Superadmin bypass membership | Switch to any project via API | Succeeds |

---

### 3.22 Session & Token Handling

**File:** `session.spec.ts`
**Priority:** P0

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | JWT refresh re-validates role | Change user role in DB → next request | Session reflects new role |
| 2 | Superadmin flag checked from DB | Session claims non-superadmin, DB says superadmin | DB value wins |
| 3 | Project switch updates JWT | Switch project → check session | All project fields updated |
| 4 | Deleted membership detected | Remove membership in DB → user makes request | Session invalidated or scoped |
| 5 | Session expiry | Wait for JWT expiration | User redirected to login |
| 6 | Concurrent sessions | Login in two browsers | Both sessions work independently |
| 7 | Callback URL preserved | Access `/bills` while logged out → login | Redirected back to `/bills` |

---

### 3.23 Rate Limiting

**File:** `rate-limiting.spec.ts`
**Priority:** P2

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Bill creation rate limit | Create 11 bills in 1 minute | 429 after 10th |
| 2 | Login rate limit | 6 failed login attempts | 429 Too Many Requests |
| 3 | Password change rate limit | Rapid password change attempts | 429 |
| 4 | Export rate limit | Rapid PDF/Excel export requests | 429 |
| 5 | Invite rate limit | Rapid invite sends | 429 |
| 6 | Rate limit header present | Any 429 response | `Retry-After` header or appropriate message |
| 7 | Rate limit resets after window | Wait for window to pass → retry | Request succeeds |

---

### 3.24 Cross-Cutting Concerns

**File:** `cross-cutting.spec.ts`
**Priority:** P1

#### Responsive Design

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Desktop layout (1440px) | All pages at 1440px | Sidebar visible, full layout |
| 2 | Tablet layout (768px) | All pages at 768px | Responsive adjustments, no overflow |
| 3 | Mobile layout (375px) | All pages at 375px | Hamburger menu, stacked layout, touch-friendly |

#### Error States

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 4 | API timeout | Slow API response (intercepted) | Loading indicator → error message with retry |
| 5 | Network failure | Kill network mid-request | Error toast with retry option |
| 6 | 500 error display | Force server error | Generic error message (no stack trace leaked) |

#### Loading States

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 7 | Page skeleton loaders | Navigate to data-heavy page | Skeleton shown during fetch |
| 8 | Button loading state | Click submit | Button shows spinner, prevents double-click |
| 9 | Table loading state | Filter bills | Loading indicator during fetch |

#### Toast Notifications

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 10 | Success toast | Create a bill | "Bill created" toast appears |
| 11 | Error toast | Trigger validation error | Error toast with message |
| 12 | Toast auto-dismiss | Wait after toast appears | Toast disappears after ~5 seconds |

#### Security Headers

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 13 | X-Frame-Options | Check response headers | `DENY` |
| 14 | X-Content-Type-Options | Check response headers | `nosniff` |
| 15 | HSTS | Check response headers | `Strict-Transport-Security` present |
| 16 | Referrer-Policy | Check response headers | `origin-when-cross-origin` |

#### Health Check

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 17 | Health endpoint | `GET /api/health` | 200 OK |

---

## 4. Test Data Strategy

### Seed Data

- All test data created in `global-setup.ts` via Prisma direct inserts (not API calls)
- Each test suite gets a known starting state
- Tests that mutate data use unique identifiers (e.g., `test-bill-{uuid}`) to avoid collisions

### Data Isolation

- Tests run against a dedicated test database (`DATABASE_URL` in `.env.test`)
- Parallel test workers use separate projects to avoid interference
- `global-teardown.ts` truncates test data (not `DROP` — schema stays)

### Image Fixtures

| File | Purpose |
|------|---------|
| `valid.jpg` | Standard JPEG, 100KB |
| `valid.png` | Standard PNG, 200KB |
| `oversized.jpg` | 25MB file for size limit testing |
| `invalid.txt` | Text file renamed to .jpg for type validation |
| `tiny.jpg` | 1x1px JPEG for edge case |

### External Service Mocks

| Service | Mock Strategy |
|---------|--------------|
| Google OAuth | Playwright route interception on OAuth callback |
| OCR Providers (OpenAI, etc.) | API route interception returning fixture responses |
| Email (Resend) | Intercept API calls, verify payload |
| Telegram Bot API | Intercept outgoing requests |
| Upstash Redis | Use in-memory fallback (already built in) |

---

## 5. Priority Tiers

### P0 — Smoke / Must Pass (run on every PR)

- Authentication (login/logout)
- Bill creation → confirm → approve
- Project switching
- Authorization boundaries (user vs admin vs superadmin)
- Session/JWT handling
- Dashboard loads
- Budget matrix CRUD

**Estimated: ~50 tests, ~5 min runtime**

### P1 — Core Flows (run on every merge to main)

- Full bill lifecycle with images
- Member invitation and management
- Notifications
- V-Geld transfers
- Reports/exports
- User profile
- Spending overview
- Navigation and responsive layout
- Superadmin operations
- Demo account
- Cross-cutting (errors, loading states, toasts)

**Estimated: ~80 tests, ~10 min runtime**

### P2 — Extended Coverage (run nightly or weekly)

- Rate limiting
- OCR/AI configuration
- Telegram configuration
- Positions management
- Bill comments
- Edge cases (concurrency, large data sets, boundary values)

**Estimated: ~40 tests, ~8 min runtime**

**Total: ~170 test cases across 23 suites**

---

## 6. Browser Matrix

| Browser | Coverage | When |
|---------|----------|------|
| Chromium | Full (P0 + P1 + P2) | Every run |
| Firefox | P0 only | Merge to main |
| WebKit (Safari) | P0 only | Merge to main |
| Mobile Chrome (emulated) | P0 + responsive tests | Merge to main |
| Mobile Safari (emulated) | P0 + responsive tests | Weekly |

---

## 7. CI/CD Integration

### Pipeline Stages

```
PR opened → P0 tests (Chromium only, ~5 min)
PR approved → P0 + P1 tests (Chromium, ~15 min)
Merge to main → Full suite, multi-browser (~25 min)
Nightly → Full suite + P2 + accessibility checks (~35 min)
```

### Failure Handling

- Screenshots captured on every failure
- Video recording for failed tests (Playwright trace)
- Test results posted as PR comment
- P0 failure blocks merge
- P1 failure warns but does not block (admin override)
- P2 failure creates issue for triage

### Artifacts

- HTML report (`playwright-report/`)
- Screenshots (`test-results/`)
- Trace files for debugging (`trace.zip`)
- JUnit XML for CI dashboards

### Environment

- Test DB: Dedicated PostgreSQL instance (Docker service in CI)
- App: `npm run build && npm start` with `.env.test`
- Playwright: `npx playwright test --project=chromium`
- Parallel workers: 4 (matches CI cores)
