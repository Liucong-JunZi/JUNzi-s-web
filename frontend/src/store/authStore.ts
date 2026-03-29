import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';
import api from '../api';

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
          await api.post('/auth/logout');
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
      onRehydrateStorage: () => (state) => {
        // If no persisted session found, try restoring from HttpOnly cookies.
        // This handles fresh page loads, new browser tabs, and E2E test contexts
        // where cookies exist but sessionStorage is empty.
        if (!state?.isAuthenticated) {
          // Use api directly with _skipAuthRedirect to avoid triggering the 401 → /login redirect.
          // This is critical: public users (no cookies) call /auth/me which returns 401,
          // and we must NOT redirect them to login.
          api.get('/auth/me', { _skipAuthRedirect: true } as any)
            .then((response) => {
              const user = response.data.user || response.data;
              useAuthStore.getState().setUser(user);
            })
            .catch(() => {
              // No valid session cookie — user stays unauthenticated.
              // Do NOT trigger the global 401 interceptor redirect here,
              // because public users (no cookies) are perfectly valid.
            })
            .finally(() => {
              useAuthStore.getState().setLoading(false);
            });
        } else {
          // Already authenticated from sessionStorage — no need to check
          useAuthStore.getState().setLoading(false);
        }
      },
    }
  )
);