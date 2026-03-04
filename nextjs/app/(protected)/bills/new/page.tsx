'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BillForm, { BillFormData } from '@/components/bills/BillForm';
import BillImageUpload from '@/components/bills/BillImageUpload';
import { useBillOptions } from '@/lib/hooks/useBills';
import * as api from '@/lib/api/bills';
import { cn } from '@/lib/utils';

export default function NewBillPage() {
  const router = useRouter();
  const { motives, categories, isLoading: optionsLoading } = useBillOptions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (formData: BillFormData) => {
    setIsSubmitting(true);
    setResult(null);

    try {
      // Build FormData for multipart upload
      const data = new FormData();
      data.append('date', formData.date);
      data.append('type', formData.type);
      data.append('vendor', formData.vendor);
      data.append('item', formData.item);
      data.append('brutto19', String(formData.brutto19));
      data.append('brutto7', String(formData.brutto7));
      data.append('brutto0', String(formData.brutto0));
      data.append('comment', formData.comment);
      data.append('motiveAllocations', JSON.stringify(formData.motiveAllocations));
      data.append('categoryAllocations', JSON.stringify(formData.categoryAllocations));

      // Add images
      pendingFiles.forEach((file) => {
        data.append('photos', file);
      });

      const response = await api.createBill(data);

      if (response.ok) {
        setResult({ type: 'success', message: 'Bill created successfully!' });
        // Redirect after a short delay
        setTimeout(() => {
          router.push('/bills');
        }, 1000);
      } else {
        throw new Error('Failed to create bill');
      }
    } catch (err) {
      setResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create bill',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (optionsLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-[vb-rise_0.4s_ease-out]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-[vb-rise_0.4s_ease-out]">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 transition-colors mb-2"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Bills
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Upload New Bill</h1>
        <p className="text-slate-500 mt-1">
          Create a new bill with optional images and allocations
        </p>
      </div>

      {/* Result message */}
      {result && (
        <div
          className={cn(
            'mb-6 rounded-lg px-4 py-3 text-sm animate-[vb-rise_0.2s_ease-out]',
            result.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          )}
        >
          {result.message}
        </div>
      )}

      {/* Image upload section */}
      <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Images</h2>
        <BillImageUpload
          onUpload={(files) => setPendingFiles((prev) => [...prev, ...files])}
          existingImages={pendingFiles.map((f, i) => ({
            id: `pending-${i}`,
            filename: f.name,
            file: URL.createObjectURL(f),
          }))}
        />
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <BillForm
          onSubmit={handleSubmit}
          motives={motives}
          categories={categories}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
