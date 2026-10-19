// Baltijas Biljards Nr.1 — API core (runtime-agnostic: Netlify Function or local Node server)
//
//   GET    /api/content            public  — site content overrides (photos, products, gallery, prices, hours)
//   POST   /api/login              {login,password} -> {token}
//   PUT    /api/admin/content      admin   — replace content (optimistic `rev` check)
//   POST   /api/admin/upload       admin   — raw image bytes -> {id,url}
//   DELETE /api/admin/img/:id      admin
//   GET    /api/img/:id            public  — uploaded image
//
// The login is verified HERE, on the server. Credentials are never sent to visitors' browsers.
// Default credentials are stored only as a salted SHA-256 hash. Override with the environment
// variables ADMIN_LOGIN and ADMIN_PASSWORD (recommended), and set ADMIN_SECRET to any long random string.
import crypto from 'node:crypto';

const SALT = 'bb-v1';
const hashCreds = (login, pass) => crypto.createHash('sha256').update(`${SALT}|${login}|${pass}`).digest('hex');
const DEFAULT_HASH = '9e769511c39ed46c948a7c314123b905264a75e4494bd04bf8daca2e1da0c566';

const MAX_UPLOAD = 4_500_000;       // bytes (Netlify request limit is ~6 MB)
const TOKEN_TTL = 12 * 60 * 60 * 1000;
const ID = /^[a-z0-9_-]{1,40}$/;
const IMG_ID = /^[a-f0-9]{16}$/;
const IMG_OK = /^(\/api\/img\/[a-f0-9]{16}|assets\/img\/[A-Za-z0-9_\/.-]{1,80}|https:\/\/baltijas-biljards-nr1\.vercel\.app\/assets\/img\/[A-Za-z0-9_\/.-]{1,80})$/;
const SLOT_KEY = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

// ---------------------------------------------------------------- helpers
const J = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const credHash = (env) => (env.ADMIN_LOGIN && env.ADMIN_PASSWORD ? hashCreds(env.ADMIN_LOGIN, env.ADMIN_PASSWORD) : DEFAULT_HASH);
const secretOf = (env) => env.ADMIN_SECRET || 's|' + credHash(env);

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(secret, payload) {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return p + '.' + crypto.createHmac('sha256', secret).update(p).digest('base64url');
}
function verifyToken(secret, token) {
  if (typeof token !== 'string') return false;
  const [p, sig] = token.split('.');
  if (!p || !sig) return false;
  const good = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  if (!safeEqual(sig, good)) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
const isAdmin = (req, env) => {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') && verifyToken(secretOf(env), h.slice(7));
};

// best-effort brute-force protection (per instance)
const failures = new Map();
const clientIp = (req) =>
  req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
const locked = (ip) => (failures.get(ip)?.until || 0) > Date.now();
function noteFail(ip) {
  const now = Date.now();
  let f = failures.get(ip);
  if (!f || now - f.first > 15 * 60e3) f = { n: 0, first: now, until: 0 };
  f.n++;
  if (f.n >= 6) f.until = now + 15 * 60e3;
  failures.set(ip, f);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sniff(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// ---------------------------------------------------------------- sanitising content
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const tri = (o, max) => ({ lv: clean(o?.lv, max), ru: clean(o?.ru, max), en: clean(o?.en, max) });
const rid = () => crypto.randomBytes(6).toString('hex');
const idOf = (v) => (typeof v === 'string' && ID.test(v) ? v : rid());
function imgUrl(v) {
  v = clean(v, 200);
  return v && !v.includes('..') && IMG_OK.test(v) ? v : '';
}

export function sanitize(input) {
  const out = {};
  if (input && typeof input.slots === 'object' && input.slots) {
    out.slots = {};
    for (const [k, v] of Object.entries(input.slots).slice(0, 100)) {
      const u = imgUrl(v);
      if (SLOT_KEY.test(k) && k.length <= 40 && u) out.slots[k] = u;
    }
  }
  if (Array.isArray(input?.products)) {
    out.products = input.products.slice(0, 200).map((p) => ({
      id: idOf(p?.id), name: tri(p?.name, 120), desc: tri(p?.desc, 600), price: clean(p?.price, 24), img: imgUrl(p?.img),
    }));
  }
  if (Array.isArray(input?.gallery)) {
    out.gallery = input.gallery.slice(0, 600)
      .map((g) => ({ id: idOf(g?.id), cat: g?.cat === 'tournaments' ? 'tournaments' : 'club', img: imgUrl(g?.img), cap: tri(g?.cap, 160) }))
      .filter((g) => g.img);
  }
  if (input?.prices && Array.isArray(input.prices.groups)) {
    out.prices = {
      groups: input.prices.groups.slice(0, 20).map((g) => ({
        id: idOf(g?.id), vip: !!g?.vip, title: tri(g?.title, 80), note: tri(g?.note, 200),
        rows: (Array.isArray(g?.rows) ? g.rows : []).slice(0, 60).map((r) => ({
          id: idOf(r?.id), label: tri(r?.label, 100), price: clean(r?.price, 24), unit: tri(r?.unit, 40),
        })),
      })),
    };
  }
  if (input?.hours && typeof input.hours === 'object') out.hours = tri(input.hours, 600);
  return out;
}

// ---------------------------------------------------------------- request handler
// store: { getJSON(key), setJSON(key,obj), putBlob(id,bytes,type), getBlob(id)->{data,contentType}|null, delBlob(id) }
export async function handle(req, { store, env = {} }) {
  const url = new URL(req.url);
  let p = url.pathname.replace(/^\/\.netlify\/functions\/api/, '/api');
  if (!p.startsWith('/api')) return J({ error: 'not_found' }, 404);
  p = p.slice(4).replace(/\/+$/, '') || '/';
  const m = req.method;

  try {
    // ---- public
    if (m === 'GET' && p === '/content') {
      const c = (await store.getJSON('content')) || { rev: 0 };
      return J(c, 200, { 'cache-control': 'public, max-age=0, must-revalidate' });
    }
    if (m === 'GET' && p.startsWith('/img/')) {
      const id = p.slice(5);
      if (!IMG_ID.test(id)) return J({ error: 'not_found' }, 404);
      const b = await store.getBlob(id);
      if (!b) return J({ error: 'not_found' }, 404);
      return new Response(b.data, {
        headers: { 'content-type': b.contentType, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
      });
    }

    // ---- login
    if (m === 'POST' && p === '/login') {
      const ip = clientIp(req);
      if (locked(ip)) return J({ error: 'too_many_attempts' }, 429);
      const text = await req.text();
      if (text.length > 2000) return J({ error: 'too_large' }, 413);
      let body = {};
      try { body = JSON.parse(text); } catch { /* ignore */ }
      const ok = safeEqual(hashCreds(String(body.login ?? ''), String(body.password ?? '')), credHash(env));
      if (!ok) { noteFail(ip); await sleep(700); return J({ error: 'bad_credentials' }, 401); }
      failures.delete(ip);
      return J({ token: sign(secretOf(env), { exp: Date.now() + TOKEN_TTL }), ttl: TOKEN_TTL });
    }

    // ---- admin
    if (p.startsWith('/admin/')) {
      if (!isAdmin(req, env)) return J({ error: 'unauthorized' }, 401);

      if (m === 'PUT' && p === '/admin/content') {
        const text = await req.text();
        if (text.length > 800_000) return J({ error: 'too_large' }, 413);
        let body;
        try { body = JSON.parse(text); } catch { return J({ error: 'bad_json' }, 400); }
        const cur = (await store.getJSON('content')) || { rev: 0 };
        if (Number(body.rev) !== cur.rev) return J({ error: 'conflict', rev: cur.rev }, 409);
        const next = { ...sanitize(body), rev: cur.rev + 1, updated: Date.now() };
        await store.setJSON('content', next);
        return J({ ok: true, rev: next.rev, content: next });
      }

      if (m === 'POST' && p === '/admin/upload') {
        const buf = new Uint8Array(await req.arrayBuffer());
        if (!buf.length) return J({ error: 'empty' }, 400);
        if (buf.length > MAX_UPLOAD) return J({ error: 'too_large' }, 413);
        const type = sniff(buf);
        if (!type) return J({ error: 'unsupported_type' }, 415);
        const id = crypto.randomBytes(8).toString('hex');
        await store.putBlob(id, buf, type);
        return J({ id, url: '/api/img/' + id });
      }

      if (m === 'DELETE' && p.startsWith('/admin/img/')) {
        const id = p.slice('/admin/img/'.length);
        if (!IMG_ID.test(id)) return J({ error: 'bad_id' }, 400);
        await store.delBlob(id);
        return J({ ok: true });
      }
    }
    return J({ error: 'not_found' }, 404);
  } catch (e) {
    console.error('api error', e);
    return J({ error: 'server_error' }, 500);
  }
}
