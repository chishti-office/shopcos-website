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
    ['formLogin','formSignup','formOTP'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
    document.getElementById('formSuccess').style.display = 'block';
    if (lic && lic.license_key) document.getElementById('userKey').textContent = lic.license_key;
    localStorage.setItem('shopcos_user', JSON.stringify({ email: user.email, id: user.id }));
    updateNav();
  }
  async function checkSession() {
    var { data } = await sb.auth.getSession();
    if (data.session && data.session.user) {
      localStorage.setItem('shopcos_user', JSON.stringify({ email: data.session.user.email, id: data.session.user.id }));
      updateNav();
    }
  }
  function updateNav() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('shopcos_user')); } catch(e) {}
    if (user && user.email) {
      loginBtn.textContent = user.email.split('@')[0];
      signupBtn.textContent = 'Logout';
      signupBtn.onclick = async function() {
        await sb.auth.signOut();
        localStorage.removeItem('shopcos_user');
        location.reload();
      };
    }
  }

  loginBtn.addEventListener('click', function() { showAuth('login'); });
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

  // Google OAuth via Supabase
  async function googleAuth() {
    var { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
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
