# BUG-38: Images Not Shown in Bill Detail View / Bill Not Editable

**Status:** Open
**Reported:** 2026-03-08
**Severity:** High
**Skill Tag:** frontend
**Feature:** PROJ-7

---

## Description

### Expected Behavior
1. Images uploaded to a bill should be visible in the bill detail view when navigating from the bills table via "View".
2. Bill fields (date, type, vendor, item, comment, amounts, allocations) should be editable from the detail view.

### Actual Behavior
1. Images are not shown — the image gallery renders broken images.
2. The bill detail page is entirely read-only — no way to edit bill fields on desktop (only a hidden floating button for mobile that links to a non-existent `/bills/[id]/edit` page).

## Steps to Reproduce

1. Create a bill with one or more images
2. Navigate to the bills table
3. Click "View" on any bill with images
4. Observe: image gallery shows broken images (no images visible)
5. Observe: no way to edit bill fields (vendor, date, amounts, allocations) on the detail page

## Root Causes

1. **Image URL mismatch**: `ImageGallery.tsx` constructs image URLs as `/uploads/${image.file}`, but the actual Next.js API route is at `/api/uploads/[...path]`. Next.js has no rewrite mapping `/uploads/` → `/api/uploads/`, so the browser requests a non-existent path.

2. **Missing edit UI**: The bill detail page (`app/(protected)/bills/[id]/page.tsx`) shows all fields as read-only text. There is no "Edit" button or edit mode for bill fields on desktop. The only edit navigation (floating FAB) routes to `/bills/[id]/edit` which does not exist.

## Environment

- **Browser/Client:** All browsers
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-08

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-08
**Fixed In:** fix(BUG-38)
**Fix Description:**

1. **Image URLs**: Changed `/uploads/${image.file}` → `/api/uploads/${image.file}` in `ImageGallery.tsx` (4 occurrences: thumbnail `<img>`, lightbox `<img>`, download `link.href`, crop `fetch()`).

2. **Edit functionality**: Added inline edit mode to `app/(protected)/bills/[id]/page.tsx`:
   - "Edit Bill" button added to the header actions row
   - Clicking "Edit Bill" enters edit mode — right column switches to an edit form with inputs for date, type, vendor, item, comment, brutto19, brutto7, brutto0
   - Allocations become editable in edit mode
   - "Save" calls `updateBill()`, "Cancel" resets state and exits edit mode
   - Removed the dead mobile-only floating FAB that routed to a non-existent edit page
