/**
 * Date formatting shared by server and client.
 *
 * The timezone is pinned so the server-rendered markup and the hydrated client
 * markup always agree; local-time formatting differs between the SSR host (UTC)
 * and the visitor's browser and would break hydration.
 */
const SITE_TIME_ZONE = 'Asia/Shanghai';

export function formatDate(
  value: string | Date | undefined,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'en-US'
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { timeZone: SITE_TIME_ZONE, ...options });
}

export const formatDay = (value: string | Date | undefined) =>
  formatDate(value, { year: 'numeric', month: 'long', day: 'numeric' });

export const formatMonth = (value: string | Date | undefined) =>
  formatDate(value, { year: 'numeric', month: 'long' });

export const formatShortMonth = (value: string | Date | undefined) =>
  formatDate(value, { year: 'numeric', month: 'short' });
