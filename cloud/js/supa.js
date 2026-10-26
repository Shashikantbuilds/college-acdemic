/* shared helpers: client, DOM builder (no innerHTML => no script injection), profile, 2FA */
const SB = supabase.createClient(CFG.url, CFG.key, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, ...kids){
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => e.append(c instanceof Node ? c : document.createTextNode(c ?? '')));
  return e;
}
function show(node, text, kind = 'error'){ node.textContent = text; node.className = 'alert alert--' + kind; node.hidden = false; }
async function getProfile(){
  const { data:{ user } } = await SB.auth.getUser(); if (!user) return null;
  const { data, error } = await SB.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error; return data;
}
const aal = async () => (await SB.auth.mfa.getAuthenticatorAssuranceLevel()).data;
async function signOut(){ await SB.auth.signOut(); location.href = '../index.html'; }
const when = t => t ? new Date(t).toLocaleString('en-IN') : '';
