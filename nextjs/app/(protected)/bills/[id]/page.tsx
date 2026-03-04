'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BillDetailHeader from '@/components/bills/BillDetailHeader';
import ImageGallery from '@/components/bills/ImageGallery';
import AllocationWidget from '@/components/bills/AllocationWidget';
import OcrFieldVerification from '@/components/bills/OcrFieldVerification';
import BillHistoryTimeline from '@/components/bills/BillHistoryTimeline';
import BillImageUpload from '@/components/bills/BillImageUpload';
import { useBill, useBillOptions } from '@/lib/hooks/useBills';
import { Allocation, BillImage } from '@/lib/types';
import { formatCurrency, calculateTotal, cn } from '@/lib/utils';

interface BillDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BillDetailPage({ params }: BillDetailPageProps) {
  const { id } = use(params);
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

  // Check if user is admin (simplified)
  const isAdmin = true; // TODO: Get from auth context
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
          className="text-indigo-600 hover:text-indigo-700 font-medium"
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
              onUpload={uploadImages}
              existingImages={bill.images || []}
              maxFiles={10}
            />
          </div>
        </div>

        {/* Right column - Details */}
        <div className="space-y-6">
          {/* Amounts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Amounts</h2>
            
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
          </div>

          {/* Allocations - Read only */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Allocations</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Motives</h3>
                <AllocationWidget
                  type="motive"
                  options={motives}
                  value={bill.motiveAllocations || []}
                  onChange={() => {}}
                  totalAmount={total}
                  readOnly
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Categories</h3>
                <AllocationWidget
                  type="category"
                  options={categories}
                  value={bill.categoryAllocations || []}
                  onChange={() => {}}
                  totalAmount={total}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* History */}
          <BillHistoryTimeline logs={logs} />
        </div>
      </div>

      {/* Edit button - floating action */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <button
          onClick={() => router.push(`/bills/${bill.id}/edit`)}
          className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
          aria-label="Edit bill"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
