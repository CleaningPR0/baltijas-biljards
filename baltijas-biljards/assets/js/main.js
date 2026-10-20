(function () {
  'use strict';
  var doc = document.documentElement;
  var I18N = window.I18N || {};
  var STORE = 'bb-lang';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BB = window.BB = window.BB || {};
  BB.lang = 'lv';

  function safeGet() { try { return localStorage.getItem(STORE); } catch (e) { return null; } }
  function safeSet(v) { try { localStorage.setItem(STORE, v); } catch (e) { /* ignore */ } }

  /* ---------- scroll-lit statement ---------- */
  var statements = [];
  function splitStatements() {
    statements = [];
    document.querySelectorAll('.statement').forEach(function (el) {
      var text = el.textContent.trim();
      el.setAttribute('aria-label', text);
      el.innerHTML = text.split(/\s+/).map(function (w) { return '<span class="w" aria-hidden="true">' + w + '</span>'; }).join(' ');
      statements.push({ el: el, words: el.querySelectorAll('.w') });
    });
    updateStatements();
  }
  function updateStatements() {
    var vh = window.innerHeight;
    statements.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      var p = (vh * 0.88 - r.top) / (vh * 0.55 + r.height);
      p = Math.max(0, Math.min(1, p));
      var n = Math.round(p * s.words.length * 1.05);
      s.words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
    });
  }

  /* ---------- language ---------- */
  function applyLang(lang) {
    var dict = I18N[lang];
    if (!dict) return;
    doc.lang = lang;
    BB.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      var k = n.getAttribute('data-i18n');
      if (dict[k] != null) n.innerHTML = dict[k];
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (n) {
      var k = n.getAttribute('data-i18n-alt');
      if (dict[k] != null) n.setAttribute('alt', dict[k]);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (n) {
      var k = n.getAttribute('data-i18n-aria');
      if (dict[k] != null) n.setAttribute('aria-label', dict[k]);
    });
    var page = doc.getAttribute('data-page');
    if (dict['meta.' + page + '.title'] && !/404/.test(location.pathname)) document.title = dict['meta.' + page + '.title'];
    var md = document.querySelector('meta[name="description"]');
    if (md && dict['meta.' + page + '.desc']) md.setAttribute('content', dict['meta.' + page + '.desc']);
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    splitStatements();
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  BB.applyLang = applyLang;
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      var l = b.getAttribute('data-lang');
      safeSet(l);
      applyLang(l);
    });
  });
  var saved = safeGet();
  if (saved && saved !== 'lv' && I18N[saved]) applyLang(saved); else splitStatements();

  document.querySelectorAll('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

  /* ---------- hidden admin: triple-click on the top-left logo ---------- */
  (function () {
    var trigger = document.querySelector('[data-admin-trigger]');
    if (!trigger) return;
    var count = 0, timer = null, loading = false;
    function load(cb) {
      if (window.BBAdmin) return cb();
      if (loading) return;
      loading = true;
      var css = document.createElement('link');
      var v = (document.currentScript && 0) || (function () { var sc = document.querySelector('script[src*="main.js"]'); var q = sc && /\?v=[^&]+/.exec(sc.src); return q ? q[0] : ''; })();
      css.rel = 'stylesheet'; css.href = 'assets/css/admin.css' + v;
      document.head.appendChild(css);
      var s1 = document.createElement('script');
      s1.src = 'assets/js/defaults.js' + v;
      s1.onload = function () {
        var s2 = document.createElement('script');
        s2.src = 'assets/js/admin.js' + v;
        s2.onload = function () { loading = false; cb(); };
        document.body.appendChild(s2);
      };
      document.body.appendChild(s1);
    }
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      count++;
      clearTimeout(timer);
      if (count >= 3) {
        count = 0;
        load(function () { window.BBAdmin.open(); });
        return;
      }
      // a normal click still goes home — after a short pause that leaves room for the 2nd/3rd click
      timer = setTimeout(function () {
        var n = count; count = 0;
        if (n > 0) location.href = trigger.getAttribute('href');
      }, 380);
    });
  })();

  /* ---------- header + menu ---------- */
  var header = document.querySelector('.site-header');
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('nav');
  function setMenu(open) {
    if (!burger || !nav) return;
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 960) setMenu(false); });
  }

  /* ---------- hero frame grow + parallax ---------- */
  var frame = document.querySelector('[data-frame]');
  var para = document.querySelector('[data-parallax]');
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (frame && !reduce) {
      var r = frame.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.75)));
      frame.style.setProperty('--p', p.toFixed(3));
      if (para) para.style.transform = 'scale(1.08) translateY(' + ((p - 0.5) * -26).toFixed(1) + 'px)';
    }
    updateStatements();
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { onScroll(); ticking = false; }); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- reveal ---------- */
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduce) {
    items.forEach(function (n) { n.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.nums, .steps, .trio, .skills, .products, .ngrid, .infos, .mosaic, .duo').forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--d', (i * 0.09).toFixed(2) + 's'); });
    });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------- count-up ---------- */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, to = parseInt(el.getAttribute('data-count'), 10), t0 = null;
        co.unobserve(el);
        function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / 1400);
          el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
        }
        el.textContent = '0';
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { co.observe(c); });
  }

  /* ---------- horizontal rows ---------- */
  document.querySelectorAll('[data-row]').forEach(function (row) {
    var section = row.closest('section');
    var btns = section ? section.querySelectorAll('.row-btn') : [];
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = parseInt(b.getAttribute('data-dir'), 10);
        var card = row.firstElementChild;
        var w = card ? card.getBoundingClientRect().width + 18 : 400;
        row.scrollBy({ left: dir * w, behavior: 'smooth' });
      });
    });
  });
})();
