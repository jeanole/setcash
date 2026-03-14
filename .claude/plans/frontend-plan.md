# Frontend Implementation Plan — PROJ-20 User Profile Edit Panel

## Feature
PROJ-20: User Profile Edit Panel — `features/PROJ-20-user-profile-edit.md`

## Context Summary
- All app code in `nextjs/`
- Header shows avatar initials (email[0]) + sign-out button — avatar is a plain `div`, not clickable
- AppShell manages modal open/close state (pattern: `useState` flag passed to modal)
- BugReportModal is the reference pattern for modals: fixed overlay, max-w-lg white card, slate form fields, indigo primary button
- `currentUser` passed as `{ email, role }` from AppShell → Header — needs extending with new profile fields
- No existing profile page or `/api/users/me` route

## User Decisions
- Password change: inline (current password + new password fields), NOT email-based reset

## Open Bug Reports to Address
None

## Existing Components to Reuse
- `BugReportModal` — modal structure, form field styling, error banner pattern
- `SignOutButton` — stays next to avatar in header
- Tailwind form classes consistent with codebase

## New Components to Build

### 1. `components/layout/ProfileModal.tsx`
**Props:**
```ts
interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
  };
  onProfileUpdated: (updated: { username: string | null; firstName: string | null; lastName: string | null }) => void;
}
```

**Two sections separated by a divider:**
1. Profile Info: username, first name, last name, mobile + Save button
2. Change Password: current password, new password, confirm new password + Update Password button

Each section has its own loading state, error banner (rose), and success banner (green, auto-dismissed after 3s).
Email shown as read-only (disabled input, bg-slate-50).

**Responsive:** `items-end sm:items-center` so it feels like a bottom sheet on mobile, centered modal on sm+

### 2. Modify `components/layout/Header.tsx`
- Extend `user` prop type: add `username?: string | null`, `firstName?: string | null`
- Change avatar `div` → `button` with `onClick` prop (passed from AppShell)
- Avatar initials: show `firstName[0]` if set, else `email[0]`
- Add `cursor-pointer hover:ring-2 hover:ring-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all` to avatar button

### 3. Modify `components/layout/AppShell.tsx`
- Extend `currentUser` prop type to include `username`, `firstName`, `lastName`, `mobile` (all optional/nullable)
- Add `isProfileOpen` state (same pattern as `isBugReportOpen`)
- Pass `onProfileOpen={() => setIsProfileOpen(true)}` to Header
- Add `onProfileUpdated` handler that updates local `currentUser` state for immediate header re-render
- Render `<ProfileModal>` alongside `<BugReportModal>`

## Pages / Routes to Modify

### `app/(protected)/layout.tsx`
- Read current session user — extend to fetch/include `username`, `firstName`, `lastName`, `mobile` from the DB via `/api/users/me` or directly via Prisma
- Pass all fields into AppShell `currentUser`

## Data Connection

### GET `/api/users/me`
- Called on ProfileModal open to load fresh data
- Returns: `{ email, username, firstName, lastName, mobile }`

### PATCH `/api/users/me`
- Body: `{ username?, firstName?, lastName?, mobile? }`
- 200: returns updated fields
- 409: username already taken — show inline error

### PATCH `/api/users/me/password`
- Body: `{ currentPassword, newPassword }`
- 200: success
- 401: wrong current password
- 400: password too weak (min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit — same rules as signup)

**Loading/error pattern:** Per-section `isLoading` + `error` state; `finally` always resets loading; success callback fires `onProfileUpdated`

## Design Specifications
- Modal overlay: `fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50`
- Modal card: `w-full max-w-lg bg-white rounded-t-lg sm:rounded-lg shadow-xl max-h-[90vh] flex flex-col`
- Form fields: `w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-[#6366f1]`
- Read-only email: add `bg-slate-50 text-slate-400 cursor-not-allowed`
- Primary button: `bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-50`
- Error banner: `p-3 bg-rose-50 border border-rose-200 rounded-md text-sm text-rose-600`
- Success banner: `p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700`
- Section divider: `border-t border-slate-200 mt-6 pt-6`
- Avatar button ring: `hover:ring-2 hover:ring-indigo-400 focus:ring-2 focus:ring-indigo-400 ring-offset-1`

## Checklist
- [ ] ProfileModal built with profile section + password change section
- [ ] Header avatar changed from div to button, triggers modal open
- [ ] Avatar initials show firstName[0] if set, else email[0]
- [ ] AppShell wires isProfileOpen state and onProfileUpdated callback
- [ ] Protected layout passes username/firstName/lastName/mobile to AppShell
- [ ] GET /api/users/me fetches fresh data on modal open
- [ ] PATCH /api/users/me saves profile — 409 username conflict shown inline
- [ ] PATCH /api/users/me/password validates current password, saves new
- [ ] Loading states reset in all code paths (success, error, finally)
- [ ] Success banners auto-dismiss after 3s
- [ ] onProfileUpdated updates header immediately (no page reload)
- [ ] Responsive: bottom sheet mobile, centered modal desktop
- [ ] Email field read-only
- [ ] Mobile field optional (no validation required)
