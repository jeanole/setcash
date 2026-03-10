"use strict";
'use client';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBills = useBills;
exports.useBill = useBill;
exports.useBillOptions = useBillOptions;
exports.useFilteredBills = useFilteredBills;
const react_1 = require("react");
const api = __importStar(require("@/lib/api/bills"));
function useBills() {
    const [bills, setBills] = (0, react_1.useState)([]);
    const [logs, setLogs] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchBills = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [billsData, logsData] = await Promise.all([
                api.getBills(),
                api.getEditLogs().catch(() => []),
            ]);
            setBills(billsData);
            setLogs(logsData);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load bills');
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        fetchBills();
    }, [fetchBills]);
    const deleteBill = async (id) => {
        try {
            await api.deleteBill(id);
            setBills((prev) => prev.filter((b) => b.id !== id));
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete bill');
            return false;
        }
    };
    const bulkDelete = async (ids) => {
        try {
            await api.bulkDeleteBill(ids);
            setBills((prev) => prev.filter((b) => !ids.includes(b.id)));
            return true;
        }
        catch (err) {
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
function useBill(id) {
    const [bill, setBill] = (0, react_1.useState)(null);
    const [logs, setLogs] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(!!id);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchBill = (0, react_1.useCallback)(async () => {
        if (!id)
            return;
        setIsLoading(true);
        setError(null);
        try {
            const [billData, logsData] = await Promise.all([
                api.getBill(id),
                api.getEditLogs().catch(() => []),
            ]);
            setBill(billData);
            setLogs(logsData.filter((l) => l.billId === id));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load bill');
        }
        finally {
            setIsLoading(false);
        }
    }, [id]);
    (0, react_1.useEffect)(() => {
        if (id) {
            fetchBill();
        }
    }, [id, fetchBill]);
    const updateBill = async (data) => {
        if (!id)
            return false;
        try {
            await api.updateBill(id, data);
            await fetchBill();
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update bill');
            return false;
        }
    };
    const deleteBill = async () => {
        if (!id)
            return false;
        try {
            await api.deleteBill(id);
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete bill');
            return false;
        }
    };
    const verifyField = async (field) => {
        if (!id)
            return false;
        try {
            const result = await api.verifyOcrField(id, field);
            await fetchBill();
            return result;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to verify field');
            return false;
        }
    };
    const analyse = async () => {
        if (!id)
            return false;
        try {
            await api.analyseBill(id);
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start analysis');
            return false;
        }
    };
    const updateStatus = async (status) => {
        if (!id)
            return false;
        try {
            await api.updateBillStatus(id, status);
            await fetchBill();
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update status');
            return false;
        }
    };
    const deleteImage = async (imageId) => {
        if (!id)
            return false;
        try {
            await api.deleteImage(id, imageId);
            await fetchBill();
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete image');
            return false;
        }
    };
    const uploadImages = async (files) => {
        if (!id)
            return false;
        try {
            await api.uploadImages(id, files);
            await fetchBill();
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload images');
            return false;
        }
    };
    const reorderImages = async (images) => {
        if (!id)
            return false;
        try {
            // Optimistically update
            setBill((prev) => {
                if (!prev)
                    return null;
                return Object.assign(Object.assign({}, prev), { images: images.map((img) => (Object.assign(Object.assign({}, prev.images.find((i) => i.id === img.id)), { sortOrder: img.sortOrder }))) });
            });
            await api.reorderImages(id, images.map((img) => ({ id: img.id, sortOrder: img.sortOrder })));
            return true;
        }
        catch (err) {
            await fetchBill(); // Revert on error
            setError(err instanceof Error ? err.message : 'Failed to reorder images');
            return false;
        }
    };
    const replaceImage = async (imageId, file) => {
        if (!id)
            return false;
        try {
            await api.replaceImage(id, imageId, file);
            await fetchBill();
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to replace image');
            return false;
        }
    };
    const cropImage = async (imageId, croppedBlob) => {
        if (!id)
            return false;
        try {
            // Convert blob to file with original filename
            const image = bill === null || bill === void 0 ? void 0 : bill.images.find((img) => img.id === imageId);
            const filename = (image === null || image === void 0 ? void 0 : image.filename) || 'cropped.jpg';
            const file = new File([croppedBlob], filename, { type: croppedBlob.type });
            await api.replaceImage(id, imageId, file);
            await fetchBill();
            return true;
        }
        catch (err) {
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
function useBillOptions() {
    const [motives, setMotives] = (0, react_1.useState)([]);
    const [categories, setCategories] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const [motivesData, categoriesData] = await Promise.all([
                    api.getMotives(),
                    api.getCategories(),
                ]);
                setMotives(motivesData);
                setCategories(categoriesData);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load options');
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchOptions();
    }, []);
    return { motives, categories, isLoading, error };
}
function useFilteredBills(bills, filters, sort, page, pageSize) {
    const filtered = bills.filter((bill) => {
        var _a, _b;
        if (filters.person && bill.email !== filters.person)
            return false;
        if (filters.motive) {
            const hasMotive = (_a = bill.motiveAllocations) === null || _a === void 0 ? void 0 : _a.some((a) => a.motiveId === filters.motive);
            if (!hasMotive)
                return false;
        }
        if (filters.category) {
            const hasCategory = (_b = bill.categoryAllocations) === null || _b === void 0 ? void 0 : _b.some((a) => a.categoryId === filters.category);
            if (!hasCategory)
                return false;
        }
        if (filters.role && bill.role !== filters.role)
            return false;
        if (filters.type && bill.type !== filters.type)
            return false;
        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            if (new Date(bill.date) < from)
                return false;
        }
        if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(bill.date) > to)
                return false;
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
            if (!searchable.includes(q))
                return false;
        }
        return true;
    });
    const sorted = [...filtered].sort((a, b) => {
        if (!sort.column)
            return 0;
        let va;
        let vb;
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
                va = a[sort.column] || '';
                vb = b[sort.column] || '';
        }
        if (typeof va === 'string') {
            va = va.toLowerCase();
            vb = vb.toLowerCase();
        }
        if (va < vb)
            return sort.dir === 'asc' ? -1 : 1;
        if (va > vb)
            return sort.dir === 'asc' ? 1 : -1;
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
