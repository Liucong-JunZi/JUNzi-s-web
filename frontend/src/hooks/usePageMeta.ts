import { useEffect } from 'react';

const SITE = 'JUNzi';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Keeps the document head in sync during client-side navigation. The initial
 * HTML already carries server-injected metadata; this covers SPA transitions.
 */
export function usePageMeta({ title, description, canonical, type = 'website' }: {
  title: string;
  description?: string;
  canonical?: string;
  type?: 'website' | 'article';
}) {
  useEffect(() => {
    const full = title.includes(SITE) ? title : `${title} | ${SITE}`;
    document.title = full;
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:type', type);
    setMeta('name', 'twitter:title', full);
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    if (canonical) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
      setMeta('property', 'og:url', canonical);
    }
  }, [canonical, description, title, type]);
}
