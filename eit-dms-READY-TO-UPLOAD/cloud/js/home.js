const app = $('#app');
(async () => {
  let me; try { me = await getProfile(); } catch {}
  if (!me || me.status !== 'approved') return location.replace('../index.html');
  if (me.is_admin) return location.replace('admin.html');
  draw(me);
})();
async function draw(me){
  const [sc, fo] = await Promise.all([SB.from('sections').select('*').order('name'), SB.from('folders').select('*').order('name')]);
  const note = el('p', { class:'alert', hidden:true });
  const pick = el('select', {}, sc.data.map(s => el('option', { value:s.id }, s.name))), name = el('input', { type:'text', placeholder:'New folder name', maxlength:'160' });
  app.replaceChildren(
    el('div', { class:'top' }, el('div', {}, el('h1', {}, 'Welcome, ' + (me.full_name || me.email)), el('span', { class:'chip' }, me.role || 'Member'), ' ', el('span', { class:'chip ' + (me.can_edit ? 'chip--ok' : 'chip--pending') }, me.can_edit ? 'can upload & edit' : 'view only')),
      el('button', { class:'btn', onclick:signOut }, 'Sign out')),
    note,
    el('div', { class:'card' }, el('h2', {}, 'Sections you can see'),
      sc.data.length ? sc.data.map(s => el('div', { class:'mc' }, el('b', {}, s.name), el('div', { class:'muted' }, fo.data.filter(f => f.section_id === s.id).map(f => f.name).join(' · ') || 'No folders yet')))
        : el('p', { class:'muted' }, 'No sections have been given to you yet.')),
    me.can_edit && sc.data.length ? el('div', { class:'card' }, el('h2', {}, 'New folder'), el('div', { class:'mc__row' }, pick, name,
      el('button', { class:'btn btn--sm btn--primary', onclick: async () => { if (!name.value.trim()) return;
        const r = await SB.from('folders').insert({ section_id:pick.value, name:name.value.trim() });
        if (r.error) return show(note, r.error.message); draw(me); } }, 'Create'))) : '',
    el('p', { class:'muted' }, 'This is the secure connection test page. The full dashboard (documents, search, OCR) is connected in the next step.'));
}
