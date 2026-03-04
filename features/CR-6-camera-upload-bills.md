# CR-6: Add Camera Capture to Bill Upload

**Requested:** 2026-03-04 | **Priority:** High | **Status:** Pending Review

**Feature:** PROJ-7: Bills Feature

## Current Behavior
The new Next.js bill upload form (`/bills/new`) only has a "Choose Files" button for selecting images from the device gallery. It lacks the camera capture functionality that was present in the original vBudget app.

## Desired Behavior
Add a "Take Photo" button that allows users to capture images directly using the device's camera (back camera / environment facing). This should:
1. Use HTML5 `capture="environment"` attribute on a file input
2. Be positioned at the **top** of the upload section
3. Support the same image processing flow as file uploads (thumbnails, crop modal, etc.)
4. Match the original implementation:
   - Green "Take Photo" button alongside the blue "Choose Files" button
   - Camera button opens the device camera directly on mobile
   - Captured photo goes through the same crop/validation flow

## Rationale
The original vBudget app supported camera capture which is essential for mobile workflows. Users expect to snap photos of receipts immediately rather than saving them to gallery first. This is a regression from the original functionality.

## Original Implementation Reference
From `public/index.html` lines 324-335:
```html
<label class="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-600 transition-colors min-h-[44px]">
    <input type="file" accept="image/*" capture="environment" id="uploadCameraInput" class="hidden" />
    Take Photo
</label>
```

## Proposed Acceptance Criteria
- [ ] "Take Photo" button added to `/bills/new` page at the top of the upload section
- [ ] Button styled with emerald/green color (matching original)
- [ ] Uses `capture="environment"` to access back camera
- [ ] Captured images process through the same crop modal as file uploads
- [ ] Thumbnails display correctly after capture
- [ ] Works on mobile devices (iOS Safari, Android Chrome)
- [ ] Graceful fallback on desktop (behaves like regular file picker)

## Resolution
**Status:** Pending Review
