import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';
import { authAPI } from '../api';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (user: User) => void;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

/**
 * Security Note: Authentication Strategy
 *
 * We use HttpOnly cookies for authentication (managed by backend):
 * 1. More secure against XSS attacks (JavaScript cannot access cookies)
 * 2. Session is managed entirely server-side
 * 3. withCredentials: true in axios enables cookie transmission
 *
 * The store only caches the user object for UI purposes.
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      login: (user) => {
        set({ user, isAuthenticated: true });
      },
      logout: async () => {
        try {
          await authAPI.logout();
        } catch {
          // Still clear local state even if backend call fails
        }
        set({ user: null, isAuthenticated: false });
      },
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);