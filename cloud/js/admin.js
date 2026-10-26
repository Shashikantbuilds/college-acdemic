const app = $('#app');
(async () => {
  let me; try { me = await getProfile(); } catch {}
  if (!me || !me.is_admin || me.status !== 'approved') return location.replace('../index.html');
  if (CFG.mfa && (await aal()).currentLevel !== 'aal2') return location.replace('../index.html');
  draw(me);
})();

async function draw(me){
  const [pr, sc, ms, au] = await Promise.all([
    SB.from('profiles').select('*').order('created_at'), SB.from('sections').select('*').order('name'),
    SB.from('member_sections').select('*'), SB.from('audit_log').select('*').order('id', { ascending:false }).limit(25)]);
  if (pr.error || sc.error) return app.replaceChildren(el('p', { class:'alert alert--error' }, (pr.error || sc.error).message));
  const mine = u => new Set(ms.data.filter(m => m.user_id === u).map(m => m.section_id));
  const people = pr.data.filter(p => !p.is_admin);
  const pending = people.filter(p => p.status === 'pending'), rest = people.filter(p => p.status !== 'pending');
  const note = el('p', { class:'alert', hidden:true, role:'status' });
  const done = async m => { show(note, m, 'ok'); await draw(me); };
  const fail = e => show(note, e.message || String(e));

  const card = u => {
    const sel = mine(u.id), role = el('input', { type:'text', value:u.role || 'Faculty', maxlength:'60', list:'roles' });
    const edit = el('input', { type:'checkbox' }); edit.checked = u.can_edit;
    const all = el('input', { type:'checkbox' }); all.checked = u.all_sections;
    const boxes = sc.data.map(s => { const c = el('input', { type:'checkbox', value:s.id }); c.checked = u.all_sections || sel.has(s.id); c.disabled = u.all_sections; return c; });
    all.addEventListener('change', () => boxes.forEach(b => { b.disabled = all.checked; if (all.checked) b.checked = true; }));
    const approve = el('button', { class:'btn btn--sm btn--primary', onclick: async () => {
      const r = await SB.rpc('approve_member', { p_user:u.id, p_role:role.value.trim(), p_can_edit:edit.checked, p_all:all.checked, p_sections:boxes.filter(b => b.checked).map(b => b.value) });
      r.error ? fail(r.error) : done(u.status === 'approved' ? 'Changes saved' : 'Approved — they can sign in now'); } }, u.status === 'approved' ? 'Save changes' : 'Approve');
    const block = el('button', { class:'btn btn--sm btn--danger', onclick: async () => { const r = await SB.rpc('block_member', { p_user:u.id }); r.error ? fail(r.error) : done('Access blocked'); } }, u.status === 'rejected' ? 'Blocked' : 'Block');
    block.disabled = u.status === 'rejected';
    return el('div', { class:'mc' },
      el('div', { class:'mc__row' }, el('b', {}, u.full_name || '(no name)'), el('span', { class:'muted' }, u.email), el('span', { class:'chip chip--' + (u.status === 'approved' ? 'ok' : u.status === 'pending' ? 'pending' : 'bad') }, u.status)),
      el('div', { class:'mc__row' }, el('label', {}, 'Role ', role), el('label', { class:'check' }, edit, ' Can upload & edit (untick = view only)')),
      el('div', {}, el('div', { class:'muted' }, 'Sections this person can see (all others stay hidden)'),
        el('div', { class:'mc__secs' }, el('label', { class:'check' }, all, el('b', {}, 'All sections')), sc.data.map((s, i) => el('label', { class:'check' }, boxes[i], s.name)))),
      el('div', { class:'mc__row' }, approve, block));
  };

  const newSec = el('input', { type:'text', placeholder:'New section name', maxlength:'120' });
  const auditRows = (au.data || []).map(a => el('tr', {}, el('td', {}, when(a.at)), el('td', {}, a.actor_email || 'system'), el('td', {}, a.action), el('td', {}, (a.detail && a.detail.name) || '')));
  const chain = el('span', { class:'muted' });

  app.replaceChildren(
    el('div', { class:'top' }, el('div', {}, el('h1', {}, 'Admin · Members & approvals'), el('span', { class:'muted' }, me.email)), el('div', { class:'mc__row' }, el('a', { class:'btn', href:'../dashboard.html' }, 'Open dashboard'), el('button', { class:'btn', onclick:signOut }, 'Sign out'))),
    note, el('datalist', { id:'roles' }, ['Faculty', 'HOD', 'Exam Cell', 'Office Staff', 'Student Coordinator'].map(r => el('option', { value:r }))),
    el('div', { class:'card' }, el('h2', {}, 'Waiting for approval (' + pending.length + ')'), pending.length ? pending.map(card) : el('p', { class:'muted' }, 'No one is waiting.')),
    el('div', { class:'card' }, el('h2', {}, 'Members (' + rest.length + ')'), rest.length ? rest.map(card) : el('p', { class:'muted' }, 'No members yet.')),
    el('div', { class:'card' }, el('h2', {}, 'Sections'), el('p', { class:'muted' }, sc.data.map(s => s.name).join(' · ')),
      el('div', { class:'mc__row' }, newSec, el('button', { class:'btn btn--sm', onclick: async () => { if (!newSec.value.trim()) return;
        const r = await SB.from('sections').insert({ name:newSec.value.trim() }); r.error ? fail(r.error) : done('Section created (members must be given access to it)'); } }, 'Add section'))),
    el('div', { class:'card' }, el('h2', {}, 'Audit log (latest 25)'), el('div', { class:'mc__row' },
      el('button', { class:'btn btn--sm', onclick: async () => { const r = await SB.rpc('verify_audit_chain'); chain.textContent = r.error ? r.error.message : (r.data[0].ok ? '✔ Log is intact' : '✖ TAMPERING DETECTED at entry ' + r.data[0].first_bad); } }, 'Verify log is untampered'), chain),
      el('table', {}, el('thead', {}, el('tr', {}, ['When', 'Who', 'What', 'Item'].map(h => el('th', {}, h)))), el('tbody', {}, auditRows))));
}
