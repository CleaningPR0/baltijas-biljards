#!/usr/bin/env node
// Static site generator for Baltijas Biljards Nr.1  (v2 — photo-led, cinematic)
// Usage: node build.js   ->  writes ./dist
const fs = require('fs');
const path = require('path');
const D = require('./i18n-source.js');
const RULES = require('./rules-defaults.js');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

// ------------------------------------------------------------------ config
const SITE = {
  name: 'Baltijas Biljards Nr.1',
  phone: '+371 20762447',
  tel: '+37120762447',
  email: 'info@biljards1.lv',
  street: 'Kalnciema iela 170A',
  city: 'Rīga',
  zip: 'LV-1046',
  map: 'https://maps.app.goo.gl/ugoQrowSYuxNYjnA7',
  mapEmbed: 'https://www.google.com/maps?q=Kalnciema%20iela%20170A%2C%20Riga&output=embed',
  tournaments: 'https://tournamentservice.net/',
  url: '', // set real domain before launch (canonical, sitemap)
};

// ------------------------------------------------------------------ photos
// Every photo on the site lives in a SLOT. The admin panel can replace any slot with an uploaded photo.
// Defaults: put files in assets/img/<name>.jpg|.webp (e.g. club-1.jpg). While a file is missing the page
// temporarily loads the photo from the reference site so the draft looks real.
const REF = 'https://baltijas-biljards-nr1.vercel.app/assets/img/';
const REMOTE_EXT = (n) => (n.startsWith('shop/') ? '.webp' : '.jpg');
const SLOTS = [
  ['logo', 'Логотип — главная страница', 'logo'],
  ['home.hero', 'Главная — большое фото', 'hero-1'],
  ['home.pyramid', 'Главная — карточка «Пирамида»', 'club-4'],
  ['home.pool', 'Главная — карточка «Пул»', 'club-2'],
  ['home.hall', 'Главная — плитка «Зал»', 'club-1'],
  ['home.tournaments', 'Главная — плитка «Турниры»', 'club-3'],
  ['home.school', 'Главная — плитка «Школа»', 'club-6'],
  ['home.shop', 'Главная — плитка «Магазин»', 'shop/cue-pyramid'],
  ['home.tournaments.lv', 'Главная — плитка «Турниры», LV (латышский)'],
  ['home.tournaments.ru', 'Главная — плитка «Турниры», RU (русский)'],
  ['home.tournaments.en', 'Главная — плитка «Турниры», EN (английский)'],
  ['home.school.lv', 'Главная — плитка «Школа», LV (латышский)'],
  ['home.school.ru', 'Главная — плитка «Школа», RU (русский)'],
  ['home.school.en', 'Главная — плитка «Школа», EN (английский)'],
  ['home.shop.lv', 'Главная — плитка «Магазин», LV (латышский)'],
  ['home.shop.ru', 'Главная — плитка «Магазин», RU (русский)'],
  ['home.shop.en', 'Главная — плитка «Магазин», EN (английский)'],
  ['tables.hero', 'Столы — большое фото', 'club-4'],
  ['tables.tt', 'Столы — настольный теннис', 'club-5'],
  ['hall.1', 'Зал — фото 1 (большое)', 'club-1'],
  ['hall.2', 'Зал — фото 2', 'club-2'],
  ['hall.3', 'Зал — фото 3', 'club-3'],
  ['hall.4', 'Зал — фото 4 (высокое)', 'club-4'],
  ['hall.5', 'Зал — фото 5', 'club-5'],
  ['hall.6', 'Зал — фото 6', 'club-6'],
  ['tournaments.hero', 'Турниры — большое фото', 'club-3'],
  ['school.hero', 'Школа — большое фото', 'hero-1'],
  ['news.1', 'Новости — новость 1 (экипировка)', 'shop/balls'],
  ['news.2', 'Новости — новость 2 (Saturday Tournament)', 'club-3'],
  ['news.3', 'Новости — новость 3 (школа)', 'hero-1'],
  ['news.4', 'Новости — новость 4 (новое сукно)', 'club-4'],
  ['news.5', 'Новости — новость 5 (вечер с коллегами)', 'club-1'],
];
const SLOT_DEF = Object.fromEntries(SLOTS.map(([k, , d]) => [k, d]));
function photoSrc(slotOrName) {
  const name = SLOT_DEF[slotOrName] || slotOrName;
  for (const ext of ['.jpg', '.jpeg', '.webp', '.png']) {
    if (fs.existsSync(path.join(ROOT, 'assets/img', name + ext))) return `assets/img/${name}${ext}`;
  }
  return REF + name + REMOTE_EXT(name);
}
const ONERR = "this.parentNode.classList.add('is-empty');this.remove()";
const img = (src, alt = '', extra = '') =>
  `<img src="${src}" alt="${alt}" ${extra} loading="lazy" decoding="async" onerror="${ONERR}">`;
const ph = (slot, cls = '', alt = '', extra = '') =>
  `<div class="ph ${cls}"${SLOT_DEF[slot] ? ` data-slot="${slot}"` : ''}>${img(photoSrc(slot), alt, extra)}</div>`;

// ------------------------------------------------------------------ helpers
const used = new Set();
function lv(key) {
  if (!D[key]) throw new Error('Missing i18n key: ' + key);
  used.add(key);
  return D[key][0];
}
function el(tag, key, cls, extra) {
  return `<${tag}${cls ? ` class="${cls}"` : ''}${extra ? ' ' + extra : ''} data-i18n="${key}">${lv(key)}</${tag}>`;
}
const t = (key) => `<span data-i18n="${key}">${lv(key)}</span>`;

const NAV = [
  ['tables', 'galdi.html'],
  ['prices', 'cenas.html'],
  ['hall', 'zale.html'],
  ['gallery', 'galerija.html'],
  ['tournaments', 'turniri.html'],
  ['rules', 'noteikumi.html'],
  ['school', 'skola.html'],
  ['shop', 'veikals.html'],
  ['news', 'jaunumi.html'],
  ['contacts', 'kontakti.html'],
];

const ICON = {
  arrow: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevL: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  phone: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  pin: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  mail: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 7l8.5 6 8.5-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  car: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16v-4l2-5h12l2 5v4M4 16h16M4 16v2m16-2v2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="13" r="1" fill="currentColor"/><circle cx="16" cy="13" r="1" fill="currentColor"/></svg>',
  clock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  ext: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16L16 8M9 8h7v7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// Site theme: 'dark' (default, requested by the club) or 'light'. Override: THEME=light node build.js
const THEME = process.env.THEME === 'light' ? 'light' : 'dark';
let gid = 0;
const HAS_LOGO = fs.existsSync(path.join(ROOT, 'assets/img/logo.jpg'));
const BUILD = Date.now().toString(36);
const brandMark = (size) => HAS_LOGO ? `<img class="brand__logo" src="assets/img/logo.jpg" alt="" width="${size}" height="${size}">` : emblem(size);
function emblem(size = 34) {
  return `<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="22.5" fill="currentColor"/>
  <circle cx="24" cy="24" r="9.5" style="fill:var(--emblem-core)"/>
  <text x="24" y="28.6" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-weight="700" font-size="12.5" fill="currentColor">1</text>
</svg>`;
}

// Pocket diagram: flat, quiet, technical. pocket & ball in mm.
function pocketDiagram(pocket, ball) {
  const k = 2.3, pw = pocket * k, bd = ball * k, cx = 200, cy = 128;
  const y = cy + pw / 2 + 26;
  return `<svg class="diag" viewBox="0 0 400 ${Math.round(y + 40)}" aria-hidden="true">
  <circle cx="${cx}" cy="${cy}" r="${pw / 2}" style="fill:var(--hole)"/>
  <circle cx="${cx}" cy="${cy}" r="${bd / 2}" style="fill:var(--ball);stroke:var(--hair)" stroke-width="1.5"/>
  <g style="stroke:var(--steel)" stroke-width="1"><path d="M${cx - pw / 2} ${y}h${pw}"/><path d="M${cx - pw / 2} ${y - 6}v12M${cx + pw / 2} ${y - 6}v12"/></g>
  <text x="${cx}" y="${y + 24}" text-anchor="middle" font-size="13" style="fill:var(--slate)">${Math.round(pocket)} MM</text>
</svg>`;
}

const SHOP_ICON = {
  chalk: '<svg viewBox="0 0 80 80"><rect x="22" y="26" width="36" height="30" rx="5" fill="#3d86b5"/><rect x="22" y="26" width="36" height="9" rx="4" fill="#79b7d6"/></svg>',
  cuePyr: '<svg viewBox="0 0 80 80"><g transform="rotate(-38 40 40)"><rect x="-4" y="36" width="88" height="6" rx="3" fill="#d9b77a"/><rect x="-4" y="36" width="34" height="6" rx="3" fill="#2a1d10"/></g></svg>',
  cuePool: '<svg viewBox="0 0 80 80"><g transform="rotate(-38 40 40)"><rect x="-4" y="37" width="88" height="5" rx="2.5" fill="#e8d3a6"/><rect x="-4" y="37" width="30" height="5" rx="2.5" fill="#0f3d2e"/></g></svg>',
  balls: '<svg viewBox="0 0 80 80"><circle cx="30" cy="32" r="13" fill="#eee7d5"/><circle cx="52" cy="34" r="13" fill="#e4dcc6"/><circle cx="40" cy="54" r="13" fill="#d9cfb4"/></svg>',
  tips: '<svg viewBox="0 0 80 80"><circle cx="28" cy="30" r="10" fill="#b98f45"/><circle cx="52" cy="30" r="10" fill="#c9a96a"/><circle cx="40" cy="52" r="10" fill="#d9bd85"/></svg>',
  glove: '<svg viewBox="0 0 80 80"><path d="M26 58V36c0-3 4-3 4 0v-8c0-3 4-3 4 0v-2c0-3 4-3 4 0v2c0-3 4-3 4 0v14l6 8v8z" fill="#2a2a2a"/></svg>',
  case: '<svg viewBox="0 0 80 80"><g transform="rotate(-38 40 40)"><rect x="2" y="32" width="76" height="16" rx="8" fill="#2a1d10"/></g></svg>',
  rack: '<svg viewBox="0 0 80 80"><path d="M40 14L68 62H12z" fill="none" stroke="#6a4a2c" stroke-width="6" stroke-linejoin="round"/></svg>',
};

const PRODUCTS = [['p1', 'chalk', 'shop/chalk'], ['p2', 'cuePyr', 'shop/cue-pyramid'], ['p3', 'cuePool', 'shop/cue-pool'], ['p4', 'balls', 'shop/balls'], ['p5', 'tips', 'shop/tips'], ['p6', 'glove', 'shop/glove'], ['p7', 'case', 'shop/case'], ['p8', 'rack', 'shop/rack']];

const PRICE_DEFAULTS = [
  { id: 'g-pyramid', vip: false, title: 'pyr.h', note: 'pyr.count' },
  { id: 'g-pool', vip: false, title: 'pool.h', note: 'pool.count' },
  { id: 'g-vip', vip: true, title: 'prices.vip', note: 'prices.vip.note' },
];

// ------------------------------------------------------------------ layout
function header(page) {
  const links = NAV.map(([k, href]) => {
    const cur = page.file === href ? ' aria-current="page"' : '';
    return `<a href="${href}"${cur} data-i18n="nav.${k}">${lv('nav.' + k)}</a>`;
  }).join('');
  return `<a class="skip" href="#main" data-i18n="skip">${lv('skip')}</a>
<header class="site-header" id="top">
  <div class="bar">
    <a class="brand" data-admin-trigger href="index.html" aria-label="${SITE.name}">${brandMark(34)}<span class="brand__name">Baltijas Biljards<small>NR.1</small></span></a>
    <nav class="nav" id="nav" aria-label="Main">
      ${links}
      <a class="nav__cta btn btn--primary" href="tel:${SITE.tel}" data-i18n="cta.book">${lv('cta.book')}</a>
    </nav>
    <div class="bar__right">
      <div class="lang" role="group" aria-label="Language">
        <button type="button" data-lang="lv" aria-pressed="true">LV</button>
        <button type="button" data-lang="ru" aria-pressed="false">RU</button>
        <button type="button" data-lang="en" aria-pressed="false">EN</button>
      </div>
      <a class="btn btn--primary btn--sm bar__book" href="tel:${SITE.tel}" data-i18n="cta.book">${lv('cta.book')}</a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu" data-i18n-aria="nav.menu"><span></span><span></span></button>
    </div>
  </div>
</header>`;
}

function footer() {
  const nav = (k, href) => `<li><a href="${href}" data-i18n="nav.${k}">${lv('nav.' + k)}</a></li>`;
  return `<footer class="site-footer">
  <div class="container">
    <div class="foot">
      <div class="foot__brand">
        <a class="brand" href="index.html" aria-label="${SITE.name}">${brandMark(38)}<span class="brand__name">Baltijas Biljards<small>NR.1</small></span></a>
        ${el('p', 'foot.about', 'foot__about')}
      </div>
      <div class="foot__col"><h3 data-i18n="foot.club">${lv('foot.club')}</h3><ul>${nav('tables', 'galdi.html')}${nav('prices', 'cenas.html')}${nav('hall', 'zale.html')}${nav('gallery', 'galerija.html')}</ul></div>
      <div class="foot__col"><h3 data-i18n="foot.services">${lv('foot.services')}</h3><ul>${nav('tournaments', 'turniri.html')}${nav('rules', 'noteikumi.html')}${nav('school', 'skola.html')}${nav('shop', 'veikals.html')}${nav('news', 'jaunumi.html')}</ul></div>
      <div class="foot__col"><h3 data-i18n="foot.contact">${lv('foot.contact')}</h3>
        <ul>
          <li><a href="${SITE.map}" target="_blank" rel="noopener">${SITE.street}, ${SITE.city}, ${SITE.zip}</a></li>
          <li><a href="tel:${SITE.tel}">${SITE.phone}</a></li>
          <li><a href="mailto:${SITE.email}">${SITE.email}</a></li>
        </ul>
      </div>
      <div class="foot__col"><h3 data-i18n="foot.hours">${lv('foot.hours')}</h3><p class="foot__hours" data-i18n="foot.hours_value">${lv('foot.hours_value')}</p></div>
    </div>
    <div class="foot__bar">
      <p>© <span data-year>2026</span> ${SITE.name}. <span data-i18n="foot.rights">${lv('foot.rights')}</span></p>
      <p><a href="privatums.html" data-i18n="foot.privacy">${lv('foot.privacy')}</a> <button type="button" class="linkbtn" data-cc-open data-i18n="cc.settings">${lv('cc.settings')}</button></p>
      <a class="totop" href="#top"><span data-i18n="cta.top">${lv('cta.top')}</span>${ICON.up}</a>
    </div>
  </div>
</footer>`;
}

function shell(page, body) {
  const title = lv(`meta.${page.id}.title`);
  const desc = lv(`meta.${page.id}.desc`);
  const canon = SITE.url ? `<link rel="canonical" href="${SITE.url}/${page.file === 'index.html' ? '' : page.file}">` : '';
  const ld = (page.id === 'index' || page.id === 'contacts') ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SportsActivityLocation', name: SITE.name, telephone: SITE.tel, email: SITE.email,
    address: { '@type': 'PostalAddress', streetAddress: SITE.street, addressLocality: 'Rīga', postalCode: SITE.zip, addressCountry: 'LV' },
  })}</script>` : '';
  return `<!doctype html>
<html lang="lv" data-page="${page.id}" data-theme="${THEME}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="${THEME === 'light' ? '#ffffff' : '#000000'}">
<meta name="color-scheme" content="${THEME}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:site_name" content="${SITE.name}">
${canon}
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/style.css?v=${BUILD}">
<script>document.documentElement.classList.add('js')</script>
${ld}
</head>
<body>
${header(page)}
<main id="main">
${body}
</main>
${footer()}
<div class="cc" id="cc" role="dialog" aria-live="polite" hidden>
  <p data-i18n="cc.text">${lv('cc.text')}</p>
  <div class="cc__act"><button type="button" class="btn btn--ghost btn--sm" data-cc="no" data-i18n="cc.no">${lv('cc.no')}</button><button type="button" class="btn btn--primary btn--sm" data-cc="yes" data-i18n="cc.yes">${lv('cc.yes')}</button></div>
  <a href="privatums.html" class="cc__more" data-i18n="foot.privacy">${lv('foot.privacy')}</a>
</div>
<script src="assets/js/i18n-data.js?v=${BUILD}"></script>
<script src="assets/js/main.js?v=${BUILD}"></script>
<script src="assets/js/content.js?v=${BUILD}"></script>
</body>
</html>
`;
}

// ------------------------------------------------------------------ partials
const btn = (href, key, kind = 'primary', icon = '') =>
  `<a class="btn btn--${kind}" href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span data-i18n="${key}">${lv(key)}</span>${icon}</a>`;
const textLink = (href, key) =>
  `<a class="tlink" href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span data-i18n="${key}">${lv(key)}</span>${ICON.chev}</a>`;

// big centered page title (Apple-like) with optional wide photo frame
function pageHero(eyebrow, h1, lead, { actions = '', photo = '' } = {}) {
  return `
<section class="phero">
  <div class="container phero__in">
    ${el('p', eyebrow, 'eyebrow reveal')}
    ${el('h1', h1, 'display reveal')}
    ${lead ? el('p', lead, 'lead reveal') : ''}
    ${actions ? `<div class="phero__actions reveal">${actions}</div>` : ''}
  </div>
  ${photo ? `<div class="container"><div class="frame frame--static reveal">${ph(photo, 'frame__in')}</div></div>` : ''}
</section>`;
}

const sectionHead = (eyebrow, h, p, extra = '') => `
<div class="shead">
  <div class="reveal">
    ${eyebrow ? el('p', eyebrow, 'eyebrow') : ''}
    ${el('h2', h, 'h2')}
    ${p ? el('p', p, 'lead') : ''}
  </div>
  ${extra}
</div>`;

const rowControls = `<div class="row-ctl"><button type="button" class="row-btn" data-dir="-1" aria-label="←">${ICON.chevL}</button><button type="button" class="row-btn" data-dir="1" aria-label="→">${ICON.chev}</button></div>`;

const ctaBand = (h, p, extra) => `
<section class="cta">
  <div class="container cta__in reveal">
    ${el('h2', h, 'display display--sm')}
    ${el('p', p, 'lead')}
    <a class="cta__phone" href="tel:${SITE.tel}">${SITE.phone}</a>
    <div class="cta__actions">${btn('tel:' + SITE.tel, 'cta.book', 'primary', ICON.phone)}${extra || ''}</div>
  </div>
</section>`;

const steps = (items) => `<ol class="steps">${items.map(([h, p], i) => `
  <li class="step reveal"><span class="step__n">0${i + 1}</span>${h ? el('h3', h) : ''}${el('p', p)}</li>`).join('')}</ol>`;

const faq = (n) => `<div class="faq">${Array.from({ length: n }, (_, i) => `
  <details class="reveal"><summary data-i18n="faq.q${i + 1}">${lv('faq.q' + (i + 1))}</summary><p data-i18n="faq.a${i + 1}">${lv('faq.a' + (i + 1))}</p></details>`).join('')}</div>`;

const newsItems = [
  ['n1', 'shop', 'news.1'],
  ['n2', 'tournaments', 'news.2'],
  ['n3', 'school', 'news.3'],
  ['n4', 'club', 'news.4'],
  ['n5', 'club', 'news.5'],
];
const newsCard = ([id, tag, photo]) => `
<article class="ncard reveal">
  ${ph(photo, 'ncard__img')}
  <div class="ncard__body">
    <p class="ncard__meta"><span class="chip" data-i18n="tag.${tag}">${lv('tag.' + tag)}</span><time data-i18n="${id}.date">${lv(id + '.date')}</time></p>
    ${el('h3', id + '.h')}
    ${el('p', id + '.p')}
  </div>
</article>`;

// highlights-stage feature card (text on top, photo below)
const posterCard = (href, titleKey, textKey, photo) => `
<a class="poster" href="${href}">
  <div class="poster__body">${el('h3', titleKey)}${el('p', textKey)}</div>
  <div class="poster__media">${ph(photo, 'poster__img')}<span class="poster__go">${ICON.arrow}</span></div>
</a>`;

// ------------------------------------------------------------------ illustrated stat cards (top-down tables, parking sign)
const POOL_COLORS = ['#f2c230', '#2a56b8', '#cc2f2f', '#5b2d83', '#e8761f', '#1f8a4c', '#7a1f1f', '#17181a', '#f2c230', '#2a56b8'];
const STAT_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="g-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5526"/><stop offset=".5" stop-color="#5e3617"/><stop offset="1" stop-color="#3a200d"/></linearGradient>
  <radialGradient id="g-cloth" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#2a8a55"/><stop offset=".7" stop-color="#15603a"/><stop offset="1" stop-color="#0c3f26"/></radialGradient>
  <radialGradient id="g-cloth2" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#2b8f78"/><stop offset=".7" stop-color="#16665a"/><stop offset="1" stop-color="#0c4238"/></radialGradient>
  <linearGradient id="g-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a6cb8"/><stop offset="1" stop-color="#143f74"/></linearGradient>
  <radialGradient id="g-ivory" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f1ead4"/><stop offset="1" stop-color="#bdb394"/></radialGradient>
  <linearGradient id="g-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2b0"/><stop offset=".5" stop-color="#c9a45c"/><stop offset="1" stop-color="#7a5a24"/></linearGradient>
  <linearGradient id="g-cue" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b200d"/><stop offset=".55" stop-color="#b98a45"/><stop offset="1" stop-color="#f3e2b8"/></linearGradient>
  <linearGradient id="g-sign" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f78d6"/><stop offset="1" stop-color="#14438a"/></linearGradient>
  <linearGradient id="g-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b949a"/><stop offset=".5" stop-color="#d3d9dc"/><stop offset="1" stop-color="#6c767c"/></linearGradient>
  <radialGradient id="g-paddle" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#e5483b"/><stop offset="1" stop-color="#8f1a14"/></radialGradient>
  ${POOL_COLORS.map((c, i) => `<radialGradient id="g-b${i}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset=".08" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></radialGradient>`).join('')}
  <filter id="f-sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.2" dy="2.4" stdDeviation="1.8" flood-color="#000" flood-opacity=".5"/></filter>
</defs></svg>`;
const STAT_ART = (() => {
  const svg = (vb, inner) => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${inner}</svg>`;
  const ball = (cx, cy, r, fill, n, disc, extra = '') => {
    const dx = (((n * 37) % 11) - 5) * 1.7, dy = (((n * 53) % 13) - 6) * 1.5;
    return `<g class="b" style="--i:${n};--dx:${dx.toFixed(1)};--dy:${dy.toFixed(1)}" ${extra}><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" filter="url(#f-sh)"/>${disc ? `<circle cx="${cx}" cy="${cy}" r="${(r * .42).toFixed(2)}" fill="#f6f3e8"/>` : ''}<ellipse cx="${(cx - r * .36).toFixed(2)}" cy="${(cy - r * .42).toFixed(2)}" rx="${(r * .3).toFixed(2)}" ry="${(r * .18).toFixed(2)}" fill="#fff" opacity=".72" transform="rotate(-30 ${(cx - r * .36).toFixed(2)} ${(cy - r * .42).toFixed(2)})"/></g>`;
  };
  const rack = (ax, ay, rows, r, colored) => {
    let s = '', n = 0; const sx = r * 1.75, sy = r * 2.04;
    for (let k = 0; k < rows; k++) for (let j = 0; j <= k; j++) {
      const cx = ax + k * sx, cy = ay + (j - k / 2) * sy;
      s += ball(cx.toFixed(1), cy.toFixed(1), r, colored ? `url(#g-b${n % 10})` : 'url(#g-ivory)', n + 1, colored);
      n++;
    }
    return s;
  };
  const diamonds = (x1, x2, y, k) => Array.from({ length: k }, (_, i) => `<circle cx="${(x1 + (x2 - x1) * (i + 1) / (k + 1)).toFixed(1)}" cy="${y}" r="2.1" fill="url(#g-brass)"/>`).join('');
  const table = ({ cloth, pr, colored, rows }) => `
    <rect x="8" y="8" width="404" height="224" rx="20" fill="url(#g-wood)" stroke="#1c0f05" stroke-width="1.5"/>
    <rect x="12" y="12" width="396" height="216" rx="17" fill="none" stroke="#b27a3d" stroke-opacity=".45" stroke-width="1"/>
    ${diamonds(60, 360, 21, 7)}${diamonds(60, 360, 219, 7)}${[1, 2, 3].map((i) => `<circle cx="20" cy="${(20 + 200 * i / 4).toFixed(1)}" r="2.1" fill="url(#g-brass)"/><circle cx="400" cy="${(20 + 200 * i / 4).toFixed(1)}" r="2.1" fill="url(#g-brass)"/>`).join('')}
    <rect x="30" y="30" width="360" height="180" rx="7" fill="#07281a"/>
    <rect x="38" y="38" width="344" height="164" rx="3" fill="url(#${cloth})"/>
    ${[[38, 38], [382, 38], [38, 202], [382, 202], [210, 36], [210, 204]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${pr + 2}" fill="url(#g-brass)"/><circle cx="${x}" cy="${y}" r="${pr}" fill="#040806"/>`).join('')}
    <line x1="120" y1="40" x2="120" y2="200" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>
    <circle cx="272" cy="110" r="1.6" fill="#fff" fill-opacity=".35"/>
    <g class="rk">${rack(272, 110, rows, 6.5, colored)}</g>
    <g class="cue"><line x1="-14" y1="141" x2="96" y2="128.4" stroke="url(#g-cue)" stroke-width="5.4" stroke-linecap="round" filter="url(#f-sh)"/><line x1="92" y1="128.9" x2="97" y2="128.3" stroke="#6aa0cc" stroke-width="5.4" stroke-linecap="round"/><line x1="82" y1="130" x2="86" y2="129.6" stroke="url(#g-brass)" stroke-width="5.6"/></g>
    <g class="cb">${ball(104, 127, 6.5, 'url(#g-ivory)', 0, false)}</g>`;
  return {
    pyr: svg('-16 0 436 240', table({ cloth: 'g-cloth', pr: 8.5, colored: false, rows: 5 })),
    pool: svg('-16 0 436 240', table({ cloth: 'g-cloth2', pr: 11, colored: true, rows: 4 })),
    tt: svg('0 0 420 240', `
      <rect x="14" y="30" width="392" height="184" rx="6" fill="#0b2a50" opacity=".55" transform="translate(0 7)"/>
      <rect x="14" y="30" width="392" height="184" rx="6" fill="url(#g-blue)" stroke="#0a2a52" stroke-width="2"/>
      <rect x="20" y="36" width="380" height="172" rx="3" fill="none" stroke="#f4f0e2" stroke-width="3"/>
      <line x1="20" y1="122" x2="400" y2="122" stroke="#f4f0e2" stroke-width="1.8"/>
      <g class="net"><rect x="206" y="22" width="8" height="200" rx="2" fill="#fff" fill-opacity=".28" stroke="#fff" stroke-opacity=".85" stroke-width="1"/><line x1="210" y1="24" x2="210" y2="220" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="1.4 2.6"/><circle cx="210" cy="20" r="6" fill="#1b1d1f"/><circle cx="210" cy="226" r="6" fill="#1b1d1f"/></g>
      <g class="pad" filter="url(#f-sh)"><line x1="366" y1="88" x2="392" y2="128" stroke="#9a6a34" stroke-width="13" stroke-linecap="round"/><line x1="366" y1="88" x2="392" y2="128" stroke="#c99a5c" stroke-width="3" stroke-linecap="round" opacity=".55"/><circle cx="346" cy="62" r="32" fill="url(#g-paddle)" stroke="#2a0c09" stroke-width="3"/><circle cx="346" cy="62" r="25" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.2"/><ellipse cx="335" cy="50" rx="11" ry="7" fill="#fff" opacity=".16" transform="rotate(-35 335 50)"/></g>
      <g class="tball" filter="url(#f-sh)"><circle cx="128" cy="104" r="7.5" fill="url(#g-ivory)"/></g>`),
    park: svg('0 0 240 250', `
      <ellipse cx="120" cy="238" rx="64" ry="7" fill="#000" opacity=".5"/>
      <rect x="114" y="140" width="12" height="98" rx="3" fill="url(#g-steel)"/>
      <rect x="104" y="232" width="32" height="8" rx="3" fill="url(#g-steel)"/>
      <g class="sgn" filter="url(#f-sh)"><rect x="34" y="6" width="172" height="156" rx="18" fill="url(#g-sign)"/><rect x="43" y="15" width="154" height="138" rx="11" fill="none" stroke="#fff" stroke-width="5"/>
        <path d="M94 128 V42 H128 a31 31 0 0 1 0 62 H94" fill="none" stroke="#fff" stroke-width="19" stroke-linejoin="miter"/><path d="M40 20 L120 12 L40 70 Z" fill="#fff" opacity=".08"/></g>`),
  };
})();

// ------------------------------------------------------------------ pages
const pages = [];

pages.push({
  id: 'index', file: 'index.html',
  body: () => `
<section class="splash" aria-label="${SITE.name}">
  <div class="container splash__in">
    <div class="splash__txt">
      ${el('p', 'home.eyebrow', 'eyebrow reveal')}
      ${el('h1', 'home.h1', 'display reveal')}
      ${el('p', 'home.lead', 'lead reveal')}
      <div class="hero__actions reveal">
        ${btn('tel:' + SITE.tel, 'cta.book', 'primary')}
        ${textLink('kontakti.html', 'home.where')}
      </div>
    </div>
    <div class="splash__art" aria-hidden="true">
      <div class="medal">
        <span class="medal__stitch"></span>
        <span class="medal__face"><img src="assets/img/logo.jpg?v=${BUILD}" alt="" width="900" height="900" data-medal-logo decoding="async"><span class="medal__glare"></span></span>
      </div>
    </div>
  </div>
</section>

${(()=>{const l=[1,2,4,5,6,7,8].map(i=>`<li>${t('mq.'+i)}</li>`).join('');return `<div class="mq" aria-label="${SITE.name}"><div class="mq__track"><ul>${l}</ul><ul aria-hidden="true">${l}</ul></div></div>`;})()}

<section class="hero hero--frame">
  <div class="frame" data-frame>
    ${ph('home.hero', 'frame__in', '', 'data-parallax')}
    <div class="callout">
      <p class="callout__t"><strong>${SITE.street}, ${SITE.city}</strong><span><b>9</b> ${t('stat.pyramid')} · <b>6</b> ${t('stat.pool')}</span></p>
      <a class="btn btn--primary btn--sm" href="tel:${SITE.tel}"><span data-i18n="cta.book">${lv('cta.book')}</span></a>
    </div>
  </div>
</section>

<section class="statement-sec">
  <div class="container narrow-xl">
    ${el('p', 'home.statement', 'statement')}
  </div>
</section>

<section class="numbers">
  <div class="container">
    ${STAT_DEFS}
    <ul class="nums">
      <li class="stat stat--pyr reveal"><div class="stat__art">${STAT_ART.pyr}</div><div class="stat__txt"><b data-count="9">9</b><span>${t('stat.pyramid')}</span></div></li>
      <li class="stat stat--pool reveal"><div class="stat__art">${STAT_ART.pool}</div><div class="stat__txt"><b data-count="6">6</b><span>${t('stat.pool')}</span></div></li>
      <li class="stat stat--tt reveal"><div class="stat__art">${STAT_ART.tt}</div><div class="stat__txt"><b data-count="1">1</b><span>${t('stat.tt')}</span></div></li>
      <li class="stat stat--park reveal"><div class="stat__art">${STAT_ART.park}</div><div class="stat__txt"><strong class="stat__big">${t('stat.park')}</strong></div></li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sectionHead('home.games.eyebrow', 'home.games.h', 'home.games.p')}
    <div class="duo">
      <a class="tile-xl reveal" href="galdi.html">
        <div class="tile-xl__body"><span class="chip">${t('pyr.count')}</span>${el('h3', 'pyr.h')}${el('p', 'pyr.p')}<span class="tlink">${t('cta.more')}${ICON.chev}</span></div>
        ${ph('home.pyramid', 'tile-xl__img')}
      </a>
      <a class="tile-xl reveal" href="galdi.html">
        <div class="tile-xl__body"><span class="chip">${t('pool.count')}</span>${el('h3', 'pool.h')}${el('p', 'pool.p')}<span class="tlink">${t('cta.more')}${ICON.chev}</span></div>
        ${ph('home.pool', 'tile-xl__img')}
      </a>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    ${sectionHead('home.sections.eyebrow', 'home.sections.h', '', rowControls)}
  </div>
  <div class="row" data-row>
    ${posterCard('zale.html', 'nav.hall', 'tile.hall.p', 'home.hall')}
    ${posterCard('turniri.html', 'nav.tournaments', 'tile.tournaments.p', 'home.tournaments')}
    ${posterCard('skola.html', 'nav.school', 'tile.school.p', 'home.school')}
    ${posterCard('veikals.html', 'nav.shop', 'tile.shop.p', 'home.shop')}
  </div>
</section>

<section class="section">
  <div class="container">
    ${sectionHead('home.steps.eyebrow', 'home.steps.h')}
    ${steps([['step.1.h', 'step.1.p'], ['step.2.h', 'step.2.p'], ['step.3.h', 'step.3.p']])}
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    ${sectionHead('home.news.eyebrow', 'home.news.h', '', rowControls)}
  </div>
  <div class="row row--news" data-row id="news-row">
    ${newsItems.map(newsCard).join('')}
  </div>
  <p class="center reveal">${textLink('jaunumi.html', 'cta.all_news')}</p>
</section>

${ctaBand('home.cta.h', 'home.cta.p', btn(SITE.map, 'cta.route', 'ghost', ICON.ext))}
`,
});

pages.push({
  id: 'tables', file: 'galdi.html',
  body: () => `
${pageHero('tables.eyebrow', 'tables.h1', 'tables.lead', { photo: 'tables.hero' })}

<section class="section section--tint">
  <div class="container">
    <div class="duo duo--cards">
      ${[['pyr', 72, 68, 'spec.12ft', '94'], ['pool', 115, 57, 'spec.9ft', '50']].map(([k, pk, bl, tb, pct]) => `
      <article class="spec-card reveal">
        <div class="spec-card__top">
          <span class="chip">${t(k + '.count')}</span>
          ${el('h2', k + '.h', 'display display--md')}
          ${el('p', k + '.p')}
        </div>
        <div class="spec-card__fig">${pocketDiagram(pk, bl)}</div>
        <p class="big-pct"><b>${pct}%</b>${t(k + '.fill')}</p>
        <dl class="specs">
          <div><dt>${t('spec.table')}</dt><dd>${t(tb)}</dd></div>
          <div><dt>${t('spec.ball')}</dt><dd>${bl} ${t('unit.mm')}</dd></div>
          <div><dt>${t('spec.pocket')}</dt><dd>${pk === 72 ? t('spec.about72') : t('spec.about115')}</dd></div>
        </dl>
      </article>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container split">
    <div class="reveal">
      ${el('p', 'tt.eyebrow', 'eyebrow')}
      ${el('h2', 'tt.h', 'h2')}
      ${el('p', 'tt.p', 'lead')}
    </div>
    <div class="reveal">${ph('tables.tt', 'photo-card')}</div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    ${sectionHead('', 'book.h', 'book.p')}
    ${steps([['step.1.h', 'step.1.p'], ['step.2.h', 'step.2.p'], ['step.3.h', 'step.3.p']])}
  </div>
</section>

<section class="section">
  <div class="container narrow">
    ${sectionHead('faq.eyebrow', 'faq.h')}
    ${faq(4)}
  </div>
</section>
${ctaBand('home.cta.h', 'home.cta.p', btn(SITE.map, 'cta.route', 'ghost', ICON.ext))}`,
});

pages.push({
  id: 'hall', file: 'zale.html',
  body: () => `
${pageHero('hall.eyebrow', 'hall.h1', 'hall.lead')}
<section class="section section--flush">
  <div class="container">
    <div class="mosaic">
      ${[1, 2, 3, 4, 5, 6].map((i) => `<figure class="mosaic__i mosaic__i--${i} reveal">${ph('hall.' + i, 'mosaic__img', lv('hall.photo'), 'data-i18n-alt="hall.photo"')}</figure>`).join('')}
    </div>
  </div>
</section>
${ctaBand('hall.cta.h', 'hall.cta.p', btn('galdi.html', 'nav.tables', 'ghost', ICON.arrow))}`,
});

pages.push({
  id: 'tournaments', file: 'turniri.html',
  body: () => `
${pageHero('tour.eyebrow', 'tour.h1', 'tour.lead', { actions: btn(SITE.tournaments, 'tour.open', 'primary', ICON.ext), photo: 'tournaments.hero' })}
<section class="section">
  <div class="container narrow-xl">
    <ul class="lines" id="tournaments">
      ${[1, 2, 3].map((i) => `
      <li class="line reveal"><span class="line__n">0${i}</span><div><span class="chip">${lv('tour.' + i + '.tag') && t('tour.' + i + '.tag')}</span>${el('h2', 'tour.' + i + '.h', 'h3')}${el('p', 'tour.' + i + '.p')}</div></li>`).join('')}
    </ul>
  </div>
</section>
<section class="section section--tint">
  <div class="container">
    ${sectionHead('', 'tour.how.h')}
    ${steps([['tour.s1.h', 'tour.s1.p'], ['tour.s2.h', 'tour.s2.p'], ['tour.s3.h', 'tour.s3.p']])}
    <p class="center reveal">${btn(SITE.tournaments, 'tour.open', 'primary', ICON.ext)}</p>
  </div>
</section>
${ctaBand('home.cta.h', 'home.cta.p', btn(SITE.map, 'cta.route', 'ghost', ICON.ext))}`,
});

pages.push({
  id: 'school', file: 'skola.html',
  body: () => `
${pageHero('school.eyebrow', 'school.h1', 'school.lead', { actions: btn('mailto:' + SITE.email, 'school.apply', 'primary', ICON.mail), photo: 'school.hero' })}
<section class="section">
  <div class="container">
    <div class="trio trio--4">
      ${[1, 2, 3, 4].map((i) => `<article class="trio__i reveal"><span class="step__n">0${i}</span>${el('h2', 'school.l' + i + '.h', 'h3')}${el('p', 'school.l' + i + '.p')}</article>`).join('')}
    </div>
  </div>
</section>
<section class="section section--tint">
  <div class="container">
    ${sectionHead('', 'school.skills.h')}
    <ul class="skills">${[1, 2, 3, 4].map((i) => `<li class="reveal"><span>0${i}</span>${t('school.sk' + i)}</li>`).join('')}</ul>
  </div>
</section>
${ctaBand('school.cta.h', 'school.cta.p', btn('mailto:' + SITE.email, 'cta.write', 'ghost', ICON.mail))}`,
});

pages.push({
  id: 'shop', file: 'veikals.html',
  body: () => {
    const items = PRODUCTS;
    return `
${pageHero('shop.eyebrow', 'shop.h1', 'shop.lead')}
<section class="section section--flush">
  <div class="container">
    <div class="products" id="products">
      ${items.map(([k, ic, photo]) => `
      <article class="pcard reveal">
        <div class="pcard__img"><span class="pcard__icon">${SHOP_ICON[ic]}</span>${ph(photo, 'pcard__ph')}</div>
        ${el('h2', 'shop.' + k + '.h', 'h3')}
        ${el('p', 'shop.' + k + '.p')}
        <a class="tlink" href="tel:${SITE.tel}">${t('cta.order')}${ICON.chev}</a>
      </article>`).join('')}
    </div>
    ${el('p', 'shop.extra', 'note reveal')}
    ${el('p', 'shop.note', 'note reveal')}
  </div>
</section>
<section class="section section--tint">
  <div class="container">
    ${sectionHead('', 'shop.how.h')}
    ${steps([[null, 'shop.how1'], [null, 'shop.how2'], [null, 'shop.how3']])}
    <p class="center reveal">${btn('tel:' + SITE.tel, 'cta.call', 'primary', ICON.phone)}${btn('mailto:' + SITE.email, 'cta.write', 'ghost', ICON.mail)}</p>
  </div>
</section>`;
  },
});

const priceGroup = (g) => `
<article class="pgroup${g.vip ? ' pgroup--vip' : ''} reveal">
  <header>${el('h2', g.title, 'h3')}${el('p', g.note, 'pgroup__note')}</header>
  <ul class="prows"><li><span class="prows__l" data-i18n="prices.hour">${lv('prices.hour')}</span><span class="prows__p"><em data-i18n="prices.on_request">${lv('prices.on_request')}</em></span></li></ul>
</article>`;

pages.push({
  id: 'prices', file: 'cenas.html',
  body: () => `
${pageHero('prices.eyebrow', 'prices.h1', 'prices.lead')}
<section class="section section--flush">
  <div class="container">
    <div class="pgroups" id="price-groups">${PRICE_DEFAULTS.map(priceGroup).join('')}</div>
    ${el('p', 'prices.note', 'note reveal')}
  </div>
</section>
${ctaBand('home.cta.h', 'home.cta.p', btn('galdi.html', 'nav.tables', 'ghost', ICON.arrow))}`,
});

const galleryItem = (src, cat) => `<figure class="g-item reveal" data-cat="${cat}"><button type="button" class="g-btn">${img(src, '')}</button></figure>`;

pages.push({
  id: 'gallery', file: 'galerija.html',
  body: () => `
${pageHero('gallery.eyebrow', 'gallery.h1', 'gallery.lead')}
<section class="section section--flush">
  <div class="container">
    <div class="fchips reveal" role="group">
      <button type="button" class="fchip is-on" data-filter="all" data-i18n="gallery.all">${lv('gallery.all')}</button>
      <button type="button" class="fchip" data-filter="club" data-i18n="gallery.club">${lv('gallery.club')}</button>
      <button type="button" class="fchip" data-filter="tournaments" data-i18n="gallery.tournaments">${lv('gallery.tournaments')}</button>
    </div>
    <div class="gallery" id="gallery">${[1, 2, 3, 4, 5, 6].map((i) => galleryItem(photoSrc('club-' + i), 'club')).join('')}</div>
    ${el('p', 'gallery.empty', 'note', 'hidden')}
  </div>
</section>
${ctaBand('hall.cta.h', 'hall.cta.p', btn('galdi.html', 'nav.tables', 'ghost', ICON.arrow))}`,
});


// ---- rules page (static defaults; admin can override via /api/content)
const escH = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function bodyHtml(text) {
  const out = []; let list = null;
  String(text || '').split('\n').forEach((ln) => {
    const m = /^\s*[-•]\s+(.*)$/.exec(ln);
    if (m) { (list = list || []).push(m[1]); return; }
    if (list) { out.push('<ul>' + list.map((i) => '<li>' + escH(i) + '</li>').join('') + '</ul>'); list = null; }
    if (ln.trim()) out.push('<p>' + escH(ln.trim()) + '</p>');
  });
  if (list) out.push('<ul>' + list.map((i) => '<li>' + escH(i) + '</li>').join('') + '</ul>');
  return out.join('');
}
RULES.forEach((r) => {
  D['rules.' + r.id + '.h'] = [r.title.lv, r.title.ru, r.title.en];
  D['rules.' + r.id + '.b'] = [bodyHtml(r.body.lv), bodyHtml(r.body.ru), bodyHtml(r.body.en)];
});
const ruleShown = RULES.filter((r) => r.body.lv || r.body.ru || r.body.en || r.link);

pages.push({
  id: 'rules', file: 'noteikumi.html',
  body: () => `
${pageHero('rules.eyebrow', 'rules.h1', 'rules.lead')}
<section class="section section--flush">
  <div class="container narrow-xl">
    <nav class="fchips" id="rules-nav" aria-label="${escH(lv('nav.rules'))}">${ruleShown.map((r) => `<a class="fchip" href="#r-${r.id}" data-i18n="rules.${r.id}.h">${lv('rules.' + r.id + '.h')}</a>`).join('')}</nav>
    <div class="rules" id="rules-list">${ruleShown.map((r) => `
      <article class="rule reveal" id="r-${r.id}"><h2 class="h3" data-i18n="rules.${r.id}.h">${lv('rules.' + r.id + '.h')}</h2><div class="rule__b" data-i18n="rules.${r.id}.b">${lv('rules.' + r.id + '.b')}</div></article>`).join('')}
    </div>
  </div>
</section>
${ctaBand('rules.cta.h', 'rules.cta.p', btn('turniri.html', 'nav.tournaments', 'ghost', ICON.arrow))}`,
});

pages.push({
  id: 'news', file: 'jaunumi.html',
  body: () => `
${pageHero('news.eyebrow', 'news.h1', 'news.lead')}
<section class="section section--flush">
  <div class="container">
    <div class="ngrid" id="news-grid">${newsItems.map(newsCard).join('')}</div>
  </div>
</section>
${ctaBand('home.cta.h', 'home.cta.p', btn('galdi.html', 'nav.tables', 'ghost', ICON.arrow))}`,
});

pages.push({
  id: 'contacts', file: 'kontakti.html',
  body: () => `
${pageHero('contacts.eyebrow', 'contacts.h1', 'contacts.lead')}
<section class="section section--flush">
  <div class="container">
    <a class="bigphone reveal" href="tel:${SITE.tel}">${SITE.phone}</a>
    <div class="infos">
      <div class="info reveal">${ICON.pin}<div><h2 data-i18n="contacts.addr">${lv('contacts.addr')}</h2><a href="${SITE.map}" target="_blank" rel="noopener">${SITE.street}<br>${SITE.city}, ${SITE.zip}</a></div></div>
      <div class="info reveal">${ICON.mail}<div><h2 data-i18n="contacts.email">${lv('contacts.email')}</h2><a href="mailto:${SITE.email}">${SITE.email}</a></div></div>
      <div class="info reveal">${ICON.car}<div><h2 data-i18n="contacts.parking">${lv('contacts.parking')}</h2><p data-i18n="contacts.parking_v">${lv('contacts.parking_v')}</p></div></div>
      <div class="info reveal">${ICON.clock}<div><h2 data-i18n="contacts.hours">${lv('contacts.hours')}</h2><p data-i18n="contacts.hours_v">${lv('contacts.hours_v')}</p></div></div>
    </div>
    <div class="map reveal" data-map="${SITE.mapEmbed}" data-title="${lv('contacts.map')}"><div class="map__ph"><p data-i18n="cc.map">${lv('cc.map')}</p><div class="map__act"><button type="button" class="btn btn--primary" data-map-load data-i18n="cc.mapyes">${lv('cc.mapyes')}</button><a class="btn btn--ghost" href="${SITE.mapLink || 'https://maps.app.goo.gl/ugoQrowSYuxNYjnA7'}" target="_blank" rel="noopener" data-i18n="cc.maplink">${lv('cc.maplink')}</a></div></div></div>
    <p class="center reveal">${btn('tel:' + SITE.tel, 'cta.call', 'primary', ICON.phone)}${btn(SITE.map, 'cta.route', 'ghost', ICON.ext)}</p>
  </div>
</section>
<section class="section section--tint">
  <div class="container narrow">
    ${sectionHead('faq.eyebrow', 'faq.h')}
    ${faq(4)}
  </div>
</section>`,
});

pages.push({
  id: 'privacy', file: 'privatums.html',
  body: () => `
${pageHero('foot.privacy', 'priv.h1', 'priv.lead')}
<section class="section section--flush">
  <div class="container narrow prose">
    ${[1, 2, 3, 4].map((i) => `<div class="reveal">${el('h2', 'priv.' + i + '.h', 'h3')}${el('p', 'priv.' + i + '.p')}</div>`).join('')}
  </div>
</section>`,
});

// ------------------------------------------------------------------ build
function write(p, content) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
for (const p of pages) write(path.join(OUT, p.file), shell(p, p.body()));

write(path.join(OUT, '404.html'), shell(
  { id: 'index', file: '404.html' },
  `<section class="phero"><div class="container phero__in">${el('h1', 'nf.h', 'display')}${el('p', 'nf.p', 'lead')}<p>${btn('index.html', 'nf.back', 'primary', ICON.arrow)}</p></div></section>`
).replace('<meta name="description"', '<meta name="robots" content="noindex"><meta name="description"'));

const tri3 = (k) => ({ lv: D[k][0], ru: D[k][1], en: D[k][2] });
const NEWS_DATES = { n1: '2026-10-05', n2: '2026-09-28', n3: '2026-09-15', n4: '2026-09-01', n5: '2026-08-20' };
const TOUR_DEF = [1, 2, 3].map((i) => ({ id: 'tr' + i, date: '', time: '', title: tri3('tour.' + i + '.h'), info: tri3('tour.' + i + '.p'), link: '' }));
const defaults = {
  tel: SITE.tel,
  news: newsItems.map(([id, tag, photo]) => ({ id, date: NEWS_DATES[id], cat: tag, title: tri3(id + '.h'), text: tri3(id + '.p'), img: photoSrc(photo) })),
  tournaments: TOUR_DEF,
  rules: RULES.map((r) => ({ id: r.id, title: r.title, body: r.body, link: r.link })),
  slots: SLOTS.map(([key, label]) => ({ key, label, img: SLOT_DEF[key] ? photoSrc(key) : '' })),
  products: PRODUCTS.map(([k, , photo]) => ({ id: k, name: tri3('shop.' + k + '.h'), desc: tri3('shop.' + k + '.p'), price: '', img: photoSrc(photo) })),
  prices: { groups: PRICE_DEFAULTS.map((g) => ({ id: g.id, vip: g.vip, title: tri3(g.title), note: tri3(g.note), rows: [{ id: g.id + '-r1', label: tri3('prices.hour'), price: '', unit: { lv: '', ru: '', en: '' } }] })) },
};
write(path.join(OUT, 'assets/js/defaults.js'), 'window.BB_DEFAULTS=' + JSON.stringify(defaults) + ';\n');

const langs = ['lv', 'ru', 'en'];
const payload = { lv: {}, ru: {}, en: {} };
Object.keys(D).forEach((k) => langs.forEach((l, i) => (payload[l][k] = D[k][i])));
write(path.join(OUT, 'assets/js/i18n-data.js'), 'window.I18N=' + JSON.stringify(payload) + ';\n');

if (SITE.url) {
  write(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${SITE.url}/${p.file === 'index.html' ? '' : p.file}</loc></url>`).join('\n')}\n</urlset>\n`);
  write(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);
}
console.log(`Built ${pages.length + 1} pages -> ${OUT}`);
