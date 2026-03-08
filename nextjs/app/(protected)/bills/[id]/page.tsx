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

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<{
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
  } | null>(null);

  const handleEditStart = () => {
    if (!bill) return;
    setEditData({
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
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const handleEditSave = async () => {
    if (!editData) return;
    setIsSaving(true);
    const ok = await updateBill({
      date: new Date(editData.date).toISOString(),
      type: editData.type,
      vendor: editData.vendor,
      item: editData.item,
      comment: editData.comment,
      brutto19: editData.brutto19,
      brutto7: editData.brutto7,
      brutto0: editData.brutto0,
      motiveAllocations: editData.motiveAllocations.map((a) => ({
        motiveId: a.id,
        percentage: a.percentage,
      })),
      categoryAllocations: editData.categoryAllocations.map((a) => ({
        categoryId: a.id,
        percentage: a.percentage,
      })),
    });
    setIsSaving(false);
    if (ok) {
      setIsEditing(false);
      setEditData(null);
      setResult({ type: 'success', message: 'Bill updated' });
    } else {
      setResult({ type: 'error', message: 'Failed to save changes' });
    }
  };

  // Poll for OCR status updates
  useEffect(() => {
    if (!bill || bill.ocrStatus !== 'pending') return;

    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [bill, refetch]);

  const handleAnalyse = async () => {
    // Confirm if re-analysing
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

  const handleMarkPaid = async () => {
    const success = await updateStatus('paid');
    if (success) {
      setResult({ type: 'success', message: 'Bill marked as paid' });
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

  // Check if user is admin from session
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin';
  const hasOcrEnabled = true; // TODO: Get from project settings

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
          <svg
            className="w-8 h-8 text-rose-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-slate-900 mb-2">
          {error || 'Bill not found'}
        </h2>
        <button
          onClick={() => router.push('/bills')}
          className="text-[#7C6AF6] hover:text-[#7C6AF6] font-medium"
        >
          Back to Bills
        </button>
      </div>
    );
  }

  const total = calculateTotal(bill.brutto19, bill.brutto7, bill.brutto0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-[vb-rise_0.4s_ease-out]">
      {/* Result message */}
      {result && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm animate-[vb-rise_0.2s_ease-out]',
            result.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          )}
        >
          {result.message}
        </div>
      )}

      {/* Header */}
      <BillDetailHeader
        bill={bill}
        onApprove={handleApprove}
        onReject={handleReject}
        onMarkPaid={handleMarkPaid}
        onDelete={handleDelete}
        onAnalyse={handleAnalyse}
        isAdmin={isAdmin}
        hasOcrEnabled={hasOcrEnabled}
        isAnalysing={isAnalysing || bill.ocrStatus === 'pending'}
      />

      {/* Edit controls */}
      <div className="flex justify-end gap-2">
        {!isEditing ? (
          <button
            onClick={handleEditStart}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Bill
          </button>
        ) : (
          <>
            <button
              onClick={handleEditCancel}
              disabled={isSaving}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              disabled={isSaving}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 bg-[#7C6AF6] text-white rounded-lg text-sm font-medium hover:bg-[#6C5CE7] transition-colors',
                isSaving && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </>
        )}
      </div>

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
        onReject={handleVerifyField} // Same action - removes from list
      />

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Images */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Images</h2>
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

          {/* Upload more images */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-medium text-slate-700 mb-4">Add More Images</h3>
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
                    setResult({ type: 'success', message: `${filesToUpload.length} image${filesToUpload.length !== 1 ? 's' : ''} uploaded successfully` });
                  } else {
                    setResult({ type: 'error', message: 'Upload failed — please try again' });
                  }
                }}
                disabled={isUploading}
                className={cn(
                  'mt-4 w-full py-2.5 bg-[#7C6AF6] text-white font-medium rounded-lg transition-colors',
                  'hover:bg-[#6C5CE7] disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2'
                )}
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  `Upload ${filesToUpload.length} file${filesToUpload.length !== 1 ? 's' : ''}`
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right column - Details */}
        <div className="space-y-6">
          {/* Details - editable in edit mode */}
          {isEditing && editData ? (
            <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={editData.date}
                      onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                    <select
                      value={editData.type}
                      onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-transparent"
                    >
                      <option value="Kauf">Kauf</option>
                      <option value="Reise">Reise</option>
                      <option value="Bewirtung">Bewirtung</option>
                      <option value="Sonstiges">Sonstiges</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                  <input
                    type="text"
                    value={editData.vendor}
                    onChange={(e) => setEditData({ ...editData, vendor: e.target.value })}
                    placeholder="Vendor name"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                  <input
                    type="text"
                    value={editData.item}
                    onChange={(e) => setEditData({ ...editData, item: e.target.value })}
                    placeholder="Item description"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comment</label>
                  <textarea
                    value={editData.comment}
                    onChange={(e) => setEditData({ ...editData, comment: e.target.value })}
                    placeholder="Optional comment"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Amounts */}
          <div className={cn('bg-white rounded-xl border shadow-sm p-6', isEditing ? 'border-violet-200' : 'border-slate-200')}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Amounts</h2>

            {isEditing && editData ? (
              <div className="space-y-3">
                {(['brutto19', 'brutto7', 'brutto0'] as const).map((field) => {
                  const labels = { brutto19: '19% VAT (Brutto)', brutto7: '7% VAT (Brutto)', brutto0: '0% VAT (Brutto)' };
                  return (
                    <div key={field} className="flex items-center gap-3">
                      <label className="text-sm text-slate-600 w-36 shrink-0">{labels[field]}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editData[field] || ''}
                        onChange={(e) => setEditData({ ...editData, [field]: parseFloat(e.target.value) || 0 })}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="font-medium text-slate-700">Total</span>
                  <span className="text-xl font-bold text-slate-900">
                    {formatCurrency((editData.brutto19 || 0) + (editData.brutto7 || 0) + (editData.brutto0 || 0))}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {bill.brutto19 > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-slate-600">19% VAT (Brutto)</span>
                    <div className="text-right">
                      <span className="font-medium text-slate-900">{formatCurrency(bill.brutto19)}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        netto {formatCurrency(bill.brutto19 / 1.19)}
                      </span>
                    </div>
                  </div>
                )}
                {bill.brutto7 > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-slate-600">7% VAT (Brutto)</span>
                    <div className="text-right">
                      <span className="font-medium text-slate-900">{formatCurrency(bill.brutto7)}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        netto {formatCurrency(bill.brutto7 / 1.07)}
                      </span>
                    </div>
                  </div>
                )}
                {bill.brutto0 > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-slate-600">0% VAT (Brutto)</span>
                    <div className="text-right">
                      <span className="font-medium text-slate-900">{formatCurrency(bill.brutto0)}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        netto {formatCurrency(bill.brutto0)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3">
                  <span className="font-medium text-slate-700">Total</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-slate-900">{formatCurrency(total)}</span>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(bill.nettoAmount)} netto
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Allocations */}
          <div className={cn('bg-white rounded-xl border shadow-sm p-6', isEditing ? 'border-violet-200' : 'border-slate-200')}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Allocations</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Motives</h3>
                <AllocationWidget
                  type="motive"
                  options={motives}
                  value={isEditing && editData ? editData.motiveAllocations : (bill.motiveAllocations || []).map((a) => ({ id: a.motiveId, name: a.name, percentage: a.percentage }))}
                  onChange={(allocs) => editData && setEditData({ ...editData, motiveAllocations: allocs })}
                  totalAmount={isEditing && editData ? (editData.brutto19 + editData.brutto7 + editData.brutto0) : total}
                  readOnly={!isEditing}
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Categories</h3>
                <AllocationWidget
                  type="category"
                  options={categories}
                  value={isEditing && editData ? editData.categoryAllocations : (bill.categoryAllocations || []).map((a) => ({ id: a.categoryId, name: a.name, percentage: a.percentage }))}
                  onChange={(allocs) => editData && setEditData({ ...editData, categoryAllocations: allocs })}
                  totalAmount={isEditing && editData ? (editData.brutto19 + editData.brutto7 + editData.brutto0) : total}
                  readOnly={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* History */}
          <BillHistoryTimeline logs={logs} />
        </div>
      </div>

    </div>
  );
}
