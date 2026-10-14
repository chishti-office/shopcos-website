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

// ============ Auth System ============
(function(){
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbwFao18zk1hLujUHIzHzr7SBAHkmej_-n53YvZ4wbdxIeERGblSplRFupEjBry-fpp6Bw/exec';
  var pendingEmail = '';

  var overlay = document.getElementById('authOverlay');
  var loginBtn = document.getElementById('loginBtn');
  var signupBtn = document.getElementById('signupBtn');
  var authClose = document.getElementById('authClose');

  function showAuth(tab) {
    overlay.style.display = 'flex';
    switchTab(tab || 'login');
  }
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
    document.getElementById('formLogin').style.display = 'none';
    document.getElementById('formSignup').style.display = 'none';
    document.getElementById('formOTP').style.display = 'block';
    document.getElementById('formSuccess').style.display = 'none';
  }
  function showSuccess(user) {
    document.getElementById('formLogin').style.display = 'none';
    document.getElementById('formSignup').style.display = 'none';
    document.getElementById('formOTP').style.display = 'none';
    document.getElementById('formSuccess').style.display = 'block';
    if (user.licenseKey) document.getElementById('userKey').textContent = user.licenseKey;
    localStorage.setItem('shopcos_user', JSON.stringify(user));
    updateNav();
  }
  function updateNav() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('shopcos_user')); } catch(e) {}
    if (user && user.email) {
      loginBtn.textContent = user.email.split('@')[0];
      signupBtn.textContent = 'Logout';
      signupBtn.onclick = function() {
        localStorage.removeItem('shopcos_user');
        location.reload();
      };
    }
  }

  async function api(action, data) {
    data = data || {}; data.action = action;
    var res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  loginBtn.addEventListener('click', function() { showAuth('login'); });
  signupBtn.addEventListener('click', function() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('shopcos_user')); } catch(e) {}
    if (user && user.email) {
      localStorage.removeItem('shopcos_user');
      location.reload();
    } else showAuth('signup');
  });
  authClose.addEventListener('click', hideAuth);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) hideAuth(); });
  document.getElementById('tabLogin').addEventListener('click', function() { switchTab('login'); });
  document.getElementById('tabSignup').addEventListener('click', function() { switchTab('signup'); });

  // Login
  document.getElementById('doLogin').addEventListener('click', async function() {
    var email = document.getElementById('loginEmail').value.trim();
    var pass = document.getElementById('loginPass').value;
    var err = document.getElementById('loginError');
    err.textContent = 'Logging in...';
    try {
      var r = await api('login', { email: email, password: pass });
      if (r.ok) { showSuccess(r); }
      else if (r.needsOTP) { showOTP(r.email || email); err.textContent = ''; }
      else err.textContent = r.error || 'Login failed';
    } catch(e) { err.textContent = 'Connection error — try again'; }
  });

  // Signup
  document.getElementById('doSignup').addEventListener('click', async function() {
    var email = document.getElementById('signupEmail').value.trim();
    var pass = document.getElementById('signupPass').value;
    var err = document.getElementById('signupError');
    err.textContent = 'Sending OTP...';
    try {
      var r = await api('signup', { email: email, password: pass });
      if (r.ok && r.needsOTP) { showOTP(email); err.textContent = ''; }
      else err.textContent = r.error || 'Signup failed';
    } catch(e) { err.textContent = 'Connection error — try again'; }
  });

  // Verify OTP
  document.getElementById('doVerify').addEventListener('click', async function() {
    var code = document.getElementById('otpCode').value.trim();
    var err = document.getElementById('otpError');
    if (code.length !== 6) { err.textContent = '6-digit code dalain'; return; }
    err.textContent = 'Verifying...';
    try {
      var r = await api('verifyOTP', { email: pendingEmail, code: code });
      if (r.ok) { showSuccess(r); }
      else err.textContent = r.error || 'Verification failed';
    } catch(e) { err.textContent = 'Connection error — try again'; }
  });

  // Resend OTP
  document.getElementById('resendOTP').addEventListener('click', async function() {
    var err = document.getElementById('otpError');
    err.textContent = 'Sending...';
    try {
      var r = await api('sendOTP', { email: pendingEmail });
      err.textContent = r.ok ? 'Naya code bhej diya! ✅' : (r.error || 'Failed');
      err.style.color = r.ok ? '#4ade80' : '#ff6b6b';
    } catch(e) { err.textContent = 'Connection error'; }
  });

  document.getElementById('authDone').addEventListener('click', hideAuth);

  // Google Sign-In (using Google Identity Services)
  function initGoogle() {
    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(initGoogle, 500); return;
    }
    google.accounts.id.initialize({
      client_id: '5145903963-im5rmn882upqiar20ajsnp9kbe0q2mnc.apps.googleusercontent.com',
      callback: async function(resp) {
        try {
          var r = await api('gauth', { idToken: resp.credential });
          if (r.ok) showSuccess(r);
          else alert(r.error || 'Google login failed');
        } catch(e) { alert('Connection error'); }
      }
    });
    var btns = [document.getElementById('googleLogin'), document.getElementById('googleSignup')];
    btns.forEach(function(b) {
      if (b) b.addEventListener('click', function() {
        google.accounts.id.prompt();
      });
    });
  }
  // Load Google Identity Services
  var gs = document.createElement('script');
  gs.src = 'https://accounts.google.com/gsi/client';
  gs.onload = initGoogle;
  document.head.appendChild(gs);

  updateNav();
})();
