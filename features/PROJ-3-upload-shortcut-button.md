# PROJ-3: Upload Shortcut Button in Bills Table

## Status: Planned
**Created:** 2026-02-27
**Last Updated:** 2026-02-27

## Dependencies
- None (UI-only addition — reuses existing upload form markup)

---

## Overview

Add a prominent "+ Upload" button in the header area of the Bills table. Clicking it opens the upload form in a modal overlay so the user can submit a new bill without leaving the Bills view. On successful submission, the modal closes and the Bills table refreshes in place.

---

## User Stories

- As a **project member**, I want a visible "+ Upload" button on the Bills page so that I can submit a new bill directly from the list, without navigating away.
- As a **project member**, I want the upload form to appear as a modal so that I stay on the Bills view and see my new bill appear immediately after submission.
- As a **project member**, I want to be able to dismiss the modal without submitting, leaving the Bills list unchanged.

---

## Acceptance Criteria

- [ ] A "+ Upload" button is displayed in the header area of the Bills table (`#tab-bills`), next to or near the "All Bills" heading
- [ ] The button is visible to all logged-in project members (not admin-only)
- [ ] Clicking the button opens the upload form in a modal overlay (not a pane switch)
- [ ] The modal contains the same upload form fields as the existing Upload pane (photo, date, vendor, item, type, amounts, motive/category allocation)
- [ ] The modal can be dismissed (via ✕ button or clicking outside) without submitting anything
- [ ] On successful submission, the modal closes and the Bills table reloads to show the new bill
- [ ] The button uses the "+" symbol to signal "add new"
- [ ] The button style is consistent with the existing app UI (Tailwind utility classes, no inline styles)
- [ ] The button and modal are usable on mobile (375px), tablet (768px), and desktop (1440px)

---

## Edge Cases

- **Submit fails (server error):** Error message shown inside the modal; modal stays open so the user can retry or fix input.
- **User closes modal mid-fill:** Form state is discarded; Bills table is unchanged.
- **Mobile layout:** Modal is full-screen or near-full-screen on small viewports; button does not overflow the "All Bills" heading row.
- **User has no project selected:** Bills pane is already inaccessible; button inherits the same guard.
- **Duplicate submission (double-click):** Submit button disabled during in-flight request to prevent duplicate bills.

---

## Technical Requirements

- Frontend-only change — no new API endpoints, no DB changes
- Reuses the existing upload form fields and submission logic from the Upload pane
- The existing `POST /upload` endpoint handles the submission unchanged
- Files to modify: `public/index.html` (modal markup + button), `public/js/bills.js` (open/close modal, refresh table on success)
- No new npm packages

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
