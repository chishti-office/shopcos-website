// shopcos soft — interactions
(function(){
  'use strict';

  // Sticky navbar state
  var nav = document.getElementById('nav');
  function onScroll(){ nav.classList.toggle('scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  // Mobile menu
  var burger = document.getElementById('hamburger');
  var menu = document.getElementById('mobileMenu');
  burger.addEventListener('click', function(){ menu.classList.toggle('open'); });
  menu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){ menu.classList.remove('open'); });
  });

  // Scroll reveals
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, {threshold:.12, rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });

  // Animated stat counters
  var cio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      cio.unobserve(e.target);
      var el = e.target, target = parseInt(el.getAttribute('data-count'),10), t0 = null;
      function tick(t){
        if(!t0) t0 = t;
        var p = Math.min((t - t0) / 1400, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if(p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, {threshold:.5});
  document.querySelectorAll('.stat-num[data-count]').forEach(function(el){ cio.observe(el); });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q = item.querySelector('.faq-q'), a = item.querySelector('.faq-a');
    q.addEventListener('click', function(){
      var open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(o){
        o.classList.remove('open');
        o.querySelector('.faq-a').style.maxHeight = null;
      });
      if(!open){
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  // Bento spotlight follows the cursor
  document.querySelectorAll('.bento-card').forEach(function(card){
    card.addEventListener('mousemove', function(e){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // Hero Urdu watermark — gentle parallax drift with the cursor
  var wm = document.querySelector('.hero .urdu-watermark');
  if(wm){
    var raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
    document.querySelector('.hero').addEventListener('mousemove', function(e){
      var r = this.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - .5;
      ty = (e.clientY - r.top) / r.height - .5;
      if(!raf) raf = requestAnimationFrame(apply);
    });
    function apply(){
      cx += (tx - cx) * .06; cy += (ty - cy) * .06;
      wm.style.translate = (cx * -34) + 'px ' + (cy * -24) + 'px';
      if(Math.abs(tx - cx) > .001 || Math.abs(ty - cy) > .001) raf = requestAnimationFrame(apply);
      else raf = null;
    }
  }

  // Eyebrow shimmer: restart pulse dot emphasis on reveal
  document.querySelectorAll('.eyebrow').forEach(function(el){
    el.addEventListener('animationend', function(){ el.style.animation = ''; });
  });
})();

// ============ Auth System (Supabase) ============
(function(){
  'use strict';
  
  var SUPABASE_URL = 'https://qqlgebbqhixbvyeotdkm.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbGdlYmJxaGl4YnZ5ZW90ZGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5ODEyNzQsImV4cCI6MjEwNzU1NzI3NH0.2-7imtVkkH0NfxTMcC-eCGLiZN5tCkiRkNR6XRzfXns';
  
  var sb = null;
  var pendingEmail = '';

  var overlay = document.getElementById('authOverlay');
  var loginBtn = document.getElementById('loginBtn');
  var signupBtn = document.getElementById('signupBtn');
  var authClose = document.getElementById('authClose');

  function initSupabase() {
    if (typeof supabase === 'undefined') { setTimeout(initSupabase, 300); return; }
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    checkSession();
  }

  function genKey() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k = 'SCS';
    for (var i = 0; i < 3; i++) { k += '-'; for (var j = 0; j < 4; j++) k += chars[Math.floor(Math.random()*chars.length)]; }
    return k;
  }

  async function ensureLicense(user) {
    // Check if license exists, create trial if not
    var { data } = await sb.from('licenses').select('*').eq('user_id', user.id).limit(1);
    if (data && data.length) return data[0];
    var key = genKey();
    var trialEnds = new Date(Date.now() + 7*86400000).toISOString();
    var { data: ins } = await sb.from('licenses').insert({
      user_id: user.id, email: user.email, license_key: key,
      type: 'trial', status: 'active', trial_ends_at: trialEnds
    }).select();
    return ins && ins[0];
  }

  function showAuth(tab) { overlay.style.display = 'flex'; switchTab(tab || 'login'); }
  function hideAuth() { overlay.style.display = 'none'; }
  function switchTab(tab) {
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
    document.getElementById('formLogin').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('formSignup').style.display = tab === 'signup' ? 'block' : 'none';
    document.getElementById('formOTP').style.display = 'none';
    document.getElementById('formSuccess').style.display = 'none';
  }
  function showOTP(email) {
    pendingEmail = email;
    document.getElementById('otpEmail').textContent = email;
    ['formLogin','formSignup'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
    document.getElementById('formOTP').style.display = 'block';
    document.getElementById('formSuccess').style.display = 'none';
  }
  async function showSuccess(user) {
    var lic = await ensureLicense(user);
    localStorage.setItem('shopcos_user', JSON.stringify({ email: user.email, id: user.id }));
    updateNav();
    // Take the user to their dashboard (separate page, not the landing page)
    window.location.href = 'dashboard.html';
  }
  async function checkSession() {
    var { data } = await sb.auth.getSession();
    if (data.session && data.session.user) {
      localStorage.setItem('shopcos_user', JSON.stringify({ email: data.session.user.email, id: data.session.user.id }));
      updateNav();
    }
    // Notice set by dashboard.html when a logged-out user lands there
    var notice = null;
    try { notice = sessionStorage.getItem('shopcos_notice'); sessionStorage.removeItem('shopcos_notice'); } catch(e) {}
    if (notice && !(data.session && data.session.user)) {
      showAuth('login');
      var le = document.getElementById('loginError');
      if (le) le.textContent = notice;
    }
  }
  function updateNav() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('shopcos_user')); } catch(e) {}
    if (user && user.email) {
      loginBtn.textContent = user.email.split('@')[0];
      loginBtn.onclick = function() { window.location.href = 'dashboard.html'; };
      loginBtn.title = 'Go to Dashboard';
      signupBtn.textContent = 'Logout';
      signupBtn.onclick = async function() {
        await sb.auth.signOut();
        localStorage.removeItem('shopcos_user');
        location.reload();
      };
      // Add Dashboard button next to logout
      if (!document.getElementById('dashNavBtn')) {
        var db = document.createElement('a');
        db.id = 'dashNavBtn';
        db.href = 'dashboard.html';
        db.className = 'btn btn-primary';
        db.textContent = '📊 Dashboard';
        db.style.marginRight = '8px';
        signupBtn.parentNode.insertBefore(db, signupBtn);
      }
    }
  }

  loginBtn.addEventListener('click', function() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('shopcos_user')); } catch(e) {}
    // Logged-in users go straight to their dashboard
    if (user && user.email) window.location.href = 'dashboard.html';
    else showAuth('login');
  });
  signupBtn.addEventListener('click', async function() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('shopcos_user')); } catch(e) {}
    if (user && user.email) {
      await sb.auth.signOut();
      localStorage.removeItem('shopcos_user');
      location.reload();
    } else showAuth('signup');
  });
  authClose.addEventListener('click', hideAuth);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) hideAuth(); });
  document.getElementById('tabLogin').addEventListener('click', function() { switchTab('login'); });
  document.getElementById('tabSignup').addEventListener('click', function() { switchTab('signup'); });

  // Login with email + password
  document.getElementById('doLogin').addEventListener('click', async function() {
    var email = document.getElementById('loginEmail').value.trim();
    var pass = document.getElementById('loginPass').value;
    var err = document.getElementById('loginError');
    err.textContent = 'Logging in...';
    var { data, error } = await sb.auth.signInWithPassword({ email: email, password: pass });
    if (error) err.textContent = error.message;
    else if (data.user) showSuccess(data.user);
  });

  // Signup: send OTP
  document.getElementById('doSignup').addEventListener('click', async function() {
    var email = document.getElementById('signupEmail').value.trim();
    var pass = document.getElementById('signupPass').value;
    var err = document.getElementById('signupError');
    if (pass.length < 6) { err.textContent = 'Password 6 characters se zyada ho'; return; }
    err.textContent = 'Sending OTP...';
    // Store password temporarily, send OTP
    sessionStorage.setItem('sb_signup_pass', pass);
    var { error } = await sb.auth.signInWithOtp({ email: email });
    if (error) err.textContent = error.message;
    else { showOTP(email); err.textContent = ''; }
  });

  // Verify OTP
  document.getElementById('doVerify').addEventListener('click', async function() {
    var code = document.getElementById('otpCode').value.trim();
    var err = document.getElementById('otpError');
    if (code.length !== 6) { err.textContent = '6-digit code dalain'; return; }
    err.textContent = 'Verifying...';
    var { data, error } = await sb.auth.verifyOtp({ email: pendingEmail, token: code, type: 'email' });
    if (error) { err.textContent = error.message; return; }
    // Set password for the user
    var pass = sessionStorage.getItem('sb_signup_pass');
    if (pass && data.user) {
      await sb.auth.updateUser({ password: pass });
      sessionStorage.removeItem('sb_signup_pass');
    }
    if (data.user) showSuccess(data.user);
  });

  // Resend OTP
  document.getElementById('resendOTP').addEventListener('click', async function() {
    var err = document.getElementById('otpError');
    err.textContent = 'Sending...';
    var { error } = await sb.auth.signInWithOtp({ email: pendingEmail });
    err.textContent = error ? error.message : 'Naya code bhej diya! ✅';
    err.style.color = error ? '#ff6b6b' : '#4ade80';
  });

  document.getElementById('authDone').addEventListener('click', hideAuth);

  // Google OAuth via Supabase — land on the dashboard after sign-in
  async function googleAuth() {
    var { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard.html' }
    });
    if (error) alert(error.message);
  }
  document.getElementById('googleLogin').addEventListener('click', googleAuth);
  document.getElementById('googleSignup').addEventListener('click', googleAuth);

  // Load Supabase JS
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  s.onload = initSupabase;
  document.head.appendChild(s);
  // Fallback if already loaded
  setTimeout(function(){ if (!sb) initSupabase(); }, 2000);
})();

// Currency toggle for pricing
(function(){
  var prices = { USD: 145, PKR: 40000, INR: 12100, EUR: 133, GBP: 114 };
  var symbols = { USD: '$', PKR: 'Rs ', INR: '₹', EUR: '€', GBP: '£' };
  var btns = document.querySelectorAll('.cur-btn');
  var priceEl = document.querySelector('.price');
  if (!btns.length || !priceEl) return;
  btns.forEach(function(btn){
    btn.addEventListener('click', function(){
      btns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var cur = btn.getAttribute('data-cur');
      priceEl.innerHTML = '<span class="cur">' + symbols[cur] + '</span>' + prices[cur].toLocaleString() + ' <span class="usd">' + cur + '</span>';
    });
  });
})();

// Require auth for buy/order buttons
(function(){
  function isLoggedIn() {
    try {
      var u = JSON.parse(localStorage.getItem('shopcos_user'));
      return !!(u && u.email);
    } catch(e) { return false; }
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.require-auth');
    if (!btn) return;
    if (isLoggedIn()) return; // logged in — proceed normally
    e.preventDefault();
    // Not logged in — open auth modal directly
    var overlay = document.getElementById('authOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      // Switch to signup tab for new users
      var tabSignup = document.getElementById('tabSignup');
      if (tabSignup) tabSignup.click();
      // Store the intended action to resume after login
      var href = btn.getAttribute('href');
      if (href && href !== '#pricing') {
        sessionStorage.setItem('post_auth_action', href);
      }
    }
  });
  // After successful login, resume pending action
  var origShowSuccess = window.__shopcosShowSuccess;
  document.addEventListener('shopcos:authSuccess', function(){
    var pending = sessionStorage.getItem('post_auth_action');
    if (pending) {
      sessionStorage.removeItem('post_auth_action');
      setTimeout(function(){ window.open(pending, '_blank'); }, 500);
    }
  });
})();

// ============ AI Chat Widget (shopcos AI Assistant) ============
(function(){
  'use strict';
  var fab = document.getElementById('aiFab');
  var widget = document.getElementById('aiWidget');
  var msgs = document.getElementById('aiwMsgs');
  var input = document.getElementById('aiwInput');
  if (!fab || !widget) return;

  var WA_LINK = 'https://wa.me/923264025618?text=' + encodeURIComponent('Assalam-o-Alaikum! Mujhe shopcos soft ke baare mein maloomat chahiye.');

  var ANSWERS = [
    { k: ['price', 'qemat', 'qeemat', 'cost', 'paisa', 'kitne ka', 'rate'], a: '💰 <strong>$145 USD</strong> lifetime (Rs 40,000 PKR) — ek dafa payment, hamesha aapka! 7-day <strong>free trial</strong>, koi monthly fee nahi. 🚀' },
    { k: ['trial', 'free', 'muft', 'azma'], a: '🆓 <strong>7-day free trial</strong> — koi card nahi chahiye! Sign up karein aur trial auto-start ho jayega. Sab 15 features unlocked! ✨' },
    { k: ['apk', 'android', 'mobile', 'app'], a: '📱 <strong>Android APK</strong> available hai! Shop ke WiFi se connect karke mobile se billing karein. Dashboard se download karein! 📥' },
    { k: ['medical', 'pharmacy', 'dawai', 'medicine', 'doctor'], a: '💊 Ji haan! <strong>Medical store</strong> ke liye perfect — batch number, generic name, expiry tracking aur expiry alerts sab included! 🏥' },
    { k: ['kiryana', 'grocery', 'general store'], a: '🏪 Kiryana/general store ke liye ideal! Fast barcode billing, stock alerts, khata/udhar management — sab kuch ek screen par! ⚡' },
    { k: ['khata', 'udhar', 'credit', 'udhaar'], a: '📒 <strong>Khata/Udhar management</strong> built-in hai! Har customer ka balance, history aur credit limit track karein. Risky debtors ke alerts bhi! 💪' },
    { k: ['offline', 'internet', 'net'], a: '📴 <strong>100% offline</strong> kaam karta hai! Internet ki zaroorat nahi — bijli/internet jaye, dukaan chalti rahe! ⚡' },
    { k: ['feature', 'kya kya', 'facilities'], a: '✨ <strong>Key features:</strong><br>• ⚡ Barcode billing<br>• 📦 Smart stock + expiry alerts<br>• 📒 Khata/udhar<br>• 🤖 AI insights + Voice billing<br>• 👥 Staff roles<br>• 💾 Daily backup + Google Drive<br>• 🗣️ Urdu + English' },
    { k: ['support', 'madad', 'help', 'contact', 'rabta', 'number', 'phone', 'whatsapp'], a: '💬 <strong>COS — Developer</strong><br>📱 WhatsApp: <a href="' + WA_LINK + '" target="_blank" style="color:#ffd97a"><strong>+92 326 4025618</strong></a><br>Rabta karein — Urdu ya English mein! 😊' },
    { k: ['download', 'software', 'install'], a: '💻 <strong>Windows portable</strong> — no installation, bas unzip karke chalao! Sign up ke baad dashboard se download karein. 📥' },
    { k: ['language', 'urdu', 'zuban', 'bhasha'], a: '🗣️ <strong>Urdu + English</strong> dono! 28 currencies aur 31 countries supported — poori duniya ke liye! 🌍' },
    { k: ['nam', 'name', 'kaun ho', 'who are you', 'tum kaun'], a: '🤖 Main <strong>shopcos AI Assistant</strong> hoon! Software, pricing ya features ke baare mein kuch bhi poochein! 😊' },
    { k: ['salam', 'assalam', 'hello', 'hi ', 'hey'], a: 'Walaikum Assalam! 👋 Main shopcos AI hoon. Software, price ya trial ke baare mein poochein! 😊' }
  ];
  var DEFAULT_A = 'Aapke sawal ka jawab jald aa raha hai! 😊 Tab tak <strong>WhatsApp</strong> par poochein: <a href="' + WA_LINK + '" target="_blank" style="color:#ffd97a">Chat karein →</a><br><br>Ya neeche chips par click karein! 👇';

  function scrollBottom(){ msgs.scrollTop = msgs.scrollHeight; }
  function addMsg(html, who){
    var d = document.createElement('div');
    d.className = 'aiw-msg ' + who;
    d.innerHTML = html;
    msgs.appendChild(d);
    scrollBottom();
  }
  function findAnswer(q){
    q = ' ' + q.toLowerCase() + ' ';
    for (var i = 0; i < ANSWERS.length; i++){
      var keys = ANSWERS[i].k;
      for (var j = 0; j < keys.length; j++){
        if (q.indexOf(keys[j]) !== -1) return ANSWERS[i].a;
      }
    }
    return DEFAULT_A;
  }
  var opened = false;
  function openWidget(){
    widget.style.display = 'flex';
    fab.style.display = 'none';
    if (!opened){
      opened = true;
      setTimeout(function(){
        addMsg('Assalam-o-Alaikum! 👋 Main <strong>shopcos AI</strong> hoon.<br>Software, pricing, ya features ke baare mein poochein!', 'bot');
      }, 300);
    }
    setTimeout(function(){ input.focus(); }, 100);
  }
  function closeWidget(){
    widget.style.display = 'none';
    fab.style.display = 'flex';
  }
  fab.addEventListener('click', openWidget);
  document.getElementById('aiwClose').addEventListener('click', closeWidget);

  function send(){
    var q = input.value.trim();
    if (!q) return;
    input.value = '';
    addMsg(q.replace(/</g, '&lt;'), 'user');
    var tp = document.createElement('div');
    tp.className = 'aiw-msg bot typing';
    tp.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(tp);
    scrollBottom();
    setTimeout(function(){
      tp.remove();
      addMsg(findAnswer(q), 'bot');
    }, 700 + Math.random() * 500);
  }
  document.getElementById('aiwSend').addEventListener('click', send);
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') send(); });
  document.getElementById('aiwChips').addEventListener('click', function(e){
    var b = e.target.closest('button');
    if (!b) return;
    var map = { price: 'Price kya hai?', trial: 'Free trial hai?', apk: 'APK available hai?', medical: 'Medical store ke liye use ho sakta?' };
    input.value = map[b.getAttribute('data-q')] || '';
    send();
  });
  // Escape closes widget
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && widget.style.display === 'flex') closeWidget();
  });
})();

// ============ Hero AI Demo — auto-playing chat loop ============
(function(){
  'use strict';
  var body = document.getElementById('aiDemoBody');
  if (!body) return;

  var SCRIPT = [
    { who: 'user', text: 'Aaj kitni sale hui? 💰' },
    { who: 'bot',  text: 'Aaj ki sale: <strong>Rs 24,500!</strong> 🎉 32 bills, profit Rs 6,200. Zabardast ja rahe ho!' },
    { who: 'user', text: 'Ali ka udhar? 🤔' },
    { who: 'bot',  text: 'Ali ka balance: <strong>Rs 3,200</strong>. 💡 15 din se pending hai — ek reminder bhej dein?' },
    { who: 'user', text: 'Cheeni ka stock? 📦' },
    { who: 'bot',  text: 'Cheeni: <strong>12 bags</strong> bache — 4 din ka stock! ⚠️ Kal order kar dein?' }
  ];

  function addMsg(who, html){
    var d = document.createElement('div');
    d.className = 'ai-dmsg ' + who;
    d.innerHTML = html;
    body.appendChild(d);
  }
  function showTyping(){
    var t = document.createElement('div');
    t.className = 'ai-dtyping';
    t.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(t);
    return t;
  }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  var running = true;
  document.addEventListener('visibilitychange', function(){
    running = !document.hidden;
  });

  async function playLoop(){
    var i = 0;
    // small initial delay so hero settles first
    await sleep(1200);
    while (true){
      if (!running){ await sleep(800); continue; }
      var step = SCRIPT[i % SCRIPT.length];
      // clear and restart loop
      if (i > 0 && i % SCRIPT.length === 0){
        await sleep(3500);
        body.innerHTML = '';
      }
      if (step.who === 'bot'){
        var tp = showTyping();
        await sleep(1100);
        tp.remove();
      } else {
        await sleep(700);
      }
      addMsg(step.who, step.text);
      i++;
      await sleep(step.who === 'bot' ? 2100 : 600);
    }
  }
  playLoop();

  // "Try it live" buttons → open the real AI chat widget
  function openRealAi(){
    var fab = document.getElementById('aiFab');
    if (fab) fab.click();
  }
  var b1 = document.getElementById('tryAiLive');
  var b2 = document.getElementById('aiDemoTry');
  if (b1) b1.addEventListener('click', openRealAi);
  if (b2) b2.addEventListener('click', openRealAi);
})();

// ============ WOWWW OVERHAUL — micro-interactions ============
(function(){
  'use strict';

  // ---- Preloader (fast hide) ----
  function hidePre(){
    var p = document.getElementById('preloader');
    if(p) p.classList.add('done');
  }
  window.addEventListener('load', function(){ setTimeout(hidePre, 500); });
  // safety: never trap the user
  setTimeout(hidePre, 2500);

  // ---- 3D tilt on cards (desktop only) ----
  if(window.matchMedia('(hover:hover) and (pointer:fine)').matches){
    document.querySelectorAll('.tilt').forEach(function(card){
      var raf = null;
      card.addEventListener('mousemove', function(e){
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5;
        var y = (e.clientY - r.top) / r.height - .5;
        if(raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function(){
          card.style.transform = 'perspective(900px) rotateY(' + (x*7).toFixed(2) + 'deg) rotateX(' + (-y*7).toFixed(2) + 'deg) translateY(-6px)';
        });
      });
      card.addEventListener('mouseleave', function(){
        if(raf) cancelAnimationFrame(raf);
        card.style.transform = '';
      });
    });
  }

  // ---- Button click ripple ----
  document.querySelectorAll('.btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      var rect = btn.getBoundingClientRect();
      var rip = document.createElement('span');
      rip.className = 'ripple';
      var size = Math.max(rect.width, rect.height);
      rip.style.width = rip.style.height = size + 'px';
      rip.style.left = (e.clientX - rect.left - size/2) + 'px';
      rip.style.top = (e.clientY - rect.top - size/2) + 'px';
      btn.appendChild(rip);
      setTimeout(function(){ rip.remove(); }, 650);
    });
  });

  // ---- Back-to-top with scroll progress ring ----
  var toTop = document.getElementById('toTop');
  var fg = document.getElementById('toTopFg');
  var CIRC = 2 * Math.PI * 23; // r=23
  if(toTop && fg){
    fg.style.strokeDasharray = CIRC;
    fg.style.strokeDashoffset = CIRC;
    function onScrollTop(){
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      fg.style.strokeDashoffset = CIRC * (1 - p);
      toTop.classList.toggle('show', (h.scrollTop || 0) > 600);
    }
    window.addEventListener('scroll', onScrollTop, {passive:true});
    onScrollTop();
    toTop.addEventListener('click', function(){
      window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  // ---- Hero parallax on scroll (subtle) ----
  var hero = document.querySelector('.hero');
  var hp = document.querySelector('.hero-parallax');
  if(hero && hp){
    var ticking = false;
    window.addEventListener('scroll', function(){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        var y = window.scrollY;
        if(y < window.innerHeight){
          hp.style.transform = 'translateY(' + (y * .18).toFixed(1) + 'px)';
        }
        ticking = false;
      });
    }, {passive:true});
  }

  // ---- Nav CTA pulse is handled via CSS (.nav-cta .btn-primary) ----
})();
