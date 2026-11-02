import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const API_BASE = (process.env.API_BASE_URL || 'http://backend:8080/api').replace(/\/$/, '');
const SITE = (process.env.SITE_URL || 'https://junziliucong.online').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 5000);

const { render } = await import(join(here, 'entry-server.js'));
const template = await readFile(join(here, 'template.html'), 'utf8');

const stripTags = (s = '') => s.replace(/<[^>]*>/g, ' ');
const toText = (s = '') => stripTags(s).replace(/[#*_>`~[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (s, n = 160) => {
  const r = [...s];
  return r.length > n ? `${r.slice(0, n - 1).join('')}…` : s;
};
const escapeHtml = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function api(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function pickLanguage(req) {
  const cookie = /(?:^|;\s*)lang=(en|zh)/.exec(req.headers.cookie || '');
  if (cookie) return cookie[1];
  const header = String(req.headers['accept-language'] || '');
  return /\bzh\b/i.test(header.split(',')[0] || '') ? 'zh' : 'en';
}

const staticPages = {
  '/': { title: 'JUNzi · Liu Cong', description: "Liu Cong's personal site: essays, selected projects, and a resume." },
  '/resume': { title: 'Resume | JUNzi', description: 'Education, experience and projects.' },
  '/friends': { title: 'Friends | JUNzi', description: 'Sites I read and people I follow.' },
};

async function collect(url) {
  if (url === '/blog' || url.startsWith('/blog?')) {
    const data = await api('/posts?page=1&limit=10');
    return { data: data ? { posts: { posts: data.posts ?? [], total: data.total ?? 0 } } : {}, meta: {
      title: 'Blog | JUNzi', description: 'Learning notes and technical write-ups.', canonical: `${SITE}/blog` } };
  }
  const postMatch = /^\/blog\/([^/?#]+)$/.exec(url);
  if (postMatch) {
    const slug = decodeURIComponent(postMatch[1]);
    const body = await api(`/posts/${encodeURIComponent(slug)}`);
    const data = body?.post ?? body;
    if (!data) return { notFound: true, meta: { title: 'Not Found | JUNzi', canonical: `${SITE}/blog` } };
    return { data: { post: data }, meta: {
      title: `${data.title} | JUNzi`,
      description: truncate(toText(data.summary || data.content)),
      canonical: `${SITE}/blog/${data.slug}`,
      type: 'article',
    } };
  }
  if (url === '/portfolio') {
    const data = await api('/projects?page=1&limit=50');
    return { data: data ? { projects: data.projects ?? [] } : {}, meta: {
      title: 'Projects | JUNzi', description: 'Selected projects and experiments.', canonical: `${SITE}/portfolio` } };
  }
  const projectMatch = /^\/portfolio\/(\d+)$/.exec(url);
  if (projectMatch) {
    const body = await api(`/projects/${projectMatch[1]}`);
    const data = body?.project ?? body;
    if (!data) return { notFound: true, meta: { title: 'Not Found | JUNzi', canonical: `${SITE}/portfolio` } };
    return { data: { project: data }, meta: {
      title: `${data.title} | JUNzi`,
      description: truncate(toText(data.description || data.content)),
      canonical: `${SITE}/portfolio/${projectMatch[1]}`,
      type: 'article',
    } };
  }
  if (url === '/resume') {
    const data = await api('/resume');
    return { data: data ? { resume: data.resume ?? data ?? [] } : {}, meta: staticPages['/resume'] && {
      title: staticPages['/resume'].title, description: staticPages['/resume'].description, canonical: `${SITE}/resume` } };
  }
  if (url === '/friends') {
    return { data: {}, meta: { ...staticPages['/friends'], canonical: `${SITE}/friends` } };
  }
  const page = staticPages[url];
  if (page) return { data: {}, meta: { ...page, canonical: `${SITE}${url}` } };
  return { notFound: true, meta: { title: 'Not Found | JUNzi', canonical: `${SITE}/` } };
}

function buildDocument(body, meta, lang, payload, notFound) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    meta.description ? `<meta name="description" content="${escapeHtml(meta.description)}">` : '',
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    meta.description ? `<meta property="og:description" content="${escapeHtml(meta.description)}">` : '',
    `<meta property="og:type" content="${meta.type || 'website'}">`,
    meta.canonical ? `<link rel="canonical" href="${escapeHtml(meta.canonical)}">` : '',
    meta.canonical ? `<meta property="og:url" content="${escapeHtml(meta.canonical)}">` : '',
    `<meta name="twitter:card" content="summary">`,
    notFound ? '<meta name="robots" content="noindex">' : '',
  ].filter(Boolean).join('\n    ');

  const data = JSON.stringify(payload).replace(/</g, '\\u003c');
  return template
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace(/<title>.*?<\/title>/s, tags)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
    .replace(
      '</head>',
      `  <script type="application/json" id="__SSR_LANG__">${JSON.stringify(lang)}</script>\n` +
        `  <script type="application/json" id="__SSR_DATA__">${data}</script>\n  </head>`
    );
}

// i18next keeps one active language, so renders are serialized.
let queue = Promise.resolve();
const enqueue = (job) => {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
};

const server = createServer((req, res) => {
  const url = req.url || '/';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  enqueue(async () => {
    const lang = pickLanguage(req);
    const { data, meta, notFound } = await collect(url);
    const { html } = await render(url, lang, data ?? {});
    const doc = buildDocument(html, meta, lang, data ?? {}, Boolean(notFound));
    res.writeHead(notFound ? 404 : 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': notFound ? 'no-store' : 'public, max-age=300',
      Vary: 'Cookie, Accept-Language',
    });
    res.end(req.method === 'HEAD' ? undefined : doc);
  }).catch((err) => {
    console.error('SSR render failed', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('render error');
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`ssr listening on ${PORT}`));
