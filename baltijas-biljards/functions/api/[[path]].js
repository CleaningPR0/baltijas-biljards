// Cloudflare Pages Function — same API as the Netlify / local versions, stored in Cloudflare KV.
// Setup: Pages project → Settings → Functions → KV namespace bindings: variable name  BB
//        Settings → Functions → Compatibility flags: nodejs_compat
//        Settings → Variables: ADMIN_LOGIN, ADMIN_PASSWORD, ADMIN_SECRET
import { handle } from '../../server/core.mjs';

function makeStore(kv) {
  return {
    async getJSON(key) { return (await kv.get('j:' + key, 'json')) ?? null; },
    async setJSON(key, obj) { await kv.put('j:' + key, JSON.stringify(obj)); },
    async putBlob(id, data, type) { await kv.put('b:' + id, data, { metadata: { type } }); },
    async getBlob(id) {
      const r = await kv.getWithMetadata('b:' + id, 'arrayBuffer');
      if (!r || !r.value) return null;
      return { data: new Uint8Array(r.value), contentType: (r.metadata && r.metadata.type) || 'image/jpeg' };
    },
    async delBlob(id) { await kv.delete('b:' + id); },
  };
}

export async function onRequest({ request, env }) {
  if (!env.BB) {
    return new Response(JSON.stringify({ error: 'kv_not_bound' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  return handle(request, { store: makeStore(env.BB), env });
}
