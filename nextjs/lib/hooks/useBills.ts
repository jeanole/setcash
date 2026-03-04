'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bill, EditLog, FilterState, SortState, Motive, Category } from '@/lib/types';
import * as api from '@/lib/api/bills';

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [logs, setLogs] = useState<EditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [billsData, logsData] = await Promise.all([
        api.getBills(),
        api.getEditLogs(),
      ]);
      setBills(billsData);
      setLogs(logsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const deleteBill = async (id: string) => {
    try {
      await api.deleteBill(id);
      setBills((prev) => prev.filter((b) => b.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bill');
      return false;
    }
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      await api.bulkDeleteBill(ids);
      setBills((prev) => prev.filter((b) => !ids.includes(b.id)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bills');
      return false;
    }
  };

  return {
    bills,
    logs,
    isLoading,
    error,
    refetch: fetchBills,
    deleteBill,
    bulkDelete,
  };
}

export function useBill(id: string | null) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [logs, setLogs] = useState<EditLog[]>([]);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  const fetchBill = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [billData, logsData] = await Promise.all([
        api.getBill(id),
        api.getEditLogs(),
      ]);
      setBill(billData);
      setLogs(logsData.filter((l) => l.billId === id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bill');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchBill();
    }
  }, [id, fetchBill]);

  const updateBill = async (data: Record<string, unknown>) => {
    if (!id) return false;
    try {
      await api.updateBill(id, data);
      await fetchBill();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bill');
      return false;
    }
  };

  const deleteBill = async () => {
    if (!id) return false;
    try {
      await api.deleteBill(id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bill');
      return false;
    }
  };

  const verifyField = async (field: string) => {
    if (!id) return false;
    try {
      const result = await api.verifyOcrField(id, field);
      await fetchBill();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify field');
      return false;
    }
  };

  const analyse = async () => {
    if (!id) return false;
    try {
      await api.analyseBill(id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      return false;
    }
  };

  const updateStatus = async (status: string) => {
    if (!id) return false;
    try {
      await api.updateBillStatus(id, status);
      await fetchBill();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      return false;
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!id) return false;
    try {
      await api.deleteImage(id, imageId);
      await fetchBill();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
      return false;
    }
  };

  const uploadImages = async (files: File[]) => {
    if (!id) return false;
    try {
      await api.uploadImages(id, files);
      await fetchBill();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images');
      return false;
    }
  };

  const reorderImages = async (images: { id: string; sortOrder: number }[]) => {
    if (!id) return false;
    try {
      // Optimistically update
      setBill((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          images: images.map((img) => ({
            ...prev.images.find((i) => i.id === img.id)!,
            sortOrder: img.sortOrder,
          })),
        };
      });
      await api.reorderImages(
        id,
        images.map((img) => ({ id: img.id, sortOrder: img.sortOrder }))
      );
      return true;
    } catch (err) {
      await fetchBill(); // Revert on error
      setError(err instanceof Error ? err.message : 'Failed to reorder images');
      return false;
    }
  };

  const replaceImage = async (imageId: string, file: File) => {
    if (!id) return false;
    try {
      await api.replaceImage(id, imageId, file);
      await fetchBill();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace image');
      return false;
    }
  };

  const cropImage = async (imageId: string, croppedBlob: Blob) => {
    if (!id) return false;
    try {
      // Convert blob to file with original filename
      const image = bill?.images.find((img) => img.id === imageId);
      const filename = image?.filename || 'cropped.jpg';
      const file = new File([croppedBlob], filename, { type: croppedBlob.type });
      
      await api.replaceImage(id, imageId, file);
      await fetchBill();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to crop image');
      return false;
    }
  };

  return {
    bill,
    logs,
    isLoading,
    error,
    refetch: fetchBill,
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
  };
}

export function useBillOptions() {
  const [motives, setMotives] = useState<Motive[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const [motivesData, categoriesData] = await Promise.all([
          api.getMotives(),
          api.getCategories(),
        ]);
        setMotives(motivesData);
        setCategories(categoriesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load options');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  return { motives, categories, isLoading, error };
}

export function useFilteredBills(
  bills: Bill[],
  filters: FilterState,
  sort: SortState,
  page: number,
  pageSize: number
) {
  const filtered = bills.filter((bill) => {
    if (filters.person && bill.email !== filters.person) return false;
    if (filters.motive) {
      const hasMotive = bill.motiveAllocations?.some(
        (a) => a.motiveId === filters.motive
      );
      if (!hasMotive) return false;
    }
    if (filters.category) {
      const hasCategory = bill.categoryAllocations?.some(
        (a) => a.categoryId === filters.category
      );
      if (!hasCategory) return false;
    }
    if (filters.role && bill.role !== filters.role) return false;
    if (filters.type && bill.type !== filters.type) return false;
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (new Date(bill.date) < from) return false;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(bill.date) > to) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const searchable = [
        bill.vendor,
        bill.item,
        bill.comment,
        bill.billNumber,
        bill.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sort.column) return 0;
    let va: number | string;
    let vb: number | string;

    switch (sort.column) {
      case 'total':
        va = (a.brutto19 || 0) + (a.brutto7 || 0) + (a.brutto0 || 0);
        vb = (b.brutto19 || 0) + (b.brutto7 || 0) + (b.brutto0 || 0);
        break;
      case 'netto':
        va = a.nettoAmount || 0;
        vb = b.nettoAmount || 0;
        break;
      case 'date':
        va = new Date(a.date || 0).getTime();
        vb = new Date(b.date || 0).getTime();
        break;
      default:
        va = (a[sort.column as keyof Bill] as string) || '';
        vb = (b[sort.column as keyof Bill] as string) || '';
    }

    if (typeof va === 'string') {
      va = va.toLowerCase();
      vb = (vb as string).toLowerCase();
    }

    if (va < vb) return sort.dir === 'asc' ? -1 : 1;
    if (va > vb) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const start = (page - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  return {
    bills: paginated,
    totalItems: sorted.length,
    totalPages,
  };
}
