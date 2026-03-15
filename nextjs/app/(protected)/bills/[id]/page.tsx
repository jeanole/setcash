'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import BillDetailHeader from '@/components/bills/BillDetailHeader';
import ImageGallery from '@/components/bills/ImageGallery';
import AllocationWidget from '@/components/bills/AllocationWidget';
import OcrFieldVerification from '@/components/bills/OcrFieldVerification';
import BillHistoryTimeline from '@/components/bills/BillHistoryTimeline';
import BillImageUpload from '@/components/bills/BillImageUpload';
import { useBill, useBillOptions } from '@/lib/hooks/useBills';
import { BillImage } from '@/lib/types';
import { formatCurrency, calculateTotal, cn } from '@/lib/utils';

interface BillDetailPageProps {
  params: { id: string };
}

interface FormData {
  date: string;
  type: string;
  vendor: string;
  item: string;
  comment: string;
  brutto19: number;
  brutto7: number;
  brutto0: number;
  motiveAllocations: { id: string; name: string; percentage: number }[];
  categoryAllocations: { id: string; name: string; percentage: number }[];
}

export default function BillDetailPage({ params }: BillDetailPageProps) {
  const { id } = params;
  const router = useRouter();
  const {
    bill,
    logs,
    isLoading,
    error,
    refetch,
    updateBill,
    deleteBill,
    verifyField,
    analyse,
    updateStatus,
    deleteImage,
    uploadImages,
    reorderImages,
    replaceImage,
    cropImage,
  } = useBill(id);

  const { motives, categories } = useBillOptions();
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData | null>(null);

  // Initialize form from bill (only when formData is null — avoids overwriting user edits on OCR polls)
  useEffect(() => {
    if (!bill || formData !== null) return;
    setFormData({
      date: bill.date.split('T')[0],
      type: bill.type || 'Kauf',
      vendor: bill.vendor || '',
      item: bill.item || '',
      comment: bill.comment || '',
      brutto19: bill.brutto19,
      brutto7: bill.brutto7,
      brutto0: bill.brutto0,
      motiveAllocations: (bill.motiveAllocations || []).map((a) => ({
        id: a.motiveId,
        name: a.name,
        percentage: a.percentage,
      })),
      categoryAllocations: (bill.categoryAllocations || []).map((a) => ({
        id: a.categoryId,
        name: a.name,
        percentage: a.percentage,
      })),
    });
  }, [bill, formData]);

  // Poll for OCR status updates
  useEffect(() => {
    if (!bill || bill.ocrStatus !== 'pending') return;

    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [bill, refetch]);

  const handleSave = async () => {
    if (!formData) return;
    setIsSaving(true);
    const ok = await updateBill({
      date: new Date(formData.date).toISOString(),
      type: formData.type,
      vendor: formData.vendor,
      item: formData.item,
      comment: formData.comment,
      brutto19: formData.brutto19,
      brutto7: formData.brutto7,
      brutto0: formData.brutto0,
      motiveAllocations: formData.motiveAllocations.map((a) => ({
        motiveId: a.id,
        percentage: a.percentage,
      })),
      categoryAllocations: formData.categoryAllocations.map((a) => ({
        categoryId: a.id,
        percentage: a.percentage,
      })),
    });
    setIsSaving(false);
    if (ok) {
      setFormData(null); // reset so useEffect re-initializes from updated bill
      setResult({ type: 'success', message: 'Bill saved' });
    } else {
      setResult({ type: 'error', message: 'Failed to save changes' });
    }
  };

  const handleAnalyse = async () => {
    const hasPriorResults = bill?.ocrStatus === 'done' || (bill?.ocrFields && bill.ocrFields.length > 0);
    if (hasPriorResults) {
      if (!confirm('This will re-analyse the bill and overwrite all AI-filled fields. Continue?')) {
        return;
      }
    }

    setIsAnalysing(true);
    setResult(null);

    const success = await analyse();

    if (success) {
      setResult({ type: 'success', message: 'Analysis started...' });
    } else {
      setResult({ type: 'error', message: 'Failed to start analysis' });
    }

    setIsAnalysing(false);
  };

  const handleApprove = async () => {
    const success = await updateStatus('approved');
    if (success) {
      setResult({ type: 'success', message: 'Bill approved' });
    }
  };

  const handleReject = async () => {
    const success = await updateStatus('rejected');
    if (success) {
      setResult({ type: 'success', message: 'Bill rejected' });
    }
  };

  const handleRevertDraft = async () => {
    const success = await updateStatus('draft');
    if (success) {
      setResult({ type: 'success', message: 'Bill reverted to draft' });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bill? This cannot be undone.')) {
      return;
    }
    const success = await deleteBill();
    if (success) {
      router.push('/bills');
    }
  };

  const handleVerifyField = async (fieldName: string) => {
    const success = await verifyField(fieldName);
    if (success) {
      setResult({ type: 'success', message: `Field "${fieldName}" verified` });
    }
  };

  const handleImageReorder = async (images: BillImage[]) => {
    const reordered = images.map((img, idx) => ({
      id: img.id,
      sortOrder: idx,
    }));
    await reorderImages(reordered);
  };

  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'owner' || session?.user?.role === 'superadmin';
  const isAuthor = session?.user?.email === bill?.email;
  const canDelete = isAdmin || isAuthor;
  const canSelfApprove = isAuthor && !isAdmin && bill?.status === 'confirmed';
  const [hasOcrEnabled, setHasOcrEnabled] = useState(false);

  // Fetch OCR enabled flag from project settings (admins only)
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/project-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.ocrEnabled === 'boolean') {
          setHasOcrEnabled(data.ocrEnabled);
        }
      })
      .catch(() => {
        // silently ignore — feature stays disabled
      });
  }, [isAdmin]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto animate-[vb-rise_0.4s_ease-out]">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-200 rounded-xl" />
            <div className="h-64 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="max-w-7xl mx-auto text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-slate-900 mb-2">
          {error || 'Bill not found'}
        </h2>
        <button onClick={() => router.push('/bills')} className="text-[#6366f1] font-medium">
          Back to Bills
        </button>
      </div>
    );
  }

  const total = calculateTotal(bill.brutto19, bill.brutto7, bill.brutto0, bill.amount);
  // Set of field names populated by OCR — used to apply amber highlight
  const ocrFieldSet = new Set(bill.ocrFields || []);
  const formTotal = formData
    ? (formData.brutto19 || 0) + (formData.brutto7 || 0) + (formData.brutto0 || 0)
    : total;

  // Shared field class helper
  const fieldClass = (fieldName: string) => cn(
    'w-full px-3 py-2 border rounded-lg text-sm bg-white transition-shadow',
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
    ocrFieldSet.has(fieldName)
      ? 'border-amber-300 ring-2 ring-amber-200 bg-amber-50/30'
      : 'border-slate-200'
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-[vb-rise_0.4s_ease-out]">
      {/* Toast notification */}
      {result && (
        <div
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 animate-[vb-rise_0.2s_ease-out]',
            result.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          )}
        >
          {result.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {result.message}
        </div>
      )}

      {/* Document header */}
      <BillDetailHeader
        bill={bill}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={handleDelete}
        onAnalyse={handleAnalyse}
        onRevertDraft={handleRevertDraft}
        isAdmin={isAdmin}
        canDelete={canDelete}
        canSelfApprove={canSelfApprove}
        hasOcrEnabled={hasOcrEnabled}
        isAnalysing={isAnalysing || bill.ocrStatus === 'pending'}
      />

      {/* OCR Field Verification */}
      <OcrFieldVerification
        fields={bill.ocrFields || []}
        billData={{
          date: bill.date,
          vendor: bill.vendor || undefined,
          item: bill.item || undefined,
          type: bill.type || undefined,
          brutto19: bill.brutto19,
          brutto7: bill.brutto7,
          brutto0: bill.brutto0,
          comment: bill.comment || undefined,
        }}
        verifiedFields={[]}
        onVerify={handleVerifyField}
        onReject={handleVerifyField}
      />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Left: Document images ── */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Receipt Images
              </h2>
              {bill.images && bill.images.length > 0 && (
                <span className="text-xs text-slate-400">{bill.images.length} file{bill.images.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="p-5">
              <ImageGallery
                images={bill.images || []}
                onReorder={handleImageReorder}
                onDelete={deleteImage}
                onReplace={replaceImage}
                onCropImage={cropImage}
                billId={bill.id}
                readOnly={false}
              />
            </div>
          </div>

          {/* Add more images */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add Images</h3>
            </div>
            <div className="p-5">
              <BillImageUpload
                selectedFiles={filesToUpload}
                onSelectedFilesChange={setFilesToUpload}
                maxFiles={10 - (bill.images?.length || 0)}
              />
              {filesToUpload.length > 0 && (
                <button
                  onClick={async () => {
                    setIsUploading(true);
                    const ok = await uploadImages(filesToUpload);
                    setIsUploading(false);
                    if (ok) {
                      setFilesToUpload([]);
                      setResult({ type: 'success', message: `${filesToUpload.length} image${filesToUpload.length !== 1 ? 's' : ''} uploaded` });
                    } else {
                      setResult({ type: 'error', message: 'Upload failed — please try again' });
                    }
                  }}
                  disabled={isUploading}
                  className={cn(
                    'mt-4 w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors',
                    'hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {isUploading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Uploading…
                    </>
                  ) : (
                    `Upload ${filesToUpload.length} file${filesToUpload.length !== 1 ? 's' : ''}`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Ledger form ── */}
        <div className="space-y-5">

          {/* Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</h2>
            </div>
            <div className="p-5">
              {formData ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                      <input type="date" value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className={fieldClass('date')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                      <select value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className={fieldClass('type')}>
                        <option value="Kauf">Kauf</option>
                        <option value="Reise">Reise</option>
                        <option value="Bewirtung">Bewirtung</option>
                        <option value="Sonstiges">Sonstiges</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Vendor</label>
                    <input type="text" value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder="Vendor name"
                      className={fieldClass('vendor')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Item</label>
                    <input type="text" value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                      placeholder="Item description"
                      className={fieldClass('item')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Comment</label>
                    <textarea value={formData.comment}
                      onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                      placeholder="Optional comment" rows={2}
                      className={cn(fieldClass('comment'), 'resize-none')} />
                  </div>
                </div>
              ) : (
                <div className="animate-pulse space-y-3">
                  <div className="h-9 bg-slate-100 rounded-lg" />
                  <div className="h-9 bg-slate-100 rounded-lg" />
                  <div className="h-9 bg-slate-100 rounded-lg" />
                </div>
              )}
            </div>
          </div>

          {/* Amounts — financial table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amounts</h2>
            </div>
            <div className="p-5">
              {formData ? (
                <div className="space-y-2">
                  {(['brutto19', 'brutto7', 'brutto0'] as const).map((field) => {
                    const labels = { brutto19: '19% MwSt.', brutto7: '7% MwSt.', brutto0: '0% MwSt.' };
                    return (
                      <div key={field} className="flex items-center gap-3">
                        <label className="text-xs font-medium text-slate-500 w-24 shrink-0">{labels[field]}</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={formData[field] || ''}
                          onChange={(e) => setFormData({ ...formData, [field]: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className={cn(fieldClass(field), 'text-right font-mono-numbers')}
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-baseline justify-between pt-3 mt-1 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Brutto</span>
                    <span className="text-2xl font-bold text-slate-900 font-mono-numbers">{formatCurrency(formTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse space-y-3">
                  <div className="h-9 bg-slate-100 rounded-lg" />
                  <div className="h-9 bg-slate-100 rounded-lg" />
                </div>
              )}
            </div>
          </div>

          {/* Allocations */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Allocations</h2>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Motives</p>
                <AllocationWidget
                  type="motive" options={motives}
                  value={formData ? formData.motiveAllocations : (bill.motiveAllocations || []).map((a) => ({ id: a.motiveId, name: a.name, percentage: a.percentage }))}
                  onChange={(allocs) => formData && setFormData({ ...formData, motiveAllocations: allocs })}
                  totalAmount={formTotal} readOnly={!formData}
                />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">Categories</p>
                <AllocationWidget
                  type="category" options={categories}
                  value={formData ? formData.categoryAllocations : (bill.categoryAllocations || []).map((a) => ({ id: a.categoryId, name: a.name, percentage: a.percentage }))}
                  onChange={(allocs) => formData && setFormData({ ...formData, categoryAllocations: allocs })}
                  totalAmount={formTotal} readOnly={!formData}
                />
              </div>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || !formData}
            className={cn(
              'w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-colors',
              'hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2 shadow-sm'
            )}
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>

          {/* Audit trail */}
          <BillHistoryTimeline logs={logs} />
        </div>
      </div>
    </div>
  );
}
