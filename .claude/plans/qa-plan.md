# QA Test Plan

## Feature
PROJ-7: Bills Feature  
Spec: `features/PROJ-7-bills-feature.md`

## Context Summary
- **Status:** In Progress (Change Requested - CR-6 and CR-7 deployed but pending review)
- **Dependencies:** PROJ-5 (NextAuth.js auth), PROJ-6 (PostgreSQL migration) — both Complete
- **Recent CRs Deployed:**
  - CR-6: Camera Capture for bill upload
  - CR-7: Image Crop feature with overlay buttons (Download, Crop, Delete)
- **Recent Bug Fixed:** BUG-9: Duplicate image upload sections — Resolved

## User Guidance
- **Scope:** Full test — all acceptance criteria, edge cases, security, and regression
- **Specific worries:** None
- **Known issues:** None
- **Environment:** http://localhost:3000 — Docker rebuild before testing
- **Test accounts:** Default admin@example.com / user@example.com

## Acceptance Criteria to Test

### AC-1: Bill List Page (`/bills`)
- **Expected:** Paginated list (25 per page), columns: date, vendor, amount, status, motive/category allocation, actions
- **How to test:** Navigate to /bills, verify table columns, check pagination works

### AC-2: Project-scoped Filtering
- **Expected:** List filtered to current user's project; admins see all project bills
- **How to test:** Login as user, verify only project bills shown; login as admin, verify all bills visible

### AC-3: New Bill Upload Page (`/bills/new`)
- **Expected:** Upload form with image file input, date, vendor, amount, description, motive/category allocation widget
- **How to test:** Navigate to /bills/new, verify all form fields present

### AC-4: File Upload Configuration
- **Expected:** Files stored in `/nextjs/public/uploads/` (or configurable `UPLOAD_DIR`); only jpg/png/webp/pdf accepted; max 10 MB
- **How to test:** Upload various file types, verify accept/reject behavior; check 10MB limit enforced

### AC-5: Bill Detail Page (`/bills/[id]`)
- **Expected:** All fields, AI analysis results with per-field verification badges, status history log
- **How to test:** Click on bill from list, verify detail view shows all components

### AC-6: Admin Action Buttons
- **Expected:** Approve, reject, mark paid buttons on detail page; visible only to admins
- **How to test:** As admin, verify buttons present; as user, verify buttons hidden

### AC-7: Re-analyse Button
- **Expected:** Triggers POST to `/api/bills/[id]/analyse`; updates fields + logs to editlog
- **How to test:** Click re-analyse, verify API call, check fields update, verify history log entry

### AC-8: Per-field Verification
- **Expected:** Each AI-extracted field has Accept / Reject toggle; saved on form submit
- **How to test:** View bill with OCR results, verify accept/reject toggles work, save and verify persistence

### AC-9: Bill History Log
- **Expected:** Editlog rendered as timeline on detail page
- **How to test:** View bill with history, verify timeline shows entries in chronological order

### AC-10: Image Gallery
- **Expected:** Thumbnail grid on detail page, click to open full-size lightbox
- **How to test:** View bill with images, verify thumbnails, click to open lightbox

### AC-11: Server Actions Only
- **Expected:** All bill mutations use Next.js Server Actions or Route Handlers — no raw SQL in components
- **How to test:** Code review — check components don't contain raw SQL

### AC-12: Allocation Widget
- **Expected:** `AllocationWidget` component allows splitting bill across multiple motives/categories with percentage inputs summing to 100%
- **How to test:** Create/edit bill, add allocations, verify percentage validation

### AC-13: Empty State
- **Expected:** When no bills exist, show "No bills yet — upload your first bill"
- **How to test:** Clear all bills or use fresh project, verify empty state message

### AC-14: Loading Skeleton
- **Expected:** Skeleton shown while data fetches
- **How to test:** Throttle network, verify skeleton appears during load

### AC-15: Camera Capture (CR-6)
- **Expected:** "Take Photo" button with green styling, uses `capture="environment"`, processes through crop modal
- **How to test:** On /bills/new, verify Take Photo button present and styled correctly

### AC-16: Image Crop Feature (CR-7)
- **Expected:** Crop modal with Cropper.js, overlay buttons (Download, Crop, Delete) on gallery images
- **How to test:** Upload image, verify crop modal; view bill gallery, verify overlay buttons

## Edge Cases to Test

### EC-1: Upload with no image
- Image is optional; form still submits with `image_path: null`

### EC-2: Unsupported file type
- 400 response with "Unsupported file type" message in UI

### EC-3: File > 10 MB
- 413 response with "File too large" message in UI

### EC-4: Allocation percentages don't sum to 100
- Form blocked with inline validation error

### EC-5: Admin approves already-approved bill
- Idempotent (no error, no double-log)

### EC-6: Bill belongs to different project
- 403 forbidden response

### EC-7: OCR service unavailable during re-analyse
- Show "Analysis unavailable, try again later"

### EC-8: Camera capture on desktop
- Graceful fallback (behaves like regular file picker)

## Security Audit Scope

### Authentication
- [ ] Cannot access /bills without login (redirect to login)
- [ ] Cannot access /bills/new without login
- [ ] Cannot access /bills/[id] without login
- [ ] API routes return 401 for unauthenticated requests

### Authorization
- [ ] User A cannot see User B's bills (different projects)
- [ ] User cannot approve/reject bills (admin only)
- [ ] User cannot access admin-only API endpoints
- [ ] Bill from different project returns 403

### Input Validation
- [ ] XSS attempts in vendor/description fields blocked
- [ ] SQL injection attempts in search/filter blocked
- [ ] Path traversal in file upload blocked
- [ ] Amount fields reject non-numeric input

### Rate Limiting
- [ ] Excessive bill creation requests handled
- [ ] Excessive re-analyse requests handled

### Exposed Secrets Check
- [ ] No API keys in client-side code
- [ ] No database credentials exposed
- [ ] Upload directory not browsable

### Sensitive Data in API Responses
- [ ] Password hashes not included in responses
- [ ] Internal IDs not leaked
- [ ] File paths don't expose server structure

## Regression Test Scope

From features with status "Deployed":
- PROJ-1: OCR / AI Bill Analysis (core functionality)
- PROJ-2: Security & Multi-tenant Hardening
- PROJ-3: Upload Shortcut Button
- PROJ-4: Next.js App Scaffold
- PROJ-5: NextAuth.js Authentication
- PROJ-6: SQLite → PostgreSQL Migration

Spot-check:
- Authentication still works
- Session persistence across pages
- Project context maintained

## Responsive / Cross-Browser Scope
- Breakpoints: 375px (mobile), 768px (tablet), 1440px (desktop)
- Browsers: Chrome, Firefox, Safari (where applicable)
- Test: Table responsiveness, form layout, image gallery, crop modal

## Bug Report Template
Reference: `.claude/skills/qa/test-template.md`

Each bug must include:
- Severity: Critical | High | Medium | Low
- Skill tag: [Frontend], [Backend], [Architecture], [Deploy]
- Steps to reproduce
- Expected vs Actual behavior
- Screenshot if visual
