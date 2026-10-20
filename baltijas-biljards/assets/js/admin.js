/* Hidden admin panel — loaded only after a triple-click on the logo.
   Real protection is on the server (login check + signed token); this file holds no credentials. */
(function () {
  'use strict';
  if (window.BBAdmin) return;

  var D = window.BB_DEFAULTS || { slots: [], products: [], prices: { groups: [] }, tel: '' };
  var TOKEN_KEY = 'bb-admin-token';
  var LANGS = [['lv', 'LV'], ['ru', 'RU'], ['en', 'EN']];

  var token = null, content = { rev: 0 }, root = null, mainEl = null, statusEl = null, overlay = null;
  var tab = 'photos', editLang = 'lv', galCat = 'club';
  var saveTimer = null, saving = false, again = false, pendingDeletes = [];

  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }

  /* ---------- tiny DOM helper ---------- */
  function append(el, c) {
    if (arguments.length > 2) { for (var i = 1; i < arguments.length; i++) append(el, arguments[i]); return; }
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var pick = function (o, l) { return (o && (o[l] || o.lv)) || ''; };
  var rid = function (p) { return (p || 'x') + Math.random().toString(36).slice(2, 9); };

  /* ---------- API ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('/api' + path, Object.assign({}, opts, { headers: headers })).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.status === 401 && token && path !== '/login') {
          logout();
          showLogin('Сессия истекла — войдите снова.');
          throw new Error('unauthorized');
        }
        if (!res.ok) {
          var err = new Error((data && data.error) || 'http_' + res.status);
          err.status = res.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  function logout() {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- image processing + upload ---------- */
  function loadImg(file) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = URL.createObjectURL(file);
    });
  }
  async function prepImage(file, o) {
    o = o || {};
    var maxSide = o.maxSide || 2000, bmp;
    try { bmp = await createImageBitmap(file); } catch (e) {
      try { bmp = await loadImg(file); } catch (e2) { throw new Error('Не удалось прочитать фото. Подойдут JPG, PNG, WebP.'); }
    }
    var w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    var k = Math.min(1, maxSide / Math.max(w0, h0));
    var w = Math.max(1, Math.round(w0 * k)), hh = Math.max(1, Math.round(h0 * k));
    var c = document.createElement('canvas'); c.width = w; c.height = hh;
    var x = c.getContext('2d');
    function draw(fill) {
      x.clearRect(0, 0, w, hh);
      if (fill) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); }
      x.drawImage(bmp, 0, 0, w, hh);
    }
    function toBlob(type, q) { return new Promise(function (r) { c.toBlob(r, type, q); }); }
    var blob;
    if (o.alpha) {
      draw(false);
      blob = await toBlob('image/webp', 0.9);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/png');
    } else {
      draw(true);
      blob = await toBlob('image/jpeg', 0.86);
    }
    var q = 0.8;
    while (blob && blob.size > 4.2e6 && q > 0.4) {
      if (blob.type === 'image/png') { draw(true); blob = await toBlob('image/jpeg', q); }
      else blob = await toBlob(blob.type, q);
      q -= 0.15;
    }
    if (!blob || blob.size > 4.5e6) throw new Error('Фото слишком большое.');
    return blob;
  }
  async function uploadImage(file, o) {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) throw new Error('Это не изображение.');
    var blob = await prepImage(file, o);
    var res = await fetch('/api/admin/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': blob.type }, body: blob });
    var data = await res.json().catch(function () { return {}; });
    if (res.status === 401) { logout(); showLogin('Сессия истекла — войдите снова.'); throw new Error('unauthorized'); }
    if (!res.ok) throw new Error(data.error === 'too_large' ? 'Файл слишком большой.' : 'Не удалось загрузить фото.');
    return data.url;
  }
  function isOwn(url) { return /^\/api\/img\/[a-f0-9]{16}$/.test(url || ''); }
  function referenced(url) {
    var found = false;
    Object.keys(content.slots || {}).forEach(function (k) { if (content.slots[k] === url) found = true; });
    (content.products || []).forEach(function (p) { if (p.img === url) found = true; });
    (content.gallery || []).forEach(function (g) { if (g.img === url) found = true; });
    (content.news || []).forEach(function (n) { if (n.img === url) found = true; });
    return found;
  }
  function releaseLater(url) { if (isOwn(url)) pendingDeletes.push(url); }

  /* ---------- saving ---------- */
  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'bba-status' + (kind ? ' bba-status--' + kind : '');
  }
  function scheduleSave() {
    setStatus('Сохранение…', 'busy');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 450);
  }
  async function doSave() {
    if (saving) { again = true; return; }
    saving = true;
    try {
      var payload = { rev: content.rev, slots: content.slots || {}, hours: content.hours || { lv: '', ru: '', en: '' } };
      if (content.products) payload.products = content.products;
      if (content.gallery) payload.gallery = content.gallery;
      if (content.prices) payload.prices = content.prices;
      ['news', 'tournaments', 'rules'].forEach(function (k) { if (content[k]) payload[k] = content[k]; });
      var r = await api('/admin/content', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      content.rev = r.rev;
      setStatus('Сохранено ✓', 'ok');
      pendingDeletes.splice(0).forEach(function (u) {
        var m = /^\/api\/img\/([a-f0-9]{16})$/.exec(u);
        if (m && !referenced(u)) api('/admin/img/' + m[1], { method: 'DELETE' }).catch(function () { /* ignore */ });
      });
    } catch (e) {
      if (e.status === 409) { setStatus('Конфликт данных', 'err'); showConflict(); }
      else if (e.message !== 'unauthorized') setStatus('Ошибка сохранения: ' + e.message, 'err');
    } finally {
      saving = false;
      if (again) { again = false; doSave(); }
    }
  }
  function showConflict() {
    if (!mainEl) return;
    mainEl.innerHTML = '';
    append(mainEl, h('div', { class: 'bba-empty' },
      h('h3', { text: 'Данные изменились на другом устройстве' }),
      h('p', { text: 'Чтобы не потерять чужие правки, загрузите актуальную версию и повторите изменение.' }),
      h('button', { class: 'bba-btn bba-btn--primary', onclick: function () { loadContent().then(renderTab); } }, 'Загрузить актуальную версию')));
  }
  function loadContent() {
    return fetch('/api/content', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (c) { content = c && typeof c === 'object' ? c : { rev: 0 }; })
      .catch(function () { content = { rev: 0 }; });
  }

  /* ---------- shell: overlay / login / panel ---------- */
  function closeAll() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (root) { root.remove(); root = null; }
    document.body.classList.remove('bba-open');
  }
  function showLogin(message) {
    closeAll();
    document.body.classList.add('bba-open');
    var err = h('p', { class: 'bba-err', text: message || '', role: 'alert' });
    var login = h('input', { type: 'text', name: 'login', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', required: true });
    var pass = h('input', { type: 'password', name: 'password', autocomplete: 'off', required: true });
    var btn = h('button', { class: 'bba-btn bba-btn--primary', type: 'submit' }, 'Войти');
    var form = h('form', { class: 'bba-modal bba-login', onsubmit: function (e) {
      e.preventDefault();
      btn.disabled = true; err.textContent = '';
      fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: login.value.trim(), password: pass.value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
        .then(function (x) {
          if (x.r.ok && x.d.token) {
            token = x.d.token;
            try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e2) { /* ignore */ }
            openPanel();
          } else {
            err.textContent = x.r.status === 429 ? 'Слишком много попыток. Попробуйте через 15 минут.'
              : x.r.status === 404 ? 'Сервер админки недоступен на этом хостинге.' : 'Неверный логин или пароль.';
            btn.disabled = false; pass.value = ''; pass.focus();
          }
        })
        .catch(function () { err.textContent = 'Нет связи с сервером.'; btn.disabled = false; });
    } },
      h('h2', { text: 'Вход в админ-панель' }),
      h('label', { class: 'bba-field' }, h('span', { text: 'Логин' }), login),
      h('label', { class: 'bba-field' }, h('span', { text: 'Пароль' }), pass),
      err,
      h('div', { class: 'bba-row' }, btn, h('button', { class: 'bba-btn bba-btn--ghost', type: 'button', onclick: closeAll }, 'Закрыть')));
    overlay = h('div', { class: 'bba-overlay' }, form);
    document.body.appendChild(overlay);
    login.focus();
  }

  function openPanel() {
    closeAll();
    document.body.classList.add('bba-open');
    statusEl = h('span', { class: 'bba-status', text: '' });
    var langBar = h('div', { class: 'bba-langs', title: 'Язык редактируемых текстов' },
      LANGS.map(function (l) {
        return h('button', { type: 'button', 'data-l': l[0], class: l[0] === editLang ? 'is-on' : '', onclick: function () { editLang = l[0]; langBar.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-l') === editLang); }); renderTab(); } }, l[1]);
      }));
    var tabs = [['photos', 'Фото'], ['news', 'Новости'], ['tournaments', 'Турниры'], ['rules', 'Правила'], ['shop', 'Магазин'], ['gallery', 'Галерея'], ['prices', 'Прайс-лист'], ['settings', 'Настройки']];
    var side = h('nav', { class: 'bba-side' }, tabs.map(function (t) {
      return h('button', { type: 'button', 'data-t': t[0], class: 'bba-tab' + (t[0] === tab ? ' is-on' : ''), onclick: function () { tab = t[0]; side.querySelectorAll('.bba-tab').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-t') === tab); }); renderTab(); } }, t[1]);
    }));
    mainEl = h('main', { class: 'bba-main' }, h('p', { class: 'bba-hint', text: 'Загрузка…' }));
    root = h('div', { class: 'bba', role: 'dialog', 'aria-label': 'Админ-панель' },
      h('header', { class: 'bba-top' },
        h('strong', { class: 'bba-title', text: 'Админ-панель' }),
        h('span', { class: 'bba-sub', text: 'Язык текстов:' }), langBar,
        statusEl,
        h('span', { class: 'bba-grow' }),
        h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', onclick: closePanel }, 'Закрыть'),
        h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', onclick: function () { logout(); closePanel(true); } }, 'Выйти')),
      h('div', { class: 'bba-body' }, side, mainEl));
    document.body.appendChild(root);
    loadContent().then(renderTab);
  }
  function closePanel(skipApply) {
    clearTimeout(saveTimer);
    if (!skipApply && saving === false && statusEl && /Сохранение/.test(statusEl.textContent)) doSave();
    closeAll();
    // show the saved state on the page the visitor is looking at
    if (skipApply !== true && window.BB && window.BB.apply) window.BB.apply(content);
    if (skipApply === true) location.reload();
  }

  function renderTab() {
    if (!mainEl) return;
    var st = mainEl.scrollTop;
    mainEl.innerHTML = '';
    ({ photos: renderPhotos, news: renderNews, tournaments: renderTournaments, rules: renderRules, shop: renderShop, gallery: renderGallery, prices: renderPrices, settings: renderSettings })[tab](mainEl);
    mainEl.scrollTop = st;
  }

  /* ---------- reusable widgets ---------- */
  function fileButton(label, onFiles, o) {
    o = o || {};
    var input = h('input', { type: 'file', accept: 'image/*', multiple: !!o.multiple, class: 'bba-file' });
    var btn = h('label', { class: 'bba-btn ' + (o.primary ? 'bba-btn--primary' : 'bba-btn--ghost') + (o.small ? ' bba-btn--sm' : '') }, label, input);
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.value = '';
      if (files.length) onFiles(files);
    });
    return btn;
  }
  function guard(fn) {
    return function () {
      var args = arguments;
      return Promise.resolve().then(function () { return fn.apply(null, args); }).catch(function (e) {
        if (e && e.message !== 'unauthorized') { setStatus(e.message, 'err'); alert(e.message); }
      });
    };
  }
  function langInput(obj, key, o) {
    o = o || {};
    obj[key] = obj[key] || { lv: '', ru: '', en: '' };
    var el = h(o.area ? 'textarea' : 'input', { class: 'bba-in', type: o.area ? null : 'text', rows: o.area ? (o.rows || 4) : null, maxlength: o.max || 200, placeholder: editLang === 'lv' ? (o.ph || '') : (obj[key].lv || o.ph || '') });
    el.value = obj[key][editLang] || '';
    el.addEventListener('input', function () { obj[key][editLang] = el.value; if (o.onchange) o.onchange(); else scheduleSave(); });
    return el;
  }
  function modal(title, body, actions) {
    var m = h('div', { class: 'bba-modal bba-modal--wide' }, h('h2', { text: title }), body, h('div', { class: 'bba-row bba-row--end' }, actions));
    var o = h('div', { class: 'bba-overlay bba-overlay--top' }, m);
    document.body.appendChild(o);
    return { close: function () { o.remove(); }, el: m };
  }
  function emptyImg(text) { return h('div', { class: 'bba-noimg', text: text || 'Нет фото' }); }

  /* ---------- tab: photos ---------- */
  function renderPhotos(main) {
    append(main, h('h2', { class: 'bba-h1', text: 'Фото на сайте' }));
    append(main, h('p', { class: 'bba-hint', text: 'Нажмите «Заменить», чтобы поставить своё фото вместо стандартного. Фото уменьшается автоматически. Горизонтальные снимки хорошего качества выглядят лучше всего.' }));
    var group = null, grid = null;
    D.slots.forEach(function (s) {
      var parts = s.label.split(' — ');
      if (parts[0] !== group) {
        group = parts[0];
        append(main, h('h3', { class: 'bba-h', text: group }));
        grid = h('div', { class: 'bba-grid' });
        append(main, grid);
      }
      var cur = content.slots && content.slots[s.key];
      var src = cur || s.img;
      var isLogo = s.key === 'logo';
      append(grid, h('div', { class: 'bba-card' },
        h('div', { class: 'bba-thumb' + (isLogo ? ' bba-thumb--logo' : '') }, src ? h('img', { src: src, alt: '', loading: 'lazy' }) : emptyImg('Стандартный логотип (круг с цифрой 1)')),
        h('div', { class: 'bba-card__b' },
          h('strong', { text: parts.slice(1).join(' — ') || s.label }),
          cur ? h('span', { class: 'bba-badge', text: 'ваше фото' }) : null,
          h('div', { class: 'bba-row' },
            fileButton(cur ? 'Заменить' : 'Загрузить', guard(function (files) { return setSlot(s, files[0]); }), { small: true, primary: !cur }),
            cur ? h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', onclick: function () { resetSlot(s); } }, 'Сбросить') : null))));
    });
  }
  async function setSlot(s, file) {
    setStatus('Загрузка фото…', 'busy');
    var url = await uploadImage(file, s.key === 'logo' ? { maxSide: 900, alpha: true } : { maxSide: 2000 });
    content.slots = content.slots || {};
    releaseLater(content.slots[s.key]);
    content.slots[s.key] = url;
    scheduleSave();
    renderTab();
  }
  function resetSlot(s) {
    if (!content.slots || !content.slots[s.key]) return;
    releaseLater(content.slots[s.key]);
    delete content.slots[s.key];
    scheduleSave();
    renderTab();
  }

  /* ---------- tab: shop ---------- */
  function ensureProducts() { if (!Array.isArray(content.products)) content.products = clone(D.products); }
  function renderShop(main) {
    ensureProducts();
    append(main, h('h2', { class: 'bba-h1', text: 'Магазин — ассортимент' }));
    append(main, h('div', { class: 'bba-bar' },
      h('button', { type: 'button', class: 'bba-btn bba-btn--primary', onclick: function () { editProduct(null); } }, '+ Добавить товар'),
      h('span', { class: 'bba-hint', text: 'Цена и описание показываются на странице «Veikals». Если цена пустая — она не отображается.' })));
    if (!content.products.length) append(main, h('p', { class: 'bba-empty', text: 'Товаров нет. Нажмите «Добавить товар».' }));
    var grid = h('div', { class: 'bba-grid bba-grid--products' });
    content.products.forEach(function (p) {
      append(grid, h('div', { class: 'bba-card' },
        h('div', { class: 'bba-thumb bba-thumb--contain' }, p.img ? h('img', { src: p.img, alt: '', loading: 'lazy' }) : emptyImg()),
        h('div', { class: 'bba-card__b' },
          h('strong', { text: pick(p.name, editLang) || '(без названия)' }),
          h('span', { class: 'bba-muted', text: p.price ? (/^\d+([.,]\d{1,2})?$/.test(p.price) ? p.price.replace('.', ',') + ' €' : p.price) : 'цена не указана' }),
          h('div', { class: 'bba-row' },
            h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', onclick: function () { editProduct(p.id); } }, 'Изменить'),
            h('button', { type: 'button', class: 'bba-btn bba-btn--danger bba-btn--sm', onclick: function () { removeProduct(p.id); } }, 'Удалить')))));
    });
    append(main, grid);
  }
  function removeProduct(id) {
    var p = content.products.filter(function (x) { return x.id === id; })[0];
    if (!p || !confirm('Удалить товар «' + (pick(p.name, 'lv') || pick(p.name, editLang) || 'без названия') + '»?')) return;
    releaseLater(p.img);
    content.products = content.products.filter(function (x) { return x.id !== id; });
    scheduleSave();
    renderTab();
  }
  function editProduct(id) {
    var orig = id ? content.products.filter(function (x) { return x.id === id; })[0] : null;
    var d = orig ? clone(orig) : { id: rid('p'), name: { lv: '', ru: '', en: '' }, desc: { lv: '', ru: '', en: '' }, price: '', img: '' };
    var uploaded = [];
    var body = h('div', { class: 'bba-form' });
    var dlg;
    function draw() {
      body.innerHTML = '';
      var name = langInput(d, 'name', { max: 120, ph: 'Название', onchange: function () {} });
      var desc = langInput(d, 'desc', { max: 600, area: true, ph: 'Описание', onchange: function () {} });
      var price = h('input', { class: 'bba-in', type: 'text', inputmode: 'decimal', maxlength: 24, placeholder: 'Например 12.50', value: d.price });
      price.addEventListener('input', function () { d.price = price.value; });
      var tabs = h('div', { class: 'bba-langs' }, LANGS.map(function (l) {
        return h('button', { type: 'button', class: l[0] === editLang ? 'is-on' : '', onclick: function () { editLang = l[0]; draw(); } }, l[1]);
      }));
      var preview = h('div', { class: 'bba-thumb bba-thumb--contain bba-thumb--sm' }, d.img ? h('img', { src: d.img, alt: '' }) : emptyImg());
      append(body,
        h('div', { class: 'bba-field' }, h('span', { text: 'Язык текста' }), tabs),
        h('label', { class: 'bba-field' }, h('span', { text: 'Название' }), name),
        h('label', { class: 'bba-field' }, h('span', { text: 'Описание' }), desc),
        h('label', { class: 'bba-field' }, h('span', { text: 'Цена, € (число или текст, например «от 12 €»)' }), price),
        h('div', { class: 'bba-field' }, h('span', { text: 'Фото' }), preview,
          h('div', { class: 'bba-row' },
            fileButton(d.img ? 'Заменить фото' : 'Загрузить фото', guard(function (files) {
              return uploadImage(files[0], { maxSide: 1400, alpha: true }).then(function (u) { uploaded.push(u); d.img = u; draw(); });
            }), { small: true }),
            d.img ? h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', onclick: function () { d.img = ''; draw(); } }, 'Убрать фото') : null)));
    }
    draw();
    function cancel() {
      uploaded.forEach(function (u) { if (u !== (orig && orig.img)) releaseLater(u); });
      pendingDeletes.splice(0).forEach(function (u) { var m = /^\/api\/img\/([a-f0-9]{16})$/.exec(u); if (m && !referenced(u)) api('/admin/img/' + m[1], { method: 'DELETE' }).catch(function () {}); });
      dlg.close();
    }
    dlg = modal(orig ? 'Изменить товар' : 'Новый товар', body, [
      h('button', { type: 'button', class: 'bba-btn bba-btn--ghost', onclick: cancel }, 'Отмена'),
      h('button', { type: 'button', class: 'bba-btn bba-btn--primary', onclick: function () {
        if (!d.name.lv && !d.name.ru && !d.name.en) { alert('Укажите название товара.'); return; }
        if (orig) {
          if (orig.img && orig.img !== d.img) releaseLater(orig.img);
          content.products = content.products.map(function (x) { return x.id === d.id ? d : x; });
        } else content.products.push(d);
        dlg.close();
        scheduleSave();
        renderTab();
      } }, 'Сохранить')]);
  }

  /* ---------- tab: gallery ---------- */
  function renderGallery(main) {
    var items = content.gallery || [];
    append(main, h('h2', { class: 'bba-h1', text: 'Галерея' }));
    var sel = h('select', { class: 'bba-in bba-in--auto', onchange: function () { galCat = sel.value; } },
      h('option', { value: 'club', text: 'Клуб' }), h('option', { value: 'tournaments', text: 'Турниры' }));
    sel.value = galCat;
    append(main, h('div', { class: 'bba-bar' },
      h('span', { class: 'bba-sub', text: 'Раздел для новых фото:' }), sel,
      fileButton('+ Добавить фото', guard(addGallery), { multiple: true, primary: true }),
      h('span', { class: 'bba-hint', text: 'Можно выбрать сразу много фото.' })));
    if (!items.length) append(main, h('p', { class: 'bba-hint', text: 'Сейчас на странице показаны стандартные фото клуба. Как только вы добавите свои, стандартные исчезнут.' }));
    var grid = h('div', { class: 'bba-grid bba-grid--gallery' });
    items.forEach(function (g) {
      var cap = langInput(g, 'cap', { max: 160, ph: 'Подпись (необязательно)' });
      var cat = h('select', { class: 'bba-in bba-in--auto', onchange: function () { g.cat = cat.value; scheduleSave(); } },
        h('option', { value: 'club', text: 'Клуб' }), h('option', { value: 'tournaments', text: 'Турниры' }));
      cat.value = g.cat;
      append(grid, h('div', { class: 'bba-card' },
        h('div', { class: 'bba-thumb' }, h('img', { src: g.img, alt: '', loading: 'lazy' })),
        h('div', { class: 'bba-card__b' }, cap, h('div', { class: 'bba-row' }, cat,
          h('button', { type: 'button', class: 'bba-btn bba-btn--danger bba-btn--sm', onclick: function () {
            if (!confirm('Удалить это фото из галереи?')) return;
            releaseLater(g.img);
            content.gallery = content.gallery.filter(function (x) { return x.id !== g.id; });
            scheduleSave(); renderTab();
          } }, 'Удалить')))));
    });
    append(main, grid);
  }
  async function addGallery(files) {
    content.gallery = content.gallery || [];
    var done = 0, failed = 0;
    for (var i = 0; i < files.length; i++) {
      setStatus('Загрузка ' + (i + 1) + ' из ' + files.length + '…', 'busy');
      try {
        var url = await uploadImage(files[i], { maxSide: 2000 });
        content.gallery.unshift({ id: rid('g'), cat: galCat, img: url, cap: { lv: '', ru: '', en: '' } });
        done++;
      } catch (e) {
        if (e.message === 'unauthorized') return;
        failed++;
      }
    }
    if (done) scheduleSave(); else setStatus('', '');
    renderTab();
    if (failed) alert('Не удалось загрузить фото: ' + failed + ' из ' + files.length + '.');
  }

  /* ---------- tab: prices ---------- */
  function ensurePrices() { if (!content.prices || !Array.isArray(content.prices.groups)) content.prices = clone(D.prices); }
  function renderPrices(main) {
    ensurePrices();
    var groups = content.prices.groups;
    append(main, h('h2', { class: 'bba-h1', text: 'Прайс-лист' }));
    append(main, h('p', { class: 'bba-hint', text: 'Группы — это столы (бильярд, пул, русский, VIP зал). В каждой группе добавляйте строки: «1 час», «Вечер», «Абонемент» и т.д. Пустая цена на сайте показывается как «Цену уточняйте по телефону».' }));
    groups.forEach(function (g, gi) {
      var rowsBox = h('div', { class: 'bba-rows' });
      (g.rows || []).forEach(function (r, ri) {
        var price = h('input', { class: 'bba-in', type: 'text', inputmode: 'decimal', maxlength: 24, placeholder: 'Цена, €', value: r.price });
        price.addEventListener('input', function () { r.price = price.value; scheduleSave(); });
        append(rowsBox, h('div', { class: 'bba-prow' },
          langInput(r, 'label', { max: 100, ph: 'Название (напр. 1 час)' }),
          price,
          langInput(r, 'unit', { max: 40, ph: 'Пояснение (напр. / час)' }),
          h('button', { type: 'button', class: 'bba-x', title: 'Удалить строку', onclick: function () { g.rows.splice(ri, 1); scheduleSave(); renderTab(); } }, '×')));
      });
      var vip = h('input', { type: 'checkbox', checked: !!g.vip });
      vip.addEventListener('change', function () { g.vip = vip.checked; scheduleSave(); });
      append(main, h('section', { class: 'bba-group' },
        h('div', { class: 'bba-grouphead' },
          langInput(g, 'title', { max: 80, ph: 'Название группы (напр. Пул)' }),
          langInput(g, 'note', { max: 200, ph: 'Пояснение (напр. 2 стола)' }),
          h('label', { class: 'bba-check' }, vip, h('span', { text: 'Тёмная карточка (VIP)' })),
          h('div', { class: 'bba-row' },
            h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', disabled: gi === 0, onclick: function () { groups.splice(gi - 1, 0, groups.splice(gi, 1)[0]); scheduleSave(); renderTab(); } }, '↑'),
            h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', disabled: gi === groups.length - 1, onclick: function () { groups.splice(gi + 1, 0, groups.splice(gi, 1)[0]); scheduleSave(); renderTab(); } }, '↓'),
            h('button', { type: 'button', class: 'bba-btn bba-btn--danger bba-btn--sm', onclick: function () { if (confirm('Удалить группу целиком?')) { groups.splice(gi, 1); scheduleSave(); renderTab(); } } }, 'Удалить группу'))),
        rowsBox,
        h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', onclick: function () {
          g.rows = g.rows || [];
          g.rows.push({ id: rid('r'), label: { lv: '', ru: '', en: '' }, price: '', unit: { lv: '', ru: '', en: '' } });
          scheduleSave(); renderTab();
        } }, '+ Добавить строку')));
    });
    append(main, h('button', { type: 'button', class: 'bba-btn bba-btn--primary', onclick: function () {
      groups.push({ id: rid('g'), vip: false, title: { lv: '', ru: '', en: '' }, note: { lv: '', ru: '', en: '' }, rows: [{ id: rid('r'), label: { lv: '', ru: '', en: '' }, price: '', unit: { lv: '', ru: '', en: '' } }] });
      scheduleSave(); renderTab();
    } }, '+ Добавить группу'));
  }


  /* ---------- shared helpers for list tabs ---------- */
  var E3 = function () { return { lv: '', ru: '', en: '' }; };
  function ensureList(key) { if (!Array.isArray(content[key])) content[key] = clone(D[key] || []); return content[key]; }
  function orderBtns(list, i) {
    return [
      h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', disabled: i === 0, title: 'Выше', onclick: function () { list.splice(i - 1, 0, list.splice(i, 1)[0]); scheduleSave(); renderTab(); } }, '↑'),
      h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', disabled: i === list.length - 1, title: 'Ниже', onclick: function () { list.splice(i + 1, 0, list.splice(i, 1)[0]); scheduleSave(); renderTab(); } }, '↓')
    ];
  }
  function plainInput(obj, key, o) {
    o = o || {};
    var el = h('input', { class: 'bba-in' + (o.auto ? ' bba-in--auto' : ''), type: o.type || 'text', maxlength: o.max || 300, placeholder: o.ph || '' });
    el.value = obj[key] || '';
    el.addEventListener('input', function () { obj[key] = el.value; scheduleSave(); });
    return el;
  }
  function field(label, node) { return h('label', { class: 'bba-field' }, h('span', { text: label }), node); }

  /* ---------- tab: news ---------- */
  var NEWS_CATS = [['club', 'Клуб'], ['tournaments', 'Турниры'], ['school', 'Школа'], ['shop', 'Магазин']];
  function renderNews(main) {
    var list = ensureList('news');
    append(main, h('h2', { class: 'bba-h1', text: 'Новости' }));
    append(main, h('p', { class: 'bba-hint', text: 'Посты показываются на странице «Jaunumi» и на главной. Новые идут по дате — самые свежие сверху. Текст пишется на трёх языках: переключайте LV / RU / EN вверху.' }));
    append(main, h('div', { class: 'bba-bar' }, h('button', { type: 'button', class: 'bba-btn bba-btn--primary', onclick: function () {
      list.unshift({ id: rid('n'), date: new Date().toISOString().slice(0, 10), cat: 'club', title: E3(), text: E3(), img: '' });
      scheduleSave(); renderTab();
    } }, '+ Новый пост')));
    if (!list.length) append(main, h('p', { class: 'bba-empty', text: 'Постов нет. Нажмите «Новый пост».' }));
    list.forEach(function (n, i) {
      var cat = h('select', { class: 'bba-in bba-in--auto', onchange: function () { n.cat = cat.value; scheduleSave(); } }, NEWS_CATS.map(function (c) { return h('option', { value: c[0], text: c[1] }); }));
      cat.value = n.cat || 'club';
      append(main, h('section', { class: 'bba-group bba-post' },
        h('div', { class: 'bba-post__img' },
          h('div', { class: 'bba-thumb bba-thumb--sm' }, n.img ? h('img', { src: n.img, alt: '' }) : emptyImg()),
          h('div', { class: 'bba-row' },
            fileButton(n.img ? 'Заменить фото' : 'Загрузить фото', guard(function (files) {
              return uploadImage(files[0], { maxSide: 1600 }).then(function (u) { releaseLater(n.img); n.img = u; scheduleSave(); renderTab(); });
            }), { small: true }),
            n.img ? h('button', { type: 'button', class: 'bba-btn bba-btn--ghost bba-btn--sm', onclick: function () { releaseLater(n.img); n.img = ''; scheduleSave(); renderTab(); } }, 'Убрать') : null)),
        h('div', { class: 'bba-form' },
          h('div', { class: 'bba-row' }, field('Дата', plainInput(n, 'date', { type: 'date', auto: true })), field('Раздел', cat)),
          field('Заголовок', langInput(n, 'title', { max: 160, ph: 'Заголовок' })),
          field('Текст', langInput(n, 'text', { max: 3000, area: true, rows: 6, ph: 'Текст поста' })),
          h('div', { class: 'bba-row bba-row--end' }, orderBtns(list, i),
            h('button', { type: 'button', class: 'bba-btn bba-btn--danger bba-btn--sm', onclick: function () {
              if (!confirm('Удалить этот пост?')) return;
              releaseLater(n.img); list.splice(i, 1); scheduleSave(); renderTab();
            } }, 'Удалить')))));
    });
  }

  /* ---------- tab: tournaments ---------- */
  function renderTournaments(main) {
    var list = ensureList('tournaments');
    append(main, h('h2', { class: 'bba-h1', text: 'Турниры' }));
    append(main, h('p', { class: 'bba-hint', text: 'Каждый турнир показывается на странице «Turnīri»: дата, положение о турнире и кнопка «Регистрация» со ссылкой на TournamentService. Прошедшие турниры автоматически уходят вниз и тускнеют.' }));
    append(main, h('div', { class: 'bba-bar' }, h('button', { type: 'button', class: 'bba-btn bba-btn--primary', onclick: function () {
      list.unshift({ id: rid('t'), date: '', time: '', title: E3(), info: E3(), link: '' });
      scheduleSave(); renderTab();
    } }, '+ Добавить турнир')));
    if (!list.length) append(main, h('p', { class: 'bba-empty', text: 'Турниров нет. Нажмите «Добавить турнир».' }));
    list.forEach(function (t, i) {
      append(main, h('section', { class: 'bba-group' },
        h('div', { class: 'bba-row' }, field('Дата', plainInput(t, 'date', { type: 'date', auto: true })), field('Время / место (необязательно)', plainInput(t, 'time', { max: 40, ph: 'Напр. 12:00' }))),
        field('Название турнира', langInput(t, 'title', { max: 160, ph: 'Название' })),
        field('Положение о турнире (формат, взнос, призы, дисциплина)', langInput(t, 'info', { max: 4000, area: true, rows: 7, ph: 'Положение о турнире' })),
        field('Ссылка на турнир в TournamentService (регистрация)', plainInput(t, 'link', { max: 300, ph: 'https://tournamentservice.net/…' })),
        h('div', { class: 'bba-row bba-row--end' }, orderBtns(list, i),
          h('button', { type: 'button', class: 'bba-btn bba-btn--danger bba-btn--sm', onclick: function () {
            if (!confirm('Удалить этот турнир?')) return;
            list.splice(i, 1); scheduleSave(); renderTab();
          } }, 'Удалить'))));
    });
  }

  /* ---------- tab: rules ---------- */
  function renderRules(main) {
    var list = ensureList('rules');
    append(main, h('h2', { class: 'bba-h1', text: 'Правила' }));
    append(main, h('p', { class: 'bba-hint', text: 'Разделы страницы «Noteikumi». Строки, начинающиеся с «- », превращаются в список. Раздел без текста и без ссылки на сайте не показывается — так можно заранее держать пустые «ЕКП» и «МКП» и заполнить позже. Ссылка (необязательно) — на PDF или страницу с официальным документом.' }));
    append(main, h('div', { class: 'bba-bar' }, h('button', { type: 'button', class: 'bba-btn bba-btn--primary', onclick: function () {
      list.push({ id: rid('r'), title: E3(), body: E3(), link: '' }); scheduleSave(); renderTab();
    } }, '+ Добавить раздел')));
    list.forEach(function (r, i) {
      append(main, h('section', { class: 'bba-group' },
        field('Название раздела', langInput(r, 'title', { max: 100, ph: 'Название' })),
        field('Текст', langInput(r, 'body', { max: 12000, area: true, rows: 10, ph: 'Текст правил' })),
        field('Ссылка на документ (необязательно)', plainInput(r, 'link', { max: 300, ph: 'https://…' })),
        h('div', { class: 'bba-row bba-row--end' }, orderBtns(list, i),
          h('button', { type: 'button', class: 'bba-btn bba-btn--danger bba-btn--sm', onclick: function () {
            if (!confirm('Удалить раздел?')) return;
            list.splice(i, 1); scheduleSave(); renderTab();
          } }, 'Удалить'))));
    });
  }

  /* ---------- tab: settings ---------- */
  function renderSettings(main) {
    content.hours = content.hours || { lv: '', ru: '', en: '' };
    append(main, h('h2', { class: 'bba-h1', text: 'Настройки' }));
    var ta = h('textarea', { class: 'bba-in', rows: 6, maxlength: 600, placeholder: editLang === 'lv' ? 'Напр.:\nPirmdiena–Ceturtdiena 12:00–00:00\nPiektdiena–Sestdiena 12:00–02:00' : (content.hours.lv || '') });
    ta.value = content.hours[editLang] || '';
    ta.addEventListener('input', function () { content.hours[editLang] = ta.value; scheduleSave(); });
    append(main,
      h('section', { class: 'bba-group' },
        h('h3', { class: 'bba-h', text: 'Часы работы' }),
        h('p', { class: 'bba-hint', text: 'Показываются в подвале сайта и на странице «Kontakti». Если оставить пустым — пишется «уточняйте по телефону». Если заполнен только LV, он используется для всех языков.' }),
        ta),
      h('section', { class: 'bba-group' },
        h('h3', { class: 'bba-h', text: 'Доступ' }),
        h('p', { class: 'bba-hint', text: 'Логин и пароль проверяются на сервере. Сменить их можно в настройках хостинга (переменные ADMIN_LOGIN и ADMIN_PASSWORD) — см. README.' }),
        h('p', { class: 'bba-muted', text: content.updated ? 'Последнее сохранение: ' + new Date(content.updated).toLocaleString('ru-RU') : 'Данные ещё не сохранялись.' })));
  }

  window.BBAdmin = {
    open: function () {
      if (token) openPanel(); else showLogin();
    },
  };
})();
