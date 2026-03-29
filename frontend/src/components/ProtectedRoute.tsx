import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // Try to restore session from HttpOnly cookie
    const restoreSession = async () => {
      if (!isAuthenticated) {
        try {
          const response = await api.get('/auth/me', { _skipAuthRedirect: true } as any);
          const user = response.data.user || response.data;
          setUser(user);
        } catch {
          // Session invalid or not found — user is already unauthenticated.
          // Do NOT call logout() here: that would fire api.post('/auth/logout')
          // without _skipAuthRedirect, triggering the 401 interceptor chain
          // and a hard window.location.href redirect that races with React Router.
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, [isAuthenticated, setUser, setLoading]);

  // Show loading state while checking session
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// AdminRoute protects admin-only routes - requires both authentication AND admin role
interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isLoading, user, setUser, setLoading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const restoreSession = async () => {
      if (!isAuthenticated) {
        try {
          const response = await api.get('/auth/me', { _skipAuthRedirect: true } as any);
          const me = response.data.user || response.data;
          setUser(me);
        } catch {
          // Session invalid — user stays unauthenticated.
          // Avoid logout() to prevent 401 interceptor hard-redirect chain.
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, [isAuthenticated, setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}