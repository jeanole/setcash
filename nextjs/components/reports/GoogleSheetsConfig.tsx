'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface GoogleConfigStatus {
  hasCredentials: boolean;
  sheetId: string | null;
  status: 'green' | 'yellow' | 'red';
}

interface GoogleSheetsConfigProps {
  projectId: string;
}

export default function GoogleSheetsConfig({ projectId }: GoogleSheetsConfigProps) {
  const [config, setConfig] = useState<GoogleConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [sheetIdInput, setSheetIdInput] = useState('');
  const [credentialsFile, setCredentialsFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConfig();
    // projectId is used to scope the config but the API derives it from session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function fetchConfig() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/export/google-config');
      if (!res.ok) {
        throw new Error('Failed to load Google Sheets configuration');
      }
      const data: GoogleConfigStatus = await res.json();
      setConfig(data);
      setSheetIdInput(data.sheetId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const body: { sheetId?: string; credentialsJson?: string } = {};

      if (sheetIdInput !== (config?.sheetId ?? '')) {
        body.sheetId = sheetIdInput;
      }

      if (credentialsFile) {
        const text = await credentialsFile.text();
        body.credentialsJson = text;
      }

      if (Object.keys(body).length === 0) {
        setSuccessMessage('No changes to save.');
        return;
      }

      const res = await fetch('/api/admin/export/google-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save configuration');
      }

      setConfig({ hasCredentials: data.hasCredentials, sheetId: data.sheetId, status: data.status });
      setSheetIdInput(data.sheetId ?? '');
      setCredentialsFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessMessage('Configuration saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    setIsTesting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Re-fetch config to test current state
      const res = await fetch('/api/admin/export/google-config');
      if (!res.ok) {
        throw new Error('Failed to check connection');
      }
      const data: GoogleConfigStatus = await res.json();
      setConfig(data);
      setSheetIdInput(data.sheetId ?? '');

      if (data.status === 'green') {
        setSuccessMessage('Connection looks good — credentials and Sheet ID are both configured.');
      } else if (data.status === 'yellow') {
        setSuccessMessage(
          data.hasCredentials
            ? 'Credentials are set but Sheet ID is missing.'
            : 'Sheet ID is set but service account credentials are missing.'
        );
      } else {
        setError('Neither credentials nor Sheet ID are configured.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  }

  const statusBadge = (status: 'green' | 'yellow' | 'red') => {
    const config = {
      green: {
        classes: 'bg-green-100 text-green-800',
        label: 'Connected',
      },
      yellow: {
        classes: 'bg-yellow-100 text-yellow-800',
        label: 'Partial',
      },
      red: {
        classes: 'bg-red-100 text-red-800',
        label: 'Not Configured',
      },
    };
    const s = config[status];
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
          s.classes
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
        {s.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3 animate-pulse" aria-busy="true" aria-label="Loading Google Sheets configuration">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-9 bg-slate-200 rounded" />
        <div className="h-9 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Google Sheets Configuration</h3>
        {config && statusBadge(config.status)}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"
        >
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      <div className="space-y-3">
        {/* Sheet ID */}
        <div>
          <label htmlFor="sheet-id-input" className="block text-xs font-medium text-slate-700 mb-1">
            Google Sheet ID
          </label>
          <div className="flex gap-2">
            <input
              id="sheet-id-input"
              type="text"
              value={sheetIdInput}
              onChange={(e) => setSheetIdInput(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              className="flex-1 min-w-0 block px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-[#7C6AF6] text-slate-900 placeholder-slate-400"
              aria-label="Google Sheet ID"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            The ID from your Google Sheet URL: .../spreadsheets/d/<strong>SHEET_ID</strong>/edit
          </p>
        </div>

        {/* Credentials Upload */}
        <div>
          <label htmlFor="credentials-upload" className="block text-xs font-medium text-slate-700 mb-1">
            Service Account Credentials (JSON)
          </label>
          <div className="flex items-center gap-2">
            <label
              htmlFor="credentials-upload"
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border cursor-pointer transition-colors',
                'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload JSON
            </label>
            <input
              id="credentials-upload"
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="sr-only"
              onChange={(e) => setCredentialsFile(e.target.files?.[0] ?? null)}
              aria-label="Upload service account credentials JSON file"
            />
            {credentialsFile && (
              <span className="text-xs text-slate-600 truncate max-w-[200px]">{credentialsFile.name}</span>
            )}
            {!credentialsFile && config?.hasCredentials && (
              <span className="text-xs text-green-600">Credentials on file</span>
            )}
            {!credentialsFile && !config?.hasCredentials && (
              <span className="text-xs text-slate-400">No credentials on file</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Service account JSON key file. Share the Google Sheet with the service account email.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isTesting}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:ring-offset-2',
              isSaving || isTesting
                ? 'bg-[#7C6AF6] text-white cursor-not-allowed'
                : 'bg-[#7C6AF6] text-white hover:bg-[#6C5CE7]'
            )}
            aria-disabled={isSaving || isTesting}
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isSaving || isTesting}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:ring-offset-2',
              isSaving || isTesting
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            )}
            aria-disabled={isSaving || isTesting}
          >
            {isTesting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
