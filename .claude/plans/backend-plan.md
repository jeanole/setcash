# Backend Implementation Plan

## Feature
PROJ-7: Bills Feature — Port from Express to Next.js App Router

## Context Summary

### Current State
- **Frontend**: Complete — All pages and components exist in `nextjs/app/(protected)/bills/` and `nextjs/components/bills/`
- **Database**: Prisma schema ready with all required tables (Bill, BillImage, BillMotive, BillCategory, EditLog, OcrLog)
- **Auth**: NextAuth.js v5 configured with JWT strategy, session includes `user.id`, `user.role`, `user.currentProjectId`
- **Middleware**: Authentication middleware protects all routes except `/login`, `/api/auth/*`, `/api/health`

### Existing Express Routes to Port
From `routes/bills.js` (1000+ lines):
- Bill CRUD (list, create, update, delete, bulk delete)
- Image management (upload, replace, delete, reorder)
- Allocations (motive/category split with percentages)
- Edit logging

From `routes/ocr.js`:
- OCR analysis trigger
- OCR status polling
- API key encryption/decryption

From `routes/motives.js` & `routes/categories.js`:
- List motives/categories for current project

### Key Business Logic to Port
1. **Bill Number Generation**: Format `group.position` (e.g., 1.01-1.20, 2.01-2.20) based on user's bill count in project
2. **Draft Auto-promotion**: Draft → Confirmed when vendor and amount are both present
3. **OCR Field Stripping**: Remove verified fields from ocr_fields JSON when user edits them
4. **Allocation Defaults**: 100% to Default/Uncategorized if none specified
5. **Image Cleanup**: Delete files from disk on bill/image deletion
6. **Legacy Column Sync**: Keep bills.filename/file synced with first image

## User Decisions

### File Upload Configuration
- **Storage**: `data/uploads/` (outside Next.js public for security)
- **Serving**: `/uploads/[...path]` route handler with project access check
- **Max file size**: 10MB
- **Allowed types**: jpg, png, webp, pdf
- **Max images per bill**: 10

### Authorization Rules
- **List/View**: Any authenticated user with project access
- **Create**: Any authenticated user with project access
- **Update/Delete own**: User who created the bill
- **Update/Delete any**: Project admins only
- **Bulk delete**: Project admins only
- **Approve/Reject/MarkPaid**: Project admins only
- **OCR Analysis**: Project admins only

### OCR Analysis
- OCR service is external (OpenAI, Gemini, or Claude)
- API keys stored encrypted in project_settings
- Analysis runs asynchronously (bill.ocrStatus = 'pending' → 'done'/'failed')
- Frontend polls `/api/bills/[id]/ocr-status` every 3 seconds

## Open Bug Reports to Address
**None** — BUG-9 (Duplicate Image Upload Sections) is Resolved

## Tables (Already Exist in schema.prisma)

No new tables needed. Existing tables:
- `Bill` — Core expense data
- `BillImage` — Multiple images per bill
- `BillMotive` / `BillCategory` — Junction tables with percentages
- `EditLog` — Audit trail
- `OcrLog` — OCR analysis logs
- `Motive` / `Category` — Reference data
- `ProjectSettings` — OCR provider config

## API Endpoints to Implement

### Bills
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/bills` | GET | Project member | List bills with allocations, images, pagination |
| `/api/bills` | POST | Project member | Create bill with images (multipart/form-data) |
| `/api/bills/[id]` | GET | Project member | Get single bill with full details |
| `/api/bills/[id]` | PUT | Project member | Update bill fields |
| `/api/bills/[id]` | DELETE | Admin or owner | Delete bill + cleanup images |
| `/api/bills/bulk-delete` | POST | Admin | Bulk delete bills |
| `/api/bills/log` | GET | Project member | Get edit history for project |

### Bill Images
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/bills/[id]/images` | POST | Project member | Add images to existing bill |
| `/api/bills/[id]/images/[imageId]` | PUT | Project member | Replace/crop image |
| `/api/bills/[id]/images/[imageId]` | DELETE | Admin or owner | Delete single image |
| `/api/bills/[id]/images/reorder` | PUT | Project member | Reorder images (new endpoint) |

### OCR
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/bills/[id]/analyse` | POST | Admin | Trigger OCR analysis |
| `/api/bills/[id]/ocr-status` | GET | Project member | Get OCR status |
| `/api/bills/[id]/verify-field` | PATCH | Project member | Verify/reject OCR field |

### Status Workflow
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/bills/[id]/status` | PATCH | Admin | Update status (approve/reject/paid) |

### Reference Data
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/motives` | GET | Project member | List motives for current project |
| `/api/categories` | GET | Project member | List categories for current project |

### File Serving
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/uploads/[...path]` | GET | Project member | Serve uploaded images with access check |

## Input Validation (Zod Schemas)

```typescript
// Bill creation
const createBillSchema = z.object({
  date: z.string().datetime(),
  type: z.string().default('Kauf'),
  vendor: z.string().min(1),
  item: z.string(),
  comment: z.string(),
  brutto19: z.number().min(0).default(0),
  brutto7: z.number().min(0).default(0),
  brutto0: z.number().min(0).default(0),
  motiveAllocations: z.array(z.object({
    motiveId: z.string(),
    percentage: z.number().min(0).max(100)
  })).default([]),
  categoryAllocations: z.array(z.object({
    categoryId: z.string(),
    percentage: z.number().min(0).max(100)
  })).default([]),
});

// Bill update (partial)
const updateBillSchema = createBillSchema.partial();

// Status update
const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'pending', 'approved', 'rejected', 'paid'])
});

// Verify field
const verifyFieldSchema = z.object({
  field: z.enum(['date', 'vendor', 'item', 'type', 'brutto19', 'brutto7', 'brutto0', 'amount', 'comment'])
});

// Bulk delete
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1)
});

// Image reorder
const reorderImagesSchema = z.object({
  images: z.array(z.object({
    id: z.string(),
    sortOrder: z.number()
  }))
});
```

## Response Shapes

### Bill (full)
```typescript
interface BillResponse {
  id: string;
  date: string;
  billNumber: string | null;
  type: string | null;
  vendor: string | null;
  item: string | null;
  comment: string | null;
  brutto19: number;
  brutto7: number;
  brutto0: number;
  amount: number;
  nettoAmount: number;
  status: BillStatus;
  ocrStatus: OcrStatus;
  ocrFields: string[] | null;
  email: string;
  role: string;
  images: BillImage[];
  motiveAllocations: MotiveAllocation[];
  categoryAllocations: CategoryAllocation[];
}
```

## Error Cases
- `400` — Invalid input (Zod validation failed)
- `401` — Not authenticated
- `403` — Not authorized (wrong project or insufficient role)
- `404` — Bill/image not found
- `409` — OCR analysis already in progress
- `413` — File too large
- `500` — Server error

## Frontend Integration

### API Client (`nextjs/lib/api/bills.ts`)
Already exists with all method signatures — just needs the actual API routes to work.

### Components Needing Connection
- `BillList.tsx` — Uses `useBills()` hook → needs `GET /api/bills`
- `BillForm.tsx` — Submit → needs `POST /api/bills` or `PUT /api/bills/[id]`
- `BillDetailHeader.tsx` — Actions → needs `PATCH /api/bills/[id]/status`, `POST /api/bills/[id]/analyse`
- `ImageGallery.tsx` — Image ops → needs image CRUD endpoints
- `OcrFieldVerification.tsx` — Verify → needs `PATCH /api/bills/[id]/verify-field`

## Implementation Order

1. **Prisma client singleton** — Ensure `lib/prisma.ts` exists
2. **Auth helper** — Create `lib/auth-session.ts` to get current user with project
3. **File upload utility** — Create `lib/upload.ts` with formidable wrapper
4. **Core bill routes** — `GET/POST /api/bills`, `GET/PUT/DELETE /api/bills/[id]`
5. **Image routes** — Upload, delete, replace, reorder
6. **OCR routes** — Analyse, status, verify-field
7. **Status route** — PATCH /api/bills/[id]/status
8. **Reference routes** — Motives, categories
9. **File serving** — `/uploads/[...path]`
10. **Edit log** — GET /api/bills/log

## Checklist

### API Implementation
- [ ] All CRUD endpoints return proper error responses
- [ ] All endpoints verify project access
- [ ] Admin-only endpoints check role
- [ ] File uploads validate type and size
- [ ] Image cleanup on delete
- [ ] Edit logging on all mutations
- [ ] Bill number generation works
- [ ] Draft auto-promotion works
- [ ] OCR field stripping works
- [ ] Allocation defaults work

### Security
- [ ] All endpoints use auth() from @/auth
- [ ] Project scoping enforced
- [ ] File serving checks project access
- [ ] No SQL injection (use Prisma)
- [ ] Input validation with Zod

### Integration
- [ ] Frontend hooks work with new APIs
- [ ] Image gallery displays correctly
- [ ] File uploads work end-to-end
- [ ] OCR analysis triggers correctly
