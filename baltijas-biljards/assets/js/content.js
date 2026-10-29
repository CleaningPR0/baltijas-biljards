/* Public content layer: pulls admin-managed content from /api/content and applies it.
   If the API is unreachable (static hosting, file://), the built-in defaults simply stay. */
(function () {
  'use strict';
  var BB = window.BB = window.BB || {};
  var I18N = window.I18N || {};
  BB.content = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pick(obj, lang) { return (obj && (obj[lang] || obj.lv)) || ''; }
  function tr(key) { var d = I18N[BB.lang] || I18N.lv || {}; return d[key] != null ? d[key] : ''; }
  function telHref() { var a = document.querySelector('a[href^="tel:"]'); return a ? a.getAttribute('href') : 'tel:'; }
  function money(v) {
    v = String(v || '').trim();
    if (!v) return '';
    return /^\d+([.,]\d{1,2})?$/.test(v) ? v.replace('.', ',') + ' €' : v;
  }
  BB.esc = esc; BB.pick = pick;

  /* ---------- photos & logo ---------- */
  function applySlots(slots) {
    document.querySelectorAll('[data-slot]').forEach(function (box) {
      var url = slots && slots[box.getAttribute('data-slot')];
      if (!url) return;
      var im = box.querySelector('img');
      if (!im) {
        im = document.createElement('img');
        im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
        box.appendChild(im);
        box.classList.remove('is-empty');
      }
      im.removeAttribute('onerror');
      im.src = url;
    });
    if (slots && slots.logo) document.querySelectorAll('.brand__logo, [data-medal-logo]').forEach(function (i) { i.src = slots.logo; });
    var logo = document.querySelector('[data-logo]');
    if (logo && slots && slots.logo) {
      logo.classList.add('hero-logo--img');
      logo.innerHTML = '<img src="' + esc(slots.logo) + '" alt="' + esc(tr('logo.alt')) + '" decoding="async">';
    }
  }

  /* ---------- opening hours ---------- */
  function applyHours(h) {
    if (!h) return;
    ['lv', 'ru', 'en'].forEach(function (l) {
      var txt = (h[l] || h.lv || '').trim();
      if (!txt || !I18N[l]) return;
      var html = esc(txt).replace(/\n/g, '<br>');
      I18N[l]['foot.hours_value'] = html;
      I18N[l]['contacts.hours_v'] = html;
    });
    if (BB.applyLang) BB.applyLang(BB.lang);
  }

  /* ---------- shop ---------- */
  var BALL_ICON = '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="22" fill="#e8e8ed"/><circle cx="40" cy="40" r="9" fill="#fff"/></svg>';
  function renderProducts() {
    var box = document.getElementById('products');
    var list = BB.content && BB.content.products;
    if (!box || !Array.isArray(list)) return;
    var empty = document.getElementById('products-empty');
    if (!list.length) {
      box.innerHTML = '';
      if (!empty) {
        empty = document.createElement('p');
        empty.id = 'products-empty'; empty.className = 'note';
        box.parentNode.insertBefore(empty, box.nextSibling);
      }
      empty.setAttribute('data-i18n', 'shop.empty');
      empty.textContent = tr('shop.empty');
      return;
    }
    if (empty) empty.remove();
    var tel = telHref();
    box.innerHTML = list.map(function (p) {
      var price = money(p.price);
      return '<article class="pcard reveal is-in">' +
        '<div class="pcard__img">' + (p.img ? '' : '<span class="pcard__icon">' + BALL_ICON + '</span>') +
        (p.img ? '<div class="ph pcard__ph"><img src="' + esc(p.img) + '" alt="' + esc(pick(p.name, BB.lang)) + '" loading="lazy" decoding="async" onerror="this.parentNode.classList.add(\'is-empty\');this.remove()"></div>' : '') +
        '</div>' +
        '<h2 class="h3">' + esc(pick(p.name, BB.lang)) + '</h2>' +
        (pick(p.desc, BB.lang) ? '<p>' + esc(pick(p.desc, BB.lang)).replace(/\n/g, '<br>') + '</p>' : '') +
        (price ? '<p class="pcard__price">' + esc(price) + '</p>' : '') +
        '<a class="tlink" href="' + esc(tel) + '">' + esc(tr('cta.order')) + '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
        '</article>';
    }).join('');
  }

  /* ---------- price list ---------- */
  function renderPrices() {
    var box = document.getElementById('price-groups');
    var data = BB.content && BB.content.prices;
    if (!box || !data || !Array.isArray(data.groups)) return;
    box.innerHTML = data.groups.map(function (g) {
      var rows = (g.rows || []).map(function (r) {
        var price = money(r.price);
        var unit = pick(r.unit, BB.lang);
        return '<li><span class="prows__l">' + esc(pick(r.label, BB.lang)) + '</span><span class="prows__p">' +
          (price ? '<b>' + esc(price) + '</b>' + (unit ? '<small>' + esc(unit) + '</small>' : '') : '<em>' + esc(tr('prices.on_request')) + '</em>') +
          '</span></li>';
      }).join('');
      return '<article class="pgroup' + (g.vip ? ' pgroup--vip' : '') + ' reveal is-in"><header><h2 class="h3">' + esc(pick(g.title, BB.lang)) + '</h2>' +
        (pick(g.note, BB.lang) ? '<p class="pgroup__note">' + esc(pick(g.note, BB.lang)) + '</p>' : '') + '</header><ul class="prows">' + rows + '</ul></article>';
    }).join('');
  }

  /* ---------- gallery + lightbox ---------- */
  var gFilter = 'all';
  function renderGallery() {
    var box = document.getElementById('gallery');
    if (!box) return;
    var list = BB.content && Array.isArray(BB.content.gallery) && BB.content.gallery.length ? BB.content.gallery : null;
    if (list) {
      box.innerHTML = list.map(function (g) {
        var cap = pick(g.cap, BB.lang);
        return '<figure class="g-item reveal is-in" data-cat="' + esc(g.cat) + '"><button type="button" class="g-btn" data-cap="' + esc(cap) + '">' +
          '<img src="' + esc(g.img) + '" alt="' + esc(cap) + '" loading="lazy" decoding="async" onerror="this.parentNode.classList.add(\'is-empty\');this.remove()"></button></figure>';
      }).join('');
    }
    applyFilter();
  }
  function applyFilter() {
    var box = document.getElementById('gallery');
    if (!box) return;
    var shown = 0;
    box.querySelectorAll('.g-item').forEach(function (f) {
      var on = gFilter === 'all' || f.getAttribute('data-cat') === gFilter;
      f.hidden = !on;
      if (on) shown++;
    });
    document.querySelectorAll('.fchip').forEach(function (c) { c.classList.toggle('is-on', c.getAttribute('data-filter') === gFilter); });
    var empty = document.querySelector('[data-i18n="gallery.empty"]');
    if (empty) empty.hidden = shown > 0;
  }
  document.querySelectorAll('.fchip').forEach(function (c) {
    c.addEventListener('click', function () { gFilter = c.getAttribute('data-filter'); applyFilter(); });
  });

  var lb = null, lbIdx = 0, lbList = [];
  function lbShow(i) {
    lbIdx = (i + lbList.length) % lbList.length;
    var b = lbList[lbIdx];
    lb.querySelector('img').src = b.querySelector('img') ? b.querySelector('img').src : '';
    lb.querySelector('figcaption').textContent = b.getAttribute('data-cap') || '';
  }
  function lbClose() { if (lb) { lb.remove(); lb = null; document.body.classList.remove('lb-open'); } }
  function lbOpen(btn) {
    lbList = Array.prototype.filter.call(document.querySelectorAll('#gallery .g-item'), function (f) { return !f.hidden; })
      .map(function (f) { return f.querySelector('.g-btn'); }).filter(Boolean);
    lbIdx = lbList.indexOf(btn);
    if (lbIdx < 0) return;
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<button type="button" class="lightbox__x" aria-label="' + esc(tr('gallery.close')) + '">×</button>' +
      '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="←">‹</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lightbox__nav lightbox__nav--next" aria-label="→">›</button>';
    document.body.appendChild(lb);
    document.body.classList.add('lb-open');
    lbShow(lbIdx);
    lb.addEventListener('click', function (e) {
      if (e.target.closest('.lightbox__x') || e.target === lb) lbClose();
      else if (e.target.closest('.lightbox__nav--prev')) lbShow(lbIdx - 1);
      else if (e.target.closest('.lightbox__nav--next')) lbShow(lbIdx + 1);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#gallery .g-btn');
    if (b) lbOpen(b);
  });
  document.addEventListener('keydown', function (e) {
    if (!lb) return;
    if (e.key === 'Escape') lbClose();
    else if (e.key === 'ArrowLeft') lbShow(lbIdx - 1);
    else if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
  });


  /* ---------- shared text helpers ---------- */
  var LOC = { lv: 'lv-LV', ru: 'ru-RU', en: 'en-GB' };
  function parseDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(v + 'T12:00:00') : null; }
  function fmtDate(v) {
    var d = parseDate(v);
    return d ? d.toLocaleDateString(LOC[BB.lang] || 'lv-LV', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  }
  function bodyHtml(text) {
    var out = [], list = null;
    String(text || '').split('\n').forEach(function (ln) {
      var m = /^\s*[-•]\s+(.*)$/.exec(ln);
      if (m) { (list = list || []).push(m[1]); return; }
      if (list) { out.push('<ul>' + list.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>'); list = null; }
      if (ln.trim()) out.push('<p>' + esc(ln.trim()) + '</p>');
    });
    if (list) out.push('<ul>' + list.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>');
    return out.join('');
  }
  function safeLink(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  var EXT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16L16 8M9 8h7v7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- news ---------- */
  function newsCard(n) {
    var title = pick(n.title, BB.lang), text = pick(n.text, BB.lang), date = fmtDate(n.date);
    return '<article class="ncard reveal is-in">' +
      (n.img ? '<div class="ph ncard__img"><img src="' + esc(n.img) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add(\'is-empty\');this.remove()"></div>' : '') +
      '<div class="ncard__body"><p class="ncard__meta"><span class="chip">' + esc(tr('tag.' + (n.cat || 'club'))) + '</span>' + (date ? '<time>' + esc(date) + '</time>' : '') + '</p>' +
      '<h3>' + esc(title) + '</h3>' + (text ? '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>' : '') + '</div></article>';
  }
  function renderNews() {
    var list = BB.content && BB.content.news;
    if (!Array.isArray(list)) return;
    list = list.slice().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0; });
    var grid = document.getElementById('news-grid'), row = document.getElementById('news-row');
    if (grid) {
      var e = document.getElementById('news-empty');
      grid.innerHTML = list.map(newsCard).join('');
      if (!list.length && !e) { e = document.createElement('p'); e.id = 'news-empty'; e.className = 'note'; grid.parentNode.insertBefore(e, grid.nextSibling); }
      if (e) { if (list.length) e.remove(); else { e.setAttribute('data-i18n', 'news.empty'); e.textContent = tr('news.empty'); } }
    }
    if (row) row.innerHTML = list.slice(0, 6).map(newsCard).join('');
  }

  /* ---------- tournaments ---------- */
  var openTour = {};
  function renderTournaments() {
    var box = document.getElementById('tournaments');
    var list = BB.content && BB.content.tournaments;
    if (!box || !Array.isArray(list)) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var isPast = function (t) { var d = parseDate(t.date); return !!d && d < today; };
    var up = list.filter(function (t) { return !isPast(t); }).sort(function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : 1; });
    var past = list.filter(isPast).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var empty = document.getElementById('tournaments-empty');
    if (!up.length && !past.length) {
      box.innerHTML = '';
      if (!empty) { empty = document.createElement('p'); empty.id = 'tournaments-empty'; empty.className = 'note'; box.parentNode.insertBefore(empty, box.nextSibling); }
      empty.setAttribute('data-i18n', 'tour.empty'); empty.textContent = tr('tour.empty');
      return;
    }
    if (empty) empty.remove();
    box.innerHTML = up.concat(past).map(function (t, n) {
      var d = parseDate(t.date), gone = isPast(t), link = safeLink(t.link), info = pick(t.info, BB.lang);
      var id = 'tour-' + (t.id || n), open = !!openTour[id];
      var big = d ? '<b>' + d.getDate() + '</b><small>' + esc(d.toLocaleDateString(LOC[BB.lang] || 'lv-LV', { month: 'short' }).replace('.', '')) + '</small>' : '<b>•</b>';
      var body = (info ? '<div class="line__info">' + bodyHtml(info) + '</div>' : '') +
        (link ? '<p class="line__act"><a class="btn btn--primary btn--sm" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(tr('tour.register')) + EXT + '</a></p>' : '');
      return '<li class="line tour' + (gone ? ' line--past' : '') + (open ? ' is-open' : '') + ' reveal is-in" data-tid="' + esc(id) + '">' +
        '<h2 class="h3 tour__h"><button type="button" class="tour__head" aria-expanded="' + open + '"' + (body ? ' aria-controls="' + esc(id) + '"' : '') + '>' +
        '<span class="line__n line__n--date">' + big + '</span>' +
        '<span class="tour__main"><span class="chip">' + esc([gone ? tr('tour.past') : '', d ? d.getFullYear() : '', t.time].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="tour__title">' + esc(pick(t.title, BB.lang)) + '</span>' +
        (body ? '<span class="tour__more">' + esc(tr('tour.more')) + '</span>' : '') + '</span>' +
        (body ? '<span class="tour__plus" aria-hidden="true"></span>' : '') + '</button></h2>' +
        (body ? '<div class="tour__body" id="' + esc(id) + '"><div class="tour__inner">' + body + '</div></div>' : '') +
        '</li>';
    }).join('');
    if (!box.getAttribute('data-bound')) {
      box.setAttribute('data-bound', '1');
      box.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.tour__head') : null; if (!btn) return;
        var li = btn.closest('.tour'); if (!li || !li.querySelector('.tour__body')) return;
        var on = !li.classList.contains('is-open');
        li.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', String(on));
        openTour[li.getAttribute('data-tid')] = on;
      });
    }
  }

  /* ---------- rules ---------- */
  function renderRules() {
    var box = document.getElementById('rules-list');
    var list = BB.content && BB.content.rules;
    if (!box || !Array.isArray(list)) return;
    var shown = list.filter(function (r) { return pick(r.body, BB.lang) || r.body && (r.body.lv || r.body.ru || r.body.en) || safeLink(r.link); });
    var nav = document.getElementById('rules-nav');
    if (nav) nav.innerHTML = shown.map(function (r) { return '<a class="fchip" href="#r-' + esc(r.id) + '">' + esc(pick(r.title, BB.lang)) + '</a>'; }).join('');
    box.innerHTML = shown.map(function (r) {
      var link = safeLink(r.link);
      return '<article class="rule reveal is-in" id="r-' + esc(r.id) + '"><h2 class="h3">' + esc(pick(r.title, BB.lang)) + '</h2><div class="rule__b">' + bodyHtml(pick(r.body, BB.lang)) + '</div>' +
        (link ? '<p><a class="tlink" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(tr('rules.doc')) + '</a></p>' : '') + '</article>';
    }).join('') || '<p class="note">' + esc(tr('rules.empty')) + '</p>';
  }

  /* ---------- wiring ---------- */
  function renderAll() { renderProducts(); renderPrices(); renderGallery(); renderNews(); renderTournaments(); renderRules(); }
  /* ---------- wording migration: texts saved earlier in the admin get the current wording ---------- */
  var LEGACY = [
    ['Русский бильярд (пирамида): свободная, комбинированная, московская и динамичная пирамида.', 'Пирамида: свободная, комбинированная и динамичная пирамида, а также многоборье.'],
    ['Krievu biljards (piramīda): brīvā, kombinētā, moskviešu un dinamiskā piramīda.', 'Piramīda: brīvā, kombinētā un dinamiskā piramīda, kā arī daudzcīņa.'],
    ['Russian billiards (pyramid): free, combined, Moscow and dynamic pyramid.', 'Pyramid: free, combined and dynamic pyramid, plus the all-around (multi-discipline) event.'],
    ['(свободная, комбинированная, московская, динамичная)', '(свободная, комбинированная, динамичная, многоборье)'],
    ['(brīvā, kombinētā, moskviešu, dinamiskā)', '(brīvā, kombinētā, dinamiskā, daudzcīņa)'],
    ['(free, combined, Moscow, dynamic)', '(free, combined, dynamic, all-around)'],
    ['Русский бильярд (пирамида)', 'Пирамида'], ['Krievu biljards (piramīda)', 'Piramīda'], ['Russian billiards (pyramid)', 'Pyramid'],
    ['для русского бильярда', 'для пирамиды'], ['по русскому бильярду', 'по пирамиде'], ['Русский бильярд', 'Пирамида'], ['русский бильярд', 'пирамида'],
    ['krievu biljardam', 'piramīdai'], ['krievu biljardā', 'piramīdā'], ['Krievu biljards', 'Piramīda'], ['krievu biljards', 'piramīda'],
    ['Russian billiards', 'Pyramid'], ['russian billiards', 'pyramid']
  ];
  function fixText(s) { for (var i = 0; i < LEGACY.length; i++) { if (s.indexOf(LEGACY[i][0]) !== -1) s = s.split(LEGACY[i][0]).join(LEGACY[i][1]); } return s; }
  function migrate(v, key) {
    if (typeof v === 'string') return key === 'slots' ? v : fixText(v);
    if (Array.isArray(v)) return v.map(function (x) { return migrate(x, key); });
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = k === 'slots' || k === 'link' || k === 'linkUrl' || k === 'img' || k === 'src' ? v[k] : migrate(v[k], k); }); return o; }
    return v;
  }
  BB.migrate = function (c) { return c && typeof c === 'object' ? migrate(c, '') : c; };

  BB.renderAll = renderAll;
  document.addEventListener('langchange', renderAll);
  BB.apply = function (c) {
    BB.content = BB.migrate(c || {});
    applySlots(BB.content.slots);
    applyHours(BB.content.hours);
    renderAll();
  };

  if (!/^https?:$/.test(location.protocol) || !window.fetch) return;
  fetch('/api/content', { headers: { accept: 'application/json' }, cache: 'no-cache' })
    .then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null; })
    .then(function (c) { if (c && typeof c === 'object') BB.apply(c); })
    .catch(function () { /* defaults stay */ });
})();
