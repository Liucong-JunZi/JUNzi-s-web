import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const supported = ['en', 'zh'];

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function normalize(lang?: string | null): string | undefined {
  if (!lang) return undefined;
  const base = lang.toLowerCase().split('-')[0];
  return supported.includes(base) ? base : undefined;
}

function storedLanguage(): string | undefined {
  try {
    return typeof window === 'undefined' ? undefined : normalize(window.localStorage.getItem('language'));
  } catch {
    return undefined;
  }
}

function serverLanguage(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const raw = document.getElementById('__SSR_LANG__')?.textContent;
  if (!raw) return undefined;
  try {
    return normalize(JSON.parse(raw)) ?? undefined;
  } catch {
    return undefined;
  }
}

function initialLanguage(): string {
  // During hydration the server-rendered language wins so the markup matches.
  const fromServer = serverLanguage();
  if (fromServer) return fromServer;
  const stored = storedLanguage();
  if (stored) return stored;
  const cookie = normalize(readCookie('lang'));
  if (cookie) return cookie;
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

export const changeLanguage = (lang: string) => {
  const next = normalize(lang) ?? 'en';
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem('language', next);
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== 'undefined') {
    document.cookie = `lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }
  i18n.changeLanguage(next);
};

export const getCurrentLanguage = () => i18n.language;

/**
 * Applies an explicitly saved language after hydration. It runs only post
 * hydration, so the server-rendered markup still matches; this keeps a visitor's
 * earlier choice even when the server defaulted to English.
 */
export function syncPreferredLanguage() {
  if (typeof window === 'undefined') return;
  const stored = storedLanguage();
  if (stored && stored !== normalize(i18n.language)) i18n.changeLanguage(stored);
}

/** Persist the language the server chose so later visits negotiate consistently. */
export function persistResolvedLanguage() {
  if (typeof window === 'undefined') return;
  const lang = serverLanguage();
  if (!lang) return;
  try {
    if (window.localStorage.getItem('language') !== lang) window.localStorage.setItem('language', lang);
  } catch {
    /* storage unavailable */
  }
  document.cookie = `lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}
