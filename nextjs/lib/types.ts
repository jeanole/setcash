// ============================================================================
// Bill-related Type Definitions
// ============================================================================

export type BillStatus = 'confirmed' | 'pending' | 'approved' | 'rejected' | 'paid' | 'draft';
export type OcrStatus = 'pending' | 'done' | 'failed' | null;

export interface MotiveAllocation {
  id: string;
  motiveId: string;
  name: string;
  percentage: number;
}

export interface CategoryAllocation {
  id: string;
  categoryId: string;
  name: string;
  percentage: number;
}

export interface BillImage {
  id: string;
  filename: string;
  file: string;
  sortOrder: number;
}

export interface Bill {
  id: string;
  date: string;
  billNumber: string | null;
  type: string | null;
  vendor: string | null;
  item: string | null;
  comment: string | null;
  brutto19: number;
  brutto7: number;
  brutto0: number;
  amount: number;
  netto19: number;
  netto7: number;
  netto0: number;
  nettoAmount: number;
  status: BillStatus;
  ocrStatus: OcrStatus;
  ocrFields: string[] | null;
  email: string;
  role: string;
  images: BillImage[];
  motiveAllocations: MotiveAllocation[];
  categoryAllocations: CategoryAllocation[];
}

export interface EditLog {
  id: string;
  timestamp: string;
  user: string;
  billId: string | null;
  changes: Record<string, unknown> & { _event?: string };
  source: 'user' | 'ai';
}

export interface Motive {
  id: string;
  name: string;
  budget: number;
}

export interface Category {
  id: string;
  name: string;
  budget: number;
}

export interface FilterState {
  person: string;
  motive: string;
  category: string;
  role: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export interface FilterOptions {
  persons: string[];
  motives: AllocationOption[];
  categories: AllocationOption[];
  roles: string[];
  types: string[];
}

export interface SortState {
  column: string | null;
  dir: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

// Allocation widget types
export interface AllocationItem {
  id: string;
  percentage: number;
}

export interface AllocationOption {
  id: string;
  name: string;
}

export interface Allocation {
  id: string;
  name: string;
  percentage: number;
}

// Re-export settings types
export * from './types/settings';

// ============================================================================
// Budget Matrix Type Definitions
// ============================================================================

export interface BudgetMatrixResponse {
  motives: Motive[];
  categories: Category[];
  matrix: Record<string, number>;
  grandTotal: number;
  motiveSpending: Record<string, number>;
  categorySpending: Record<string, number>;
  cellSpending: Record<string, number>;
}

export interface BudgetCellUpdate {
  motiveId: string;
  categoryId: string;
  amount: number;
}
