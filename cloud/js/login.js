const app = $('#app');
const okDomain = e => e.trim().toLowerCase().endsWith(CFG.domain) && e.trim().length > CFG.domain.length;

function frame(...kids){ app.replaceChildren(el('div', { class:'card' }, el('h1', {}, 'EIT Faridabad · Document Management'), ...kids)); }
function formSignin(note){
  const em = el('input', { type:'email', autocomplete:'username', placeholder:'name' + CFG.domain, required:true });
  const pw = el('input', { type:'password', autocomplete:'current-password', placeholder:'Password', required:true });
  const al = el('p', { class:'alert', hidden:true, role:'alert' });
  const btn = el('button', { class:'btn btn--primary btn--block', type:'submit' }, 'Sign in');
  const f = el('form', { onsubmit: async e => { e.preventDefault(); al.hidden = true; btn.disabled = true;
      const { error } = await SB.auth.signInWithPassword({ email:em.value.trim().toLowerCase(), password:pw.value });
      btn.disabled = false;
      if (error) return show(al, error.message.includes('not confirmed') ? 'Please confirm your e-mail first (check your inbox).' : 'Incorrect e-mail or password.');
      afterAuth(); } },
    el('div', { class:'field' }, el('label', {}, 'College e-mail'), em), el('div', { class:'field' }, el('label', {}, 'Password'), pw), al, btn);
  if (note) show(al, note, 'info');
  frame(el('p', { class:'muted' }, 'Sign in to your account'), f,
    el('p', { class:'muted' }, 'New here? ', el('a', { href:'#', class:'link', onclick:e => { e.preventDefault(); formSignup(); } }, 'Create account'), ' — the admin approves access.'));
}
function formSignup(){
  const nm = el('input', { type:'text', placeholder:'Full name', required:true, maxlength:'120' });
  const em = el('input', { type:'email', placeholder:'name' + CFG.domain, required:true });
  const pw = el('input', { type:'password', placeholder:'At least 10 characters', autocomplete:'new-password', required:true });
  const al = el('p', { class:'alert', hidden:true, role:'alert' });
  const f = el('form', { onsubmit: async e => { e.preventDefault(); al.hidden = true;
      if (!okDomain(em.value)) return show(al, 'Only ' + CFG.domain + ' addresses can register.');
      if (pw.value.length < 10) return show(al, 'Use a password of at least 10 characters.');
      const { error } = await SB.auth.signUp({ email:em.value.trim().toLowerCase(), password:pw.value, options:{ data:{ full_name:nm.value.trim() } } });
      if (error) return show(al, /database error/i.test(error.message) ? 'Only ' + CFG.domain + ' addresses can register.' : error.message);
      frame(el('p', { class:'alert alert--ok' }, 'Account created. Check your e-mail and confirm it. After that, WAIT FOR APPROVAL — the admin will give you a role and access.'),
        el('button', { class:'btn', onclick:() => formSignin() }, 'Back to sign in')); } },
    el('div', { class:'field' }, el('label', {}, 'Full name'), nm), el('div', { class:'field' }, el('label', {}, 'College e-mail'), em),
    el('div', { class:'field' }, el('label', {}, 'Password'), pw), al, el('button', { class:'btn btn--primary btn--block', type:'submit' }, 'Create account'));
  frame(el('p', { class:'muted' }, 'Create your account'), f, el('p', { class:'muted' }, el('a', { href:'#', class:'link', onclick:e => { e.preventDefault(); formSignin(); } }, '← Back to sign in')));
}
function formCode(factorId, p){
  const code = el('input', { type:'text', inputmode:'numeric', autocomplete:'one-time-code', placeholder:'6-digit code', maxlength:'6', required:true });
  const al = el('p', { class:'alert', hidden:true, role:'alert' });
  frame(el('p', {}, 'Enter the code from your authenticator app.'), el('form', { onsubmit: async e => { e.preventDefault();
      const { error } = await SB.auth.mfa.challengeAndVerify({ factorId, code:code.value.trim() });
      if (error) return show(al, 'That code is not correct. Try the newest one.'); go(p); } }, el('div', { class:'field' }, code), al, el('button', { class:'btn btn--primary btn--block', type:'submit' }, 'Verify')),
    el('button', { class:'btn btn--ghost', onclick:signOut }, 'Cancel'));
}
async function enroll(p){
  const { data:f } = await SB.auth.mfa.listFactors();
  for (const x of (f?.all || []).filter(x => x.status === 'unverified')) await SB.auth.mfa.unenroll({ factorId:x.id });   // clear abandoned attempts
  const { data, error } = await SB.auth.mfa.enroll({ factorType:'totp', friendlyName:'EIT DMS ' + Date.now() });
  if (error) return frame(el('p', { class:'alert alert--error' }, error.message));
  const code = el('input', { type:'text', inputmode:'numeric', placeholder:'6-digit code', maxlength:'6', required:true });
  const al = el('p', { class:'alert', hidden:true, role:'alert' });
  frame(el('p', {}, 'Admin accounts need two-step login. Scan this QR with Google Authenticator (or any authenticator app), then type the code.'),
    el('img', { class:'qr', alt:'QR code for the authenticator app', src:data.totp.qr_code }),
    el('p', { class:'muted' }, 'Cannot scan? Key: ', el('code', {}, data.totp.secret)),
    el('form', { onsubmit: async e => { e.preventDefault();
      const r = await SB.auth.mfa.challengeAndVerify({ factorId:data.id, code:code.value.trim() });
      if (r.error) return show(al, 'That code is not correct.'); go(p); } }, el('div', { class:'field' }, code), al, el('button', { class:'btn btn--primary btn--block', type:'submit' }, 'Turn on 2-step login')));
}
const go = () => { location.href = '../dashboard.html'; };
async function afterAuth(){
  let p; try { p = await getProfile(); } catch { p = null; }
  if (!p) { await SB.auth.signOut(); return formSignin('We could not find your account. Please create one.'); }
  if (p.status === 'pending')  { await SB.auth.signOut(); return formSignin('Waiting for approval. The admin has not given you access yet — you can sign in once you are approved.'); }
  if (p.status === 'rejected') { await SB.auth.signOut(); return formSignin('Your access request was not approved. Please contact the admin.'); }
  if (CFG.mfa) {                                   // 2-step login is switched off for now (see config.js)
    const a = await aal(), { data:f } = await SB.auth.mfa.listFactors(), totp = (f?.totp || []).filter(x => x.status === 'verified');
    if (totp.length && a.currentLevel !== 'aal2') return formCode(totp[0].id, p);
    if (!totp.length && p.is_admin) return enroll(p);
  }
  go(p);
}
(async () => {
  const { data:{ session } } = await SB.auth.getSession();
  if (session) afterAuth(); else formSignin('');
})();
