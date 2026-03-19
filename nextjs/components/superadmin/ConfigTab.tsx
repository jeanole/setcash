'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, useSuperAdminApi } from './useSuperAdminApi';
import ToastContainer from './ToastContainer';

interface SystemConfig {
  defaultUploadLimit?: number | null;
}

export default function ConfigTab() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [defaultUploadLimit, setDefaultUploadLimit] = useState('');

  const { toasts, showToast, removeToast, handleApiError } = useSuperAdminApi();

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<SystemConfig>('/api/superadmin/system-config');
      setConfig(data);
      setDefaultUploadLimit(data.defaultUploadLimit != null ? String(data.defaultUploadLimit) : '');
    } catch (error) {
      handleApiError(error, 'Failed to load system config');
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = useCallback(async () => {
    const rawValue = defaultUploadLimit.trim();

    if (rawValue !== '') {
      const parsed = parseInt(rawValue, 10);
      if (isNaN(parsed) || parsed < 0) {
        showToast('Please enter a valid positive number, or leave empty for no default.', 'error');
        return;
      }
    }

    setIsSaving(true);
    try {
      const body: Record<string, number | null> = {
        defaultUploadLimit: rawValue === '' ? null : parseInt(rawValue, 10),
      };
      await apiFetch('/api/superadmin/system-config', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      showToast('System config saved');
    } catch (error) {
      handleApiError(error, 'Failed to save system config');
    } finally {
      setIsSaving(false);
    }
  }, [defaultUploadLimit, showToast, handleApiError]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="h-10 w-64 bg-slate-200 rounded" />
        <div className="h-10 w-24 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-lg space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">System Configuration</h3>
          <p className="text-sm text-slate-500">
            These settings apply system-wide as defaults. Individual projects can override them.
          </p>
        </div>

        {/* Default Upload Limit */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div>
            <label htmlFor="default-upload-limit" className="block text-sm font-medium text-slate-700 mb-1">
              Default upload limit (bills per project)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              New projects will inherit this limit. Leave empty for no default limit.
            </p>
            <input
              id="default-upload-limit"
              type="number"
              min="0"
              placeholder="No default limit"
              value={defaultUploadLimit}
              onChange={(e) => setDefaultUploadLimit(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)] focus:border-transparent"
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[var(--vb-accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--vb-accent-hover)] transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
            {config && (
              <span className="text-xs text-slate-500">
                Current: {config.defaultUploadLimit ? `${config.defaultUploadLimit} bills` : 'No default'}
              </span>
            )}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
