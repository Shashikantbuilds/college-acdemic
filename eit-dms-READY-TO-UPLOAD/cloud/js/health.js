/* Live health check: runs against YOUR Supabase and YOUR browser. Admin gets a full write/read/cleanup test, a member gets the "forbidden things" test. */
const app = $('#app'), out = el('div', {}), report = [];
const abs = p => new URL(p, location.href).href;
const libs = {};
const loadJs = u => libs[u] || (libs[u] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = () => no(new Error('could not load ' + u)); document.head.appendChild(s); }));
const hex = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('');
let failed = 0;
async function step(name, fn){
  const row = el('div', { class:'res' }, el('b', {}, '…'), el('span', {}, name)); out.append(row);
  try { const note = await fn(); row.className = 'res pass'; row.firstChild.textContent = 'PASS'; if (note) row.lastChild.textContent = name + ' — ' + note; report.push('PASS  ' + name + (note ? ' — ' + note : '')); }
  catch (e) { failed++; row.className = 'res fail'; row.firstChild.textContent = 'FAIL'; const m = (e && e.message) || String(e); row.lastChild.textContent = name + ' — ' + m; report.push('FAIL  ' + name + ' — ' + m); }
}
const must = (c, m) => { if (!c) throw new Error(m); };
const refused = (r, hint) => { must(r.error || (Array.isArray(r.data) && r.data.length === 0), 'this was NOT refused. ' + (hint || '')); return 'refused'; };

async function ocrTest(){
  await loadJs(abs('../js/vendor/tesseract/tesseract.min.js'));
  const c = document.createElement('canvas'); c.width = 900; c.height = 220; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 220); g.fillStyle = '#000'; g.font = 'bold 110px Arial, sans-serif'; g.fillText('HELLO 12345', 40, 150);
  const opt = { workerPath:abs('../js/vendor/tesseract/worker.min.js'), corePath:abs('../js/vendor/tesseract/core'), langPath:abs('../js/vendor/tesseract/lang') };
  const w = await Tesseract.createWorker('eng', 1, opt); const t = (await w.recognize(c)).data.text; await w.terminate();
  must(/HELLO/i.test(t) && /12345/.test(t), 'OCR read "' + t.trim().slice(0, 40) + '" instead of "HELLO 12345"');
  const h = await Tesseract.createWorker('eng+hin', 1, opt); await h.terminate();
  return 'English + Hindi engines load from this website (no outside server)';
}
async function pdfTest(){
  await loadJs(abs('../js/vendor/pdf-lib.min.js')); await loadJs(abs('../js/vendor/pdf.min.js'));
  const d = await PDFLib.PDFDocument.create(); d.addPage().drawText('ROLL 987654', { x:50, y:700, size:24 }); const bytes = await d.save();
  const code = await (await fetch(abs('../js/vendor/pdf.worker.min.js'))).text();
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type:'text/javascript' }));
  const pdf = await pdfjsLib.getDocument({ data:bytes }).promise, txt = (await (await pdf.getPage(1)).getTextContent()).items.map(i => i.str).join(' ');
  must(/987654/.test(txt), 'PDF text came back as "' + txt + '"'); return 'PDF created, read back and text extracted';
}

async function adminTests(me){
  const st = SB.storage.from('documents'); let sec, fid, did, path, dup, hash;
  const id = () => crypto.randomUUID(), tag = Date.now().toString(36);
  await step('Sections load from the database', async () => { const r = await SB.from('sections').select('*').order('name'); must(!r.error && r.data.length, r.error?.message || 'no sections'); sec = r.data[0]; return r.data.length + ' sections'; });
  await step('Create a folder', async () => { fid = id(); const r = await SB.from('folders').insert({ id:fid, section_id:sec.id, name:'_healthcheck_' + tag }); must(!r.error, r.error?.message); });
  const body = new Blob(['health check ' + tag + ' ' + Math.random()], { type:'text/plain' });
  await step('Upload a file (private storage) and create its document row', async () => {
    did = id(); path = `${sec.id}/${did}/v1-health`; hash = await hex(await body.arrayBuffer());
    const up = await st.upload(path, body, { contentType:'text/plain', upsert:false }); must(!up.error, 'storage: ' + up.error?.message);
    const r = await SB.from('documents').insert({ id:did, section_id:sec.id, folder_id:fid, name:'_health.txt', mime:'text/plain', ext:'txt', size_bytes:body.size, storage_path:path, sha256:hash, doc_type:'Other', version:1 });
    must(!r.error, 'row: ' + r.error?.message); });
  await step('Download it back and compare', async () => { const r = await st.download(path); must(!r.error, r.error?.message); must((await r.data.text()) === (await body.text()), 'content differs'); });
  await step('Same file again in the same section is refused (duplicate)', async () => { const r = await SB.from('documents').insert({ id:id(), section_id:sec.id, name:'_dup.txt', storage_path:null, sha256:hash }); dup = r; must(r.error && /23505|duplicate/i.test(r.error.code + r.error.message), r.error ? r.error.message : 'duplicate was accepted'); return 'refused'; });
  await step('A document cannot point at another document\'s file (needs 06_hardening.sql)', async () => { const x = id(), r = await SB.from('documents').insert({ id:x, section_id:sec.id, name:'_bad.txt', storage_path:`${sec.id}/${id()}/v1-x`, sha256:'f'.repeat(64) });
    if (!r.error) await SB.from('documents').delete().eq('id', x); return refused(r, 'Run supabase/06_hardening.sql'); });
  await step('HTML files cannot be stored (needs 06_hardening.sql)', async () => { const p = `${sec.id}/${id()}/v1-bad`, r = await st.upload(p, new Blob(['<script>1</script>'], { type:'text/html' }), { contentType:'text/html' });
    if (!r.error) await st.remove([p]); return refused(r, 'Run supabase/06_hardening.sql'); });
  await step('Edit tags / type', async () => { const r = await SB.from('documents').update({ tags:['Health/Test'], doc_type:'Circular' }).eq('id', did).select(); must(!r.error && r.data.length === 1, r.error?.message || 'no row updated'); });
  await step('Move to Trash and Restore (checked server functions)', async () => {
    let r = await SB.rpc('trash_item', { p_kind:'document', p_id:did }); must(!r.error, r.error?.message);
    const t = await SB.from('documents').select('trashed_at').eq('id', did).single(); must(t.data && t.data.trashed_at, 'not in trash');
    r = await SB.rpc('restore_item', { p_kind:'document', p_id:did }); must(!r.error, r.error?.message);
    const u = await SB.from('documents').select('trashed_at').eq('id', did).single(); must(u.data && !u.data.trashed_at, 'not restored'); });
  await step('Record a "view" in the audit log', async () => { const r = await SB.rpc('log_event', { p_action:'doc.view', p_doc:did }); must(!r.error, r.error?.message); });
  await step('Clean up everything this test created', async () => {
    const a = await SB.from('documents').delete().eq('id', did).select(); must(!a.error && a.data.length === 1, 'row: ' + (a.error?.message || 'not deleted'));
    const b = await st.remove([path]); must(!b.error, 'file: ' + b.error?.message);
    const c = await SB.from('folders').delete().eq('id', fid).select(); must(!c.error && c.data.length === 1, 'folder: ' + (c.error?.message || 'not deleted'));
    const d = await st.download(path); must(d.error, 'file still downloadable'); });
  await step('Audit log chain is intact (no tampering)', async () => { const r = await SB.rpc('verify_audit_chain'); must(!r.error, r.error?.message); must(r.data[0].ok, 'TAMPERING at entry ' + r.data[0].first_bad); });
}
async function memberTests(me){
  await step('You see only your own sections', async () => { const r = await SB.from('sections').select('name'); must(!r.error, r.error?.message); return r.data.map(s => s.name).join(', ') || '(none given yet)'; });
  await step('The audit log is closed to you', async () => refused(await SB.from('audit_log').select('*').limit(1)));
  await step('You cannot approve people', async () => refused(await SB.rpc('approve_member', { p_user:me.id, p_role:'Faculty', p_can_edit:true, p_all:true, p_sections:null })));
  await step('You cannot give yourself a section', async () => refused(await SB.from('member_sections').insert({ user_id:me.id, section_id:crypto.randomUUID() })));
  await step('You cannot approve yourself or change your role', async () => refused(await SB.from('profiles').update({ status:'approved', role:'Admin' }).eq('id', me.id).select()));
  await step('You cannot make yourself admin', async () => refused(await SB.from('profiles').update({ is_admin:true }).eq('id', me.id).select()));
  await step('Settings table is closed to you', async () => refused(await SB.from('app_config').select('*')));
  await step('You cannot permanently delete documents', async () => { const r = await SB.from('documents').delete().neq('id', crypto.randomUUID()).select(); must(!r.error ? r.data.length === 0 : true, 'rows were deleted!'); return 'nothing deleted'; });
  if (!me.can_edit) await step('View-only: you cannot create a folder', async () => { const s = await SB.from('sections').select('id').limit(1); return refused(await SB.from('folders').insert({ section_id:s.data && s.data[0] ? s.data[0].id : crypto.randomUUID(), name:'_x' })); });
}

(async () => {
  const note = el('p', { class:'muted' }, 'Running…');
  app.replaceChildren(el('div', { class:'card' }, el('div', { class:'top' }, el('h1', {}, 'Health check'), el('a', { class:'btn', href:'../dashboard.html' }, 'Open dashboard')), note, out));
  let me; try { me = await getProfile(); } catch {}
  if (!me || me.status !== 'approved') { note.textContent = 'Please sign in first (the sign-in page), then open this page again.'; return; }
  note.textContent = 'Signed in as ' + me.email + (me.is_admin ? ' (admin: full test, it cleans up after itself)' : ' (member: tests that forbidden things stay forbidden)');
  await step('Secure browser features available (HTTPS or localhost)', async () => { must(window.isSecureContext && crypto.subtle, 'open this page over https:// or http://localhost'); });
  if (me.is_admin) await adminTests(me); else await memberTests(me);
  await step('OCR works inside this browser (English + Hindi, local files)', ocrTest);
  await step('PDF tools work inside this browser', pdfTest);
  const ta = el('textarea', { rows:'10', readonly:true, style:'width:100%;font:12px monospace' }); ta.value = report.join('\n');
  note.textContent = failed ? failed + ' check(s) FAILED. Copy the report below and send it to your developer.' : 'ALL CHECKS PASSED';
  note.className = failed ? 'alert alert--error' : 'alert alert--ok';
  out.append(el('p', { class:'muted' }, 'Report (copy & send if something failed):'), ta);
})();
