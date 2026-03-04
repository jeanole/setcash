'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Bill, AllocationOption, Allocation } from '@/lib/types';
import {
  formatDateForInput,
  calculateNetto,
  calculateTotal,
  formatCurrency,
  cn,
} from '@/lib/utils';
import AllocationWidget from './AllocationWidget';
import BillImageUpload from './BillImageUpload';

interface BillFormProps {
  initialData?: Partial<Bill>;
  onSubmit: (data: BillFormData) => void;
  motives: AllocationOption[];
  categories: AllocationOption[];
  isSubmitting?: boolean;
}

export interface BillFormData {
  date: string;
  type: string;
  vendor: string;
  item: string;
  brutto19: number;
  brutto7: number;
  brutto0: number;
  comment: string;
  motiveAllocations: Allocation[];
  categoryAllocations: Allocation[];
}

export default function BillForm({
  initialData,
  onSubmit,
  motives,
  categories,
  isSubmitting = false,
}: BillFormProps) {
  const [formData, setFormData] = useState<BillFormData>({
    date: formatDateForInput(initialData?.date) || new Date().toISOString().split('T')[0],
    type: initialData?.type || 'Kauf',
    vendor: initialData?.vendor || '',
    item: initialData?.item || '',
    brutto19: initialData?.brutto19 || 0,
    brutto7: initialData?.brutto7 || 0,
    brutto0: initialData?.brutto0 || 0,
    comment: initialData?.comment || '',
    motiveAllocations: initialData?.motiveAllocations || [],
    categoryAllocations: initialData?.categoryAllocations || [],
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const totalAmount = calculateTotal(
    formData.brutto19,
    formData.brutto7,
    formData.brutto0
  );

  const nettoAmount = calculateNetto(
    formData.brutto19,
    formData.brutto7,
    formData.brutto0
  );

  // Validate allocations
  useEffect(() => {
    const errors: string[] = [];

    const motiveTotal = formData.motiveAllocations.reduce(
      (sum, a) => sum + (a.percentage || 0),
      0
    );
    if (formData.motiveAllocations.length > 0 && Math.abs(motiveTotal - 100) > 0.01) {
      errors.push(`Motive allocations must sum to 100% (currently ${motiveTotal.toFixed(1)}%)`);
    }

    const categoryTotal = formData.categoryAllocations.reduce(
      (sum, a) => sum + (a.percentage || 0),
      0
    );
    if (formData.categoryAllocations.length > 0 && Math.abs(categoryTotal - 100) > 0.01) {
      errors.push(
        `Category allocations must sum to 100% (currently ${categoryTotal.toFixed(1)}%)`
      );
    }

    setValidationErrors(errors);
  }, [formData.motiveAllocations, formData.categoryAllocations]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validationErrors.length > 0) return;
    onSubmit(formData);
  };

  const updateField = <K extends keyof BillFormData>(
    field: K,
    value: BillFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateNumberField = (field: keyof BillFormData, value: string) => {
    const num = value === '' ? 0 : parseFloat(value);
    updateField(field, (isNaN(num) ? 0 : num) as never);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => updateField('date', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => updateField('type', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors bg-white"
            >
              <option value="Kauf">Kauf</option>
              <option value="Rechnung">Rechnung</option>
              <option value="Quittung">Quittung</option>
              <option value="Bargeld">Bargeld</option>
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Vendor <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.vendor}
              onChange={(e) => updateField('vendor', e.target.value)}
              placeholder="Store or company name"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Item */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Item
            </label>
            <input
              type="text"
              value={formData.item}
              onChange={(e) => updateField('item', e.target.value)}
              placeholder="What was purchased"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Comment */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Comment
          </label>
          <textarea
            value={formData.comment}
            onChange={(e) => updateField('comment', e.target.value)}
            placeholder="Additional notes..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors resize-y"
          />
        </div>
      </section>

      {/* Amounts */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Amounts</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Brutto 19% */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              19% VAT (Brutto)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                €
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.brutto19 || ''}
                onChange={(e) => updateNumberField('brutto19', e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Netto: {formatCurrency(formData.brutto19 / 1.19)}
            </p>
          </div>

          {/* Brutto 7% */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              7% VAT (Brutto)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                €
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.brutto7 || ''}
                onChange={(e) => updateNumberField('brutto7', e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Netto: {formatCurrency(formData.brutto7 / 1.07)}
            </p>
          </div>

          {/* Brutto 0% */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              0% VAT (Brutto)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                €
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.brutto0 || ''}
                onChange={(e) => updateNumberField('brutto0', e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Netto: {formatCurrency(formData.brutto0)}
            </p>
          </div>
        </div>

        {/* Total */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700">Total Brutto:</span>
            <span className="text-lg font-semibold text-slate-900">
              {formatCurrency(totalAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-slate-500">Total Netto:</span>
            <span className="text-base font-medium text-slate-700">
              {formatCurrency(nettoAmount)}
            </span>
          </div>
        </div>
      </section>

      {/* Allocations */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Allocations</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Motive Allocation</h3>
            <AllocationWidget
              type="motive"
              options={motives}
              value={formData.motiveAllocations}
              onChange={(allocs) => updateField('motiveAllocations', allocs)}
              totalAmount={totalAmount}
            />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Category Allocation</h3>
            <AllocationWidget
              type="category"
              options={categories}
              value={formData.categoryAllocations}
              onChange={(allocs) => updateField('categoryAllocations', allocs)}
              totalAmount={totalAmount}
            />
          </div>
        </div>
      </section>

      {/* Image Upload */}
      {!initialData?.id && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Images</h2>
          <BillImageUpload
            onUpload={(files) => {
              // Handle file upload after form submit
              console.log('Files to upload:', files);
            }}
          />
        </section>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-rose-700 mb-1">
            Please fix the following errors:
          </h4>
          <ul className="list-disc list-inside text-sm text-rose-600">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || validationErrors.length > 0}
          className={cn(
            'px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg transition-colors',
            isSubmitting || validationErrors.length > 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-indigo-700'
          )}
        >
          {isSubmitting ? 'Saving...' : initialData?.id ? 'Save Changes' : 'Create Bill'}
        </button>
      </div>
    </form>
  );
}
