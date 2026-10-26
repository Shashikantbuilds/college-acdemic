/* login.js — sign-in page. Uses the shared helpers from cloud/js/supa.js (SB, el, show, getProfile, aal) and CFG from config.js */
(() => {
  const $id = id => document.getElementById(id);
  const okDomain = e => { e = e.trim().toLowerCase(); return e.endsWith(CFG.domain) && e.length > CFG.domain.length; };
  const KEY = 'eit_dms_email';
  const mem = { get(){ try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
                set(v){ try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} } };

  const signinPane = $id('signinPane'), regForm = $id('registerForm'), extra = $id('extraPane');
  const loginForm = $id('loginForm'), email = $id('email'), pass = $id('password'), alertBox = $id('loginAlert'), loginBtn = $id('loginBtn');

  /* ---- which block is visible ---- */
  function showPane(which, nodes){
    signinPane.hidden = which !== 'signin'; regForm.hidden = which !== 'register'; extra.hidden = which !== 'extra';
    if (which === 'extra') extra.replaceChildren(...nodes);
  }
  function backToSignin(note, kind){
    showPane('signin'); alertBox.hidden = true; if (note) show(alertBox, note, kind || 'info');
  }
  const message = (text, kind) => showPane('extra', [el('p', { class:'alert alert--' + (kind || 'ok') }, text),
    el('button', { class:'btn btn--primary btn--block', type:'button', onclick:() => backToSignin() }, 'Back to sign in')]);

  /* ---- sign in ---- */
  async function afterAuth(){
    let p; try { p = await getProfile(); } catch { p = null; }
    if (!p) { await SB.auth.signOut(); return backToSignin('We could not find your account. Please create one.'); }
    if (p.status === 'pending')  { await SB.auth.signOut(); return backToSignin('Waiting for approval. The admin has not given you access yet — you can sign in once you are approved.'); }
    if (p.status === 'rejected') { await SB.auth.signOut(); return backToSignin('Your access request was not approved. Please contact the admin.', 'error'); }
    if (CFG.mfa) {                                     // 2-step login (OFF unless config.js says mfa:true)
      const a = await aal(), { data:f } = await SB.auth.mfa.listFactors(), totp = (f?.totp || []).filter(x => x.status === 'verified');
      if (totp.length && a.currentLevel !== 'aal2') return formCode(totp[0].id);
      if (!totp.length && p.is_admin) return enroll();
    }
    location.href = 'dashboard.html';
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault(); alertBox.hidden = true;
    const em = email.value.trim().toLowerCase();
    if (!em || !pass.value) return show(alertBox, 'Please enter your e-mail and password.');
    loginBtn.disabled = true; loginBtn.textContent = 'Signing in…';
    const { error } = await SB.auth.signInWithPassword({ email:em, password:pass.value });
    loginBtn.disabled = false; loginBtn.textContent = 'Log In';
    if (error) return show(alertBox, /not confirmed/i.test(error.message) ? 'Please confirm your e-mail first (check your inbox).' : 'Incorrect e-mail or password.');
    mem.set($id('remember').checked ? em : '');
    afterAuth();
  });

  $id('togglePass').addEventListener('click', () => {
    const hide = pass.type === 'password'; pass.type = hide ? 'text' : 'password';
    $id('togglePass').setAttribute('aria-label', hide ? 'Hide password' : 'Show password');
  });

  /* ---- forgot password ---- */
  $id('forgotLink').addEventListener('click', async e => {
    e.preventDefault(); alertBox.hidden = true;
    const em = email.value.trim().toLowerCase();
    if (!em || !em.includes('@')) return show(alertBox, 'Type your e-mail above first, then click "Forgot password?".');
    await SB.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    show(alertBox, 'If this e-mail is registered, a password-reset link has been sent. Check your inbox (and spam).', 'ok');
  });

  /* ---- create account ---- */
  $id('openRegister').addEventListener('click', e => { e.preventDefault(); showPane('register'); $id('rEmail').value = email.value; });
  $id('closeRegister').addEventListener('click', e => { e.preventDefault(); backToSignin(); });
  regForm.addEventListener('submit', async e => {
    e.preventDefault(); const al = $id('regAlert'), btn = $id('regBtn'); al.hidden = true;
    const name = $id('rName').value.trim(), em = $id('rEmail').value.trim().toLowerCase(), p1 = $id('rPass').value, p2 = $id('rPass2').value;
    if (!name) return show(al, 'Please enter your full name.');
    if (!okDomain(em)) return show(al, 'Only ' + CFG.domain + ' addresses can register.');
    if (p1.length < 10) return show(al, 'Use a password of at least 10 characters.');
    if (p1 !== p2) return show(al, 'The two passwords do not match.');
    btn.disabled = true;
    const { error } = await SB.auth.signUp({ email:em, password:p1, options:{ data:{ full_name:name } } });
    btn.disabled = false;
    if (error) return show(al, /database error/i.test(error.message) ? 'Only ' + CFG.domain + ' addresses can register.' : error.message);
    regForm.reset();
    message('Account created. Check your e-mail and confirm it. After that, WAIT FOR APPROVAL — the admin will give you a role and access.');
  });

  /* ---- 2-step login (only when CFG.mfa is true) ---- */
  function formCode(factorId){
    const code = el('input', { type:'text', inputmode:'numeric', autocomplete:'one-time-code', placeholder:'6-digit code', maxlength:'6', required:true });
    const al = el('p', { class:'alert', hidden:true, role:'alert' });
    showPane('extra', [el('p', {}, 'Enter the code from your authenticator app.'),
      el('form', { onsubmit: async e => { e.preventDefault();
        const { error } = await SB.auth.mfa.challengeAndVerify({ factorId, code:code.value.trim() });
        if (error) return show(al, 'That code is not correct. Try the newest one.'); location.href = 'dashboard.html'; } },
        el('div', { class:'field' }, code), al, el('button', { class:'btn btn--primary btn--block', type:'submit' }, 'Verify')),
      el('button', { class:'btn btn--ghost', type:'button', onclick: async () => { await SB.auth.signOut(); backToSignin(); } }, 'Cancel')]);
  }
  async function enroll(){
    const { data:f } = await SB.auth.mfa.listFactors();
    for (const x of (f?.all || []).filter(x => x.status === 'unverified')) await SB.auth.mfa.unenroll({ factorId:x.id });
    const { data, error } = await SB.auth.mfa.enroll({ factorType:'totp', friendlyName:'EIT DMS ' + Date.now() });
    if (error) return message(error.message, 'error');
    const code = el('input', { type:'text', inputmode:'numeric', placeholder:'6-digit code', maxlength:'6', required:true });
    const al = el('p', { class:'alert', hidden:true, role:'alert' });
    showPane('extra', [el('p', {}, 'Admin accounts need two-step login. Scan this QR with Google Authenticator (or any authenticator app), then type the code.'),
      el('img', { alt:'QR code for the authenticator app', src:data.totp.qr_code, style:'width:190px;height:190px;display:block;margin:8px auto' }),
      el('p', { class:'muted' }, 'Cannot scan? Key: ', el('code', {}, data.totp.secret)),
      el('form', { onsubmit: async e => { e.preventDefault();
        const r = await SB.auth.mfa.challengeAndVerify({ factorId:data.id, code:code.value.trim() });
        if (r.error) return show(al, 'That code is not correct.'); location.href = 'dashboard.html'; } },
        el('div', { class:'field' }, code), al, el('button', { class:'btn btn--primary btn--block', type:'submit' }, 'Turn on 2-step login'))]);
  }

  /* ---- coming back from the "reset password" e-mail ---- */
  async function recovery(hash){
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    history.replaceState(null, '', location.pathname);                      // remove the token from the address bar
    if (q.get('error_description') || !q.get('access_token')) return backToSignin('That reset link has expired or was already used. Click "Forgot password?" to get a new one.', 'error');
    const { error } = await SB.auth.setSession({ access_token:q.get('access_token'), refresh_token:q.get('refresh_token') || '' });
    if (error) return backToSignin('That reset link has expired. Click "Forgot password?" to get a new one.', 'error');
    const p1 = el('input', { type:'password', placeholder:'New password (at least 10 characters)', autocomplete:'new-password', required:true });
    const p2 = el('input', { type:'password', placeholder:'Type it again', autocomplete:'new-password', required:true });
    const al = el('p', { class:'alert', hidden:true, role:'alert' });
    showPane('extra', [el('h2', { class:'signin-card__title' }, 'Choose a new password'),
      el('form', { onsubmit: async e => { e.preventDefault();
        if (p1.value.length < 10) return show(al, 'Use a password of at least 10 characters.');
        if (p1.value !== p2.value) return show(al, 'The two passwords do not match.');
        const r = await SB.auth.updateUser({ password:p1.value });
        if (r.error) return show(al, r.error.message);
        await SB.auth.signOut(); backToSignin('Password changed. Please sign in with your new password.', 'ok'); } },
        el('div', { class:'field' }, p1), el('div', { class:'field' }, p2), al, el('button', { class:'btn btn--primary btn--block', type:'submit' }, 'Save new password'))]);
  }

  /* ---- start ---- */
  $id('year').textContent = new Date().getFullYear();
  email.value = mem.get();
  (async () => {
    if (/type=recovery|error_description/.test(location.hash)) return recovery(location.hash);
    const { data:{ session } } = await SB.auth.getSession();
    if (session) afterAuth();
  })();
})();