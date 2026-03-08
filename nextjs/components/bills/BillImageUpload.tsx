'use client';

import { useState, useCallback, useRef } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import CropModal from './CropModal';

interface BillImageUploadProps {
  onUpload: (files: File[]) => void;
  existingImages?: { id: string; filename: string; file: string }[];
  onRemoveExisting?: (index: number) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

export default function BillImageUpload({
  onUpload,
  existingImages = [],
  onRemoveExisting,
  maxFiles = 10,
  maxSizeMB = 10,
}: BillImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Crop modal state
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [filesToProcess, setFilesToProcess] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const processedFilesRef = useRef<File[]>([]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.includes(`.${ext}`)) {
        return `${file.name}: Invalid file type. Allowed: jpg, png, webp, pdf`;
      }
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `${file.name}: File too large (max ${maxSizeMB}MB)`;
    }
    return null;
  };

  const validateFiles = (newFiles: FileList | null): File[] => {
    if (!newFiles) return [];

    const newErrors: string[] = [];
    const validFiles: File[] = [];

    Array.from(newFiles).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    // Check total file count
    const totalCount = files.length + existingImages.length + validFiles.length + processedFilesRef.current.length;
    if (totalCount > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} images allowed per bill`);
      const allowedNew = Math.max(0, maxFiles - files.length - existingImages.length - processedFilesRef.current.length);
      validFiles.splice(allowedNew);
    }

    setErrors(newErrors);
    return validFiles;
  };

  // Process files through crop modal
  const processThroughCropModal = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;

    // Reset and start processing
    processedFilesRef.current = [];
    setFilesToProcess(newFiles);
    setCurrentFileIndex(0);
    setCurrentFile(newFiles[0]);
    setIsCropModalOpen(true);
  };

  const handleCropSave = (croppedBlob: Blob) => {
    // Create a new File from the blob, preserving the original filename
    const originalFile = filesToProcess[currentFileIndex];
    const croppedFile = new File([croppedBlob], originalFile.name || 'image.jpg', {
      type: croppedBlob.type,
    });

    processedFilesRef.current.push(croppedFile);
    processNextFile();
  };

  const handleCropSkip = () => {
    // Use original file
    processedFilesRef.current.push(filesToProcess[currentFileIndex]);
    processNextFile();
  };

  const handleCropCancel = () => {
    // Discard this file and continue with the rest
    processNextFile();
  };

  const processNextFile = () => {
    const nextIndex = currentFileIndex + 1;

    if (nextIndex >= filesToProcess.length) {
      // All files processed
      setIsCropModalOpen(false);
      setCurrentFile(null);
      setFilesToProcess([]);
      setCurrentFileIndex(0);

      // Snapshot ref before clearing — setFiles updater runs deferred,
      // so reading processedFilesRef.current inside it would see []
      const processed = [...processedFilesRef.current];
      processedFilesRef.current = [];

      if (processed.length > 0) {
        setFiles((prev) => [...prev, ...processed]);
      }
    } else {
      // Process next file
      setCurrentFileIndex(nextIndex);
      setCurrentFile(filesToProcess[nextIndex]);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const validFiles = validateFiles(e.dataTransfer.files);
    if (validFiles.length > 0) {
      processThroughCropModal(validFiles);
    }
  }, [files, existingImages]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = validateFiles(e.target.files);
    e.target.value = ''; // Reset input
    if (validFiles.length > 0) {
      processThroughCropModal(validFiles);
    }
  };

  const handleCameraInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = validateFiles(e.target.files);
    e.target.value = ''; // Reset input
    if (validFiles.length > 0) {
      processThroughCropModal(validFiles);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (files.length === 0) return;
    onUpload(files);
    setFiles([]);
    setErrors([]);
  };

  const remainingSlots = maxFiles - existingImages.length - files.length;
  const counterText = filesToProcess.length > 1 
    ? `${currentFileIndex + 1} / ${filesToProcess.length}` 
    : undefined;

  return (
    <div className="space-y-4">
      {/* Camera Button - At the top */}
      <div className="flex justify-center">
        <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors cursor-pointer">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Take Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraInput}
            className="hidden"
            aria-label="Take photo"
          />
        </label>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragging
            ? 'border-[#7C6AF6] bg-violet-50'
            : 'border-slate-200 hover:border-slate-300 bg-slate-50'
        )}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Upload images"
        />

        <svg
          className={cn(
            'w-12 h-12 mx-auto mb-3 transition-colors',
            isDragging ? 'text-[#7C6AF6]' : 'text-slate-300'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="text-sm font-medium text-slate-700">
          Drop images here or click to browse
        </p>
        <p className="text-xs text-slate-500 mt-1">
          JPG, PNG, WebP, PDF up to {maxSizeMB}MB
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {remainingSlots} of {maxFiles} slots remaining
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1">
          {errors.map((error, idx) => (
            <p key={idx} className="text-sm text-rose-700">
              {error}
            </p>
          ))}
        </div>
      )}

      {/* Existing images thumbnails */}
      {existingImages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">
            Uploaded images ({existingImages.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {existingImages.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-100"
              >
                <img
                  src={image.file}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />

                {/* Filename overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs p-2">
                  <p className="truncate">{image.filename}</p>
                </div>

                {/* Remove button */}
                {onRemoveExisting && (
                  <button
                    onClick={() => onRemoveExisting(index)}
                    className="absolute top-2 right-2 p-1 bg-rose-500 rounded text-white hover:bg-rose-600 transition-colors"
                    aria-label="Remove image"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected files preview */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">
            Selected files ({files.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {files.map((file, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-100"
              >
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                )}

                {/* File info overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs p-2">
                  <p className="truncate">{file.name}</p>
                  <p className="text-slate-300">
                    {formatCurrency(file.size / 1024 / 1024).replace('€', '')} MB
                  </p>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-2 right-2 p-1 bg-rose-500 rounded text-white hover:bg-rose-600 transition-colors"
                  aria-label="Remove file"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            className="w-full py-2.5 bg-[#7C6AF6] text-white font-medium rounded-lg hover:bg-[#6C5CE7] transition-colors"
          >
            Upload {files.length} file{files.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Crop Modal */}
      <CropModal
        isOpen={isCropModalOpen}
        file={currentFile}
        onSave={handleCropSave}
        onSkip={handleCropSkip}
        onCancel={handleCropCancel}
        counter={counterText}
      />
    </div>
  );
}
