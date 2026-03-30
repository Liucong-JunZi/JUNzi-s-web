import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { authAPI } from '../api';
import { useAuthStore } from '../store/authStore';

export function AuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Backend sets HttpOnly cookie and redirects here
      // We need to verify the session by calling /api/auth/me
      try {
        const user = await authAPI.me();
        setUser(user);

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
  }, [navigate, setUser]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-destructive">{t('authCallback.loginFailed')}</p>
          <p className="text-muted-foreground mt-2">{t('authCallback.redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto text-center" data-testid="auth-loading">
        <p>{t('authCallback.completingLogin')}</p>
      </div>
    </div>
  );
}