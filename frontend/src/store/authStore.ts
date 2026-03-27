import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

/**
 * Security Note: Token Storage Strategy
 *
 * We use sessionStorage instead of localStorage for the following security benefits:
 * 1. Session-scoped: Token is cleared when the browser/tab is closed
 * 2. Reduced XSS persistence: Even if XSS occurs, token doesn't persist across sessions
 * 3. Reduced exposure window: Token lifetime is limited to the browsing session
 *
 * For production environments, consider:
 * - Using HttpOnly cookies (requires backend support)
 * - Implementing CSP headers to further mitigate XSS risks
 * - Using short-lived tokens with refresh token rotation
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      login: (user, token) => {
        // Use sessionStorage for better security (session-scoped, cleared on browser close)
        sessionStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        sessionStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);