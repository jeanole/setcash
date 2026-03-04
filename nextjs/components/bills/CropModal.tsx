'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Dynamically import Cropper.js only on client side
let Cropper: typeof import('cropperjs').default | null = null;

interface CropModalProps {
  isOpen: boolean;
  file: File | null;
  onSave: (croppedBlob: Blob) => void;
  onSkip: () => void;
  onCancel: () => void;
  counter?: string;
}

export default function CropModal({
  isOpen,
  file,
  onSave,
  onSkip,
  onCancel,
  counter,
}: CropModalProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<InstanceType<typeof import('cropperjs').default> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cropperLoaded, setCropperLoaded] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // Load Cropper.js on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !Cropper) {
      import('cropperjs').then((module) => {
        Cropper = module.default;
        setCropperLoaded(true);
      });
    } else if (Cropper) {
      setCropperLoaded(true);
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (imageRef.current) {
      imageRef.current.src = '';
    }
  }, []);

  // Initialize cropper when modal opens with a file
  useEffect(() => {
    if (!isOpen || !file || !imageRef.current || !cropperLoaded || !Cropper) return;

    // Clean up any existing cropper first
    cleanup();

    // Create object URL for the file
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    const img = imageRef.current;
    img.src = objectUrl;

    img.onload = () => {
      // Initialize Cropper.js v2
      cropperRef.current = new Cropper!(img);
    };

    return () => {
      cleanup();
    };
  }, [isOpen, file, cropperLoaded, cleanup]);

  const handleSave = async () => {
    if (!cropperRef.current) return;

    setIsLoading(true);

    try {
      // Get the selection (cropped area)
      const selection = cropperRef.current.getCropperSelection();
      
      if (selection) {
        // Generate canvas from the selection
        const canvas = await selection.$toCanvas({
          width: 4096,
          height: 4096,
        });

        canvas.toBlob(
          (blob: Blob | null) => {
            setIsLoading(false);
            if (blob) {
              onSave(blob);
            }
            cleanup();
          },
          'image/jpeg',
          0.92
        );
      } else {
        // No selection, skip
        setIsLoading(false);
        handleSkipBtn();
      }
    } catch (error) {
      console.error('Error cropping image:', error);
      setIsLoading(false);
      handleSkipBtn();
    }
  };

  const handleSkipBtn = () => {
    cleanup();
    onSkip();
  };

  const handleCancelBtn = () => {
    cleanup();
    onCancel();
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancelBtn();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-[vb-rise_0.2s_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancelBtn();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Crop Image</h3>
            {counter && (
              <p className="text-sm text-slate-500">{counter}</p>
            )}
          </div>
          <button
            onClick={handleCancelBtn}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cropper Area */}
        <div className="flex-1 bg-slate-900 min-h-[50vh] max-h-[60vh] relative">
          {file && file.type.startsWith('image/') ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              {!cropperLoaded ? (
                <div className="text-white flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </div>
              ) : (
                <img
                  ref={imageRef}
                  alt="Crop preview"
                  className="max-w-full max-h-full block"
                />
              )}
            </div>
          ) : file ? (
            <div className="w-full h-full flex items-center justify-center text-white">
              <p>PDF files cannot be cropped</p>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <p>No file selected</p>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 gap-3">
          <button
            onClick={handleCancelBtn}
            disabled={isLoading}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSkipBtn}
              disabled={isLoading}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Skip (use original)
            </button>

            <button
              onClick={handleSave}
              disabled={isLoading || !file || !file.type.startsWith('image/') || !cropperLoaded}
              className={cn(
                'px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg transition-colors',
                'hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2'
              )}
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Crop & Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
