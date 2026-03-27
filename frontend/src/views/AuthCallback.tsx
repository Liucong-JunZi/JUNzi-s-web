import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuthStore } from '../store/authStore';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');

      if (!code) {
        setError('No authorization code received');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      try {
        const { user, token } = await authAPI.callback(code);
        login(user, token);

        // Redirect to the original page after login, or home
        const redirectPath = authAPI.getRedirectPath() || '/';
        navigate(redirectPath);
      } catch (error) {
        console.error('Login failed:', error);
        setError('Login failed. Please try again.');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, login]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-destructive">{error}</p>
          <p className="text-muted-foreground mt-2">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto text-center">
        <p>Completing login...</p>
      </div>
    </div>
  );
}