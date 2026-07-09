import { create } from 'zustand';

export interface BusinessUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

export interface Business {
  id: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: BusinessUser | null;
  business: Business | null;
  isDemoMode: boolean;
  setAuth: (token: string, user: BusinessUser, business: Business, isDemo?: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('cs_token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cs_user') || 'null') : null,
  business: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cs_business') || 'null') : null,
  isDemoMode: typeof window !== 'undefined' ? localStorage.getItem('cs_demo') === 'true' : false,

  setAuth: (token, user, business, isDemo = false) => {
    localStorage.setItem('cs_token', token);
    localStorage.setItem('cs_user', JSON.stringify(user));
    localStorage.setItem('cs_business', JSON.stringify(business));
    localStorage.setItem('cs_demo', String(isDemo));
    set({ token, user, business, isDemoMode: isDemo });
  },

  logout: () => {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
    localStorage.removeItem('cs_business');
    localStorage.removeItem('cs_demo');
    set({ token: null, user: null, business: null, isDemoMode: false });
  }
}));