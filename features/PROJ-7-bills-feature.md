# PROJ-7: Bills Feature

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-5 (NextAuth.js auth — protected routes)
- Requires: PROJ-6 (PostgreSQL data available via Prisma)

## User Stories
- As a user, I want to see a list of my submitted bills so that I can track my expenses.
- As a user, I want to upload a new bill (with an image) so that I can submit an expense for approval.
- As a user, I want to view the detail of a bill (fields, image, AI analysis results, history log)
  so that I understand its current state.
- As an admin, I want to see all bills for my project so that I can review and process them.
- As an admin, I want to approve, reject, or mark a bill as paid so that the workflow progresses.
- As an admin, I want to trigger OCR/AI re-analysis on a bill so that I can correct misread fields.
- As a user, I want to verify or reject individual AI-extracted fields so that the bill data is accurate.
- As a user, I want to view the bill image gallery so that I can refer to the original receipt.

## Acceptance Criteria
- [ ] `/app/(protected)/bills/page.tsx` — bill list (paginated, 25 per page), columns: date, vendor,
      amount, status, motive/category allocation, actions
- [ ] Bill list is filtered to the current user's project; admins see all project bills
- [ ] `/app/(protected)/bills/new/page.tsx` — upload form: image file input, date, vendor, amount,
      description, motive/category allocation widget
- [ ] File uploads stored in `/nextjs/public/uploads/` (or configurable `UPLOAD_DIR`); only
      jpg/png/webp/pdf accepted; max 10 MB
- [ ] `/app/(protected)/bills/[id]/page.tsx` — bill detail: all fields, AI analysis results with
      per-field verification badges, status history log
- [ ] Admin action buttons (approve, reject, mark paid) on the detail page; visible only to admins
- [ ] "Re-analyse" button triggers POST to `/api/bills/[id]/analyse`; updates fields + logs to editlog
- [ ] Per-field verification: each AI-extracted field has Accept / Reject toggle; saved on form submit
- [ ] Bill history log (editlog) rendered as a timeline on the detail page
- [ ] Image gallery: thumbnail grid on detail page, click to open full-size lightbox
- [ ] All bill mutations use Next.js Server Actions or Route Handlers — no raw SQL in components
- [ ] Allocation widget (`AllocationWidget` React component) allows splitting bill across multiple
      motives and/or categories with percentage inputs that must sum to 100%
- [ ] Empty state shown when no bills exist: "No bills yet — upload your first bill"
- [ ] Loading skeleton shown while data fetches

## Edge Cases
- Upload with no image → image is optional; form still submits with `image_path: null`
- Upload of unsupported file type → 400 response with "Unsupported file type" message in UI
- File > 10 MB → 413 response with "File too large" message in UI
- Allocation percentages do not sum to 100 → form blocked with inline validation error
- Admin tries to approve an already-approved bill → idempotent (no error, no double-log)
- Bill belongs to a different project than the current user's session → 403
- Re-analyse while OCR service is unavailable → show "Analysis unavailable, try again later"

## Technical Requirements
- File uploads: `formidable` or Next.js built-in form handling with `multer` equivalent
- Image serving: Next.js `public/` folder or a dedicated `/api/bills/[id]/image` route
- Pagination: cursor-based via Prisma `cursor` + `take`
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
