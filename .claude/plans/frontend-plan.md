# Frontend Implementation Plan

## Feature
CR-6 & CR-7: Camera Capture + Image Crop Feature — `features/CR-6-camera-upload-bills.md`, `features/CR-7-image-crop-overlay.md`

## Context Summary
- **Project:** vBudget Next.js migration (from Express/Vanilla JS)
- **Existing Code:** `BillImageUpload.tsx`, `ImageGallery.tsx` components already exist
- **Original Implementation:** Uses Cropper.js for cropping, `capture="environment"` for camera
- **Dependencies:** Need to install `cropperjs` and `@types/cropperjs`

## User Decisions

| Question | Answer |
|----------|--------|
| Visual Style | Match existing vBudget style exactly |
| Mobile Support | Mobile-first responsive |
| Camera Button Position | **At the top** of upload section (as specified in CR-6) |
| Crop Library | Cropper.js (same as original app) |

## Open Bug Reports to Address
None

## Existing Components to Modify

| Component | Location | Changes Needed |
|-----------|----------|----------------|
| `BillImageUpload` | `components/bills/BillImageUpload.tsx` | Add camera button, crop modal integration |
| `ImageGallery` | `components/bills/ImageGallery.tsx` | Add overlay buttons (Download, Crop), integrate crop modal |

## New Components to Build

### 1. `CropModal` — `/components/bills/CropModal.tsx`
- **Props:** `isOpen: boolean, file: File | null, onSave: (croppedBlob: Blob) => void, onSkip: () => void, onCancel: () => void, counter?: string`
- **States:** Loading cropper, cropping, error
- **Features:**
  - Cropper.js integration
  - ViewMode 1, autoCropArea 0.8
  - "Crop & Save", "Skip (use original)", "Cancel" buttons
  - 60vh height on desktop, responsive
  - Counter display for multi-image processing ("1 / 3")

### 2. `ImageOverlayButtons` — `/components/bills/ImageOverlayButtons.tsx` (or inline in ImageGallery)
- **Props:** `image: BillImage, onDownload: () => void, onCrop: () => void, onDelete: () => void`
- **Position:** Absolute top-right on image
- **Buttons:**
  - Download (dark bg, download icon)
  - Crop (dark bg, crop icon) 
  - Delete (dark bg → rose on hover, trash icon)
- **Style:** `bg-black/50 hover:bg-black/75`, rounded-lg, white icons

## Dependencies to Add

```json
{
  "cropperjs": "^1.6.2",
  "@types/cropperjs": "^1.3.0"
}
```

Also need to import Cropper.js CSS in globals.css or layout.

## BillImageUpload Modifications

### Camera Button (CR-6)
- Add green "Take Photo" button at the **top** of upload section
- Use `<input type="file" accept="image/*" capture="environment" />`
- Style: emerald-500 bg, white text, rounded-lg
- Process captured images through crop modal

### Crop Modal Integration
- Add state for crop modal: `isCropModalOpen`, `filesToProcess`, `currentFileIndex`
- When files selected (via file picker OR camera), process through crop modal sequentially
- `processThroughCropModal()` function similar to original:
  - Open crop modal for each file
  - On Save: use cropped blob
  - On Skip: use original file
  - On Cancel: discard file
  - Continue to next file

### Flow
```
User selects files/camera → Show crop modal for each → Collect processed files → Call onUpload()
```

## ImageGallery Modifications (CR-7)

### Overlay Buttons
- Add Download button (opens image in new tab / download)
- Add Crop button (opens crop modal for existing image)
- Reposition Delete button to overlay (currently in hover overlay)
- Style: `absolute top-2 right-2 flex gap-1.5`, buttons have `bg-black/50 hover:bg-black/75`

### Re-crop Existing Images
- New prop: `onCropImage?: (imageId: string, croppedBlob: Blob) => void`
- Fetch image as blob, open crop modal, upload cropped result

## Pages / Routes to Modify

### `/app/(protected)/bills/new/page.tsx`
- Update `BillImageUpload` usage to handle camera capture

### `/app/(protected)/bills/[id]/page.tsx`
- Update `ImageGallery` usage to pass `onCropImage` handler

## Data Connection

### API Endpoints Needed (already exist or assumed)
- `PUT /api/bills/[id]/images/[imageId]` - Replace/crop existing image
- `GET /uploads/[file]` - Fetch image for cropping

## Design Specifications

### Colors
- Camera button: `bg-emerald-500 hover:bg-emerald-600 text-white`
- Overlay buttons: `bg-black/50 hover:bg-black/75 text-white`
- Delete overlay button: `hover:bg-rose-500/80`
- Crop modal bg: white, border: slate-100

### Layout
- Crop modal: `max-w-2xl`, centered, `60vh` cropper area
- Overlay buttons: `w-8 h-8`, `rounded-lg`, `top-2 right-2`
- Icons: 15x15px in overlay buttons

### Animations
- Use existing `animate-[vb-rise_0.2s_ease-out]` for modal
- Overlay opacity transition: `opacity-0 group-hover:opacity-100`

## Checklist

### CR-6: Camera Capture
- [ ] Install `cropperjs` dependency
- [ ] Add green "Take Photo" button to `BillImageUpload`
- [ ] Position camera button at **top** of upload section
- [ ] Use `capture="environment"` for back camera
- [ ] Process camera captures through crop modal

### CR-7: Image Crop
- [ ] Create `CropModal` component with Cropper.js
- [ ] Add crop modal styles/globals.css import
- [ ] Implement "Crop & Save", "Skip", "Cancel" buttons
- [ ] Add multi-file counter display
- [ ] Create `processThroughCropModal` flow
- [ ] Add overlay buttons to `ImageGallery` (Download, Crop, Delete)
- [ ] Style overlay buttons: top-right, semi-transparent dark bg
- [ ] Implement re-crop for existing images
- [ ] Add download functionality

### Testing
- [ ] Camera button works on mobile devices
- [ ] Crop modal opens for file uploads
- [ ] Crop modal opens for camera captures
- [ ] Skip uses original file
- [ ] Cancel discards file
- [ ] Overlay buttons visible on hover
- [ ] Download works correctly
- [ ] Re-crop uploads new image
