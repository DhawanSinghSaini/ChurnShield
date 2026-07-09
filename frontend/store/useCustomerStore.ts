import { create } from 'zustand';

export interface Customer {
  id: string;
  external_user_id: string;
  churn_risk_probability: number;
  risk_classification_status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  monthly_contract_value: string;
  last_computed_at: string;
  webhook_fired_at?: string | null;
}

type StatusFilter = 'ALL' | 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
type SortOption = 'risk_desc' | 'risk_asc' | 'value_desc' | 'value_asc';
type Segment = '' | 'vips' | 'slipped' | 'negative_spike';

interface CustomerState {
  customers: Customer[];
  totalCount: number;
  page: number;
  limit: number;
  statusFilter: StatusFilter;
  sortBy: SortOption;
  segment: Segment;
  searchQuery: string;
  isLoading: boolean;

  setCustomers: (customers: Customer[], totalCount: number) => void;
  setPage: (page: number) => void;
  setStatusFilter: (f: StatusFilter) => void;
  setSortBy: (s: SortOption) => void;
  setSegment: (s: Segment) => void;
  setSearchQuery: (q: string) => void;
  setLoading: (v: boolean) => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  totalCount: 0,
  page: 1,
  limit: 20,
  statusFilter: 'ALL',
  sortBy: 'risk_desc',
  segment: '',
  searchQuery: '',
  isLoading: false,

  setCustomers: (customers, totalCount) => set({ customers, totalCount }),
  setPage: (page) => set({ page }),
  setStatusFilter: (statusFilter) => set({ statusFilter, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSegment: (segment) => set({ segment, page: 1, statusFilter: 'ALL' }),
  setSearchQuery: (searchQuery) => set({ searchQuery, page: 1 }),
  setLoading: (isLoading) => set({ isLoading })
}));