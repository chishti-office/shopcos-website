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
    window.__shopcosSB = sb; // expose for currency/language sync IIFE
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
    var trialEnds = new Date(Date.now() + 30*86400000).toISOString();
    var shop = sessionStorage.getItem('sb_signup_shop') || '';
    var phone = sessionStorage.getItem('sb_signup_phone') || '';
    sessionStorage.removeItem('sb_signup_shop');
    sessionStorage.removeItem('sb_signup_phone');
    var { data: ins } = await sb.from('licenses').insert({
      user_id: user.id, email: user.email, license_key: key,
      type: 'trial', status: 'active', trial_ends_at: trialEnds,
      shop_name: shop, phone: phone
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
    document.getElementById('formForgot').style.display = 'none';
    document.getElementById('formReset').style.display = 'none';
  }
  function showForgot() {
    ['formLogin','formSignup','formOTP','formSuccess','formReset'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
    document.getElementById('formForgot').style.display = 'block';
    document.getElementById('forgotError').textContent = '';
  }
  function showResetForm() {
    ['formLogin','formSignup','formOTP','formSuccess','formForgot'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
    document.getElementById('formReset').style.display = 'block';
    document.getElementById('resetError').textContent = '';
  }
  function showOTP(email) {
    pendingEmail = email;
    document.getElementById('otpEmail').textContent = email;
    ['formLogin','formSignup'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
    document.getElementById('formOTP').style.display = 'block';
    document.getElementById('formSuccess').style.display = 'none';
    if (typeof startResendTimer === 'function') { try { startResendTimer(); } catch(e){} }
  }
  async function showSuccess(user) {
    var lic = await ensureLicense(user);
    localStorage.setItem('shopcos_user', JSON.stringify({ email: user.email, id: user.id }));
    updateNav();
    // Take the user to their dashboard (separate page, not the landing page)
    window.location.href = 'dashboard/';
  }
  async function checkSession() {
    var { data } = await sb.auth.getSession();
    if (data.session && data.session.user) {
      localStorage.setItem('shopcos_user', JSON.stringify({ email: data.session.user.email, id: data.session.user.id }));
      updateNav();
    }
    // Notice set by dashboard/ when a logged-out user lands there
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
      loginBtn.onclick = function() { window.location.href = 'dashboard/'; };
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
        db.href = 'dashboard/';
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
    if (user && user.email) window.location.href = 'dashboard/';
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

  // Forgot password: send reset link to email
  document.getElementById('forgotLink').addEventListener('click', function(e) { e.preventDefault(); showForgot(); });
  document.getElementById('backToLogin').addEventListener('click', function(e) { e.preventDefault(); switchTab('login'); });
  document.getElementById('doForgot').addEventListener('click', async function() {
    var email = document.getElementById('forgotEmail').value.trim();
    var err = document.getElementById('forgotError');
    if (!email) { err.textContent = 'Gmail likhein'; return; }
    err.textContent = 'Sending...';
    var { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://shopcos.shop/' });
    if (error) err.textContent = error.message;
    else { err.textContent = ''; err.style.color = 'green'; err.textContent = '✅ Reset link bhej diya! Gmail check karein (spam folder bhi).'; }
  });

  // Set new password (opened from the email recovery link)
  document.getElementById('doResetPass').addEventListener('click', async function() {
    var p1 = document.getElementById('resetPass').value;
    var p2 = document.getElementById('resetPass2').value;
    var err = document.getElementById('resetError');
    if (p1.length < 6) { err.textContent = 'Password 6 characters se zyada ho'; return; }
    if (p1 !== p2) { err.textContent = 'Dono password same likhein'; return; }
    err.textContent = 'Saving...';
    var { data, error } = await sb.auth.updateUser({ password: p1 });
    if (error) err.textContent = error.message;
    else if (data.user) { window.location.hash = ''; showSuccess(data.user); }
  });

  // If opened via password-recovery email link, show the new-password form
  if (window.location.hash && window.location.hash.indexOf('type=recovery') !== -1) {
    showAuth('login'); showResetForm();
  }

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
    var btn = this;
    var email = document.getElementById('signupEmail').value.trim();
    var pass = document.getElementById('signupPass').value;
    var shop = (document.getElementById('signupShop') || {}).value || '';
    var phone = (document.getElementById('signupPhone') || {}).value || '';
    var err = document.getElementById('signupError');
    if (pass.length < 6) { err.textContent = 'Password 6 characters se zyada ho'; return; }
    btn.disabled = true;
    err.textContent = 'Sending OTP...';
    // Store password + shop/phone temporarily, send OTP
    sessionStorage.setItem('sb_signup_pass', pass);
    sessionStorage.setItem('sb_signup_shop', shop.trim());
    sessionStorage.setItem('sb_signup_phone', phone.trim());
    var { error } = await sb.auth.signInWithOtp({ email: email });
    btn.disabled = false;
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
    if (error) {
      var m = error.message || '';
      if (/expir|invalid/i.test(m)) {
        err.textContent = 'Ye code purana ho gaya hai. Neeche "Resend Code" dabayein aur NAYA code foran enter karein.';
      } else { err.textContent = m; }
      return;
    }
    // Set password for the user
    var pass = sessionStorage.getItem('sb_signup_pass');
    if (pass && data.user) {
      await sb.auth.updateUser({ password: pass });
      sessionStorage.removeItem('sb_signup_pass');
    }
    if (data.user) showSuccess(data.user);
  });

  // Resend OTP with 60-sec timer
  var resendTimer = null, resendSecs = 0;
  function startResendTimer(){
    var btn = document.getElementById('resendOTP');
    clearInterval(resendTimer);
    resendSecs = 60;
    btn.disabled = true;
    btn.style.opacity = '.5';
    btn.style.cursor = 'not-allowed';
    btn.textContent = 'Resend Code (' + resendSecs + 's)';
    resendTimer = setInterval(function(){
      resendSecs--;
      if (resendSecs <= 0) {
        clearInterval(resendTimer);
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.textContent = 'Resend Code';
      } else {
        btn.textContent = 'Resend Code (' + resendSecs + 's)';
      }
    }, 1000);
  }
  document.getElementById('resendOTP').addEventListener('click', async function() {
    if (this.disabled) return;
    var err = document.getElementById('otpError');
    err.textContent = 'Sending...';
    err.style.color = '';
    var { error } = await sb.auth.signInWithOtp({ email: pendingEmail });
    err.textContent = error ? error.message : 'New code sent! ✅';
    err.style.color = error ? '#ff6b6b' : '#4ade80';
    if (!error) startResendTimer();
  });


  document.getElementById('authDone').addEventListener('click', hideAuth);

  // Google OAuth via Supabase — land on the dashboard after sign-in
  async function googleAuth() {
    var { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard/' }
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
    { k: ['konsa plan', 'kaunsa plan', 'which plan', 'konsa loon', 'kaunsa loon', 'konsa le', 'recommend', 'suggest', 'choti shop', 'chhoti shop', 'small shop', 'bari shop', 'badi shop'], a: '🎯 <strong>Mere mashwara:</strong><br><br>🏪 <strong>Choti shop (akelai kaam)</strong> → <strong>$90 Starter</strong> — bas aap ke liye perfect!<br><br>👥 <strong>2-3 staff wali shop</strong> → <strong>$145 Business</strong> ⭐ sab se popular! 1 Editor + 2 Users<br><br>🏬 <strong>Bari shop / multiple counters</strong> → <strong>$290 Professional</strong> — 2 Editors + 10 Users<br><br>🏢 <strong>Chain / bohat bara setup</strong> → <strong>$545 Enterprise</strong> — unlimited!<br><br>💡 <strong>Tip:</strong> Pehle <strong>30-day free trial</strong> lein (Business plan unlocked) — pasand aye to khareed lein! 🆓' },
    { k: ['plian', 'paln', 'qemat', 'qeemat'], a: '💰 <strong>4 Plans:</strong><br>• <strong>$90</strong> Starter (Rs 25,000) — 1 Admin<br>• <strong>$145</strong> Business ⭐ (Rs 40,000) — 1 Admin + 1 Editor + 2 Users<br>• <strong>$290</strong> Professional (Rs 80,000) — 1 Admin + 2 Editors + 10 Users<br>• <strong>$545</strong> Enterprise (Rs 150,000) — 1 Admin + 5 Editors + Unlimited Users<br><br>Lifetime license, no monthly fee! 🚀' },
    { k: ['trial', 'free', 'muft', 'azma'], a: '🆓 <strong>30-day free trial</strong> — koi card nahi chahiye! Sign up karein aur trial auto-start ho jayega. Trial mein <strong>Business plan</strong> unlocked (1 Editor + 2 Users)! ✨' },
    { k: ['apk', 'android', 'mobile', 'app'], a: '📱 <strong>Android APK</strong> available hai! Shop ke WiFi se connect karke mobile se billing karein. Dashboard se download karein! 📥' },
    { k: ['medical', 'pharmacy', 'dawai', 'medicine', 'doctor'], a: '💊 Ji haan! <strong>Medical store</strong> ke liye perfect — batch number, generic name, expiry tracking aur expiry alerts sab included! 🏥' },
    { k: ['kiryana', 'grocery', 'general store'], a: '🏪 Kiryana/general store ke liye ideal! Fast barcode billing, stock alerts, khata/udhar management — sab kuch ek screen par! ⚡' },
    { k: ['khata', 'udhar', 'credit', 'udhaar', 'ledger'], a: '📒 <strong>Khata/Udhar management</strong> built-in hai! Har customer ka balance, history aur credit limit track karein. Risky debtors ke alerts bhi! 💪' },
    { k: ['offline', 'internet', 'net'], a: '📴 <strong>100% offline</strong> kaam karta hai! Internet ki zaroorat nahi — bijli/internet jaye, dukaan chalti rahe! Net aye to auto cloud sync! ☁️⚡' },
    { k: ['feature', 'kya kya', 'facilities'], a: '✨ <strong>Key features:</strong><br>• ⚡ Barcode billing<br>• 📦 Smart stock + expiry alerts<br>• 📒 Khata/udhar<br>• 🤖 AI assistant (sawal jawab + mashwaray)<br>• 🎤 Voice billing<br>• 👥 Admin/Editor/User roles<br>• ☁️ Cloud sync + offline<br>• 💾 Daily backup + Google Drive<br>• 🗣️ Urdu + English, 28 currencies' },
    { k: ['support', 'madad', 'help', 'contact', 'rabta', 'number', 'phone', 'whatsapp'], a: '💬 <strong>COS — Developer</strong><br>📱 WhatsApp: <a href="' + WA_LINK + '" target="_blank" style="color:#ffd97a"><strong>+92 326 4025618</strong></a><br>Rabta karein — Urdu ya English mein! 😊' },
    { k: ['download', 'software', 'install'], a: '💻 <strong>Windows portable</strong> — no installation, bas unzip karke chalao! Sign up ke baad dashboard se download karein. 📥' },
    { k: ['language', 'urdu', 'zuban', 'bhasha', 'currency', 'country'], a: '🗣️ <strong>Urdu + English</strong> dono! 28 currencies aur 31 countries supported — poori duniya ke liye! 🌍' },
    { k: ['ai', 'artificial', 'bot', 'robot', 'chat'], a: '🤖 <strong>shopcos AI Assistant</strong> — aapka smart munshi! Poochein "aaj kitni sale hui?", ya kahein "Faizan se 500 lene hain" — wo yaad rakhega, khate mein update karega, aur reminder bhi dega! 💡' },
    { k: ['voice', 'awaz', 'bol'], a: '🎤 <strong>Voice billing</strong> — bas bolein "Cheeni 2, Oil 1" aur bill khud ban jayega! Haath se type karne ki zaroorat nahi! ⚡' },
    { k: ['backup'], a: '💾 <strong>Daily auto-backup</strong> + Google Drive sync! Aapka data kabhi nahi khoyega. Settings se manual backup bhi le sakte hain! ✅' },
    { k: ['cloud', 'sync'], a: '☁️ <strong>Cloud sync</strong> — net ho to auto-sync, net jaye to offline kaam jari! Wapas aye to sab sync ho jayega. Phone + computer par same data! 📱💻' },
    { k: ['staff', 'user', 'editor', 'role', 'admin'], a: '👥 <strong>3 Roles:</strong><br>👑 <strong>Admin</strong> — full access, users banaye<br>✏️ <strong>Editor</strong> — products, stock, rates (no AI)<br>🧾 <strong>User</strong> — sirf billing, sirf sale rate<br><br>Plan ke hisab se limits! 🔒' },
    { k: ['barcode'], a: '📊 <strong>Barcode</strong> support built-in! Scanner se scan karein ya manual entry — dono kaam karte hain. Labels bhi print kar sakte hain! 🏷️' },
    { k: ['report'], a: '📈 <strong>Reports</strong> — daily/weekly/monthly sales, profit analysis, stock reports, khata statements. PDF/CSV mein export karein! 📊' },
    { k: ['nam', 'name', 'kaun ho', 'who are you', 'tum kaun'], a: '🤖 Main <strong>shopcos AI Assistant</strong> hoon! Software, pricing ya features ke baare mein kuch bhi poochein! 😊' },
    { k: ['salam', 'assalam', 'hello', 'hi ', 'hey'], a: 'Walaikum Assalam! 👋 Main shopcos AI hoon. Software, price ya trial ke baare mein poochein! 😊' }
  ];
  var DEFAULT_A = 'Hmm, is bare mein thoda aur batayein? 🤔 Main aapki madad kar sakta hoon:<br><br>💰 <strong>Price</strong> — kitne ka hai?<br>🆓 <strong>Free trial</strong> — kaise shuru karein?<br>✨ <strong>Features</strong> — kya kya hai?<br>📱 <strong>APK</strong> — mobile app<br>💊 <strong>Medical store</strong> ke liye?<br><br>Ya phir apna sawal dobara likhein! 😊';

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
        addMsg('Hello! 👋 I\'m <strong>shopcos AI</strong>.<br>Ask me about software, pricing, or features!', 'bot');
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

  // Auto-open AI chat for first-time visitors (AI first!) — but not over the hero
  try {
    if (!localStorage.getItem('shopcos_ai_seen')) {
      setTimeout(function(){
        // Only auto-open if user scrolled past hero (avoid covering demo)
        var heroVisible = false;
        try {
          var hero = document.querySelector('.hero');
          if (hero) {
            var r = hero.getBoundingClientRect();
            heroVisible = r.bottom > 100;
          }
        } catch(e){}
        if (!heroVisible) {
          openWidget();
        } else {
          // Hero visible: pulse the button instead of covering demo
          fab.classList.add('ai-fab-attention');
          setTimeout(function(){ fab.classList.remove('ai-fab-attention'); }, 5000);
        }
        localStorage.setItem('shopcos_ai_seen', '1');
      }, 5000);
    }
  } catch(e) {}

  var AI_SYSTEM = 'You are shopcos AI, friendly assistant for shopcos soft billing software. Plans (LIFETIME, not monthly): Starter $90 (1 admin), Business $145 (1 admin+1 editor+2 users), Professional $290 (1 admin+2 editors+10 users), Enterprise $545 (1 admin+5 editors+unlimited). 30-day free trial with Business plan unlocked. Features: barcode billing, stock alerts, khata/udhar, AI assistant, voice billing, cloud sync, offline mode, 28 currencies, Urdu+English. IMPORTANT: Detect the user\'s language from their message and reply in the SAME language. If they write in Urdu/Roman Urdu, reply in Roman Urdu. If they write in English, reply in English. Keep answers brief (2-3 lines max), friendly. Never mention monthly pricing.';

  var WORKER_URL = 'https://shopcos-ai-chat.chishtioffice2.workers.dev';
  function workerReplyOk(t){
    // The Worker swallows Groq errors and answers HTTP 200 with a "busy"
    // fallback string — that counts as failure, never as a real answer.
    t = (t || '').trim();
    return !!t && t.indexOf('Thoda busy hun') === -1 && t.charAt(0) !== '⏳';
  }
  function askAI(q, cb){
    // Try Cloudflare Worker (Groq) first — no rate limits, key stays secret
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 15000) : null;
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q })
    };
    if (ctrl) opts.signal = ctrl.signal;
    fetch(WORKER_URL, opts).then(function(r){
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('worker ' + r.status);
      return r.json();
    }).then(function(j){
      var rep = (j && j.reply) ? String(j.reply).trim() : '';
      if (workerReplyOk(rep)) { cb(rep); return; }
      throw new Error('worker busy');
    }).catch(function(){
      if (timer) clearTimeout(timer);
      // Fallback: Pollinations (keyless)
      var url = 'https://text.pollinations.ai/' + encodeURIComponent(q) + '?system=' + encodeURIComponent(AI_SYSTEM);
      fetch(url).then(function(r){ return r.text(); }).then(function(t){
        t = (t || '').trim();
        if (t.indexOf('Free limit reached') !== -1 || t.indexOf('Please wait') !== -1) {
          cb('⏳ Thoda busy hun! 30 second baad dobara poochein 🙏');
          return;
        }
        cb(t || null);
      }).catch(function(){ cb(null); });
    });
  }

  // ---- Photo attach (📷) — visitor photo bhejta hai, AI dekh kar jawab deta hai ----
  var pendingImg = null; // downscaled JPEG data-URI, send ke liye ready
  var fileInput = document.getElementById('aiwFile');
  var attachBtn = document.getElementById('aiwAttach');
  var previewBar = document.getElementById('aiwPreview');
  var previewImg = document.getElementById('aiwPreviewImg');
  var previewName = document.getElementById('aiwPreviewName');

  function chatNote(text){
    var d = document.createElement('div');
    d.className = 'aiw-msg bot aiw-note';
    d.textContent = text;
    msgs.appendChild(d);
    scrollBottom();
  }
  function clearPendingImg(){
    pendingImg = null;
    if (fileInput) fileInput.value = '';
    if (previewBar) previewBar.style.display = 'none';
    if (previewImg) previewImg.removeAttribute('src');
  }
  function downscaleImage(file, done){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      var w = img.naturalWidth, h = img.naturalHeight;
      var max = 1024;
      if (w > max || h > max){
        var s = max / Math.max(w, h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      done(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function(){
      URL.revokeObjectURL(url);
      done(null);
    };
    img.src = url;
  }
  if (attachBtn && fileInput){
    attachBtn.addEventListener('click', function(){ fileInput.click(); });
    fileInput.addEventListener('change', function(){
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (f.type.indexOf('image/') !== 0){
        chatNote('⚠️ Ye photo nahi hai — meharbani karke ek image file chunein (JPG / PNG). / Please choose an image file.');
        clearPendingImg();
        return;
      }
      if (f.size > 10 * 1024 * 1024){
        chatNote('⚠️ Photo bohat bari hai (max 10 MB). Chhoti photo try karein. / Photo is too large (max 10 MB).');
        clearPendingImg();
        return;
      }
      downscaleImage(f, function(dataUri){
        if (!dataUri){
          chatNote('⚠️ Photo khul nahi saki — koi aur photo try karein. / Could not read that photo, please try another.');
          clearPendingImg();
          return;
        }
        pendingImg = dataUri;
        previewImg.src = dataUri;
        previewName.textContent = f.name || 'photo';
        previewBar.style.display = 'flex';
        input.focus();
      });
    });
    document.getElementById('aiwPreviewRemove').addEventListener('click', clearPendingImg);
  }

  var PHOTO_FALLBACK = '📷 Maazrat! Is waqt photo dekhne wali sahulat jawab nahi de rahi. 🙏 Aap photo ke baare mein likh kar bata dein — main yahin madad kar dunga! (You can also type what is in the photo.)';
  var PHOTO_DEFAULT_Q = 'Is photo mein kya hai? Describe this photo briefly.';
  function askAIWithImage(q, imgData, cb){
    // Photo sirf Worker (Groq vision) se — jawaab mein vision flag lazmi hai,
    // warna samjha jayega ke photo process nahi hui (purana worker) → polite fallback.
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 40000) : null;
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q, image: imgData })
    };
    if (ctrl) opts.signal = ctrl.signal;
    fetch(WORKER_URL, opts).then(function(r){
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('worker ' + r.status);
      return r.json();
    }).then(function(j){
      var rep = (j && j.reply) ? String(j.reply).trim() : '';
      if (j && j.vision === true && workerReplyOk(rep)) { cb(rep); return; }
      cb(PHOTO_FALLBACK);
    }).catch(function(){
      if (timer) clearTimeout(timer);
      cb(PHOTO_FALLBACK);
    });
  }

  function send(){
    var q = input.value.trim();
    var img = pendingImg;
    if (!q && !img) return;
    input.value = '';
    clearPendingImg();
    var html = '';
    if (img) html += '<img class="aiw-sent-img" src="' + img + '" alt="Attached photo">';
    if (q) html += '<span>' + q.replace(/</g, '&lt;') + '</span>';
    addMsg(html, 'user');
    var tp = document.createElement('div');
    tp.className = 'aiw-msg bot typing';
    tp.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(tp);
    scrollBottom();
    if (img) {
      askAIWithImage(q || PHOTO_DEFAULT_Q, img, function(aiAns){
        tp.remove();
        addMsg(aiAns, 'bot');
      });
      return;
    }
    askAI(q, function(aiAns){
      tp.remove();
      if (aiAns) { addMsg(aiAns, 'bot'); }
      else { addMsg(findAnswer(q), 'bot'); }
    });
  }
  document.getElementById('aiwSend').addEventListener('click', send);
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') send(); });
  document.getElementById('aiwChips').addEventListener('click', function(e){
    var b = e.target.closest('button');
    if (!b) return;
    var map = { price: 'What is the price?', trial: 'Is there a free trial?', apk: 'Is APK available?', medical: 'Can it be used for medical stores?' };
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

// ============ Language & Currency selectors ============
(function(){
  'use strict';

  // ---- i18n dictionary ----
  var I18N = {
    en: {
      nav_features: 'Features', nav_how: 'How it works', nav_blog: 'Blog', nav_pricing: 'Pricing', nav_faq: 'FAQ',
      login: 'Login', signup: 'Sign Up',
      hero_eyebrow: '<span class="pulse-dot"></span> 🤖 shopcos AI — Shop Software for 31 Countries · POS Billing · 100% Offline',
      hero_h1: '🤖 Talk to Your Shop. <span class="grad">Your Entire Business, In Your Pocket.</span>',
      hero_sub: 'Meet <strong>shopcos AI</strong> — ask <em>"how much did I sell today?"</em> and get instant answers. Billing, stock, credit ledger, reports — on your computer <strong>AND</strong> phone, wherever you are. 28 currencies, 31 countries. No internet needed. No monthly fees. <span class="seo-kw">Best shop software &amp; point of sale (POS) billing software for retail shops, pharmacies &amp; small businesses worldwide.</span>',
      cta_trial: '⚡ Start 30-day Free Trial', cta_trial2: 'Start 30-day Free Trial',
      cta_ai: '🤖 Try AI Live',
      cta_buy: '💎 Buy Now — Lifetime License',
      cta_h2: 'Stop managing your shop<br>from a <span class="grad">paper register.</span>',
      cta_p: 'Join the shop owners who bill faster, never run out of stock, and recover every rupee of udhar.',
      trust_1: 'No card required', trust_2: 'Works fully offline', trust_3: 'Urdu + English',
      pricing_kicker: 'Pricing',
      pricing_h2: 'One payment. <span class="grad">Yours forever.</span>',
      pricing_sub: 'No subscriptions. No hidden charges. No monthly fees.',
      add_cart: '🛒 Add to Cart'
    },
    ur: {
      nav_features: 'فیچرز', nav_how: 'طریقہ کار', nav_blog: 'بلاگ', nav_pricing: 'قیمت', nav_faq: 'سوالات',
      login: 'لاگ اِن', signup: 'سائن اپ',
      hero_eyebrow: '<span class="pulse-dot"></span> 🤖 shopcos AI — 31 ممالک کے لیے شاپ سافٹ ویئر · POS بلنگ · 100% آف لائن',
      hero_h1: '🤖 اپنی دکان سے بات کریں۔ <span class="grad">آپ کا پورا کاروبار، آپ کی جیب میں۔</span>',
      hero_sub: '<strong>shopcos AI</strong> سے ملیں — پوچھیں <em>"آج کتنی سیل ہوئی؟"</em> اور فوری جواب پائیں۔ بلنگ، اسٹاک، کھاتہ، رپورٹس — آپ کے کمپیوٹر <strong>اور</strong> فون پر، جہاں بھی آپ ہوں۔ 28 کرنسیاں، 31 ممالک۔ انٹرنیٹ کی ضرورت نہیں۔ کوئی ماہانہ فیس نہیں۔',
      cta_trial: '⚡ 30 دن کا مفت ٹرائل شروع کریں', cta_trial2: '30 دن کا مفت ٹرائل شروع کریں',
      cta_ai: '🤖 AI لائیو آزمائیں',
      cta_buy: '💎 ابھی خریدیں — لائف ٹائم لائسنس',
      cta_h2: 'اپنی دکان کاغذی رجسٹر<br>سے چلانا <span class="grad">بند کریں۔</span>',
      cta_p: 'ان دکان مالکان کے ساتھ شامل ہوں جو تیز بلنگ کرتے ہیں، اسٹاک کبھی ختم نہیں ہونے دیتے، اور ادھار کی ہر روپیہ وصول کرتے ہیں۔',
      trust_1: 'کارڈ کی ضرورت نہیں', trust_2: 'مکمل آف لائن کام کرتا ہے', trust_3: 'اردو + انگریزی',
      pricing_kicker: 'قیمت',
      pricing_h2: 'ایک بار ادائیگی۔ <span class="grad">ہمیشہ آپ کی۔</span>',
      pricing_sub: 'کوئی سبسکرپشن نہیں۔ کوئی چھپی فیس نہیں۔ کوئی ماہانہ چارجز نہیں۔',
      add_cart: '🛒 کارٹ میں ڈالیں'
    }
  };

  function setLang(l){
    if (!I18N[l]) l = 'en';
    try { localStorage.setItem('shopcos_lang', l); } catch(e){}
    var dict = I18N[l];
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var k = el.getAttribute('data-i18n');
      if (dict[k] !== undefined) el.innerHTML = dict[k];
    });
    document.documentElement.setAttribute('lang', l === 'ur' ? 'ur' : 'en');
    ['langSelect','langSelectM'].forEach(function(id){
      var s = document.getElementById(id);
      if (s) s.value = l;
    });
  }

  // ---- Currency ----
  var CURS = {
    USD: { rate: 1,    sym: '$', code: 'USD' },
    PKR: { rate: 278,  sym: '₨', code: 'PKR' },
    EUR: { rate: 0.92, sym: '€', code: 'EUR' },
    GBP: { rate: 0.79, sym: '£', code: 'GBP' },
    INR: { rate: 84,   sym: '₹', code: 'INR' },
    AED: { rate: 3.67, sym: 'د.إ', code: 'AED' },
    SAR: { rate: 3.75, sym: 'ر.س', code: 'SAR' },
    BDT: { rate: 119,  sym: '৳', code: 'BDT' }
  };
  function fmt(n){ return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  window.__shopcosCURS = CURS; // expose rates for cart.js / checkout

  // ---- Supabase profile sync (preferred_currency) ----
  function sbClient(){ return window.__shopcosSB || null; }
  function loggedInUser(){
    try { var u = JSON.parse(localStorage.getItem('shopcos_user')); return (u && u.id) ? u : null; }
    catch(e){ return null; }
  }
  function waitForSb(tries){
    return new Promise(function(resolve){
      (function poll(n){
        if (sbClient()) return resolve(sbClient());
        if (n <= 0) return resolve(null);
        setTimeout(function(){ poll(n - 1); }, 400);
      })(tries || 12);
    });
  }
  // Save selected currency to the user's Supabase profile (fire-and-forget)
  var __lastSyncedCur = null;
  function syncCurrencyToProfile(c){
    if (c === __lastSyncedCur) return;
    __lastSyncedCur = c;
    var u = loggedInUser(); if (!u) return;
    waitForSb().then(function(client){
      if (!client) return;
      client.from('profiles').upsert({ user_id: u.id, preferred_currency: c }, { onConflict: 'user_id' })
        .then(function(){}, function(){});
    });
  }
  // Load preferred currency from profile (returns currency code or null)
  function loadCurrencyFromProfile(){
    var u = loggedInUser(); if (!u) return Promise.resolve(null);
    return waitForSb().then(function(client){
      if (!client) return null;
      return client.from('profiles').select('preferred_currency').eq('user_id', u.id).limit(1).single()
        .then(function(res){
          var v = res && res.data && res.data.preferred_currency;
          return (v && CURS[v]) ? v : null;
        }, function(){ return null; });
    });
  }

  function setCurrency(c){
    if (!CURS[c]) c = 'USD';
    try { localStorage.setItem('shopcos_cur', c); } catch(e){}
    syncCurrencyToProfile(c);
    var cur = CURS[c];
    // Big price cards: data-usd + data-pkr live on .price itself (single source of truth per card)
    document.querySelectorAll('.price[data-usd]').forEach(function(el){
      var usd = parseFloat(el.getAttribute('data-usd'));
      var card = el.closest('.price-card');
      var sub = card ? card.querySelector('.price-pkr') : null;
      var pkrAttr = el.getAttribute('data-pkr') || (sub && sub.getAttribute('data-pkr'));
      var pkr = pkrAttr ? parseFloat(pkrAttr) : Math.round(usd * CURS.PKR.rate);
      var suffix = (sub && sub.getAttribute('data-suffix')) || '';
      if (c === 'USD') {
        el.innerHTML = '<span class="cur">$</span>' + usd + ' <span class="usd">USD</span>';
        if (sub) sub.textContent = 'Rs ' + fmt(pkr) + ' PKR' + suffix;
      } else if (c === 'PKR') {
        el.innerHTML = '<span class="cur">₨</span> ' + fmt(pkr) + ' <span class="usd">PKR</span>';
        if (sub) sub.textContent = '$' + usd + ' USD';
      } else {
        var v = Math.round(usd * cur.rate);
        el.innerHTML = '<span class="cur">' + cur.sym + '</span> ' + fmt(v) + ' <span class="usd">' + cur.code + '</span>';
        if (sub) sub.textContent = '$' + usd + ' USD';
      }
    });
    // Inline amounts: <span data-usd-inline="145" data-pkr-inline="40000">$145</span>
    document.querySelectorAll('[data-usd-inline]').forEach(function(el){
      var usd = parseFloat(el.getAttribute('data-usd-inline'));
      var pkrInline = el.getAttribute('data-pkr-inline');
      if (c === 'PKR' && pkrInline) {
        el.textContent = 'Rs ' + fmt(parseFloat(pkrInline));
      } else if (c === 'USD') {
        el.textContent = '$' + fmt(usd);
      } else {
        el.textContent = cur.sym + ' ' + fmt(Math.round(usd * cur.rate));
      }
    });
    ['curSelect','curSelectM'].forEach(function(id){
      var s = document.getElementById(id);
      if (s) s.value = c;
    });
  }

  // ---- Init from Supabase profile (if logged in), else localStorage, else geo-detect ----
  var savedLang = 'en', savedCur = 'USD';
  try {
    savedLang = localStorage.getItem('shopcos_lang') || 'en';
    savedCur = localStorage.getItem('shopcos_cur') || 'USD';
  } catch(e){}
  // Geo-detect language on first visit (no saved preference)
  var geoDone = false;
  try { geoDone = !!localStorage.getItem('shopcos_geo'); } catch(e){}
  if (!geoDone) {
    fetch('http://ip-api.com/json/?fields=countryCode')
      .then(function(r){ return r.json(); })
      .then(function(d){
        var cc = (d.countryCode || 'US').toUpperCase();
        var langMap = {
          'PK': 'ur',  // Pakistan -> Urdu
          'ES': 'es',  // Spain -> Spanish
          'SA': 'ar', 'AE': 'ar', 'QA': 'ar', 'KW': 'ar', 'BH': 'ar', 'OM': 'ar', 'EG': 'ar',  // Arabic
          'IN': 'en',  // India -> English (Hindi support later)
          'FR': 'fr',  // France -> French
          'DE': 'de',  // Germany -> German
          'IT': 'it',  // Italy -> Italian
          'PT': 'pt', 'BR': 'pt',  // Portuguese
          'TR': 'tr',  // Turkey -> Turkish
          'CN': 'zh',  // China -> Chinese
          'JP': 'ja',  // Japan -> Japanese
          'KR': 'ko',  // Korea -> Korean
          'RU': 'ru',  // Russia -> Russian
        };
        var detected = langMap[cc] || 'en';
        // Only apply if we support the language (en/ur for now, others fall back to en)
        if (detected === 'ur' || detected === 'en') {
          setLang(detected);
        }
        try { localStorage.setItem('shopcos_geo', cc); } catch(e){}
      })
      .catch(function(){});
  }
  setLang(savedLang);
  setCurrency(savedCur);
  // Website currency is the source of truth: pull profile value after login
  loadCurrencyFromProfile().then(function(pc){
    if (pc && pc !== savedCur) setCurrency(pc);
  });

  // ---- Events ----
  ['langSelect','langSelectM'].forEach(function(id){
    var s = document.getElementById(id);
    if (s) s.addEventListener('change', function(){ setLang(s.value); });
  });
  ['curSelect','curSelectM'].forEach(function(id){
    var s = document.getElementById(id);
    if (s) s.addEventListener('change', function(){ setCurrency(s.value); });
  });
})();
