import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Run after `pnpm --dir frontend build`. All requests use local fixtures.
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const results = {};
const calls = [];
const posts = [
  {id: 1, slug: 'alpha', title: 'Alpha fixture', summary: 'Alpha summary', content: 'Alpha body', tags: [{id:1, name:'test', slug:'test'}], created_at:'2026-10-31T18:00:00Z', like_count:0, view_count:1},
  {id: 2, slug: 'beta', title: 'Beta fixture', summary: 'Beta summary', content: 'Beta body', tags: [], created_at:'2026-10-31T18:00:00Z', like_count:0, view_count:1},
  {id: 3, slug: 'dollar', title: 'Dollar fixture', summary: 'Dollar summary', content: 'Literal dollar ampersand: $&', tags: [], created_at:'2026-10-31T18:00:00Z', like_count:0, view_count:1}
];
const api = createServer(async (req, res) => {
  calls.push(req.url);
  res.setHeader('content-type', 'application/json');
  const path = new URL(req.url, 'http://localhost').pathname;
  let payload;
  if(path === '/api/posts/slow') { await new Promise(r=>setTimeout(r,800)); payload={post:posts[0]}; }
  else if (path === '/api/posts') payload = {posts, total:posts.length};
  else if (path.endsWith('/comments')) payload = {comments:[], total:0};
  else if (path === '/api/posts/down') {res.statusCode=503; payload={error:'backend offline'};}
  else if (path === '/api/posts/limited') {res.statusCode=429; payload={error:'rate limited'};}
  else if (path.startsWith('/api/posts/')) {const post=posts.find(p=>path===`/api/posts/${p.slug}`); if(!post)res.statusCode=404; payload=post?{post}:{error:'not found'};}
  else if (path === '/api/auth/me') {res.statusCode=401; payload={error:'unauthorized'};}
  else if (path === '/api/resume') payload={resume:[]};
  else if (path === '/api/projects') payload={projects:[],total:0};
  else payload={};
  res.end(JSON.stringify(payload));
});
api.listen(0,'127.0.0.1'); await once(api,'listening');
const apiBase=`http://127.0.0.1:${api.address().port}`;
const lease=createServer();lease.listen(0,'127.0.0.1');await once(lease,'listening');const port=lease.address().port;await new Promise(r=>lease.close(r));
const child=spawn(process.execPath, [`${root}/frontend/dist-ssr/server.mjs`], {env:{...process.env,PORT:String(port),API_BASE_URL:`${apiBase}/api`},stdio:['ignore','pipe','pipe']});
const ssr=`http://127.0.0.1:${port}`;
const childLogs=[];child.stderr.on('data',d=>childLogs.push(d.toString()));
const proxy=createServer(async(req,res)=>{
  try {
    if(req.url.startsWith('/assets/')||req.url.startsWith('/fonts/')||req.url==='/favicon.jpg'){
      const path=new URL(req.url,'http://localhost').pathname;
      const data=await readFile(`${root}/frontend/dist${path}`);
      const ext=path.split('.').pop();res.setHeader('content-type',({js:'application/javascript',css:'text/css',woff2:'font/woff2',jpg:'image/jpeg'})[ext]||'application/octet-stream');res.end(data);return;
    }
    const upstream=await fetch((req.url.startsWith('/api/')?apiBase:ssr)+req.url,{headers:{cookie:req.headers.cookie||''}});
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch(e){res.writeHead(500).end(String(e));}
});
let browser;
try{
  for(let i=0;i<150;i++){try{await fetch(ssr);break;}catch{await new Promise(r=>setTimeout(r,50));}}
  proxy.listen(0,'127.0.0.1');await once(proxy,'listening');const base=`http://127.0.0.1:${proxy.address().port}`;
  results.routes=[];
  for(const path of ['/','/?utm_source=test','/blog/alpha','/blog/alpha?utm_source=test','/blog/alpha/','/resume?from=home','/blog/down','/blog/limited','/blog/missing','/blog/%ZZ']){
    const res=await fetch(ssr+path);const html=await res.text();results.routes.push({path,status:res.status,noindex:html.includes('content="noindex"'),loading:html.includes('Loading...')});
  }
  const plain=await (await fetch(ssr+'/blog/alpha')).text();
  results.descriptions=[...plain.matchAll(/<meta name="description"[^>]*>/g)].map(m=>m[0]);
  calls.length=0;await fetch(ssr+'/blog?tag=selected-tag');results.tagFilterApiCalls=[...calls];
  const slow=fetch(ssr+'/blog/slow');await new Promise(r=>setTimeout(r,100));let started=performance.now();await fetch(ssr+'/');results.homeBlockedBySlowArticleMs=Math.round(performance.now()-started);await slow;
  const dollar=await (await fetch(ssr+'/blog/dollar')).text();
  results.dollar={rootCount:[...dollar.matchAll(/id="root"/g)].length,literalPreserved:dollar.includes('Literal dollar ampersand: $&')};
  browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:204}));
  const fresh=await context.newPage();
  await fresh.goto(base+'/');await fresh.waitForTimeout(200);
  assert.equal(await fresh.locator('html').getAttribute('lang'), 'en');
  assert.ok((await fresh.locator('html').getAttribute('class')).includes('dark'));
  await fresh.close();
  await context.clearCookies();
  const page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('language','zh'));
  await page.goto(base+'/');await page.waitForTimeout(500);
  results.legacyLanguage=await page.evaluate(()=>({lang:document.documentElement.lang,stored:localStorage.getItem('language'),cookie:document.cookie,h1:document.querySelector('h1')?.textContent}));
  await page.getByTestId('language-toggle-btn').click();await page.waitForTimeout(100);
  results.toggledLanguage=await page.evaluate(()=>({lang:document.documentElement.lang,stored:localStorage.getItem('language'),h1:document.querySelector('h1')?.textContent}));
  await page.getByTestId('language-toggle-btn').click();
  let release;
  const held=new Promise(r=>release=r);
  await page.route('**/api/posts/alpha', async route=>{await held;await route.continue();});
  await page.goto(base+'/blog/alpha');await page.waitForTimeout(300);
  results.afterHydrationWhileApiPending={titleVisible:await page.getByTestId('post-title').count(),mainText:await page.locator('main').innerText()};
  release();await page.getByTestId('post-title').waitFor();await page.unroute('**/api/posts/alpha');
  await page.locator('header nav a[href="/blog"]').click();await page.getByTestId('post-card').first().waitFor();
  await page.getByTestId('post-card').filter({hasText:'Beta fixture'}).click();await page.waitForTimeout(200);
  await page.locator('header nav a[href="/blog"]').click();await page.getByTestId('post-card').first().waitFor();
  await page.route('**/api/posts/beta',route=>route.fulfill({status:404,contentType:'application/json',body:'{"error":"deleted"}'}));
  await page.getByTestId('post-card').filter({hasText:'Beta fixture'}).click();await page.waitForTimeout(200);
  results.staleDetail={url:page.url(),title:await page.getByTestId('post-title').textContent().catch(()=>null),canonical:await page.locator('link[rel=canonical]').getAttribute('href')};
  results.pageErrors=pageErrors;
  await context.close();
  assert.deepEqual(results.routes.map(r=>r.status), [200,200,200,200,200,200,503,503,404,400]);
  assert.equal(results.routes[8].loading, false);
  assert.equal(results.descriptions.length, 1);
  assert.match(results.descriptions[0], /Alpha summary/);
  assert.ok(results.tagFilterApiCalls.some(p=>p.includes('tag=selected-tag')));
  assert.ok(results.homeBlockedBySlowArticleMs < 600, 'API fetch must not block unrelated renders');
  assert.equal(results.dollar.rootCount, 1);
  assert.equal(results.dollar.literalPreserved, true);
  const embedded = dollar.match(/id="__SSR_DATA__">([\s\S]*?)<\/script>/);
  assert.equal(JSON.parse(embedded[1]).post.content, 'Literal dollar ampersand: $&');
  assert.equal(results.legacyLanguage.lang, 'zh');
  assert.equal(results.legacyLanguage.stored, 'zh');
  assert.equal(results.toggledLanguage.lang, 'en');
  assert.equal(results.afterHydrationWhileApiPending.titleVisible, 1);
  assert.equal(results.staleDetail.title, null);
  assert.deepEqual(pageErrors, []);
  console.log('SSR_REGRESSION_PASS');
} finally {
  if(browser)await browser.close();
  proxy.closeAllConnections();proxy.close();api.closeAllConnections();api.close();child.kill();
  results.ssrErrors=childLogs;
  console.log(JSON.stringify(results,null,2));
}
