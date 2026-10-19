// Local / self-hosted server: serves ./dist and the /api with data stored on disk (./data).
//   npm run build && npm start        ->  http://localhost:8080
// Environment: PORT, DATA_DIR, ADMIN_LOGIN, ADMIN_PASSWORD, ADMIN_SECRET
import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const DIST = path.join(ROOT, 'dist');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const BLOBS = path.join(DATA, 'blobs');
mkdirSync(BLOBS, { recursive: true });

// Files are only touched with validated ids (core.mjs allows 16 hex chars only).
const store = {
  async getJSON(key) {
    try { return JSON.parse(await fs.readFile(path.join(DATA, key + '.json'), 'utf8')); } catch { return null; }
  },
  async setJSON(key, obj) {
    const f = path.join(DATA, key + '.json');
    await fs.writeFile(f + '.tmp', JSON.stringify(obj));
    await fs.rename(f + '.tmp', f);
  },
  async putBlob(id, data, type) {
    await fs.writeFile(path.join(BLOBS, id), data);
    await fs.writeFile(path.join(BLOBS, id + '.type'), type);
  },
  async getBlob(id) {
    try {
      const [data, type] = await Promise.all([fs.readFile(path.join(BLOBS, id)), fs.readFile(path.join(BLOBS, id + '.type'), 'utf8')]);
      return { data, contentType: type };
    } catch { return null; }
  },
  async delBlob(id) {
    await Promise.all([fs.rm(path.join(BLOBS, id), { force: true }), fs.rm(path.join(BLOBS, id + '.type'), { force: true })]);
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const r = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? await readBody(req) : undefined });
      const out = await handle(r, { store, env: process.env });
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file = path.join(DIST, rel);
    if (!file.startsWith(DIST + path.sep) && file !== DIST) { res.writeHead(403).end('Forbidden'); return; }
    if (!existsSync(file)) {
      const alt = existsSync(file + '.html') ? file + '.html' : null;
      if (alt) file = alt;
      else { res.writeHead(404, { 'content-type': MIME['.html'] }); createReadStream(path.join(DIST, '404.html')).pipe(res); return; }
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end('Server error');
  }
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`Baltijas Biljards: http://localhost:${port}   (data: ${DATA})`));
