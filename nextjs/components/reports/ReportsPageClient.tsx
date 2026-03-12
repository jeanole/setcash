'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import GoogleSheetsConfig from '@/components/reports/GoogleSheetsConfig';

interface ReportUser {
  email: string;
  roleName: string;
}

interface ReportsPageClientProps {
  isAdmin: boolean;
  currentUserEmail: string;
  projectId: string;
  projectName: string;
}

// ---- Spinner icon ----
function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---- Download icon ----
function DownloadIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

// ---- Google Sheets icon ----
function SheetsIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export default function ReportsPageClient({
  isAdmin,
  currentUserEmail,
  projectId,
  projectName,
}: ReportsPageClientProps) {
  // Users list state
  const [users, setUsers] = useState<ReportUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Selected user for user PDF
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>(currentUserEmail);

  // Loading states per action
  const [isDownloadingUserPdf, setIsDownloadingUserPdf] = useState(false);
  const [isDownloadingBudgetPdf, setIsDownloadingBudgetPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isPushingSheets, setIsPushingSheets] = useState(false);

  // Google Sheets push result
  const [sheetsResult, setSheetsResult] = useState<{ url: string } | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  // ---- Load users on mount ----
  useEffect(() => {
    async function fetchUsers() {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const res = await fetch('/api/reports/users');
        if (!res.ok) {
          throw new Error('Failed to load users');
        }
        const data: ReportUser[] = await res.json();
        setUsers(data);
        // Pre-select current user if present, otherwise first user
        if (data.length > 0) {
          const selfInList = data.find(
            (u) => u.email.toLowerCase() === currentUserEmail.toLowerCase()
          );
          setSelectedUserEmail(selfInList ? selfInList.email : data[0].email);
        }
      } catch (err) {
        setUsersError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setUsersLoading(false);
      }
    }

    fetchUsers();
  }, [currentUserEmail]);

  // ---- Download helpers ----
  function triggerDownload(url: string) {
    window.location.href = url;
  }

  async function handleDownloadUserPdf() {
    if (!selectedUserEmail) return;
    setIsDownloadingUserPdf(true);
    try {
      triggerDownload(`/api/reports/user/${encodeURIComponent(selectedUserEmail)}/pdf`);
    } finally {
      // Small delay to reset state since window.location.href is instant
      setTimeout(() => setIsDownloadingUserPdf(false), 1500);
    }
  }

  async function handleDownloadBudgetPdf() {
    setIsDownloadingBudgetPdf(true);
    try {
      triggerDownload('/api/reports/budget-matrix/pdf');
    } finally {
      setTimeout(() => setIsDownloadingBudgetPdf(false), 1500);
    }
  }

  async function handleDownloadExcel() {
    setIsDownloadingExcel(true);
    try {
      triggerDownload('/api/admin/export/excel');
    } finally {
      setTimeout(() => setIsDownloadingExcel(false), 1500);
    }
  }

  async function handleDownloadZip() {
    setIsDownloadingZip(true);
    try {
      triggerDownload('/api/admin/export/images');
    } finally {
      setTimeout(() => setIsDownloadingZip(false), 1500);
    }
  }

  async function handlePushToSheets() {
    setIsPushingSheets(true);
    setSheetsResult(null);
    setSheetsError(null);
    try {
      const res = await fetch('/api/admin/export/google-sheet', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to push to Google Sheets');
      }
      setSheetsResult({ url: data.sheetUrl });
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : 'Failed to push to Google Sheets');
    } finally {
      setIsPushingSheets(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports &amp; Exports</h1>
        {projectName && (
          <p className="mt-1 text-sm text-slate-500">Project: {projectName}</p>
        )}
      </div>

      {/* ---- PDF Reports card (visible to all) ---- */}
      <section
        aria-labelledby="pdf-reports-heading"
        className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
      >
        <div className="mb-5">
          <h2 id="pdf-reports-heading" className="text-lg font-semibold text-slate-900">
            PDF Reports
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Generate and download PDF reports for expense data.
          </p>
        </div>

        <div className="space-y-6">
          {/* User report row */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">User Report</h3>
            <p className="text-xs text-slate-500 mb-3">
              Download a PDF report of all bills submitted by a specific user.
            </p>
            {usersLoading ? (
              <div className="flex items-center gap-3" aria-busy="true">
                <div className="h-9 w-56 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
              </div>
            ) : usersError ? (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {usersError}
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No users with bills found.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  id="user-select"
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  className="block w-full sm:w-auto min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-[#6366f1] text-slate-900 bg-white"
                  aria-label="Select user for PDF report"
                >
                  {users.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.email} ({u.roleName})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDownloadUserPdf}
                  disabled={isDownloadingUserPdf || !selectedUserEmail}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2',
                    isDownloadingUserPdf
                      ? 'bg-[#6366f1] text-white cursor-not-allowed'
                      : 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
                  )}
                  aria-disabled={isDownloadingUserPdf}
                >
                  {isDownloadingUserPdf ? <Spinner /> : <DownloadIcon />}
                  {isDownloadingUserPdf ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100" />

          {/* Budget matrix PDF row */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Budget Matrix</h3>
            <p className="text-xs text-slate-500 mb-3">
              Download a PDF overview of the full budget matrix with motive and category allocation.
            </p>
            <button
              type="button"
              onClick={handleDownloadBudgetPdf}
              disabled={isDownloadingBudgetPdf}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2',
                isDownloadingBudgetPdf
                  ? 'bg-[#6366f1] text-white cursor-not-allowed'
                  : 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
              )}
              aria-disabled={isDownloadingBudgetPdf}
            >
              {isDownloadingBudgetPdf ? <Spinner /> : <DownloadIcon />}
              {isDownloadingBudgetPdf ? 'Downloading...' : 'Download Budget Matrix PDF'}
            </button>
          </div>
        </div>
      </section>

      {/* ---- Data Exports card (admin/owner only) ---- */}
      {isAdmin && (
        <section
          aria-labelledby="data-exports-heading"
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
        >
          <div className="mb-5">
            <h2 id="data-exports-heading" className="text-lg font-semibold text-slate-900">
              Data Exports
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Export all project data in various formats. Admin access only.
            </p>
          </div>

          <div className="space-y-6">
            {/* Export buttons */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Bulk Exports</h3>
              <div className="flex flex-wrap gap-3">
                {/* Excel export */}
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={isDownloadingExcel}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2',
                    isDownloadingExcel
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  )}
                  aria-disabled={isDownloadingExcel}
                >
                  {isDownloadingExcel ? <Spinner /> : <DownloadIcon />}
                  {isDownloadingExcel ? 'Downloading...' : 'Export Excel'}
                </button>

                {/* ZIP images */}
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isDownloadingZip}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2',
                    isDownloadingZip
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  )}
                  aria-disabled={isDownloadingZip}
                >
                  {isDownloadingZip ? <Spinner /> : <DownloadIcon />}
                  {isDownloadingZip ? 'Downloading...' : 'Download ZIP (Images)'}
                </button>

                {/* Google Sheets push */}
                <button
                  type="button"
                  onClick={handlePushToSheets}
                  disabled={isPushingSheets}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2',
                    isPushingSheets
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  )}
                  aria-disabled={isPushingSheets}
                >
                  {isPushingSheets ? <Spinner /> : <SheetsIcon />}
                  {isPushingSheets ? 'Pushing...' : 'Push to Google Sheets'}
                </button>
              </div>

              {/* Google Sheets push result */}
              {sheetsResult && (
                <div
                  role="status"
                  className="mt-3 flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"
                >
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>
                    Data pushed successfully.{' '}
                    <a
                      href={sheetsResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline hover:text-green-900"
                    >
                      Open Google Sheet
                    </a>
                  </span>
                </div>
              )}

              {sheetsError && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
                >
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {sheetsError}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Google Sheets Config panel */}
            <GoogleSheetsConfig projectId={projectId} />
          </div>
        </section>
      )}
    </div>
  );
}
