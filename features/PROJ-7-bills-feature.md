# PROJ-7: Bills Feature

## Status: In Progress
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
The Bills Feature provides a complete expense management workflow within vBudget. Users can upload receipts, view their expense history, and admins can review/approve bills. The feature supports multiple images per bill, manual AI analysis trigger, and per-field verification.

### Component Structure

```
Bills List Page (/bills)
├── Page Header
│   ├── Title "Bills"
│   └── "Upload New Bill" Button → links to /bills/new
├── Filters Bar (future iteration)
│   ├── Status filter tabs (All | Pending | Approved | Rejected | Paid)
│   └── Date range picker
├── Bills Table
│   ├── Columns: Date | Vendor | Amount | Status | Actions
│   ├── Pagination Controls (25 per page)
│   ├── Empty State (when no bills)
│   └── Loading Skeleton
└── Upload Shortcut Button (PROJ-3 component reused)

New Bill Page (/bills/new)
├── Form Container
│   ├── Image Upload Zone
│   │   ├── Drop zone for files
│   │   ├── File type validation (jpg/png/webp/pdf)
│   │   ├── Size validation (max 10MB)
│   │   └── Preview thumbnails
│   ├── Date Input
│   ├── Vendor Input
│   ├── Amount Input (with currency formatting)
│   ├── Description Textarea
│   ├── Motive Select (single for MVP)
│   ├── Category Select (single for MVP)
│   └── Submit / Cancel Buttons
└── Validation Messages

Bill Detail Page (/bills/[id])
├── Back Navigation → /bills
├── Bill Header
│   ├── Bill ID & Date
│   ├── Status Badge
│   └── Total Amount
├── Image Gallery
│   ├── Thumbnail Grid (clickable)
│   └── Lightbox Modal (full-size view)
├── Bill Information Card
│   ├── Vendor, Amount, Description
│   ├── Motive & Category
│   └── Submitted By
├── AI Analysis Section (if analyzed)
│   ├── Extracted Fields Table
│   │   ├── Field name | Value | Confidence | Actions
│   │   └── Per-field Accept/Reject toggles
│   └── "Re-analyse" Button (admin only)
├── Admin Actions Panel (admin only)
│   ├── Approve Button
│   ├── Reject Button
│   └── Mark as Paid Button
└── History Timeline
    ├── EditLog entries (newest first)
    └── Status change history
```

### Data Model (Conceptual)

The Bills feature works with these core data types:

**Bill**
- Unique ID (UUID)
- Project association (for multi-tenancy)
- Submitter (user email)
- Date of expense
- Vendor name
- Amounts (gross, net, VAT breakdown)
- Description/comment
- Status (confirmed → pending → approved/rejected → paid)
- OCR analysis status and extracted fields
- Creation timestamp

**Bill Image**
- Unique ID (UUID)
- Associated bill
- File path in storage
- Filename for display
- Sort order for gallery
- Upload timestamp

**Bill-Motive Link** (for future allocation widget)
- Links bills to motives with percentage
- MVP: 100% single motive

**Bill-Category Link** (for future allocation widget)
- Links bills to categories with percentage
- MVP: 100% single category

**EditLog / History**
- Timestamp of change
- User who made the change
- What changed (field-level diff)
- Source (user action or AI)

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Image Storage** | Filesystem (`public/uploads/`) | Simple, fast, no external dependencies. For production scale, could migrate to S3-compatible storage later. |
| **Image Serving** | Direct via `/uploads/` path | Next.js public folder serves static files efficiently. No need for API route overhead. |
| **Pagination** | Cursor-based | Better performance with large datasets, consistent ordering when new bills added during browsing. |
| **Form Handling** | Next.js Server Actions | Type-safe, progressive enhancement, handles file uploads via multipart. |
| **State Management** | React Server Components + URL params | No client-side state library needed. Filters and pagination via URL query params for shareable links. |
| **Lightbox** | Custom modal component | Keeps bundle size small, matches app design system. Can enhance with pinch-to-zoom later. |
| **AI Integration** | Route Handler (`/api/bills/[id]/analyse`) | Async processing, handles external OCR API calls, logs results to editlog. |

### Page Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/bills` | Protected | List all bills for user's project |
| `/bills/new` | Protected | Upload new bill form |
| `/bills/[id]` | Protected | View bill detail, admin actions |
| `/api/bills` | Protected (API) | CRUD operations for bills |
| `/api/bills/[id]/analyse` | Admin only | Trigger OCR/AI analysis |
| `/api/bills/[id]/images` | Protected (API) | Upload/retrieve bill images |

### Dependencies

No new major dependencies required. Uses existing stack:
- `@prisma/client` - Database queries
- `next-auth` - Authentication/session
- `zod` - Form validation (already in project)
- Native browser APIs - File upload, image preview

### Security Considerations

- File upload validation: whitelist extensions, size limits
- Project-scoped queries: all bill queries filtered by `projectId` from session
- Role-based actions: admin checks on approve/reject/analyse endpoints
- Image access: images served from public folder; rely on obfuscated filenames for privacy

### Performance Considerations

- Pagination: 25 bills per page to keep initial load fast
- Image optimization: Next.js Image component for thumbnails
- Database indexes: `projectId`, `status`, `date` for efficient filtering
- Server Components: bill list renders on server, reducing client JS

### Future Enhancements (Post-MVP)

- **Allocation Widget**: Split bills across multiple motives/categories with percentage UI
- **Automatic OCR**: Trigger AI analysis on upload (configurable per project)
- **Bulk Actions**: Approve/reject multiple bills at once
- **Advanced Filters**: Date range, amount range, vendor search
- **Receipt Templates**: Pre-fill based on vendor history

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
