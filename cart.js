/* ============================================================
   shopcos soft — Shared Shopping Cart
   localStorage-based, single-plan cart (license purchase).
   One plan per cart: adding a new plan replaces the old one.
   Include on: index.html, dashboard/, checkout/
   ============================================================ */
(function(){
  'use strict';

  var PLANS = {
    starter:      { id:'starter',      name:'Starter',      tag:'🌱', usd:90,  pkr:25000  },
    business:     { id:'business',     name:'Business',     tag:'💼', usd:145, pkr:40000  },
    professional: { id:'professional', name:'Professional', tag:'🚀', usd:290, pkr:80000  },
    enterprise:   { id:'enterprise',   name:'Enterprise',   tag:'🏢', usd:545, pkr:150000 }
  };

  var KEY = 'shopcos_cart';

  function fmt(n){ return n.toLocaleString('en-US'); }

  function get(){
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.planId || !PLANS[c.planId]) return null;
      return c;
    } catch(e){ return null; }
  }

  function set(planId){
    if (!PLANS[planId]) return false;
    var p = PLANS[planId];
    localStorage.setItem(KEY, JSON.stringify({
      planId: p.id, name: p.name, tag: p.tag, usd: p.usd, pkr: p.pkr,
      addedAt: new Date().toISOString()
    }));
    render();
    return true;
  }

  function clear(){
    localStorage.removeItem(KEY);
    render();
  }

  function count(){ return get() ? 1 : 0; }

  /* ---------- injected styles ---------- */
  var css =
    '.sc-cart-btn{position:relative;display:inline-flex;align-items:center;gap:6px;}' +
    '.sc-cart-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;border-radius:999px;' +
    'background:linear-gradient(120deg,#ffd97a,#f5b73f);color:#1a1005;font-size:.72rem;font-weight:800;' +
    'display:flex;align-items:center;justify-content:center;padding:0 5px;box-shadow:0 2px 8px rgba(245,183,63,.5);}' +
    '.sc-cart-badge.zero{display:none;}' +
    '#scDrawerOv{position:fixed;inset:0;background:rgba(3,5,14,.7);backdrop-filter:blur(4px);z-index:2000;' +
    'opacity:0;pointer-events:none;transition:opacity .25s;}' +
    '#scDrawerOv.open{opacity:1;pointer-events:auto;}' +
    '#scDrawer{position:fixed;top:0;right:0;bottom:0;width:min(400px,92vw);z-index:2001;' +
    'background:#0b1130;border-left:1px solid rgba(245,183,63,.25);box-shadow:-20px 0 60px rgba(0,0,0,.5);' +
    'transform:translateX(105%);transition:transform .3s cubic-bezier(.2,.8,.2,1);' +
    'display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif;color:#f2f4fb;}' +
    '#scDrawerOv.open #scDrawer{transform:none;}' +
    '.sc-d-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid rgba(255,255,255,.09);}' +
    '.sc-d-head h3{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:1.25rem;margin:0;}' +
    '.sc-d-close{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#f2f4fb;' +
    'width:34px;height:34px;border-radius:10px;font-size:1rem;cursor:pointer;}' +
    '.sc-d-close:hover{border-color:#f5b73f;}' +
    '.sc-d-body{flex:1;overflow-y:auto;padding:22px;}' +
    '.sc-d-item{background:rgba(245,183,63,.07);border:1px solid rgba(245,183,63,.3);border-radius:16px;padding:18px;}' +
    '.sc-d-item .pname{font-size:1.15rem;font-weight:700;margin-bottom:4px;}' +
    '.sc-d-item .plic{font-size:.82rem;color:#a3adc9;margin-bottom:12px;}' +
    '.sc-d-price{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:1.9rem;font-weight:800;' +
    'background:linear-gradient(120deg,#ffd97a,#f5b73f);-webkit-background-clip:text;background-clip:text;color:transparent;}' +
    '.sc-d-pkr{color:#a3adc9;font-size:.9rem;margin-top:2px;}' +
    '.sc-d-empty{text-align:center;padding:50px 10px;color:#a3adc9;}' +
    '.sc-d-empty .big{font-size:3rem;margin-bottom:12px;}' +
    '.sc-d-foot{padding:20px 22px;border-top:1px solid rgba(255,255,255,.09);}' +
    '.sc-d-total{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;}' +
    '.sc-d-total .t{color:#a3adc9;font-size:.9rem;}' +
    '.sc-d-total .v{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:1.6rem;font-weight:800;color:#ffd97a;}' +
    '.sc-d-total .v small{display:block;font-size:.78rem;color:#a3adc9;font-family:Inter,system-ui,sans-serif;font-weight:400;}' +
    '.sc-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border-radius:12px;' +
    'font-weight:700;font-size:.95rem;cursor:pointer;border:none;font-family:Inter,system-ui,sans-serif;text-decoration:none;}' +
    '.sc-btn-gold{background:linear-gradient(120deg,#ffd97a,#f5b73f 45%,#e08a1e);color:#1a1005;}' +
    '.sc-btn-gold:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(245,183,63,.35);}' +
    '.sc-btn-ghost{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#f2f4fb;margin-top:10px;}' +
    '.sc-btn-ghost:hover{border-color:#f5b73f;}' +
    '.sc-d-note{font-size:.78rem;color:#6d7694;text-align:center;margin-top:12px;line-height:1.5;}' +
    '#scToast{position:fixed;bottom:26px;left:50%;transform:translate(-50%,80px);z-index:3000;' +
    'background:#101736;border:1px solid rgba(245,183,63,.4);color:#f2f4fb;padding:13px 22px;border-radius:14px;' +
    'font-size:.9rem;font-weight:600;box-shadow:0 12px 40px rgba(0,0,0,.5);opacity:0;transition:.3s;pointer-events:none;' +
    'max-width:90vw;text-align:center;}' +
    '#scToast.show{opacity:1;transform:translate(-50%,0);}' +
    '@media(max-width:640px){.sc-d-price{font-size:1.6rem;}}';

  function injectCss(){
    if (document.getElementById('scCartCss')) return;
    var s = document.createElement('style');
    s.id = 'scCartCss';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ensureDrawer(){
    if (document.getElementById('scDrawerOv')) return;
    var ov = document.createElement('div');
    ov.id = 'scDrawerOv';
    ov.innerHTML =
      '<aside id="scDrawer" role="dialog" aria-label="Shopping cart">' +
        '<div class="sc-d-head"><h3>🛒 Your Cart</h3>' +
        '<button class="sc-d-close" id="scDrawerClose" aria-label="Close cart">✕</button></div>' +
        '<div class="sc-d-body" id="scDrawerBody"></div>' +
        '<div class="sc-d-foot" id="scDrawerFoot"></div>' +
      '</aside>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      if (e.target === ov || e.target.closest('#scDrawerClose')) close();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') close();
    });
  }

  function toast(msg){
    var t = document.getElementById('scToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'scToast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function(){ t.classList.remove('show'); }, 2800);
  }

  function render(){
    var c = get();
    // badge(s)
    document.querySelectorAll('#cartCount, .sc-cart-badge').forEach(function(b){
      b.textContent = count();
      b.classList.toggle('zero', count() === 0);
    });
    // drawer body
    var body = document.getElementById('scDrawerBody');
    var foot = document.getElementById('scDrawerFoot');
    if (!body || !foot) return;
    if (!c) {
      body.innerHTML = '<div class="sc-d-empty"><div class="big">🛒</div>' +
        '<p><strong>Your cart is empty.</strong></p>' +
        '<p style="font-size:.85rem;margin-top:6px">Pick a lifetime plan to get started.</p></div>';
      foot.innerHTML = '';
      return;
    }
    body.innerHTML =
      '<div class="sc-d-item">' +
        '<div class="pname">' + c.tag + ' ' + c.name + ' Plan</div>' +
        '<div class="plic">Lifetime license · Single shop · One-time payment</div>' +
        '<div class="sc-d-price">$' + fmt(c.usd) + ' <span style="font-size:1rem">USD</span></div>' +
        '<div class="sc-d-pkr">Rs ' + fmt(c.pkr) + ' PKR</div>' +
      '</div>' +
      '<p class="sc-d-note">💡 License plans are one per shop.<br>Adding a different plan replaces this one.</p>';
    foot.innerHTML =
      '<div class="sc-d-total"><span class="t">Total (one-time)</span>' +
      '<span class="v">$' + fmt(c.usd) + '<small>Rs ' + fmt(c.pkr) + ' PKR</small></span></div>' +
      '<a class="sc-btn sc-btn-gold" href="checkout/">Proceed to Checkout →</a>' +
      '<button class="sc-btn sc-btn-ghost" id="scClearCart">Remove from cart</button>';
    var clr = document.getElementById('scClearCart');
    if (clr) clr.addEventListener('click', function(){ clear(); toast('🗑️ Cart cleared.'); });
  }

  function open(){ ensureDrawer(); render(); document.getElementById('scDrawerOv').classList.add('open'); }
  function close(){ var ov = document.getElementById('scDrawerOv'); if (ov) ov.classList.remove('open'); }

  function add(planId){
    if (!PLANS[planId]) return;
    var prev = get();
    set(planId);
    var p = PLANS[planId];
    toast(prev && prev.planId !== planId
      ? '🔄 Cart updated: ' + p.tag + ' ' + p.name + ' ($' + fmt(p.usd) + ')'
      : '🛒 Added: ' + p.tag + ' ' + p.name + ' ($' + fmt(p.usd) + ')');
    open();
  }

  function init(){
    injectCss();
    ensureDrawer();
    render();
    // Add-to-cart buttons (delegated — works for dynamically added content too)
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-add-cart]');
      if (btn) { e.preventDefault(); add(btn.getAttribute('data-add-cart')); return; }
      var cb = e.target.closest('[data-open-cart]');
      if (cb) { e.preventDefault(); open(); return; }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.ShopcosCart = { get:get, set:set, clear:clear, open:open, close:close, count:count, PLANS:PLANS, toast:toast };
})();
