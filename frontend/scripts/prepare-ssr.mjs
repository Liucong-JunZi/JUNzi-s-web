// Keep only the server bundle plus the HTTP server; the SSR output directory
// otherwise inherits copies of public/ assets that are served by Nginx.
import { readdir, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = join(process.cwd(), 'dist-ssr');
for (const entry of await readdir(out)) {
  if (entry === 'entry-server.js') continue;
  await rm(join(out, entry), { recursive: true, force: true });
}
await copyFile(join(process.cwd(), 'ssr', 'server.mjs'), join(out, 'server.mjs'));
// Snapshot the client template from the same build so the hashed asset names
// referenced here always exist in the image serving /assets.
await copyFile(join(process.cwd(), 'dist', 'index.html'), join(out, 'template.html'));
console.log('ssr bundle prepared');
