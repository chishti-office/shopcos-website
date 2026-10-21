/* ============================================================
   shopcos soft — Phone UI behavior
   Injects an app-like bottom tab bar + account sheet on phones.
   ONLY runs when viewport is <= 768px. Desktop is untouched.
   Loaded on every page via <script src="/mobile.js" defer>.
   ============================================================ */
(function () {
  'use strict';
  var MQ = window.matchMedia('(max-width: 768px)');
  var HOME = 'https://shopcos.shop/';
  var built = false;

  var TABS = [
    { id: 'home',     ic: '🏠', label: 'Home',     href: HOME },
    { id: 'features', ic: '✨', label: 'Features', href: HOME + '#features' },
    { id: 'pricing',  ic: '💰', label: 'Pricing',  href: HOME + '#pricing' },
    { id: 'blog',     ic: '📰', label: 'Blog',     href: HOME + 'blog/' },
    { id: 'account',  ic: '👤', label: 'Account',  href: '#', action: 'sheet' }
  ];

  function activeTabId() {
    var p = location.pathname.replace(/\/$/, '') || '/';
    var h = location.hash;
    if (h === '#features') return 'features';
    if (h === '#pricing') return 'pricing';
    if (p.indexOf('/blog') === 0) return 'blog';
    if (p === '' || p === '/') return 'home';
    return '';
  }

  function build() {
    if (built) return;
    built = true;

    /* ---- Tab bar ---- */
    var bar = document.createElement('nav');
    bar.className = 'm-tabbar';
    bar.setAttribute('aria-label', 'App navigation');
    TABS.forEach(function (t) {
      var el = document.createElement(t.action ? 'button' : 'a');
      el.className = 'm-tab' + (activeTabId() === t.id ? ' active' : '');
      el.dataset.tab = t.id;
      if (!t.action) el.href = t.href;
      el.innerHTML = '<span class="m-ic">' + t.ic + '</span><span>' + t.label + '</span>';
      if (t.action === 'sheet') {
        el.addEventListener('click', function (e) { e.preventDefault(); openSheet(); });
      }
      bar.appendChild(el);
    });
    document.body.appendChild(bar);

    /* ---- Account sheet ---- */
    var overlay = document.createElement('div');
    overlay.className = 'm-sheet-overlay';
    overlay.innerHTML =
      '<div class="m-sheet" role="dialog" aria-label="Account">' +
        '<div class="m-sheet-grab"></div>' +
        '<h3>👤 Account</h3>' +
        '<p class="m-sheet-sub">Login, language aur currency — sab yahin.</p>' +
        '<div class="m-sheet-actions">' +
          '<button class="btn btn-primary" data-m-act="login">Login</button>' +
          '<button class="btn btn-ghost" data-m-act="signup">Sign Up</button>' +
        '</div>' +
        '<button class="m-sheet-link" data-m-act="dashboard"><span class="m-ic">📊</span> Open Dashboard</button>' +
        '<button class="m-sheet-link" data-m-act="cart"><span class="m-ic">🛒</span> View Cart</button>' +
        '<div class="m-sheet-row"><label>Language</label><span data-m-slot="lang"></span></div>' +
        '<div class="m-sheet-row"><label>Currency</label><span data-m-slot="cur"></span></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSheet();
    });
    overlay.querySelector('.m-sheet-grab').addEventListener('click', closeSheet);

    overlay.querySelectorAll('[data-m-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.dataset.mAct;
        closeSheet();
        if (act === 'login' || act === 'signup') {
          var native = document.getElementById(act === 'login' ? 'loginBtn' : 'signupBtn');
          if (native) { native.click(); return; }
          location.href = HOME; // auth lives on homepage
        } else if (act === 'dashboard') {
          location.href = HOME + 'dashboard/';
        } else if (act === 'cart') {
          var cartBtn = document.querySelector('[data-open-cart]');
          if (cartBtn) { cartBtn.click(); }
        }
      });
    });

    /* Move language/currency selects into the sheet (keeps their listeners) */
    moveSelects(true);

    /* ---- Header cart button (compact) ---- */
    var navInner = document.querySelector('.nav .nav-inner');
    var cartSrc = document.querySelector('[data-open-cart]');
    if (navInner && cartSrc && !document.querySelector('.m-head-cart')) {
      var hc = document.createElement('button');
      hc.className = 'm-head-cart';
      hc.setAttribute('aria-label', 'Open cart');
      hc.innerHTML = '🛒';
      var badge = cartSrc.querySelector('.cart-badge');
      if (badge) hc.appendChild(badge.cloneNode(true));
      hc.addEventListener('click', function () { cartSrc.click(); });
      navInner.appendChild(hc);
    }
  }

  function moveSelects(toSheet) {
    var lang = document.getElementById('langSelect') || document.getElementById('langSelectM');
    var cur = document.getElementById('curSelect') || document.getElementById('curSelectM');
    var langSlot = document.querySelector('[data-m-slot="lang"]');
    var curSlot = document.querySelector('[data-m-slot="cur"]');
    if (toSheet) {
      if (lang && langSlot && lang.parentNode !== langSlot) langSlot.appendChild(lang);
      if (cur && curSlot && cur.parentNode !== curSlot) curSlot.appendChild(cur);
    } else {
      var cta = document.querySelector('.nav-cta');
      var mm = document.querySelector('.mobile-selects');
      if (lang && lang.id === 'langSelect' && cta && lang.parentNode !== cta) cta.insertBefore(lang, cta.firstChild);
      if (cur && cur.id === 'curSelect' && cta && cur.parentNode !== cta) cta.insertBefore(cur, cta.firstChild);
      if (lang && lang.id === 'langSelectM' && mm && lang.parentNode !== mm) mm.appendChild(lang);
      if (cur && cur.id === 'curSelectM' && mm && cur.parentNode !== mm) mm.appendChild(cur);
    }
  }

  function openSheet() {
    var o = document.querySelector('.m-sheet-overlay');
    if (o) { o.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }
  function closeSheet() {
    var o = document.querySelector('.m-sheet-overlay');
    if (o) { o.classList.remove('open'); document.body.style.overflow = ''; }
  }

  function teardown() {
    var bar = document.querySelector('.m-tabbar');
    if (bar) bar.remove();
    var ov = document.querySelector('.m-sheet-overlay');
    if (ov) ov.remove();
    var hc = document.querySelector('.m-head-cart');
    if (hc) hc.remove();
    moveSelects(false);
    built = false;
  }

  function apply() {
    if (MQ.matches) build();
    else teardown();
  }

  /* Active tab follows hash changes (single-page anchors) */
  window.addEventListener('hashchange', function () {
    if (!MQ.matches) return;
    var id = activeTabId();
    document.querySelectorAll('.m-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === id);
    });
  });

  if (MQ.addEventListener) MQ.addEventListener('change', apply);
  else if (MQ.addListener) MQ.addListener(apply);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  /* Escape closes the sheet */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSheet();
  });
})();
