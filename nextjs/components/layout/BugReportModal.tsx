'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Bug, ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

export default function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL on unmount or when screenshot changes
  useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  const handleScreenshotChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SCREENSHOT_SIZE) {
      setError('Screenshot must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }

    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }

    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
    setError(null);
  }, [screenshotPreview]);

  const removeScreenshot = useCallback(() => {
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [screenshotPreview]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    removeScreenshot();
    setError(null);
  }, [removeScreenshot]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (title.trim().length > 200) {
      setError('Title must be 200 characters or less');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      if (stepsToReproduce.trim()) {
        formData.append('stepsToReproduce', stepsToReproduce.trim());
      }
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit bug report');
        return;
      }

      toast.success('Bug report submitted successfully!');
      resetForm();
      onClose();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [title, description, stepsToReproduce, screenshot, resetForm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-semibold text-slate-900">Report a Bug</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="bug-title" className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="bug-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              maxLength={200}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
            <p className="mt-1 text-xs text-slate-400">{title.length}/200</p>
          </div>

          <div>
            <label htmlFor="bug-description" className="block text-sm font-medium text-slate-700 mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? What did you expect?"
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] resize-y"
            />
          </div>

          <div>
            <label htmlFor="bug-steps" className="block text-sm font-medium text-slate-700 mb-1">
              Steps to Reproduce
            </label>
            <textarea
              id="bug-steps"
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Screenshot
            </label>
            {screenshotPreview ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  className="w-16 h-16 object-cover rounded border border-slate-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 truncate">{screenshot?.name}</p>
                  <p className="text-xs text-slate-400">
                    {screenshot ? `${(screenshot.size / 1024).toFixed(1)} KB` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-slate-300 rounded-md text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                Attach screenshot (max 5MB)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              className="hidden"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-zinc-900 rounded-md font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              <Bug className="w-4 h-4" />
              {isLoading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
