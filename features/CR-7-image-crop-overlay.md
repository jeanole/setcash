# CR-7: Add Image Crop Feature with Overlay Buttons

**Requested:** 2026-03-04 | **Priority:** Medium | **Status:** Pending Review

**Feature:** PROJ-7: Bills Feature

## Current Behavior
The new Next.js `ImageGallery` and `BillImageUpload` components are missing the image cropping functionality that existed in the original vBudget app. Users cannot crop images after upload or during the upload process.

## Desired Behavior
Port the complete cropping feature from the original app:

### 1. Crop Modal (during upload)
When uploading images (file picker or camera), show a crop modal that allows users to:
- Crop the image using Cropper.js
- Save the cropped version
- Skip cropping (use original)
- Cancel (discard image)

### 2. Gallery Overlay Buttons
Add action buttons overlaying gallery images (top-right corner):
- **Download** button - Download the current image
- **Crop** button - Re-crop an existing uploaded image
- **Delete** button - Remove the image

### 3. Full-size Lightbox
Clicking an image opens a full-size modal with navigation arrows.

## Original Implementation Reference

From `public/js/gallery.js`:
```javascript
// Crop modal functions: openCropModal(), cropModalSave(), cropModalSkip(), cropModalCancel()
// Gallery overlay: cropCurrentImage(), deleteCurrentImage()
// Uses Cropper.js library
```

From `public/index.html` lines 1797-1808:
```html
<div id="galleryImageActions" class="absolute top-2 right-2 flex gap-1.5 z-[3]">
    <a id="downloadLink" title="Download" class="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/75 text-white flex items-center justify-center">
        <!-- Download icon -->
    </a>
    <button type="button" id="cropImageBtn" title="Crop" onclick="cropCurrentImage()" class="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/75 text-white flex items-center justify-center">
        <!-- Crop icon -->
    </button>
    <button type="button" id="deleteImageBtn" title="Delete" onclick="deleteCurrentImage()" class="w-8 h-8 rounded-lg bg-black/50 hover:bg-rose-500/80 text-white flex items-center justify-center">
        <!-- Delete icon -->
    </button>
</div>
```

## Rationale
The cropping feature is essential for the bill upload workflow. Receipts often need to be cropped to remove unnecessary background. The original app supported this with overlay buttons for quick access.

## Proposed Acceptance Criteria
- [ ] Crop modal component with Cropper.js integration
- [ ] "Crop & Save", "Skip", and "Cancel" buttons in modal
- [ ] Images processed through crop modal on upload
- [ ] Gallery overlay buttons: Download, Crop, Delete
- [ ] Buttons positioned top-right with semi-transparent dark background
- [ ] Crop button re-crops existing uploaded images
- [ ] Works for both new uploads and existing bill images
- [ ] Responsive crop modal (60vh height on desktop)

## Resolution
**Status:** Pending Review
