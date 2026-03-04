# PROJ-7: Bills Feature

## Status: Change Requested
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

### Overview
PROJ-7 ports the **existing Bills feature** from the Express/Vanilla JS app to Next.js. The existing implementation provides full functionality including multi-image upload, OCR verification, admin workflows, and allocation management.

**Existing Code to Port:**
- Backend: `routes/bills.js` (1000+ lines) - Complete REST API
- Frontend: `public/js/bills.js`, `public/js/allocation-widget.js`, `public/js/gallery.js`
- Helpers: `routes/helpers.js` - Allocation saving logic

### Existing API to Port

| Express Route | Next.js Route | Purpose |
|---------------|---------------|---------|
| `GET /api/bills` | `app/api/bills/route.ts` | List bills with allocations, images |
| `POST /upload` | `app/api/bills/route.ts` | Create bill with images |
| `PUT /api/bills/:id` | `app/api/bills/[id]/route.ts` | Update bill fields |
| `PATCH /api/bills/:id/verify-field` | `app/api/bills/[id]/verify-field/route.ts` | Accept/reject OCR field |
| `DELETE /api/bills/:id` | `app/api/bills/[id]/route.ts` | Delete bill + cleanup images |
| `POST /api/bills/bulk-delete` | `app/api/bills/bulk-delete/route.ts` | Bulk delete bills |
| `POST /api/bills/:id/images` | `app/api/bills/[id]/images/route.ts` | Add images to bill |
| `PUT /api/bills/:id/images/:imageId` | `app/api/bills/[id]/images/[imageId]/route.ts` | Replace/crop image |
| `DELETE /api/bills/:id/images/:imageId` | `app/api/bills/[id]/images/[imageId]/route.ts` | Delete single image |
| `GET /api/bills/log` | `app/api/bills/log/route.ts` | Get edit history |
| `GET /uploads/*` | `public/uploads/` or route handler | Serve uploaded images |

### Component Structure

```
Bills List (/bills)
├── Page Header
│   ├── Title "Bills"
│   └── "Upload New Bill" Button
├── Filter Tabs (All | Pending | Approved | Rejected | Paid)
├── Bills Table
│   ├── Columns: Date | Vendor | Amount | Status | Motive/Category | Actions
│   ├── Bulk select checkbox
│   ├── Pagination (25 per page)
│   └── Empty State
└── Upload Shortcut Button (PROJ-3)

New Bill (/bills/new)
├── Upload Form
│   ├── Image Upload Zone (drag-drop, multiple)
│   ├── Date, Vendor, Amount fields (brutto19/7/0)
│   ├── Description
│   ├── Allocation Widget (motive/category split)
│   └── Submit/Cancel

Bill Detail (/bills/[id])
├── Back link → /bills
├── Header (ID, Date, Status, Amount)
├── Image Gallery (thumbnails, sortable, cropper)
├── Bill Info (vendor, amounts, allocations)
├── AI Analysis (extracted fields, verify/reject)
├── Admin Actions (approve/reject/paid)
└── History Timeline (editlog entries)
```

### Key Features to Port

**From routes/bills.js:**
1. **Bill Number Generation** - Auto format (1.01, 1.02...)
2. **Draft Auto-promotion** - Draft → Confirmed when complete
3. **OCR Field Stripping** - Remove verified fields from ocr_fields JSON
4. **Allocation Defaults** - 100% to Default/Uncategorized if none specified
5. **Image Cleanup** - Delete files on bill/image deletion
6. **Legacy Column Sync** - Keep bills.filename/file synced with first image

**From public/js/*.js:**
1. Table sorting, filtering, bulk operations
2. Allocation widget with percentage validation
3. Image gallery with Cropper.js integration
4. Status workflow UI

### Data Model

Already in `schema.prisma`:
- **Bill** - Core expense data, amounts, status, OCR
- **BillImage** - Multiple images per bill
- **BillMotive/BillCategory** - Junction tables with percentages
- **EditLog** - Audit trail

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API Layer** | Route Handlers | Port existing Express logic to App Router |
| **File Uploads** | `formidable` | Multer equivalent for Next.js |
| **Image Storage** | Keep `data/uploads/` | PROJ-6 migration handles paths |
| **Allocation Widget** | Port existing | Complex UI already built |
| **Gallery** | Cropper.js | Existing integration works |

### Dependencies

- `formidable` - File upload handling
- `cropperjs` - Image cropping (already used)

### Security (from existing)

- Project-scoped queries via session
- File type whitelist (jpg/png/webp/pdf)
- 10MB size limit
- Max 10 images per bill

### Migration Strategy

1. **API Routes** - Port endpoints to `app/api/bills/**`
2. **Pages** - Port UI to `app/(protected)/bills/`
3. **Components** - Port allocation widget, gallery

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Change Requests

| ID | Priority | Title | Status |
|----|----------|-------|--------|
| [CR-6](CR-6-camera-upload-bills.md) | High | Add Camera Capture to Bill Upload | Pending Review |
| [CR-7](CR-7-image-crop-overlay.md) | Medium | Add Image Crop Feature with Overlay Buttons | Pending Review |
