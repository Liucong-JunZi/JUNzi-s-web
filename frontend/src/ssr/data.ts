/**
 * Per-request SSR payload. The server fills this immediately before a
 * synchronous render; the client reads the same payload from the HTML so the
 * first client render matches the server markup exactly.
 */
export interface SSRPayload {
  url?: string;
  post?: unknown;
  posts?: { posts: unknown[]; total: number };
  project?: unknown;
  projects?: unknown[];
  resume?: unknown[];
  notFound?: boolean;
}

function readInjected<T>(id: string): T | undefined {
  if (typeof document === 'undefined') return undefined;
  const el = document.getElementById(id);
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return undefined;
  }
}

// Delivered as a JSON data block so the strict CSP does not need 'unsafe-inline'.
let current: SSRPayload = readInjected<SSRPayload>('__SSR_DATA__') ?? {};

export function setSSRData(data: SSRPayload) {
  current = data;
}

export function getSSRData(): SSRPayload {
  return current;
}

export function ssrValue<K extends keyof SSRPayload>(key: K): SSRPayload[K] {
  if (typeof window !== 'undefined' && current.url) {
    const initial = new URL(current.url, window.location.origin);
    if (initial.pathname !== window.location.pathname || initial.search !== window.location.search) return undefined;
  }
  return current[key];
}
