'use client';

import { useState, useCallback } from 'react';
import { BillImage } from '@/lib/types';
import { cn } from '@/lib/utils';
import CropModal from './CropModal';

interface ImageGalleryProps {
  images: BillImage[];
  onReorder: (images: BillImage[]) => void;
  onDelete: (imageId: string) => void;
  onReplace: (imageId: string, file: File) => void;
  onCropImage?: (imageId: string, croppedBlob: Blob) => Promise<boolean | void>;
  billId: string;
  readOnly?: boolean;
}

export default function ImageGallery({
  images,
  onReorder,
  onDelete,
  onReplace,
  onCropImage,
  billId,
  readOnly = false,
}: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Crop modal state for re-cropping existing images
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageId, setCropImageId] = useState<string | null>(null);
  const [cropImageFile, setCropImageFile] = useState<File | null>(null);
  const [isCropSaving, setIsCropSaving] = useState(false);

  // Cache-busting timestamps per image id — updated after each successful crop
  const [cropTimestamps, setCropTimestamps] = useState<Record<string, number>>({});

  const handleDragStart = (index: number) => {
    if (readOnly) return;
    setDraggedIndex(index);
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (readOnly) return;
      e.preventDefault();
      setDragOverIndex(index);
    },
    [readOnly]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      if (readOnly || draggedIndex === null) return;
      e.preventDefault();

      const newImages = [...images];
      const [removed] = newImages.splice(draggedIndex, 1);
      newImages.splice(dropIndex, 0, removed);

      const reordered = newImages.map((img, idx) => ({
        ...img,
        sortOrder: idx,
      }));

      onReorder(reordered);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, images, onReorder, readOnly]
  );

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const navigateLightbox = (direction: number) => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + direction + images.length) % images.length);
  };

  const handleFileReplace = (imageId: string, input: HTMLInputElement) => {
    if (input.files && input.files[0]) {
      onReplace(imageId, input.files[0]);
    }
  };

  const handleDownload = (image: BillImage) => {
    const link = document.createElement('a');
    link.href = imageUrl(image);
    link.download = image.filename || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Build image URL with cache-busting timestamp when the image was recently cropped
  const imageUrl = (image: BillImage) => {
    const ts = cropTimestamps[image.id];
    return ts ? `/api/uploads/${image.file}?v=${ts}` : `/api/uploads/${image.file}`;
  };

  // Open crop modal for existing image
  const handleCropClick = async (image: BillImage) => {
    if (!onCropImage) return;

    try {
      const resp = await fetch(imageUrl(image));
      if (!resp.ok) {
        console.error('Could not load image for cropping');
        return;
      }
      const blob = await resp.blob();
      const file = new File([blob], image.filename || 'image.jpg', { type: blob.type });

      setCropImageId(image.id);
      setCropImageFile(file);
      setIsCropModalOpen(true);
    } catch (err) {
      console.error('Error loading image for crop:', err);
    }
  };

  // Called by CropModal when user confirms crop — awaits the API call
  const handleCropSave = async (croppedBlob: Blob) => {
    if (!cropImageId || !onCropImage) {
      closeCropModal();
      return;
    }

    setIsCropSaving(true);
    try {
      const ok = await onCropImage(cropImageId, croppedBlob);
      if (ok !== false) {
        // Force img element to re-fetch by changing the src query param
        setCropTimestamps((prev) => ({ ...prev, [cropImageId]: Date.now() }));
      }
    } finally {
      setIsCropSaving(false);
      closeCropModal();
    }
  };

  const closeCropModal = () => {
    setIsCropModalOpen(false);
    setCropImageId(null);
    setCropImageFile(null);
  };

  if (images.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2z"
          />
        </svg>
        <p className="text-slate-500">No images uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {images.map((image, index) => (
          <div
            key={image.id}
            draggable={!readOnly}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative group aspect-square rounded-lg overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing',
              dragOverIndex === index && 'ring-2 ring-indigo-500 ring-offset-2',
              draggedIndex === index && 'opacity-50'
            )}
          >
            <img
              src={imageUrl(image)}
              alt={image.filename}
              className="w-full h-full object-cover"
              onClick={() => openLightbox(index)}
            />

            {/* Overlay buttons - top right */}
            <div className="absolute top-2 right-2 flex gap-1.5 z-[3] opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Download button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(image); }}
                className="bg-black/50 hover:bg-black/75 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                aria-label="Download image"
                title="Download"
              >
                <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Crop button */}
              {!readOnly && onCropImage && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCropClick(image); }}
                  className="bg-black/50 hover:bg-black/75 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  aria-label="Crop image"
                  title="Crop"
                >
                  <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </button>
              )}

              {/* Delete button */}
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this image?')) { onDelete(image.id); }
                  }}
                  className="bg-black/50 hover:bg-rose-500/80 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  aria-label="Delete image"
                  title="Delete"
                >
                  <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            {/* View / Replace overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={() => openLightbox(index)}
                className="p-2 bg-white rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="View full size"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>

              {!readOnly && (
                <label className="p-2 bg-white rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileReplace(image.id, e.target)}
                  />
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </label>
              )}
            </div>

            {/* Order indicator */}
            {!readOnly && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {index + 1}
              </div>
            )}

            {/* Filename tooltip */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
              {image.filename}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && images.length > 1 && (
        <p className="text-xs text-slate-500 text-center">
          Drag and drop to reorder images
        </p>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-[vb-rise_0.2s_ease-out]"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"
            aria-label="Close lightbox"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                className="absolute left-4 p-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                className="absolute right-4 p-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"
                aria-label="Next image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <img
            src={imageUrl(images[lightboxIndex])}
            alt={images[lightboxIndex].filename}
            className="max-w-full max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 rounded-full text-white text-sm">
              {lightboxIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}

      {/* Crop Modal */}
      <CropModal
        isOpen={isCropModalOpen}
        file={cropImageFile}
        onSave={handleCropSave}
        onSkip={closeCropModal}
        onCancel={closeCropModal}
        isSaving={isCropSaving}
      />
    </div>
  );
}
