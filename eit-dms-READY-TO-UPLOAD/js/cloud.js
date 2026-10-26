/* ============================================================
   cloud.js — connects the dashboard to Supabase
   The dashboard still talks to Tree / Files exactly as before; underneath,
   data now comes from (and is saved to) the database and private storage.
   Security is enforced by the database (row-level security), not by this file.
   ============================================================ */
const Cloud = (() => {
  const { Tree, Files } = window.Store;
  const SBc = supabase.createClient(CFG.url, CFG.key, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
  const BUCKET = 'documents', MAX_BYTES = 25 * 1024 * 1024;
  // only these file types are accepted (no HTML / SVG / scripts / programs); the storage bucket enforces the same list
  const MIME = { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
    txt:'text/plain', csv:'text/csv', md:'text/markdown', doc:'application/msword',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls:'application/vnd.ms-excel',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt:'application/vnd.ms-powerpoint',
    pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  const clone = o => JSON.parse(JSON.stringify(o));
  const ts = v => v ? Date.parse(v) : undefined;
  const uuid = () => crypto.randomUUID();
  const rand = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  let mem = { nodes:{}, order:[], v:2 };      // what the dashboard sees
  let snap = {};                              // what the database already has
  let chain = Promise.resolve();              // saves happen one after another, in order
  let me = null, pending = 0;

  const say = (m, k = 'err') => { try { toast(m, k); } catch { console.warn(m); } };
  const nice = e => {
    const m = (e && e.message) || String(e);
    if (/row-level security|permission denied|not allowed|admin only/i.test(m)) return 'You do not have permission for this action.';
    if (/duplicate key|23505/i.test(m)) return 'This file already exists in this section.';
    if (/still has documents/i.test(m)) return 'This folder still has documents. Ask the admin to remove it.';
    return m;
  };
  const redirect = q => location.replace('index.html' + (q || ''));

  /* ---------------- load everything the person is allowed to see ---------------- */
  async function hydrate(){
    const cols = 'id,section_id,folder_id,name,mime,ext,size_bytes,storage_path,sha256,doc_type,tags,fields,visibility,version,created_by,created_by_name,created_at,modified_at,trashed_at';
    const [sc, fo, dc] = await Promise.all([
      SBc.from('sections').select('*').order('name'), SBc.from('folders').select('*'), SBc.from('documents').select(cols)]);
    const bad = sc.error || fo.error || dc.error; if (bad) throw bad;
    const nodes = {}, order = [];
    sc.data.forEach(s => { nodes[s.id] = { id:s.id, type:'section', name:s.name, parent:null, created:ts(s.created_at), createdBy:'System', meta:{ colour:s.colour } }; order.push(s.id); });
    fo.data.forEach(f => { nodes[f.id] = { id:f.id, type:'folder', name:f.name, parent:f.parent_id || f.section_id, created:ts(f.created_at),
      createdBy:f.created_by_name || 'Member', createdEmail:'', meta:{}, ...(f.trashed_at ? { trashed:ts(f.trashed_at), trashRoot:f.id } : {}) }; });
    dc.data.forEach(d => { nodes[d.id] = { id:d.id, type:'doc', name:d.name, parent:d.folder_id || d.section_id, created:ts(d.created_at), modified:ts(d.modified_at),
      createdBy:d.created_by_name || 'Member', createdEmail:'', modifiedBy:'', docType:d.doc_type || 'Other', tags:d.tags || [], fields:d.fields || {},
      ...(d.visibility === 'private' ? { acl:{ visibility:'private', groups:[] } } : {}),
      meta:{ size:Number(d.size_bytes) || 0, mime:d.mime, ext:d.ext, hash:d.sha256, version:d.version, path:d.storage_path, cloud:true },
      ...(d.trashed_at ? { trashed:ts(d.trashed_at), trashRoot:d.id } : {}) }; });
    mem = { nodes, order, v:2 }; snap = clone(nodes);
  }
  async function reload(){ try { await hydrate(); if (typeof buildNav === 'function') { buildNav(); render(); } } catch (e) { say(nice(e)); } }

  /* ---------------- turn "what changed" into database calls ---------------- */
  const rootOf = (nodes, id) => { let c = nodes[id], g = 0; while (c && c.parent && g++ < 50) c = nodes[c.parent]; return c; };
  const depth = (nodes, id) => { let c = nodes[id], d = 0; while (c && c.parent && d < 50) { c = nodes[c.parent]; d++; } return d; };
  const vis = n => (n.acl && (n.acl.visibility === 'private' || n.acl.visibility === 'groups')) ? 'private' : 'section';
  const sig = n => JSON.stringify([n.name, n.docType, n.tags, n.fields, vis(n)]);

  function plan(prev, next){
    const ops = [], N = Object.values(next), P = Object.values(prev);
    N.filter(n => n.type === 'section' && !prev[n.id]).forEach(n => ops.push({ k:'sec+', n }));
    N.filter(n => n.type === 'folder' && !prev[n.id]).sort((a, b) => depth(next, a.id) - depth(next, b.id)).forEach(n => ops.push({ k:'fol+', n }));
    N.forEach(b => { const a = prev[b.id]; if (!a) return;
      if (b.type === 'section' && a.name !== b.name) ops.push({ k:'sec~', n:b });
      if (b.type === 'folder' && a.name !== b.name) ops.push({ k:'fol~', n:b });
      if (b.type === 'doc' && sig(a) !== sig(b)) ops.push({ k:'doc~', n:b });
      if (b.type !== 'section' && !a.trashed && b.trashed && b.trashRoot === b.id) ops.push({ k:'trash', n:b });
      if (b.type !== 'section' && a.trashed && !b.trashed) ops.push({ k:'restore', n:b }); });
    P.filter(a => a.type === 'doc' && !next[a.id]).forEach(a => ops.push({ k:'doc-', n:a }));
    P.filter(a => a.type === 'folder' && !next[a.id]).sort((x, y) => depth(prev, y.id) - depth(prev, x.id)).forEach(a => ops.push({ k:'fol-', n:a }));
    return ops;
  }
  async function run(op, nodes){
    const n = op.n, root = rootOf(nodes, n.id) || rootOf(snap, n.id), db = t => SBc.from(t);
    let r;
    if (op.k === 'sec+') r = await db('sections').insert({ id:n.id, name:n.name, colour:(n.meta && n.meta.colour) || '#3d4fb8' });
    if (op.k === 'sec~') r = await db('sections').update({ name:n.name }).eq('id', n.id);
    if (op.k === 'fol+') r = await db('folders').insert({ id:n.id, section_id:root.id, parent_id:n.parent === root.id ? null : n.parent, name:n.name });
    if (op.k === 'fol~') r = await db('folders').update({ name:n.name }).eq('id', n.id);
    if (op.k === 'doc~') r = await db('documents').update({ name:n.name, doc_type:n.docType, tags:n.tags || [], fields:n.fields || {}, visibility:vis(n) }).eq('id', n.id);
    if (op.k === 'trash')   { r = await SBc.rpc('trash_item',   { p_kind:n.type === 'doc' ? 'document' : 'folder', p_id:n.id }); if (!r.error) op.reload = true; }
    if (op.k === 'restore') { r = await SBc.rpc('restore_item', { p_kind:n.type === 'doc' ? 'document' : 'folder', p_id:n.id }); if (!r.error) op.reload = true; }
    if (op.k === 'doc-') { r = await db('documents').delete().eq('id', n.id); if (!r.error && n.meta && n.meta.path) await SBc.storage.from(BUCKET).remove([n.meta.path]); }
    if (op.k === 'fol-') r = await db('folders').delete().eq('id', n.id);
    if (r && r.error) throw r.error;
  }
  function enqueue(ops, nodes){
    if (!ops.length) return;
    pending += ops.length;
    chain = chain.then(async () => {
      let again = false;
      for (const op of ops) {
        try { await run(op, nodes); again = again || !!op.reload; }
        catch (e) { say(nice(e)); again = true; break; }          // something was refused → show the truth again
        finally { pending--; }
      }
      if (again) await reload();
    });
  }
  const sync = (prev, next) => enqueue(plan(prev, next), clone(next));
  const flush = () => chain;

  /* ---------------- the Tree now lives in memory, saved through sync ---------------- */
  Tree.read  = () => clone(mem);
  Tree.seed  = () => clone(mem);
  Tree.reset = () => clone(mem);
  Tree.write = state => { const prev = snap; mem = state; snap = clone(state.nodes); sync(prev, state.nodes); return true; };

  const actor = () => Tree.actor();
  Tree.addSection = (name, colour) => { const s = Tree.state(), id = uuid(), a = actor();
    s.nodes[id] = { id, type:'section', name, parent:null, created:Date.now(), createdBy:a.name, createdEmail:a.email, meta:{ colour:colour || '#3d4fb8' } };
    s.order.push(id); Tree.write(s); return id; };
  Tree.addFolder = (name, parentId) => { const s = Tree.state(), id = uuid(), a = actor();
    s.nodes[id] = { id, type:'folder', name, parent:parentId, created:Date.now(), createdBy:a.name, createdEmail:a.email, meta:{} }; Tree.write(s); return id; };
  Tree.addDoc = ({ name, size, mime, ext, docType, tags, fields }, parentId) => { const s = Tree.state(), id = uuid(), a = actor();
    s.nodes[id] = { id, type:'doc', name, parent:parentId, created:Date.now(), createdBy:a.name, createdEmail:a.email, modified:Date.now(), modifiedBy:a.name,
      docType:docType || 'Other', tags:Array.isArray(tags) ? tags.slice() : [], fields:(fields && typeof fields === 'object') ? { ...fields } : {}, meta:{ size, mime, ext } };
    Tree.write(s); return id; };   // the database row is created together with the file (Files.put)

  /* ---------------- files: private storage + a row per document ---------------- */
  async function sha(file){ const h = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  const dropLocal = id => { delete mem.nodes[id]; delete snap[id]; };
  const patchLocal = (id, fn) => { const n = mem.nodes[id]; if (n) { fn(n); } const m = snap[id]; if (m) fn(m); };

  Files.put = async (id, file) => {
    const n = mem.nodes[id]; if (!n) throw new Error('Document missing');
    if (file.size > MAX_BYTES) { dropLocal(id); throw new Error('Files can be at most 25 MB.'); }
    const type = MIME[String(n.meta.ext || '').toLowerCase()];
    if (!type) { dropLocal(id); throw new Error('This file type is not allowed. Allowed: PDF, images (png, jpg, gif, webp), Word, Excel, PowerPoint, txt, csv.'); }
    const root = rootOf(mem.nodes, id), hash = await sha(file), st = SBc.storage.from(BUCKET);
    try {
      await flush();                                                   // folders created a moment ago must exist first
      if (n.meta.cloud) {                                              // a new version of an existing document
        const v = (n.meta.version || 1) + 1, path = `${root.id}/${id}/v${v}-${rand()}`;
        const up = await st.upload(path, file, { contentType:type, upsert:false }); if (up.error) throw up.error;
        const old = await SBc.from('doc_versions').insert({ document_id:id, version:n.meta.version || 1, storage_path:n.meta.path, size_bytes:n.meta.size || 0, sha256:n.meta.hash });
        if (old.error) { await st.remove([path]); throw old.error; }
        const upd = await SBc.from('documents').update({ storage_path:path, size_bytes:file.size, sha256:hash, version:v, mime:type }).eq('id', id);
        if (upd.error) { await st.remove([path]); throw upd.error; }
        patchLocal(id, d => { Object.assign(d.meta, { path, size:file.size, hash, version:v, mime:type }); });
        return true;
      }
      const path = `${root.id}/${id}/v1-${rand()}`;
      const up = await st.upload(path, file, { contentType:type, upsert:false }); if (up.error) throw up.error;
      const ins = await SBc.from('documents').insert({ id, section_id:root.id, folder_id:n.parent === root.id ? null : n.parent, name:n.name, mime:type, ext:n.meta.ext || null,
        size_bytes:file.size, storage_path:path, sha256:hash, doc_type:n.docType, tags:n.tags || [], fields:n.fields || {}, visibility:vis(n), version:1 });
      if (ins.error) { await st.remove([path]); throw ins.error; }
      patchLocal(id, d => { Object.assign(d.meta, { path, hash, version:1, cloud:true, size:file.size, mime:type }); });
      return true;
    } catch (e) { if (!n.meta.cloud) dropLocal(id); throw new Error(nice(e)); }
  };
  Files.get = async id => {
    const n = mem.nodes[id]; if (!n || !n.meta || !n.meta.path) return null;
    const r = await SBc.storage.from(BUCKET).download(n.meta.path); if (r.error) { say(nice(r.error)); return null; }
    return { id, blob:r.data, name:n.name, type:r.data.type || n.meta.mime || '', size:r.data.size };
  };
  Files.remove = async () => true;      // the row + file are removed by the saved change itself
  Files.clear  = async () => true;      // the vault can never be wiped from the browser

  /* ---------------- sign-in state ---------------- */
  async function boot(){
    const { data:{ session } } = await SBc.auth.getSession(); if (!session) return redirect();
    const pr = await SBc.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    const p = pr.data;
    if (!p || p.status !== 'approved') { await SBc.auth.signOut(); return redirect(); }
    const a = (await SBc.auth.mfa.getAuthenticatorAssuranceLevel()).data || {};
    if (CFG.mfa && a.currentLevel !== 'aal2' && (p.is_admin || a.nextLevel === 'aal2')) return redirect('?mfa=1');   // 2-step login incomplete (only when switched on)
    let sections = 'all';
    if (!p.is_admin && !p.all_sections) { const ms = await SBc.from('member_sections').select('section_id'); sections = (ms.data || []).map(m => m.section_id); }
    me = { email:p.email, name:p.full_name || p.email.split('@')[0], role:p.is_admin ? 'Admin' : (p.role || 'Member'), sections, canEdit:p.can_edit, status:'approved' };
    if (p.is_admin) { const c = await SBc.from('profiles').select('id', { count:'exact', head:true }).eq('status', 'pending'); pending = 0; me.waiting = c.count || 0; }
    window.ME = me;
    window.Users = { find:() => me, all:() => [], ROLES:[], pendingCount:() => me.waiting || 0 };
    await hydrate();
    // Tabs share one sign-in. If it ends anywhere (sign-out, expiry) every tab says so and goes to the sign-in page.
    // Token refreshes and other tabs' sign-ins are deliberately ignored: they never redraw or reset this page.
    SBc.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') { say('You were signed out (maybe in another tab). Please sign in again.'); setTimeout(() => redirect(), 1500); } });
    return me;
  }
  async function signOut(){ try { await SBc.auth.signOut(); } finally { redirect(); } }

  /* OCR text is saved so search works from any computer */
  const saveText = (id, text) => { SBc.from('documents').update({ text_content:String(text).slice(0, 200000) }).eq('id', id).then(r => { if (r.error) console.warn(r.error.message); }); };
  async function loadTexts(set){
    for (let from = 0; ; from += 200) {
      const r = await SBc.from('documents').select('id,text_content').not('text_content', 'is', null).range(from, from + 199);
      if (r.error || !r.data) return; r.data.forEach(d => set(d.id, d.text_content)); if (r.data.length < 200) return; }
  }
  const log = (action, id) => { SBc.rpc('log_event', { p_action:action, p_doc:id }).then(r => { if (r.error) console.warn(r.error.message); }); };

  return { boot, signOut, saveText, loadTexts, log, flush, reload, get busy(){ return pending > 0; }, client:SBc };
})();
window.Cloud = Cloud;
