/* ============================================================
   features.js — Paperless-style features on top of the base DMS
   ingest · OCR · full-text + advanced search · saved views ·
   auto-matching · groups/permissions · trash · share links ·
   workflows · PDF tools · versions · notes · duplicates · history
   Everything runs in the browser (no server, no database yet).
   ============================================================ */
(() => {
const { Tree, Files, Meta } = window.Store;
const q1 = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- libraries (lazy, from CDN) ---------- */
const abs = p => new URL(p, document.baseURI).href;
const LIB = {                                   // all hosted inside this project (js/vendor): nothing is fetched from other sites
  tess:   abs('js/vendor/tesseract/tesseract.min.js'),
  pdfjs:  abs('js/vendor/pdf.min.js'),
  pdfw:   abs('js/vendor/pdf.worker.min.js'),
  pdflib: abs('js/vendor/pdf-lib.min.js'),
  mammoth:abs('js/vendor/mammoth.browser.min.js')
};
const loaded = {};
const load = url => loaded[url] || (loaded[url] = new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = url; s.onload = ok;
  s.onerror = () => { delete loaded[url]; no(new Error('Could not load a helper library. Please reload the page.')); };
  document.head.appendChild(s);
}));

/* ---------- local settings ---------- */
const K = { groups:'eit_dms_groups', rules:'eit_dms_rules', views:'eit_dms_views', shares:'eit_dms_shares', cfg:'eit_dms_cfg', users:'eit_dms_users' };
const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const jset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const cfg = () => ({ ocr:true, ocrLang:'eng+hin', automatch:true, ...jget(K.cfg, {}) });
const me = () => Tree.actor();
const day = 864e5;
const pathLabel = id => Tree.path(id).map(p => p.name).join(' / ');

/* ---------- second IndexedDB: extracted text + old versions ---------- */
const X = {
  db:null,
  open(){ if (X.db) return Promise.resolve(X.db);
    return new Promise((ok, no) => { const r = indexedDB.open('eit_dms_ext', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('content', { keyPath:'id' }); r.result.createObjectStore('versions', { keyPath:'key' }); };
      r.onsuccess = () => { X.db = r.result; ok(X.db); }; r.onerror = () => no(r.error); }); },
  async run(store, mode, fn){ const db = await X.open();
    return new Promise((ok, no) => { const t = db.transaction(store, mode); const req = fn(t.objectStore(store));
      t.oncomplete = () => ok(req && req.result); t.onerror = () => no(t.error); }); },
  put:(s, v) => X.run(s, 'readwrite', o => o.put(v)),
  get:(s, k) => X.run(s, 'readonly',  o => o.get(k)),
  del:(s, k) => X.run(s, 'readwrite', o => o.delete(k)),
  all:(s)    => X.run(s, 'readonly',  o => o.getAll()),
  clear:(s)  => X.run(s, 'readwrite', o => o.clear())
};
const TXT = {};   // id -> extracted text (kept in memory for instant search)

/* ---------- small node helpers ---------- */
function mutate(id, fn){ const s = Tree.state(); const n = s.nodes[id]; if (!n) return null; fn(n, s); Tree.write(s); return n; }
function hist(id, text){ mutate(id, n => { (n.history = n.history || []).unshift({ at:Date.now(), by:me().name, text }); n.history = n.history.slice(0, 80); }); }
const asFile = (blob, name, type) => new File([blob], name, { type: type || blob.type });

/* ============================================================
   ACCESS — users, groups, per-document visibility
   (enforced in the UI only; real enforcement comes with the backend)
   ============================================================ */
const groups = () => jget(K.groups, [{ name:'Faculty', members:[] }, { name:'Exam Cell', members:[] }]);
let _cu = null, _cut = 0;
const cu = () => { if (!_cu || Date.now() - _cut > 800) { _cu = Users.find(me().email) || window.ME || {}; _cut = Date.now(); } return _cu; };
const bust = () => { _cu = null; };
const isAdmin = () => cu().role === 'Admin';
const canEditAll = () => isAdmin() || cu().canEdit !== false;
const fullView = u => u.role === 'Admin' || u.sections === 'all';
function canAccess(n){
  if (!n || n.type !== 'doc') return true;
  const a = n.acl; if (!a || a.visibility === 'everyone') return true;
  if (isAdmin() || (n.createdEmail && n.createdEmail === me().email)) return true;
  return a.visibility === 'groups' && groups().some(g => (a.groups || []).includes(g.name) && g.members.includes(me().email));
}
const live = n => n && !n.trashed && canAccess(n);

/* hide trashed / forbidden nodes from every existing list */
const _children = Tree.children, _search = Tree.search, _filter = Tree.filter, _remove = Tree.remove, _setMeta = Tree.setMeta;
/* sections the signed-in member may not see are hidden everywhere */
function visible(list){
  const u = cu(); if (fullView(u)) return list.filter(live);
  const nodes = Tree.state().nodes, mine = Array.isArray(u.sections) ? u.sections : [];
  const ok = n => { let c = n, g = 0; while (c && c.parent && g++ < 50) c = nodes[c.parent]; return c && mine.includes(c.id); };
  return list.filter(n => live(n) && ok(n));
}
Tree.children = id => { const l = _children(id); if (id === null) return visible(l);
  const u = cu(); if (!fullView(u)) { const top = Tree.path(id)[0]; if (!top || !(u.sections || []).includes(top.id)) return []; } return l.filter(live); };
Tree.search = t => visible(_search(t));
Tree.filter = f => visible(_filter(f));
Tree.stats  = () => { const nodes = visible(Object.values(Tree.state().nodes)), c = t => nodes.filter(n => n.type === t).length;
  return { sections:c('section'), folders:c('folder'), docs:c('doc'), bytes:nodes.filter(n => n.type === 'doc').reduce((a, n) => a + (n.meta?.size || 0), 0) }; };
Tree.setMeta = (id, p) => { if (!canEditAll()) { toast('You have view-only access.', 'err'); return false; } const o = JSON.parse(JSON.stringify(Tree.get(id) || {})); const r = _setMeta(id, p); const n = Tree.get(id);
  if (r && n) { const ch = []; if (n.docType !== o.docType) ch.push('type → ' + n.docType);
    if ((n.tags || []).join() !== (o.tags || []).join()) ch.push('tags');
    if (JSON.stringify(n.fields) !== JSON.stringify(o.fields)) ch.push('fields');
    if (ch.length) hist(id, 'Metadata edited: ' + ch.join(', ')); }
  return r; };

/* ============================================================
   TRASH — 90 days, then gone
   ============================================================ */
const TRASH_DAYS = 90;
function trash(id){ const s = Tree.state(); const ts = Date.now();
  const mark = nid => { const n = s.nodes[nid]; if (!n) return; n.trashed = ts; n.trashRoot = id;
    if (n.type !== 'doc') Object.values(s.nodes).filter(c => c.parent === nid).forEach(c => mark(c.id)); };
  mark(id); Tree.write(s); hist(id, 'Moved to trash'); }
function restore(id){ const s = Tree.state(); Object.values(s.nodes).forEach(n => { if (n.trashRoot === id) { delete n.trashed; delete n.trashRoot; } }); Tree.write(s); hist(id, 'Restored from trash'); }
async function purge(id){
  const ids = Object.values(Tree.state().nodes).filter(n => n.trashRoot === id && n.type === 'doc').map(n => n.id);
  _remove(id);
  for (const d of ids) { delete TXT[d]; await X.del('content', d).catch(() => {});
    (await X.all('versions').catch(() => [])).filter(v => v.id === d).forEach(v => X.del('versions', v.key)); }
}
async function autoPurge(){
  const old = Object.values(Tree.state().nodes).filter(n => n.trashed && n.trashRoot === n.id && Date.now() - n.trashed > TRASH_DAYS * day);
  for (const n of old) await purge(n.id);
}

/* ============================================================
   READING DOCUMENTS — text layer, OCR (English + Hindi)
   ============================================================ */
async function hashOf(file){
  try { const h = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  catch { return `${file.size}-${file.lastModified}-${file.name}`; }
}
async function checkDuplicate(file){
  const hash = await hashOf(file);
  const dup = Object.values(Tree.state().nodes).find(n => n.type === 'doc' && !n.trashed && n.meta?.hash === hash);
  return { hash, dup };
}

const Q = { items:[], busy:false }; let pillMsg = '';
function pill(){
  let p = q1('#qpill'); const left = Q.items.length + (Q.busy ? 1 : 0);
  if (!left) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement('div'); p.id = 'qpill'; p.className = 'qpill'; document.body.appendChild(p); }
  p.textContent = pillMsg || `Reading documents… ${left} left`;
}
function enqueue(id, opts = {}){ Q.items.push({ id, ...opts }); pill(); if (!Q.busy) runQueue(); }
async function runQueue(){
  Q.busy = true;
  while (Q.items.length) { pill(); const it = Q.items.shift();
    try { await processDoc(it); } catch (e) { console.warn('process failed', e); } pillMsg = ''; }
  Q.busy = false; pill();
  if (['overview','section','folder'].includes(state.view)) render();
}

async function pdfOpen(blob){
  if (!(window.pdfjsLib && pdfjsLib.GlobalWorkerOptions.workerSrc)) {
    await load(LIB.pdfjs);
    const code = await (await fetch(LIB.pdfw)).text();      // blob worker also works from file://
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type:'text/javascript' }));
  }
  return pdfjsLib.getDocument({ data:new Uint8Array(await blob.arrayBuffer()) }).promise;
}
async function withOcr(fn){ await load(LIB.tess); const w = await Tesseract.createWorker(cfg().ocrLang, 1, { workerPath:abs('js/vendor/tesseract/worker.min.js'), corePath:abs('js/vendor/tesseract/core'), langPath:abs('js/vendor/tesseract/lang') }); try { return await fn(w); } finally { await w.terminate(); } }
async function extractText(blob, n){
  const ext = (n.meta?.ext || '').toLowerCase(), mime = (blob.type || '').toLowerCase();
  if (mime.startsWith('text/') || ['txt','csv','tsv','md','json'].includes(ext)) return (await blob.text()).slice(0, 400000);
  if (ext === 'docx') { await load(LIB.mammoth); return (await mammoth.extractRawText({ arrayBuffer:await blob.arrayBuffer() })).value; }
  if (ext === 'pdf') {
    const pdf = await pdfOpen(blob); let out = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 200); i++) { const c = await (await pdf.getPage(i)).getTextContent(); out += c.items.map(x => x.str).join(' ') + '\n'; }
    if (out.replace(/\s/g, '').length >= 40 || !cfg().ocr) return out;          // has a real text layer
    return withOcr(async w => { let t = ''; const max = Math.min(pdf.numPages, 25);   // scanned → OCR
      for (let i = 1; i <= max; i++) { pillMsg = `OCR page ${i}/${max} · ${n.name}`; pill();
        const pg = await pdf.getPage(i), vp = pg.getViewport({ scale:2 }), c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext:c.getContext('2d'), viewport:vp }).promise;
        t += (await w.recognize(c)).data.text + '\n'; } return t; });
  }
  if (mime.startsWith('image/') && cfg().ocr) { pillMsg = `OCR · ${n.name}`; pill(); return withOcr(async w => (await w.recognize(blob)).data.text); }
  return '';
}
async function processDoc({ id, userMeta }){
  const n = Tree.get(id); if (!n || n.trashed) return;
  const rec = await Files.get(id); if (!rec) return;
  let text = ''; try { text = await extractText(rec.blob, n); } catch (e) { console.warn('extract', e); toast(e.message || 'Could not read ' + n.name, 'err'); }
  if (text && text.trim()) { TXT[id] = text; await X.put('content', { id, text }); if (window.Cloud) Cloud.saveText(id, text); }
  if (cfg().automatch && !userMeta) autoMatch(id);
  runRules(id);
}

/* ============================================================
   AUTO-MATCHING — learns from documents you already labelled
   ============================================================ */
const STOP = new Set('the and for with that this from are was will have has not you your our all any can per via'.split(' '));
const tok = t => (t || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !STOP.has(w));
const vec = n => { const m = {}; tok((n.name || '') + ' ' + (TXT[n.id] || '').slice(0, 20000)).forEach(w => m[w] = (m[w] || 0) + 1); for (const k in m) m[k] = 1 + Math.log(m[k]); return m; };
const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] * a[k]; if (b[k]) d += a[k] * b[k]; } for (const k in b) nb += b[k] * b[k]; return na && nb ? d / Math.sqrt(na * nb) : 0; };
const KW = [[/result|marksheet|gazette/,'Result'],[/circular/,'Circular'],[/notice/,'Notice'],[/syllabus|curriculum/,'Syllabus'],[/thesis|dissertation/,'Thesis'],
  [/minutes/,'Minutes'],[/certificate/,'Certificate'],[/fee|receipt/,'Fee Record'],[/admission/,'Admission'],[/\bnba\b|\bsar\b|accreditation/,'NBA Evidence'],[/time\s?table|date\s?sheet/,'Timetable']];
const labelsOf = d => [d.docType && d.docType !== 'Other' ? 'type:' + d.docType : null, ...(d.tags || []).filter(t => !t.startsWith('Status/')).map(t => 'tag:' + t),
  d.fields?.department ? 'dept:' + d.fields.department : null, d.fields?.issuedBy ? 'issuer:' + d.fields.issuedBy : null].filter(Boolean);

function autoMatch(id){
  const s = Tree.state(), n = s.nodes[id]; if (!n) return;
  const v = vec(n), found = { tags:[], fields:{} }, why = [], cent = {}, cnt = {};
  Object.values(s.nodes).filter(d => d.type === 'doc' && d.id !== id && !d.trashed).forEach(d => {
    const labs = labelsOf(d); if (!labs.length) return; const dv = vec(d);
    labs.forEach(l => { cent[l] = cent[l] || {}; cnt[l] = (cnt[l] || 0) + 1; for (const k in dv) cent[l][k] = (cent[l][k] || 0) + dv[k]; }); });
  const best = {};
  for (const l in cent) { if (cnt[l] < 2) continue; const c = cos(v, cent[l]), cat = l.split(':')[0], val = l.slice(l.indexOf(':') + 1);
    if (cat === 'tag') { if (c >= .3) found.tags.push(val); } else if (c >= .25 && (!best[cat] || c > best[cat].c)) best[cat] = { val, c }; }
  let docType = n.docType;
  if (docType === 'Other') {
    if (best.type) docType = best.type.val;
    else { const hay = (n.name + ' ' + (TXT[id] || '').slice(0, 1500)).toLowerCase(), hit = KW.find(([re]) => re.test(hay)); if (hit) docType = hit[1]; }
  }
  if (docType !== n.docType) why.push('type ' + docType);
  const f = n.fields || {}, hay = n.name + ' ' + (TXT[id] || '').slice(0, 3000);
  if (!f.department) { const d = best.dept?.val || Tree.FIELD_DEFS[0].options.find(o => o.length > 2 && o !== 'Administration' && new RegExp('\\b' + o + '\\b', 'i').test(n.name)); if (d) found.fields.department = d; }
  if (!f.issuedBy) { const i = best.issuer?.val || (/GGSIPU|\bIPU\b/i.test(hay) ? 'GGSIPU' : /AICTE/i.test(hay) ? 'AICTE' : null); if (i) found.fields.issuedBy = i; }
  if (!f.year) { const y = hay.match(/\b(20[0-4]\d)\b/); if (y) found.fields.year = y[1]; }
  found.tags = found.tags.filter(t => !(n.tags || []).includes(t));
  if (Object.keys(found.fields).length) why.push(Object.entries(found.fields).map(([k, x]) => k + ' ' + x).join(', '));
  if (found.tags.length) why.push('tags ' + found.tags.join(', '));
  if (!why.length) return;
  _setMeta(id, { docType, tags:[...new Set([...(n.tags || []), ...found.tags, 'Status/Needs Review'])], fields:found.fields });
  hist(id, 'Auto-matched → ' + why.join(' · ') + ' (please review)');
}

/* ============================================================
   WORKFLOWS — "if this, then that" on every upload
   ============================================================ */
const rules = () => jget(K.rules, []);
function ruleMatches(r, n){
  const w = r.when || {}, t = (TXT[n.id] || '').toLowerCase(), nm = n.name.toLowerCase();
  return (!w.type || n.docType === w.type) && (!w.nameHas || nm.includes(w.nameHas.toLowerCase())) && (!w.textHas || t.includes(w.textHas.toLowerCase())) &&
    (!w.tag || (n.tags || []).some(x => x === w.tag || x.startsWith(w.tag + '/'))) && (!w.folder || Tree.path(n.id).some(p => p.id === w.folder));
}
function runRules(id){
  rules().filter(r => r.on).forEach(r => {
    const n = Tree.get(id); if (!n || !ruleMatches(r, n)) return; const a = r.then || {}, patch = {};
    if (a.type) patch.docType = a.type;
    if (a.tag) patch.tags = [...new Set([...(n.tags || []), a.tag])];
    if (a.fieldKey && a.fieldVal) patch.fields = { [a.fieldKey]: a.fieldVal };
    if (Object.keys(patch).length) _setMeta(id, patch);
    if (a.group) mutate(id, d => { d.acl = { visibility:'groups', groups:[a.group] }; });
    hist(id, `Workflow “${r.name}” applied`);
  });
}

/* ============================================================
   SEARCH — name + full text + metadata
   ============================================================ */
const hayOf = d => (d.name + ' ' + (TXT[d.id] || '') + ' ' + Object.values(d.fields || {}).join(' ') + ' ' + (d.tags || []).join(' ')).toLowerCase();
function searchAll(qs){
  const base = Tree.search(qs), seen = new Set(base.map(n => n.id)), terms = qs.toLowerCase().split(/\s+/).filter(Boolean);
  return base.concat(Tree.filter({}).filter(d => !seen.has(d.id) && terms.every(t => hayOf(d).includes(t))));
}
function runSearch(f){
  let docs = Tree.filter({ types:f.type ? [f.type] : [], tags:f.tag ? [f.tag] : [], fields:f.fields || {} });
  if (f.from) docs = docs.filter(d => d.created >= new Date(f.from).getTime());
  if (f.to)   docs = docs.filter(d => d.created <= new Date(f.to).getTime() + day - 1);
  if (f.by)   docs = docs.filter(d => (d.createdBy || '').toLowerCase().includes(f.by.toLowerCase()));
  if (f.text) { const terms = f.text.toLowerCase().split(/\s+/).filter(Boolean); docs = docs.filter(d => terms.every(t => hayOf(d).includes(t))); }
  return docs.sort((a, b) => b.created - a.created);
}
function snippet(d, text){
  const t = TXT[d.id] || '', term = (text || '').toLowerCase().split(/\s+/)[0]; if (!t || !term) return '';
  const i = t.toLowerCase().indexOf(term); if (i < 0) return '';
  const raw = esc(t.slice(Math.max(0, i - 70), i + 110).replace(/\s+/g, ' ')), re = new RegExp(esc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return '…' + raw.replace(re, m => `<mark>${m}</mark>`) + '…';
}
function resultRow(d, text){
  const st = fileStyle(d.meta?.ext), sn = snippet(d, text);
  return `<div class="fr" data-open="${d.id}">
    <span class="fr__ico" style="background:${st.bg};color:${st.fg}">${esc((d.meta?.ext || 'file').toUpperCase().slice(0, 4))}</span>
    <div class="fr__txt"><b>${esc(d.name)}</b><small>${esc(pathLabel(d.parent))} · ${esc(d.docType || 'Other')} · ${timeAgo(d.created)}</small>
      ${sn ? `<em>${sn}</em>` : ''}<div>${(d.tags || []).slice(0, 5).map(t => `<span class="tagchip">${esc(t)}</span>`).join('')}</div></div>
    <button class="btn btn--sm" data-info="${d.id}">Details</button></div>`;
}
function wireRows(host){
  host.addEventListener('click', e => {
    const i = e.target.closest('[data-info]'); if (i) { showDetails(i.dataset.info); return; }
    const o = e.target.closest('[data-open]'); if (o) openDoc(o.dataset.open);
  });
}

/* saved views (pinned in the sidebar) */
const savedViews = () => jget(K.views, []);
function paintSaved(){
  const host = q1('#savedNav'); if (!host) return;
  host.innerHTML = '';
  savedViews().forEach(v => {
    const row = document.createElement('div'); row.className = 'nav__row';
    row.innerHTML = `<button class="nav__item" title="${esc(v.name)}"><span class="nav__dot" style="background:var(--lime-600)"></span><span class="nav__label-txt">${esc(v.name)}</span></button><button class="nav__add" title="Remove this view">×</button>`;
    row.children[0].addEventListener('click', () => { Feat.pending = v.query; state.view = 'adv'; state.nodeId = null;
      qa('.nav__item[data-view]').forEach(x => x.classList.toggle('nav__item--active', x.dataset.view === 'adv')); render(); closeSidebar(); });
    row.children[1].addEventListener('click', () => { jset(K.views, savedViews().filter(x => x.id !== v.id)); paintSaved(); });
    host.appendChild(row);
  });
  if (!savedViews().length) host.innerHTML = '<div class="nav__hint">Pin a search from Advanced search</div>';
}

/* ============================================================
   SHARING — links & bundles (see share.html)
   ============================================================ */
const shareUrl = tk => new URL('share.html', location.href).href.split('#')[0] + '#t=' + tk;
function makeShare(ids, days, name){
  const list = jget(K.shares, []), token = Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  list.unshift({ token, ids, name:name || (ids.length === 1 ? Tree.get(ids[0])?.name : ids.length + ' documents'), by:me().name, created:Date.now(), expires:days ? Date.now() + days * day : 0 });
  jset(K.shares, list); ids.forEach(i => hist(i, 'Share link created')); return token;
}
const expiryHtml = `<div class="field"><label for="shDays">Link expires</label><select id="shDays"><option value="1">in 1 day</option><option value="7" selected>in 7 days</option><option value="30">in 30 days</option><option value="0">never</option></select></div>`;
function linkModal(url){
  openModal('Share link ready', 'Anyone with this link can download — no login. Works in this browser until the server version is added.', 'Copy link',
    () => { navigator.clipboard?.writeText(url); toast('Link copied', 'ok'); },
    { mode:'custom', html:`<div class="field"><input readonly value="${esc(url)}"></div>` });
}
function shareDialog(ids, name){
  openModal('Create share link', name || '', 'Create link', () => {
    const tk = makeShare(ids, +q1('#shDays').value, name); setTimeout(() => linkModal(shareUrl(tk)), 0); return false;
  }, { mode:'custom', html:expiryHtml });
}

/* ============================================================
   VERSIONS · PDF TOOLS
   ============================================================ */
async function replaceFile(id, file, why){
  const n = Tree.get(id), rec = await Files.get(id), v = n.meta.version || 1;
  if (rec) await X.put('versions', { key:`${id}#${v}`, id, v, blob:rec.blob, name:rec.name || n.name, mime:rec.type, size:rec.size, at:n.modified || n.created, by:n.modifiedBy || n.createdBy });
  await Files.put(id, file); const hash = await hashOf(file);
  mutate(id, d => { d.meta.version = v + 1; d.meta.size = file.size; d.meta.hash = hash; d.meta.mime = file.type || d.meta.mime; d.modified = Date.now(); d.modifiedBy = me().name; });
  hist(id, `${why} → v${v + 1}`); enqueue(id, { userMeta:true });
}
async function addBlobDoc(bytes, name, from){
  const file = new File([bytes], name, { type:'application/pdf' });
  const id = Tree.addDoc({ name, size:file.size, mime:file.type, ext:'pdf', docType:from.docType, tags:from.tags, fields:from.fields }, from.parent);
  await Files.put(id, file); mutate(id, d => { d.meta.version = 1; d.meta.hash = null; }); hist(id, `Created from “${from.name}”`);
  enqueue(id, { userMeta:true }); return id;
}
const parseRange = (str, total) => { const out = new Set(); String(str).split(',').forEach(p => { const m = p.trim().match(/^(\d+)(?:-(\d+))?$/); if (!m) return;
  for (let i = +m[1]; i <= +(m[2] || m[1]); i++) if (i >= 1 && i <= total) out.add(i); }); return [...out].sort((a, b) => a - b); };
async function pdfOp(id, op, arg){
  await load(LIB.pdflib); const { PDFDocument, degrees } = PDFLib, n = Tree.get(id);
  const open = async i => PDFDocument.load(await (await Files.get(i)).blob.arrayBuffer(), { ignoreEncryption:true });
  const src = await open(id), total = src.getPageCount();
  if (op === 'rotate') { src.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + +arg) % 360))); await replaceFile(id, asFile(await src.save(), n.name, 'application/pdf'), `Rotated ${arg}°`); }
  if (op === 'delete') { const pg = parseRange(arg, total); if (!pg.length || pg.length >= total) throw new Error('Choose some pages, but not all of them.');
    pg.reverse().forEach(i => src.removePage(i - 1)); await replaceFile(id, asFile(await src.save(), n.name, 'application/pdf'), `Deleted pages ${arg}`); }
  if (op === 'split') { const pg = parseRange(arg, total); if (!pg.length) throw new Error('Enter page numbers like 1,3-5');
    const out = await PDFDocument.create(); (await out.copyPages(src, pg.map(i => i - 1))).forEach(p => out.addPage(p));
    await addBlobDoc(await out.save(), n.name.replace(/\.pdf$/i, '') + ` (pages ${arg}).pdf`, n); }
  if (op === 'merge') { const other = await open(arg), out = await PDFDocument.create();
    for (const d of [src, other]) (await out.copyPages(d, d.getPageIndices())).forEach(p => out.addPage(p));
    await addBlobDoc(await out.save(), 'Merged - ' + n.name, n); }
}
function pdfDialog(id){
  const n = Tree.get(id), others = Tree.filter({}).filter(d => d.id !== id && d.meta?.ext === 'pdf');
  const draw = () => { const op = q1('#pdfOp').value, a = q1('#pdfArg');
    a.innerHTML = op === 'rotate' ? `<label for="pdfV">Rotate by (degrees)</label><select id="pdfV"><option>90</option><option>180</option><option>270</option></select>`
      : op === 'merge' ? `<label for="pdfV">Append this PDF</label><select id="pdfV">${others.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('') || '<option value="">No other PDFs</option>'}</select>`
      : `<label for="pdfV">Pages</label><input id="pdfV" type="text" placeholder="e.g. 1,3-5">`; };
  openModal('PDF tools', n.name, 'Apply', async () => {
    const op = q1('#pdfOp').value, arg = q1('#pdfV').value.trim(); if (!arg) { toast('Fill in the option first.', 'err'); return false; }
    try { toast('Working…', 'ok'); await pdfOp(id, op, arg); toast('Done', 'ok'); render(); showDetails(id); } catch (e) { toast(e.message, 'err'); return false; }
  }, { mode:'custom', html:`<div class="field"><label for="pdfOp">Action</label><select id="pdfOp"><option value="rotate">Rotate all pages</option><option value="delete">Delete pages</option><option value="split">Split pages into a new document</option><option value="merge">Merge with another PDF (new document)</option></select></div><div class="field" id="pdfArg"></div>` });
  q1('#pdfOp').addEventListener('change', draw); draw();
}

/* ============================================================
   DETAILS PANEL — extra sections for every document
   ============================================================ */
const sec = (title, body, open) => (window.Cloud && ['Notes', 'History', 'Versions'].includes(title)) ? '' : `<details class="fx__sec"${open ? ' open' : ''}><summary>${title}</summary><div class="fx__body">${body}</div></details>`;
function similar(n){
  const v = vec(n);
  return Tree.filter({}).filter(d => d.id !== n.id).map(d => { let s = cos(v, vec(d)); if (n.docType !== 'Other' && d.docType === n.docType) s += .08;
    s += Math.min(.12, (d.tags || []).filter(t => (n.tags || []).includes(t)).length * .06); return { d, s }; }).filter(x => x.s > .12).sort((a, b) => b.s - a.s).slice(0, 5);
}
function decorate(id, body){
  const n = Tree.get(id); if (!n || n.type !== 'doc') return;
  const host = document.createElement('div'); host.className = 'fx'; body.appendChild(host);
  const owner = isAdmin() || n.createdEmail === me().email, a = n.acl || { visibility:'everyone', groups:[] };
  const sim = similar(n), text = (TXT[id] || '').trim();
  host.innerHTML = `
    <div class="fx__tools">
      <button class="btn btn--sm" data-x="version">New version</button><button class="btn btn--sm" data-x="share">Share link</button>
      <button class="btn btn--sm" data-x="mail">Email</button>${n.meta?.ext === 'pdf' ? '<button class="btn btn--sm" data-x="pdf">PDF tools</button>' : ''}
      <button class="btn btn--sm" data-x="reread">Re-read text</button><input type="file" id="fxVerIn" hidden></div>
    ${sec('Access', owner ? `<div class="fx__row"><select id="fxVis"><option value="everyone">Everyone signed in</option><option value="private">Only me (and admins)</option>${window.Cloud ? '' : '<option value="groups">Selected groups</option>'}</select></div>
        <div class="fx__row" id="fxGroups">${groups().map(g => `<label class="check"><input type="checkbox" value="${esc(g.name)}"${(a.groups || []).includes(g.name) ? ' checked' : ''}> ${esc(g.name)}</label>`).join('')}</div>
        <button class="btn btn--sm btn--primary" data-x="acl">Save access</button>` : `<small>Visible to you because of your group. Only the owner or an admin can change access.</small>`)}
    ${sec('Notes', `<div id="fxNotes">${(n.notes || []).map(x => `<div class="note"><b>${esc(x.by)}</b> <time>${timeAgo(x.at)}</time><p>${esc(x.text)}</p></div>`).join('') || '<small>No notes yet.</small>'}</div>
       <textarea id="fxNoteIn" rows="2" placeholder="Add a comment…"></textarea><button class="btn btn--sm btn--primary" data-x="note">Add note</button>`, (n.notes || []).length)}
    ${sec('Versions', '<div id="fxVers"><small>Loading…</small></div>')}
    ${sec('Similar documents', sim.length ? sim.map(x => `<button class="sim" data-sim="${x.d.id}"><b>${esc(x.d.name)}</b><small>${Math.round(Math.min(.99, x.s) * 100)}% match · ${esc(x.d.docType || 'Other')}</small></button>`).join('') : '<small>Nothing similar yet.</small>')}
    ${sec('History', (n.history || []).map(h => `<div class="hl"><time>${fullDate(h.at)}</time> ${esc(h.text)} <small>— ${esc(h.by)}</small></div>`).join('') || '<small>No history yet.</small>')}
    ${sec('Extracted text', text ? `<pre class="fx__pre">${esc(text.slice(0, 2500))}${text.length > 2500 ? '\n…' : ''}</pre>` : '<small>No text extracted (yet). Scanned files are read by OCR in the background.</small>')}`;
  const vis = q1('#fxVis', host);
  if (vis) { vis.value = a.visibility || 'everyone'; const sync = () => q1('#fxGroups', host).style.display = vis.value === 'groups' ? '' : 'none'; vis.onchange = sync; sync(); }

  X.all('versions').then(rows => { const mine = rows.filter(r => r.id === id).sort((x, y) => y.v - x.v), el = q1('#fxVers', host); if (!el) return;
    el.innerHTML = `<div class="ver ver--now"><b>v${n.meta?.version || 1}</b> current · ${humanSize(n.meta?.size)}</div>` + mine.map(r =>
      `<div class="ver"><b>v${r.v}</b> ${fullDate(r.at)} · ${esc(r.by || '')} · ${humanSize(r.size)}<span><button class="btn btn--sm btn--ghost" data-x="vdl" data-k="${esc(r.key)}">Download</button><button class="btn btn--sm btn--ghost" data-x="vrs" data-k="${esc(r.key)}">Restore</button></span></div>`).join(''); });

  host.addEventListener('click', async e => {
    const s = e.target.closest('[data-sim]'); if (s) { showDetails(s.dataset.sim); return; }
    const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x;
    try {
      if (x === 'version') q1('#fxVerIn', host).click();
      if (x === 'share') shareDialog([id], n.name);
      if (x === 'mail') { const u = shareUrl(makeShare([id], 7, n.name)); location.href = `mailto:?subject=${encodeURIComponent(n.name)}&body=${encodeURIComponent('Document: ' + n.name + '\n' + u)}`; }
      if (x === 'pdf') pdfDialog(id);
      if (x === 'reread') { enqueue(id, { userMeta:true }); toast('Reading in the background…', 'ok'); }
      if (x === 'note') { const t = q1('#fxNoteIn', host).value.trim(); if (!t) return; mutate(id, d => { (d.notes = d.notes || []).push({ by:me().name, at:Date.now(), text:t }); }); hist(id, 'Note added'); showDetails(id); }
      if (x === 'acl') { const v = vis.value, g = qa('#fxGroups input:checked', host).map(c => c.value); mutate(id, d => { d.acl = { visibility:v, groups:g }; });
        hist(id, 'Access set to ' + v + (g.length ? ' (' + g.join(', ') + ')' : '')); toast('Access saved', 'ok'); render(); showDetails(id); }
      if (x === 'vdl') { const r = await X.get('versions', b.dataset.k), u = URL.createObjectURL(r.blob); liveUrls.push(u); triggerDownload(u, `v${r.v} - ${r.name}`); }
      if (x === 'vrs') { const r = await X.get('versions', b.dataset.k); await replaceFile(id, asFile(r.blob, r.name, r.mime), `Restored v${r.v}`); toast('Version restored', 'ok'); setTimeout(() => { render(); showDetails(id); }, 300); }
    } catch (err) { toast(err.message, 'err'); }
  });
  q1('#fxVerIn', host).addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return;
    await replaceFile(id, f, 'New version uploaded'); toast('New version saved — the old one is kept', 'ok'); render(); showDetails(id); });
}

/* ============================================================
   VIEWS (pages in the main area)
   ============================================================ */
const head = (t, p, actions = '') => `<div class="page-head"><div><h1>${t}</h1><p>${p}</p></div><div class="page-head__actions">${actions}</div></div>`;
const folderOpts = (sel, withSections) => visible(Object.values(Tree.state().nodes)).filter(n => n.type === 'folder' || (withSections && n.type === 'section'))
  .map(n => `<option value="${n.id}"${n.id === sel ? ' selected' : ''}>${esc(pathLabel(n.id))}</option>`).join('');
const fieldInput = (d, v = '') => d.type === 'select'
  ? `<select data-f="${d.key}"><option value="">Any ${esc(d.label)}</option>${d.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
  : `<input type="text" data-f="${d.key}" value="${esc(v)}" placeholder="${esc(d.label)}">`;
const Feat = { pending:null, views:{} };

Feat.views.adv = page => {
  const f = Feat.pending || {}; Feat.pending = null;
  page.innerHTML = head('Advanced search', 'Search inside documents and filter by type, tag and fields.', '<button class="btn" id="asSave">Pin as saved view</button>') + `
    <div class="panel"><div class="panel__body"><div class="as">
      <input type="search" id="asText" placeholder="Words inside the document, roll number, name…" value="${esc(f.text || '')}" class="as__wide">
      <select id="asType"><option value="">Any document type</option>${Tree.DOC_TYPES.map(t => `<option${t === f.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <input type="text" id="asTag" list="asTags" placeholder="Tag (e.g. Result/2025)" value="${esc(f.tag || '')}"><datalist id="asTags">${Tree.allTags().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      ${Tree.FIELD_DEFS.map(d => fieldInput(d, (f.fields || {})[d.key] || '')).join('')}
      <input type="text" id="asBy" placeholder="Uploaded by" value="${esc(f.by || '')}">
      <label class="as__date">From <input type="date" id="asFrom" value="${esc(f.from || '')}"></label>
      <label class="as__date">To <input type="date" id="asTo" value="${esc(f.to || '')}"></label>
      <button class="btn" id="asClear">Clear</button>
    </div></div></div>
    <div class="panel"><div class="panel__head"><h2>Results</h2><span class="tag" id="asCount" style="background:var(--shell-chip)"></span></div><div class="panel__body" id="asOut"></div></div>`;
  const read = () => { const fields = {}; qa('[data-f]', page).forEach(e => { if (e.value.trim()) fields[e.dataset.f] = e.value.trim(); });
    return { text:q1('#asText').value.trim(), type:q1('#asType').value, tag:q1('#asTag').value.trim(), fields, by:q1('#asBy').value.trim(), from:q1('#asFrom').value, to:q1('#asTo').value }; };
  const go = () => { const qy = read(), r = runSearch(qy); q1('#asCount').textContent = r.length + ' found';
    q1('#asOut').innerHTML = r.length ? r.slice(0, 200).map(d => resultRow(d, qy.text)).join('') : '<div class="empty"><h3>No documents match</h3><p>Try fewer filters.</p></div>'; };
  wireRows(q1('#asOut')); page.addEventListener('input', go); page.addEventListener('change', go);
  q1('#asClear').addEventListener('click', () => { Feat.pending = {}; render(); });
  q1('#asSave').addEventListener('click', () => openModal('Pin this search', 'It will appear in the sidebar under Saved views.', 'Save', () => {
    const name = q1('#modalInput').value.trim(); if (!name) return false;
    jset(K.views, [...savedViews(), { id:'v' + Date.now(), name, query:read() }]); paintSaved(); toast('Saved view pinned', 'ok'); }, { mode:'prompt', label:'View name' }));
  go();
};

Feat.views.trash = page => {
  const roots = Object.values(Tree.state().nodes).filter(n => n.trashed && n.trashRoot === n.id).sort((a, b) => b.trashed - a.trashed);
  page.innerHTML = head('Trash', `Deleted items stay here for ${TRASH_DAYS} days, then are removed for good.`, roots.length ? '<button class="btn btn--danger" id="trEmpty">Empty trash</button>' : '') + `
    <div class="panel"><div class="panel__body">${roots.length ? `<table class="tbl"><thead><tr><th>Name</th><th>Kind</th><th>Deleted</th><th>Left</th><th></th></tr></thead><tbody>${roots.map(n => `<tr>
      <td>${esc(n.name)}</td><td>${n.type === 'doc' ? 'Document' : 'Folder'}</td><td>${timeAgo(n.trashed)}</td><td>${Math.max(0, TRASH_DAYS - Math.floor((Date.now() - n.trashed) / day))} days</td>
      <td class="tr"><button class="btn btn--sm" data-re="${n.id}">Restore</button> <button class="btn btn--sm btn--danger" data-rm="${n.id}">Delete forever</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty"><div class="empty__ico">◌</div><h3>Trash is empty</h3></div>'}</div></div>`;
  page.addEventListener('click', e => {
    const re = e.target.closest('[data-re]'), rm = e.target.closest('[data-rm]');
    if (re) { restore(re.dataset.re); buildNav(); toast('Restored', 'ok'); render(); }
    if (rm) openModal('Delete forever?', 'This cannot be undone.', 'Delete', async () => { await purge(rm.dataset.rm); render(); }, { mode:'none' });
    if (e.target.closest('#trEmpty')) openModal('Empty trash?', 'Everything in the trash is deleted permanently.', 'Empty', async () => { for (const n of roots) await purge(n.id); render(); }, { mode:'none' });
  });
};

Feat.views.rules = page => {
  const c = cfg(), rs = rules();
  const sum = r => [r.when.type && 'type ' + r.when.type, r.when.nameHas && `name has “${r.when.nameHas}”`, r.when.textHas && `text has “${r.when.textHas}”`, r.when.tag && 'tag ' + r.when.tag, r.when.folder && 'in ' + (Tree.get(r.when.folder)?.name || '?')].filter(Boolean).join(' + ') || 'every upload';
  const act = r => [r.then.tag && 'add tag ' + r.then.tag, r.then.type && 'set type ' + r.then.type, r.then.fieldKey && `${r.then.fieldKey} = ${r.then.fieldVal}`, r.then.group && 'restrict to ' + r.then.group].filter(Boolean).join(', ');
  page.innerHTML = head('Workflows & reading', 'Rules that run on every upload, plus how documents are read.', '<button class="btn btn--primary" id="rlNew">New workflow</button>') + `
    <div class="panel"><div class="panel__head"><h2>Reading settings</h2></div><div class="panel__body fx__cfg">
      <label class="check"><input type="checkbox" id="cfOcr"${c.ocr ? ' checked' : ''}> OCR for scanned PDFs and photos</label>
      <label>OCR language <select id="cfLang"><option value="eng+hin">English + Hindi</option><option value="eng">English</option><option value="hin">Hindi</option></select></label>
      <label class="check"><input type="checkbox" id="cfAuto"${c.automatch ? ' checked' : ''}> Auto-match type, tags and fields (flags “Status/Needs Review”)</label>
      <div><button class="btn btn--sm" id="cfRun">Re-run workflows on all documents</button> <button class="btn btn--sm" id="cfRead">Read all unread documents</button></div></div></div>
    <div class="panel"><div class="panel__head"><h2>Workflows</h2><span class="tag" style="background:var(--shell-chip)">${rs.length}</span></div><div class="panel__body">
      ${rs.length ? `<table class="tbl"><tbody>${rs.map(r => `<tr><td><b>${esc(r.name)}</b><br><small>When ${esc(sum(r))} → ${esc(act(r))}</small></td>
        <td class="tr"><label class="check"><input type="checkbox" data-on="${r.id}"${r.on ? ' checked' : ''}> On</label> <button class="btn btn--sm btn--danger" data-del="${r.id}">Delete</button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><h3>No workflows yet</h3><p>Example: when the file name contains “circular”, add tag Public/Circular.</p></div>'}</div></div>`;
  q1('#cfLang').value = c.ocrLang;
  const save = () => jset(K.cfg, { ...cfg(), ocr:q1('#cfOcr').checked, ocrLang:q1('#cfLang').value, automatch:q1('#cfAuto').checked });
  ['#cfOcr', '#cfLang', '#cfAuto'].forEach(s => q1(s).addEventListener('change', save));
  q1('#cfRun').addEventListener('click', () => { Tree.filter({}).forEach(d => runRules(d.id)); toast('Workflows applied', 'ok'); });
  q1('#cfRead').addEventListener('click', () => { const todo = Tree.filter({}).filter(d => TXT[d.id] === undefined); todo.forEach(d => enqueue(d.id, { userMeta:true })); toast(`${todo.length} documents queued`, 'ok'); });
  page.addEventListener('change', e => { const o = e.target.dataset.on; if (o) jset(K.rules, rules().map(r => r.id === o ? { ...r, on:e.target.checked } : r)); });
  page.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { jset(K.rules, rules().filter(r => r.id !== d.dataset.del)); render(); } });
  q1('#rlNew').addEventListener('click', () => {
    openModal('New workflow', 'Runs on every new upload. Leave a condition empty to ignore it.', 'Save workflow', () => {
      const v = id => q1('#' + id).value.trim(), name = v('rlName'); if (!name) { toast('Give the workflow a name.', 'err'); return false; }
      jset(K.rules, [...rules(), { id:'r' + Date.now(), name, on:true,
        when:{ type:v('rlType'), nameHas:v('rlName2'), textHas:v('rlText'), tag:v('rlTag'), folder:v('rlFolder') },
        then:{ tag:v('rlAddTag'), type:v('rlSetType'), fieldKey:v('rlFk'), fieldVal:v('rlFv'), group:v('rlGroup') } }]);
      render(); toast('Workflow saved', 'ok');
    }, { mode:'custom', html:`<div class="fx__form">
      <div class="field"><label for="rlName">Workflow name</label><input id="rlName" type="text" placeholder="e.g. Circulars are public"></div>
      <h4>When a document…</h4>
      <div class="field"><label for="rlType">has type</label><select id="rlType"><option value="">any</option>${Tree.DOC_TYPES.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label for="rlName2">file name contains</label><input id="rlName2" type="text"></div>
      <div class="field"><label for="rlText">text contains</label><input id="rlText" type="text"></div>
      <div class="field"><label for="rlTag">has tag</label><input id="rlTag" type="text" placeholder="e.g. Department/CSE"></div>
      <div class="field"><label for="rlFolder">is in folder</label><select id="rlFolder"><option value="">anywhere</option>${folderOpts('', true)}</select></div>
      <h4>Then…</h4>
      <div class="field"><label for="rlAddTag">add tag</label><input id="rlAddTag" type="text" placeholder="e.g. Status/Needs Review"></div>
      <div class="field"><label for="rlSetType">set type</label><select id="rlSetType"><option value="">—</option>${Tree.DOC_TYPES.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label for="rlFk">set field</label><select id="rlFk"><option value="">—</option>${Tree.FIELD_DEFS.map(d => `<option value="${d.key}">${esc(d.label)}</option>`).join('')}</select><input id="rlFv" type="text" placeholder="value"></div>
      <div class="field"><label for="rlGroup">restrict access to group</label><select id="rlGroup"><option value="">—</option>${groups().map(g => `<option>${esc(g.name)}</option>`).join('')}</select></div></div>` });
    q1('.modal__box').style.maxWidth = '560px';
  });
};

Feat.views.shares = page => {
  const list = jget(K.shares, []);
  page.innerHTML = head('Shares & bundles', 'Public links (no login) for one document or a bundle of many.', '<button class="btn btn--primary" id="shNew">New bundle</button>') + `
    <div class="alert alert--info">Links work in the browser that holds the vault. For links that open on other computers the server version is needed — the data shape here is already ready for it.</div>
    <div class="panel"><div class="panel__body">${list.length ? `<table class="tbl"><thead><tr><th>Name</th><th>Docs</th><th>Expires</th><th></th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.name)}<br><small>by ${esc(s.by)} · ${timeAgo(s.created)}</small></td><td>${s.ids.length}</td>
      <td>${s.expires ? (s.expires < Date.now() ? '<span style="color:var(--shell-danger)">expired</span>' : new Date(s.expires).toLocaleDateString('en-IN')) : 'never'}</td>
      <td class="tr"><button class="btn btn--sm" data-cp="${s.token}">Copy link</button> <button class="btn btn--sm" data-ml="${s.token}">Email</button> <button class="btn btn--sm btn--danger" data-rv="${s.token}">Revoke</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty"><h3>No share links yet</h3><p>Use “Share link” in a document’s details, or create a bundle here.</p></div>'}</div></div>`;
  page.addEventListener('click', e => {
    const cp = e.target.closest('[data-cp]'), ml = e.target.closest('[data-ml]'), rv = e.target.closest('[data-rv]');
    if (cp) { navigator.clipboard?.writeText(shareUrl(cp.dataset.cp)); toast('Link copied', 'ok'); }
    if (ml) { const s = list.find(x => x.token === ml.dataset.ml); location.href = `mailto:?subject=${encodeURIComponent(s.name)}&body=${encodeURIComponent(shareUrl(s.token))}`; }
    if (rv) { jset(K.shares, list.filter(x => x.token !== rv.dataset.rv)); render(); }
  });
  q1('#shNew').addEventListener('click', () => {
    const docs = Tree.filter({}); if (!docs.length) { toast('Upload documents first.', 'err'); return; }
    openModal('New bundle', 'Pick the documents that share one link.', 'Create link', () => {
      const ids = qa('#bnList input:checked').map(c => c.value); if (!ids.length) { toast('Pick at least one document.', 'err'); return false; }
      const tk = makeShare(ids, +q1('#shDays').value, q1('#bnName').value.trim() || ids.length + ' documents'); setTimeout(() => linkModal(shareUrl(tk)), 0); return false;
    }, { mode:'custom', html:`<div class="field"><label for="bnName">Bundle name</label><input id="bnName" type="text" placeholder="e.g. Results 2026"></div>${expiryHtml}
      <div class="bn" id="bnList">${docs.map(d => `<label class="check"><input type="checkbox" value="${d.id}"> ${esc(d.name)}</label>`).join('')}</div>` });
  });
};

Feat.views.groups = page => {
  const gs = groups(), users = Users.all().filter(u => u.hash && u.status === 'approved');
  page.innerHTML = head('Users & groups', 'Groups for restricting single documents (e.g. only Exam Cell). Admins always see everything.', '<button class="btn btn--primary" id="gNew">New group</button>') + `
    <div class="alert alert--info">Which sections a member can open is set under Members &amp; approvals. Groups here only restrict individual documents.</div>
    ${gs.map(g => `<div class="panel"><div class="panel__head"><h2>${esc(g.name)}</h2>${['Faculty','Exam Cell'].includes(g.name) ? '' : `<button class="btn btn--sm btn--danger" data-gd="${esc(g.name)}">Delete group</button>`}</div>
      <div class="panel__body"><div>${g.members.map(m => `<span class="tagchip">${esc(m)} <a href="#" data-rm="${esc(g.name)}|${esc(m)}">×</a></span>`).join('') || '<small>No members.' + '' + '</small>'}</div>
      <div class="fx__row"><select data-add="${esc(g.name)}"><option value="">Add a member…</option>${users.filter(u => !g.members.includes(u.email)).map(u => `<option value="${esc(u.email)}">${esc(u.name)} · ${esc(u.email)}</option>`).join('')}</select></div></div></div>`).join('')}
    <div class="panel"><div class="panel__head"><h2>Approved members</h2></div><div class="panel__body"><table class="tbl"><tbody>${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td></tr>`).join('') || '<tr><td>No users yet.</td></tr>'}</tbody></table></div></div>`;
  const save = v => { jset(K.groups, v); render(); };
  page.addEventListener('change', e => { const g = e.target.dataset.add; if (g && e.target.value) save(gs.map(x => x.name === g ? { ...x, members:[...x.members, e.target.value] } : x)); });
  page.addEventListener('click', e => { const rm = e.target.closest('[data-rm]'), gd = e.target.closest('[data-gd]');
    if (rm) { e.preventDefault(); const [g, m] = rm.dataset.rm.split('|'); save(gs.map(x => x.name === g ? { ...x, members:x.members.filter(y => y !== m) } : x)); }
    if (gd) save(gs.filter(x => x.name !== gd.dataset.gd)); });
  q1('#gNew').addEventListener('click', () => openModal('New group', '', 'Create', () => { const n = q1('#modalInput').value.trim(); if (!n || gs.some(g => g.name === n)) return false; save([...gs, { name:n, members:[] }]); }, { mode:'prompt', label:'Group name' }));
};

/* ---------- Members & approvals (admin only) ---------- */
function pendBadge(){ const n = Users.pendingCount(), b = q1('#pendBadge'); if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; } }
Feat.views.members = page => {
  const all = Users.all().filter(u => u.hash), pend = all.filter(u => u.status === 'pending'), rest = all.filter(u => u.status !== 'pending'), secs = Tree.sections();
  const card = u => { const isA = u.role === 'Admin', allSec = u.sections === 'all', sel = Array.isArray(u.sections) ? u.sections : [];
    const label = isA ? 'Admin' : u.status === 'pending' ? 'Waiting for approval' : u.status === 'approved' ? 'Active' : 'Blocked';
    return `<div class="mc" data-email="${esc(u.email)}"><div class="mc__top"><div><b>${esc(u.name)}</b><small>${esc(u.email)} · joined ${timeAgo(u.created)}</small></div><span class="st st--${isA ? 'approved' : u.status}">${label}</span></div>
      ${isA ? '<small>Full access to everything. This account cannot be restricted or removed.</small>' : `
      <div class="mc__grid"><label>Role<input data-k="role" list="roleList" value="${esc(u.role || 'Faculty')}" placeholder="Faculty, HOD…"></label>
        <label class="check"><input type="checkbox" data-k="edit"${u.canEdit !== false ? ' checked' : ''}> Can upload &amp; edit (untick = view only)</label></div>
      <div class="mc__secs"><span>Sections this member can see (the rest stay hidden)</span>
        <label class="check"><input type="checkbox" data-k="all"${allSec ? ' checked' : ''}> All sections</label>
        ${secs.map(s => `<label class="check"><input type="checkbox" data-sec="${s.id}"${allSec || sel.includes(s.id) ? ' checked' : ''}${allSec ? ' disabled' : ''}> ${esc(s.name)}</label>`).join('')}</div>`}
      <div class="mc__acts">${isA ? '' : u.status === 'pending' || u.status === 'rejected' ? '<button class="btn btn--sm btn--primary" data-a="approve">Approve</button>' + (u.status === 'pending' ? '<button class="btn btn--sm btn--danger" data-a="reject">Reject</button>' : '')
        : '<button class="btn btn--sm btn--primary" data-a="save">Save changes</button><button class="btn btn--sm" data-a="reject">Block</button>'}
        <button class="btn btn--sm" data-a="pw">Set password</button>${isA ? '' : '<button class="btn btn--sm btn--danger" data-a="rm">Remove</button>'}</div></div>`; };
  page.innerHTML = head('Members & approvals', 'New sign-ups wait here. Give each person a role and choose which sections they can see.') +
    `<datalist id="roleList">${Users.ROLES.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
    <div class="panel"><div class="panel__head"><h2>Waiting for approval</h2><span class="tag" style="background:var(--shell-chip)">${pend.length}</span></div><div class="panel__body">${pend.map(card).join('') || '<div class="empty"><h3>No one is waiting</h3></div>'}</div></div>
    <div class="panel"><div class="panel__head"><h2>Members</h2><span class="tag" style="background:var(--shell-chip)">${rest.length}</span></div><div class="panel__body">${rest.map(card).join('')}</div></div>`;
  const rd = c => ({ role:q1('[data-k="role"]', c).value.trim() || 'Faculty', canEdit:q1('[data-k="edit"]', c).checked,
    sections:q1('[data-k="all"]', c).checked ? 'all' : qa('[data-sec]:checked', c).map(x => x.dataset.sec) });
  const done = msg => { bust(); pendBadge(); toast(msg, 'ok'); render(); };
  page.addEventListener('change', e => { if (e.target.dataset.k === 'all') { const c = e.target.closest('.mc'); qa('[data-sec]', c).forEach(x => { x.disabled = e.target.checked; if (e.target.checked) x.checked = true; }); } });
  page.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const c = b.closest('.mc'), email = c.dataset.email, a = b.dataset.a;
    if (a === 'approve' || a === 'save') { const d = rd(c);
      if (d.role.toLowerCase() === 'admin') { toast('The Admin role cannot be assigned here.', 'err'); return; }
      if (d.sections !== 'all' && !d.sections.length) { toast('Select at least one section (or “All sections”).', 'err'); return; }
      Users.update(email, { ...d, status:'approved', approvedBy:me().name, approvedAt:Date.now() }); done(a === 'approve' ? 'Approved — they can sign in now' : 'Changes saved'); }
    if (a === 'reject') { Users.update(email, { status:'rejected' }); done('Access blocked'); }
    if (a === 'rm') openModal('Remove this member?', email, 'Remove', () => { Users.remove(email); done('Member removed'); }, { mode:'none' });
    if (a === 'pw') openModal('Set a new password', email, 'Save password', async () => {
      const pw = q1('#modalInput').value; if (pw.length < 8) { toast('At least 8 characters.', 'err'); return false; }
      await Users.setPassword(email, pw); toast('Password changed', 'ok'); }, { mode:'prompt', label:'New password' });
  });
};
const adminOnly = fn => page => isAdmin() ? fn(page) : (page.innerHTML = '<div class="empty"><h3>Admin only</h3><p>Ask the admin if you need this.</p></div>');
['trash', 'rules', 'groups', 'members'].forEach(k => Feat.views[k] = adminOnly(Feat.views[k]));

/* ============================================================
   BULK INGEST — mobile scan + whole-folder import
   ============================================================ */
async function importFolder(files, destId, keep){
  const cache = {}, byDir = new Map();
  const ensure = dirs => { let parent = destId, key = ''; for (const d of dirs) { key += '/' + d;
    if (!cache[key]) { const ex = Tree.children(parent).find(c => c.type === 'folder' && c.name === d); cache[key] = ex ? ex.id : Tree.addFolder(d, parent); } parent = cache[key]; } return parent; };
  files.filter(f => !/^(\.|thumbs\.db$|desktop\.ini$)/i.test(f.name)).forEach(f => { const parts = (f.webkitRelativePath || f.name).split('/'); parts.pop();
    const k = keep ? parts.join('/') : ''; if (!byDir.has(k)) byDir.set(k, []); byDir.get(k).push(f); });
  toast(`Importing ${files.length} files — text is read in the background`, 'ok');
  for (const [dir, list] of byDir) await commitFiles(list, ensure(dir ? dir.split('/') : []), { docType:'Other', tags:[], fields:{} });
}
function wireIngest(){
  const scan = q1('#scanInput'), fold = q1('#folderInput'); let dest = '', keep = true;
  q1('#scanBtn').addEventListener('click', () => { scan.value = ''; scan.click(); });
  scan.addEventListener('change', () => { const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-'), many = scan.files.length > 1;
    const files = [...scan.files].map((f, i) => new File([f], `Scan ${stamp}${many ? '-' + (i + 1) : ''}.${(f.name.split('.').pop() || 'jpg').toLowerCase()}`, { type:f.type }));
    if (files.length) handleFiles(files, state.nodeId || ''); });
  q1('#folderBtn').addEventListener('click', () => openModal('Import a folder', 'Pick a destination, then choose the folder on your computer. Every file inside is added and read automatically.', 'Choose folder…', () => {
    dest = q1('#fiDest').value; keep = q1('#fiKeep').checked; fold.value = ''; fold.click();
  }, { mode:'custom', html:`<div class="field"><label for="fiDest">Destination</label><select id="fiDest">${folderOpts(state.nodeId, true)}</select></div><label class="check"><input type="checkbox" id="fiKeep" checked> Keep the sub-folder structure</label>` }));
  fold.addEventListener('change', () => { const files = [...fold.files]; if (files.length && dest) importFolder(files, dest, keep); });
}

/* ============================================================
   PUBLIC API used by dashboard.js
   ============================================================ */
Object.assign(Feat, {
  trash, searchAll, decorate, checkDuplicate,
  setText(id, t){ TXT[id] = t; },
  async afterUpload(id, file, hash, meta){
    mutate(id, n => { n.meta.hash = hash; n.meta.version = 1; });
    hist(id, 'Uploaded');
    const given = meta && (meta.docType !== 'Other' || (meta.tags || []).length || Object.keys(meta.fields || {}).length);
    enqueue(id, { userMeta:!!given });
  },
  async clearAll(){ await X.clear('content'); await X.clear('versions'); Object.keys(TXT).forEach(k => delete TXT[k]);
    ['groups','rules','views','shares'].forEach(k => localStorage.removeItem(K[k])); paintSaved(); },
  roles(){
    if (window.Cloud) Feat.views.members = adminOnly(async page => {      /* approvals live inside the dashboard (Supabase) */
      const C = Cloud.client, ROLES = ['Faculty', 'HOD', 'Exam Cell', 'Office Staff', 'Student Coordinator'];
      const h = (tag, a = {}, ...kids) => { const e = document.createElement(tag);
        for (const [k, v] of Object.entries(a)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); }
        kids.flat().forEach(c => e.append(c instanceof Node ? c : document.createTextNode(c ?? ''))); return e; };
      page.innerHTML = head('Members & approvals', 'New sign-ups wait here. Give each person a role and choose which sections they can see.');
      const box = h('div'); page.append(box);
      const fail = e => toast((e && e.message) || String(e), 'err');
      async function draw(){
        box.replaceChildren(h('p', { class:'muted' }, 'Loading…'));
        const [pr, sc, ms] = await Promise.all([C.from('profiles').select('*').order('created_at'), C.from('sections').select('*').order('name'), C.from('member_sections').select('*')]);
        if (pr.error || sc.error || ms.error) return box.replaceChildren(h('div', { class:'alert alert--error' }, (pr.error || sc.error || ms.error).message));
        const people = pr.data.filter(p => !p.is_admin), pend = people.filter(p => p.status === 'pending'), rest = people.filter(p => p.status !== 'pending');
        const bd = q1('#pendBadge'); if (bd) { bd.textContent = pend.length; bd.style.display = pend.length ? '' : 'none'; }
        const card = u => {
          const mine = new Set(ms.data.filter(m => m.user_id === u.id).map(m => m.section_id));
          const role = h('input', { type:'text', value:u.role || 'Faculty', maxlength:'60', list:'roleList' });
          const edit = h('input', { type:'checkbox' }); edit.checked = u.can_edit !== false;
          const all = h('input', { type:'checkbox' }); all.checked = !!u.all_sections;
          const boxes = sc.data.map(s => { const c = h('input', { type:'checkbox', value:s.id }); c.checked = u.all_sections || mine.has(s.id); c.disabled = !!u.all_sections; return c; });
          all.addEventListener('change', () => boxes.forEach(b => { b.disabled = all.checked; if (all.checked) b.checked = true; }));
          const go = async (label, fn) => { try { const r = await fn(); if (r.error) return fail(r.error); toast(label, 'ok'); await draw(); } catch (e) { fail(e); } };
          const approve = h('button', { class:'btn btn--sm btn--primary', type:'button', onclick: () => {
            const chosen = boxes.filter(b => b.checked).map(b => b.value);
            if (role.value.trim().toLowerCase() === 'admin') return toast('The Admin role cannot be assigned here.', 'err');
            if (!all.checked && !chosen.length) return toast('Select at least one section (or “All sections”).', 'err');
            go(u.status === 'approved' ? 'Changes saved' : 'Approved — they can sign in now', () => C.rpc('approve_member', { p_user:u.id, p_role:role.value.trim(), p_can_edit:edit.checked, p_all:all.checked, p_sections:chosen })); } },
            u.status === 'approved' ? 'Save changes' : 'Approve');
          const block = h('button', { class:'btn btn--sm btn--danger', type:'button', onclick: () => go('Access blocked', () => C.rpc('block_member', { p_user:u.id })) }, u.status === 'rejected' ? 'Blocked' : (u.status === 'pending' ? 'Reject' : 'Block'));
          block.disabled = u.status === 'rejected';
          const label = u.status === 'pending' ? 'Waiting for approval' : u.status === 'approved' ? 'Active' : 'Blocked';
          return h('div', { class:'mc' },
            h('div', { class:'mc__top' }, h('div', {}, h('b', {}, u.full_name || '(no name)'), h('small', {}, u.email + (u.created_at ? ' · joined ' + timeAgo(Date.parse(u.created_at)) : ''))), h('span', { class:'st st--' + u.status }, label)),
            h('div', { class:'mc__grid' }, h('label', {}, 'Role', role), h('label', { class:'check' }, edit, ' Can upload & edit (untick = view only)')),
            h('div', { class:'mc__secs' }, h('span', {}, 'Sections this member can see (the rest stay hidden)'),
              h('label', { class:'check' }, all, ' All sections'), sc.data.map((s, i) => h('label', { class:'check' }, boxes[i], ' ' + s.name))),
            h('div', { class:'mc__acts' }, approve, block));
        };
        const panel = (title, list, none) => h('div', { class:'panel' }, h('div', { class:'panel__head' }, h('h2', {}, title), h('span', { class:'tag', style:'background:var(--shell-chip)' }, String(list.length))),
          h('div', { class:'panel__body' }, list.length ? list.map(card) : h('div', { class:'empty' }, h('h3', {}, none))));
        box.replaceChildren(h('datalist', { id:'roleList' }, ROLES.map(r => h('option', { value:r }))), panel('Waiting for approval', pend, 'No one is waiting'), panel('Members', rest, 'No members yet'));
      }
      draw();
    });

    /* ---- role rules: view-only members and admin-only actions ---- */
    const guard = (name, adminSide) => { const f = window[name]; if (typeof f !== 'function') return;
      window[name] = function(...a){ if (adminSide ? !isAdmin() : !canEditAll()) { toast(adminSide ? 'Only the admin can do this.' : 'You have view-only access.', 'err'); return; } return f.apply(this, a); }; };
    ['pickFiles', 'handleFiles', 'commitFiles', 'newFolder', 'renameFolder', 'deleteFolder', 'deleteDoc'].forEach(n => guard(n, false));
    guard('newSection', true);
    const baseRender = window.render;
    window.render = function(){ baseRender(); applyRole(); };
    function applyRole(){
      const adm = isAdmin();
      qa('[data-admin]').forEach(b => b.classList.toggle('hidden', !adm));
      const sb = q1('#addSectionBtn'); if (sb) sb.classList.toggle('hidden', !adm);          // fixed button: hide (the page still wires it)
      ['#ovNewSec', '#resetBtn'].forEach(s => { const e = q1(s); if (e && !adm) e.remove(); });
      if (window.Cloud) { qa('[data-view="groups"],[data-view="shares"]').forEach(b => b.classList.add('hidden')); const r = q1('#resetBtn'); if (r) r.remove(); }
      ['#uploadBtn', '#scanBtn', '#folderBtn'].forEach(s => { const e = q1(s); if (e) e.classList.toggle('hidden', !canEditAll()); });
      pendBadge();
    }
    applyRole();
    if (isAdmin() && Users.pendingCount()) toast(`${Users.pendingCount()} person(s) waiting for your approval`, 'ok');
  },
  async init(){
    (await X.all('content').catch(() => [])).forEach(r => TXT[r.id] = r.text);
    await autoPurge();
    if (!jget(K.cfg, {}).seeded) {
      jset(K.views, [{ id:'v1', name:'Needs Review', query:{ tag:'Status/Needs Review', fields:{} } },
        { id:'v2', name:'Pending Approval', query:{ tag:'Status/Pending Approval', fields:{} } },
        { id:'v3', name:'Results 2026', query:{ type:'Result', fields:{ year:'2026' } } }]);
      jset(K.cfg, { ...cfg(), seeded:true });
    }
    paintSaved(); wireIngest();

  }
});
window.Feat = Feat;
})();