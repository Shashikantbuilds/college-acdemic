const app = $('#app'); const out = el('div', {});
app.replaceChildren(el('div', { class:'card' }, el('h1', {}, 'Security self-check'), el('p', { class:'muted' }, 'Runs from this browser against YOUR Supabase project, as an anonymous visitor.'), out));
const add = (ok, what, why = '') => out.append(el('div', { class:'res ' + (ok ? 'pass' : 'fail') }, el('b', {}, ok ? 'PASS' : 'FAIL'), el('span', {}, what + (why ? ' — ' + why : ''))));
(async () => {
  const anon = supabase.createClient(CFG.url, CFG.key, { auth:{ persistSession:false, autoRefreshToken:false, storageKey:'chk-anon' } });
  for (const t of ['profiles', 'sections', 'folders', 'documents', 'doc_versions', 'member_sections', 'audit_log', 'app_config']) {
    const { data, error } = await anon.from(t).select('*').limit(1);
    add(!!error || (data || []).length === 0, 'A stranger cannot read "' + t + '"', error ? 'blocked' : 'no rows returned');
  }
  for (const e of ['check.' + Date.now() + '@gmail.com', 'x' + Date.now() + '@eitfaridabad.co.in.evil.com']) {
    const { data, error } = await anon.auth.signUp({ email:e, password:'Chk-' + Math.random().toString(36).slice(2) + '-9Zq!' });
    add(!!error, 'Sign-up with "' + e.split('@')[1] + '" is refused', error ? 'refused' : 'ACCOUNT WAS CREATED (user id ' + (data.user && data.user.id) + ') — delete it in Supabase → Authentication → Users and re-run 01_schema.sql');
  }
  out.append(el('p', { class:'muted' }, 'Manual checks (cannot be done from here): Supabase → Authentication → "Confirm email" must be ON; sign-in methods: only Email; minimum password 10+.'));
})();
