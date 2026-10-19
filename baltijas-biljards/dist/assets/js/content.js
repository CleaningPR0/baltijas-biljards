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

  /* ---------- wiring ---------- */
  function renderAll() { renderProducts(); renderPrices(); renderGallery(); }
  BB.renderAll = renderAll;
  document.addEventListener('langchange', renderAll);
  BB.apply = function (c) {
    BB.content = c || {};
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
