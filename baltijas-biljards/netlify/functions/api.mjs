// Netlify Function (v2) — same API as server/local.mjs, with Netlify Blobs as storage.
import { getStore } from '@netlify/blobs';
import { handle } from '../../server/core.mjs';

const blobs = () => getStore({ name: 'bb-site', consistency: 'strong' });

const store = {
  async getJSON(key) {
    return (await blobs().get(key, { type: 'json' })) ?? null;
  },
  async setJSON(key, obj) {
    await blobs().setJSON(key, obj);
  },
  async putBlob(id, data, type) {
    await blobs().set(id, data, { metadata: { type } });
  },
  async getBlob(id) {
    const r = await blobs().getWithMetadata(id, { type: 'arrayBuffer' });
    if (!r) return null;
    return { data: new Uint8Array(r.data), contentType: r.metadata?.type || 'image/jpeg' };
  },
  async delBlob(id) {
    await blobs().delete(id);
  },
};

export default async (req) => handle(req, { store, env: process.env });

export const config = { path: '/api/*' };
