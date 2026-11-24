// TournamentService → club tournaments. Parses the public home page (https://www.tournamentservice.net/?ln=xx)
// and keeps only tournaments whose venue is "BALTIJAS BILJARDS Nr.1". Pure functions + one refresh routine.
const BASE = 'https://www.tournamentservice.net/';
const VENUE = /baltijas\s*biljards/i;
const MONTHS = { 'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'май': 5, 'мая': 5, 'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12 };

const dec = (s) => String(s || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&quot;/g, '"').replace(/&apos;|&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

// "25<br>ноя<br>ср" | "28-29<br>ноя<br>сб" | "25.11<br>1.12"  ->  { date, end } (ISO, year guessed nearest to now)
function pickDate(timeHtml, now) {
  const parts = String(timeHtml || '').split(/<br\s*\/?>/i).map((x) => dec(x));
  let d, m, d2 = 0, m2 = 0;
  const a = /^(\d{1,2})(?:-(\d{1,2}))?$/.exec(parts[0] || '');
  if (a && MONTHS[(parts[1] || '').slice(0, 3).toLowerCase()]) { d = +a[1]; m = MONTHS[parts[1].slice(0, 3).toLowerCase()]; if (a[2]) { d2 = +a[2]; m2 = m; } }
  else {
    const b = /^(\d{1,2})\.(\d{1,2})$/.exec(parts[0] || '');
    if (b) { d = +b[1]; m = +b[2]; const c = /^(\d{1,2})\.(\d{1,2})$/.exec(parts[1] || ''); if (c) { d2 = +c[1]; m2 = +c[2]; } }
  }
  if (!d || !m) return { date: '', end: '' };
  const y0 = new Date(now).getUTCFullYear();
  let best = null, bd = Infinity;
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const t = Date.UTC(y, m - 1, d, 12);
    if (new Date(t).getUTCMonth() !== m - 1) continue;
    if (Math.abs(t - now) < bd) { bd = Math.abs(t - now); best = y; }
  }
  if (best == null) return { date: '', end: '' };
  const iso = (y, mm, dd) => new Date(Date.UTC(y, mm - 1, dd, 12)).toISOString().slice(0, 10);
  const date = iso(best, m, d);
  let end = '';
  if (d2 && m2) { end = iso(m2 < m ? best + 1 : best, m2, d2); if (end <= date) end = ''; }
  return { date, end };
}

// -> [{ tsId, date, time, title, link, count, disc }]  (only this club's tournaments)
export function parseTS(html, now = Date.now()) {
  const out = [];
  const rows = String(html).split('<div class="item-row">').slice(1);
  for (const row of rows) {
    const a = /<a class="stat-\w+" href="(tournament\.php\?(?:participants|bracket|info|standing)=(\d+))"[^>]*>([\s\S]*?)<\/a>/.exec(row);
    const v = /<span>([^<]*)<\/span>\s*•\s*<span>([^<]*)<\/span>/.exec(row);
    if (!a || !v || !VENUE.test(dec(v[1]))) continue;
    const t = /<time[^>]*>([\s\S]*?)<\/time>/.exec(row);
    const c = /<em class="evt-\w+"><span>(\d*)/.exec(row);
    const title = dec(a[3]);
    const dt = pickDate(t && t[1], now);
    const tm = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(title);
    out.push({
      tsId: a[2], date: dt.date, end: dt.end, time: tm ? tm[1].padStart(2, '0') + ':' + tm[2] : '',
      title, link: BASE + a[1], count: c && c[1] ? +c[1] : 0, disc: dec(v[2]),
    });
  }
  return out;
}

async function get(lang) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(BASE + '?ln=' + lang, { signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; BaltijasBiljardsSite/1.0)', accept: 'text/html' } });
    if (!r.ok) throw new Error('ts_http_' + r.status);
    const html = await r.text();
    if (!html.includes('item-row')) throw new Error('ts_layout_changed');
    return html;
  } finally { clearTimeout(timer); }
}

const clip = (s, n) => String(s || '').slice(0, n);
// Merge a fresh fetch into the stored list (older tournaments that already left the home page are kept).
export async function refreshTS(prev, now = Date.now()) {
  const ru = parseTS(await get('ru'), now);
  const disc = { lv: {}, en: {} };
  for (const l of ['lv', 'en']) {
    try { for (const r of parseTS(await get(l), now)) disc[l][r.tsId] = r.disc; } catch { /* optional */ }
  }
  const map = new Map((prev?.items || []).map((i) => [i.tsId, i]));
  const seen = new Set();
  for (const r of ru) {
    seen.add(r.tsId);
    map.set(r.tsId, {
      tsId: r.tsId, date: r.date, end: r.end, time: r.time, title: clip(r.title, 160), link: r.link, count: r.count,
      disc: { ru: clip(r.disc, 60), lv: clip(disc.lv[r.tsId] || r.disc, 60), en: clip(disc.en[r.tsId] || r.disc, 60) },
    });
  }
  // an upcoming tournament that should be on the home page but vanished was cancelled/deleted
  const soon = new Date(now + 10 * 864e5).toISOString().slice(0, 10), today = new Date(now).toISOString().slice(0, 10);
  for (const [id, i] of map) if (!seen.has(id) && i.date && i.date >= today && i.date <= soon) map.delete(id);
  const items = [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 80);
  return { fetched: now, tried: now, items };
}
