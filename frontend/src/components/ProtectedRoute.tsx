import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // Try to restore session from HttpOnly cookie
    const restoreSession = async () => {
      if (!isAuthenticated) {
        try {
          const user = await authAPI.me();
          setUser(user);
        } catch {
          // Session invalid or not found
          logout();
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, [isAuthenticated, setUser, setLoading, logout]);

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
  const { isAuthenticated, isLoading, user, setUser, setLoading, logout } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const restoreSession = async () => {
      if (!isAuthenticated) {
        try {
          const me = await authAPI.me();
          setUser(me);
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, [isAuthenticated, setUser, setLoading, logout]);

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