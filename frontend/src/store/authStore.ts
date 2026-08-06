import { create } from 'zustand';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'technician';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            JSON.parse(localStorage.getItem('sd_user') || 'null'),
  token:           localStorage.getItem('sd_token'),
  isAuthenticated: !!localStorage.getItem('sd_token'),

  login: (token, user) => {
    localStorage.setItem('sd_token', token);
    localStorage.setItem('sd_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('sd_token');
    localStorage.removeItem('sd_user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
