# Frontend Implementation Plan

## Feature
BUG-9: Duplicate Image Upload Sections on New Bill Page — `features/BUG-9-duplicate-image-upload-sections.md`

## Context Summary
- **Project:** vBudget Next.js migration
- **Bug:** The `/bills/new` page shows TWO image upload sections
- **Location 1:** `BillForm.tsx` lines 320-331 (inside form component)
- **Location 2:** `page.tsx` lines 130-141 (separate section at bottom)
- **Fix Required:** Remove from BillForm, move to top in page.tsx

## User Decisions
| Question | Answer |
|----------|--------|
| Visual Style | Match existing vBudget style |
| Image Upload Position | **TOP** of form (as per original vBudget) |

## Open Bug Reports to Address
- BUG-9: Duplicate Image Upload Sections (this bug)

## Existing Components to Modify

| Component | Location | Changes |
|-----------|----------|---------|
| `BillForm.tsx` | `components/bills/BillForm.tsx` | Remove image upload section (lines 320-331) |
| `page.tsx` | `app/(protected)/bills/new/page.tsx` | Move image upload to top (before form) |

## No New Components Needed
This is a fix that only requires removing duplicate code and repositioning existing components.

## Pages / Routes to Modify

### `/app/(protected)/bills/new/page.tsx`
**Current Structure:**
1. Header
2. Result message
3. Form (contains BillForm with its own image upload)
4. Image upload section (duplicate)

**New Structure:**
1. Header
2. Result message
3. **Images section** (moved to top)
4. Form (BillForm without image upload)

## Changes Required

### 1. BillForm.tsx - Remove Image Upload Section
**Remove lines 320-331:**
```tsx
{/* Image Upload */}
{!initialData?.id && (
  <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
    <h2 className="text-lg font-semibold text-slate-900 mb-4">Images</h2>
    <BillImageUpload
      onUpload={(files) => {
        // Handle file upload after form submit
        console.log('Files to upload:', files);
      }}
    />
  </section>
)}
```

Also remove the `BillImageUpload` import since it's no longer used in this file.

### 2. page.tsx - Move Image Upload to Top
**Current order:** Header → Result → Form → Images
**New order:** Header → Result → Images → Form

Move the image upload section (lines 130-141) to appear BEFORE the form section (line 121).

## Design Specifications
- Keep existing styling: `bg-white rounded-xl border border-slate-200 shadow-sm p-6`
- Keep existing BillImageUpload component with same props
- No visual changes, just repositioning

## Checklist
- [ ] Remove image upload from `BillForm.tsx` (lines 320-331)
- [ ] Remove unused `BillImageUpload` import from `BillForm.tsx`
- [ ] Move image upload section to top in `page.tsx` (before form)
- [ ] Verify only ONE image upload section appears on /bills/new
- [ ] Verify image upload is at the TOP of the page
- [ ] Verify form submission still works with images
- [ ] Update BUG-9 status to "Resolved"
