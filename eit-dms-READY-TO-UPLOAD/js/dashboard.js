/* ============================================================
   dashboard.js — app logic
   ============================================================ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const { Tree, Files, Meta } = window.Store;

/* ---------------- icons ---------------- */
const ICO = {
  section:  '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 18Z"/></svg>',
  folder:   '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 18Z"/></svg>',
  doc:      '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5Z"/><path d="M14 3v4.5h4.5"/></svg>',
  upload:   '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/></svg>',
  plus:     '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  folderNew:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 8V6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h7A1.5 1.5 0 0 1 19 9v1"/><path d="M12 12v6M9 15h6"/></svg>',
  search:   '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',

  /* ---- small glyphs used inside document cards ---- */
  folderBig:'<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 7A1.5 1.5 0 0 1 4 5.5h4.6L10.6 8H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5Z"/></svg>',
  folderSm: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 18Z"/></svg>',
  docSm:   '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5Z"/><path d="M14 3v4.5h4.5"/></svg>',
  clock:   '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
  hddSm:   '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9"><ellipse cx="12" cy="6.5" rx="7.5" ry="2.8"/><path d="M4.5 6.5v11c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-11"/></svg>',
  openSm:  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6.5h6l2 2.5h8v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z"/></svg>',
  editSm:  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z"/></svg>',
  eyeSm:   '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  dlSm:    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2"/></svg>',
  trashSm: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12.5h9L17.5 7"/></svg>',
  infoSm:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/></svg>'
};

/* ---------------- file type styling ---------------- */
const TYPE_COLOURS = {
  pdf:  { bg:'#fdecea', fg:'#c0392b' },
  doc:  { bg:'#e8f0fd', fg:'#2b579a' },
  docx: { bg:'#e8f0fd', fg:'#2b579a' },
  xls:  { bg:'#e6f6f0', fg:'#12735a' },
  xlsx: { bg:'#e6f6f0', fg:'#12735a' },
  csv:  { bg:'#e6f6f0', fg:'#12735a' },
  ppt:  { bg:'#fdf4de', fg:'#b7791f' },
  pptx: { bg:'#fdf4de', fg:'#b7791f' },
  png:  { bg:'#f3ecfd', fg:'#7048c0' },
  jpg:  { bg:'#f3ecfd', fg:'#7048c0' },
  jpeg: { bg:'#f3ecfd', fg:'#7048c0' },
  zip:  { bg:'#eef1f7', fg:'#4b5570' },
  txt:  { bg:'#eef1f7', fg:'#4b5570' }
};
function fileStyle(ext){
  const e = (ext || '').toLowerCase();
  return TYPE_COLOURS[e] || { bg:'var(--primary-050)', fg:'var(--primary)' };
}
function extOf(name){
  const i = (name || '').lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}
function humanSize(bytes){
  if (!bytes) return '0 KB';
  const u = ['B','KB','MB','GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}
function timeAgo(ts){
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s/60)} min ago`;
  if (s < 86400) return `${Math.floor(s/3600)} hr ago`;
  if (s < 604800)return `${Math.floor(s/86400)} d ago`;
  return new Date(ts).toLocaleDateString('en-IN',{ day:'numeric', month:'short', year:'numeric' });
}
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

/* ============================================================
   STATE
   ============================================================ */
const state = {
  view: 'overview',     // overview | section | folder | recent | storage
  nodeId: null,         // current section/folder id
  user: null
};

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // apply the saved colour theme before anything paints
  applyTheme(localStorage.getItem('eit_dms_theme') || 'light');

  // guard: must be signed in (Supabase), approved, and — for the admin — 2-step verified
  let acct;
  try { acct = await Cloud.boot(); }
  catch (e) { console.error(e); document.body.textContent = 'Could not reach the server. Check the internet connection and reload.'; return; }
  if (!acct) return;                                   // being sent to the sign-in page
  const session = { email: acct.email, name: acct.name };
  state.user = session;

  const name = acct.name;
  $('#userName').textContent = name.split(' ')[0];
  $('#menuName').textContent = name;
  $('#menuEmail').textContent = session.email + ' · ' + (acct.role || 'Member');
  $('#avatar').textContent = (name[0] || 'U').toUpperCase();

  // everything created from now on is attributed to this person
  Tree.setActor(name, session.email);

  Feat.roles();          // role rules are in place BEFORE the first screen is drawn
  buildNav();
  render();
  wireGlobal();
  Feat.init();
  Cloud.loadTexts(Feat.setText);
});

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(theme){
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('eit_dms_theme', t);
  const btn = $('#themeBtn');
  if (btn) {
    btn.title = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  }
}
function toggleTheme(){
  const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(now);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function buildNav(){
  const host = $('#sectionNav');
  const sections = Tree.sections();
  host.innerHTML = '';

  sections.forEach(sec => {
    const folders = Tree.children(sec.id);

    const wrap = document.createElement('div');
    wrap.className = 'nav__section';

    const row = document.createElement('div');
    row.className = 'nav__row';

    const btn = document.createElement('button');
    btn.className = 'nav__item' + (state.view === 'section' && state.nodeId === sec.id ? ' nav__item--active' : '');
    btn.dataset.node = sec.id;
    btn.dataset.type = 'section';
    btn.innerHTML = `<span class="nav__dot" style="background:${sec.meta.colour || '#3d4fb8'}"></span>
                     <span class="nav__label-txt">${esc(sec.name)}</span>`;
    btn.addEventListener('click', () => openNode(sec.id));

    const add = document.createElement('button');
    add.className = 'nav__add';
    add.title = 'New folder in ' + sec.name;
    add.textContent = '+';
    add.addEventListener('click', e => { e.stopPropagation(); newFolder(sec.id); });

    row.append(btn, add);
    wrap.append(row);

    // folders of this section
    const sub = document.createElement('div');
    sub.className = 'nav__sub';
    folders.forEach(f => {
      const fb = document.createElement('button');
      fb.className = 'nav__item' + (state.view === 'folder' && state.nodeId === f.id ? ' nav__item--active' : '');
      fb.dataset.node = f.id;
      fb.dataset.type = 'folder';
      fb.innerHTML = `<span class="nav__label-txt">${esc(f.name)}</span>`;
      fb.addEventListener('click', () => openNode(f.id));
      sub.appendChild(fb);
    });
    wrap.append(sub);

    host.appendChild(wrap);
  });
}

function openNode(id){
  state.view = Tree.get(id)?.type === 'folder' ? 'folder' : 'section';
  state.nodeId = id;
  closeSidebar();
  buildNav();
  render();
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){
  const page = $('#page');
  page.innerHTML = '';
  updateCrumbs();

  if (window.Feat && Feat.views[state.view]) return Feat.views[state.view](page);
  if (state.view === 'overview')  return renderOverview(page);
  if (state.view === 'recent')    return renderRecent(page);
  if (state.view === 'storage')   return renderStorage(page);
  if (state.view === 'section')   return renderSection(page);
  if (state.view === 'folder')    return renderFolder(page);
}

function updateCrumbs(){
  const c = $('#crumbs');
  c.innerHTML = '';

  const mk = (label, icon, onclick) => {
    const b = document.createElement('button');
    b.innerHTML = (icon ? `<span class="crumb-ico">${icon}</span>` : '') + esc(label);
    if (onclick) b.addEventListener('click', onclick); else b.disabled = true;
    c.appendChild(b);
  };
  const sep = () => {
    const s = document.createElement('span');
    s.className = 'sep'; s.textContent = '/';
    c.appendChild(s);
  };

  mk('Overview', '◈', () => { state.view='overview'; state.nodeId=null; buildNav(); render(); });
  if (state.nodeId) {
    sep();
    Tree.path(state.nodeId).forEach((n, i, arr) => {
      if (i > 0) sep();
      mk(n.name, n.type === 'section' ? '▣' : '▸', i === arr.length - 1 ? null : () => openNode(n.id));
    });
  }
}

/* ---------------- overview ---------------- */
function renderOverview(page){
  const st = Tree.stats();

  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Overview</h1>
        <p>Everything organised across the college document vault.</p>
      </div>
      <div class="page-head__actions">
        <button class="btn" id="ovNewSec">${ICO.folderNew} New section</button>
        <button class="btn btn--primary" id="ovUpload">${ICO.upload} Upload documents</button>
      </div>
    </div>

    <div class="stats">
      ${statCard('▣', st.sections, 'Sections')}
      ${statCard('▤', st.folders,  'Folders')}
      ${statCard('▥', st.docs,     'Documents')}
      ${statCard('◔', humanSize(st.bytes), 'Total size')}
    </div>

    <div class="panel">
      <div class="panel__head"><h2>Management sections</h2><span class="tag" style="background:var(--primary-050);color:var(--primary)">${st.sections} total</span></div>
      <div class="panel__body"><div class="grid-cards" id="ovCards"></div></div>
    </div>

    <div class="panel">
      <div class="panel__head"><h2>Recent activity</h2><button class="btn btn--sm btn--ghost" id="ovSeeAll">View all</button></div>
      <div class="panel__body" id="ovActivity"></div>
    </div>`;

  // cards
  const cards = $('#ovCards');
  Tree.sections().forEach(sec => {
    const folders = Tree.children(sec.id);
    const docCount = folders.reduce((a, f) => a + Tree.children(f.id).filter(n => n.type === 'doc').length, 0);
    const el = document.createElement('button');
    el.className = 'card-sec';
    el.innerHTML = `
      <div class="card-sec__top">
        <span class="card-sec__ico" style="background:${sec.meta.colour || '#3d4fb8'}">${ICO.section}</span>
        <div>
          <div class="card-sec__name">${esc(sec.name)}</div>
          <div class="card-sec__meta">${folders.length} folders · ${docCount} documents</div>
        </div>
      </div>
      <div class="card-sec__list">
        ${folders.slice(0,4).map(f =>
          `<button class="card-sec__item" data-folder="${f.id}"><span class="dot"></span>${esc(f.name)}</button>`
        ).join('') || '<span class="card-sec__meta">No folders yet</span>'}
      </div>`;
    el.addEventListener('click', e => {
      const f = e.target.closest('[data-folder]');
      if (f) { openNode(f.dataset.folder); return; }
      openNode(sec.id);
    });
    cards.appendChild(el);
  });

  $('#ovNewSec').addEventListener('click', newSection);
  $('#ovUpload').addEventListener('click', () => pickFiles(null));
  $('#ovSeeAll').addEventListener('click', () => { state.view='recent'; state.nodeId=null; buildNav(); render(); });
  paintActivity($('#ovActivity'), 6);
}

function statCard(ico, val, lbl){
  return `<div class="stat">
    <span class="stat__ico">${ico}</span>
    <div><div class="stat__val">${esc(val)}</div><div class="stat__lbl">${esc(lbl)}</div></div>
  </div>`;
}

/* ---------------- section view ---------------- */
function renderSection(page){
  const sec = Tree.get(state.nodeId);
  if (!sec) return renderOverview(page);

  const folders = Tree.children(sec.id).filter(n => n.type === 'folder');
  const loose  = Tree.children(sec.id).filter(n => n.type === 'doc');

  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${esc(sec.name)}</h1>
        <p>${folders.length} folders · ${loose.length} documents directly in this section</p>
      </div>
      <div class="page-head__actions">
        <button class="btn" id="secNewFolder">${ICO.folderNew} New folder</button>
        <button class="btn" id="secUpload">${ICO.upload} Upload</button>
        <button class="btn btn--primary" id="secUploadFolder">${ICO.upload} Upload to a folder</button>
      </div>
    </div>
    <div id="dropzone" class="dropzone">
      <strong>Drop files here to upload</strong>
      <span>or use the Upload button · files are stored locally on this device</span>
    </div>
    <div class="panel">
      <div class="panel__head"><h2>Folders</h2></div>
      <div class="panel__body"><div class="grid-items" id="secFolders"></div></div>
    </div>
    ${loose.length ? `
    <div class="panel">
      <div class="panel__head"><h2>Documents in this section</h2></div>
      <div class="panel__body"><div class="grid-items" id="secDocs"></div></div>
    </div>` : ''}`;

  const fHost = $('#secFolders');
  folders.forEach(f => fHost.appendChild(folderTile(f)));
  if (!folders.length) fHost.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="empty__ico">▤</div><h3>No folders yet</h3><p>Create the first folder for this section.</p>
      <button class="btn btn--primary" data-click="secNewFolder">New folder</button></div>`;

  const dHost = $('#secDocs');
  if (dHost) loose.forEach(d => dHost.appendChild(docTile(d)));

  $('#secNewFolder').addEventListener('click', () => newFolder(sec.id));
  $('#secUpload').addEventListener('click', () => pickFiles(sec.id));
  $('#secUploadFolder').addEventListener('click', () => {
    if (!folders.length) { toast('Create a folder first, then upload into it.', 'err'); return; }
    const pick = folders.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    openModal('Upload to folder', 'Choose which folder should receive the files.', 'Upload', () => {
      pickFiles($('#modalSelect').value);
    }, { mode:'custom', html: `
      <div class="field"><label for="modalSelect">Target folder</label>
      <select id="modalSelect">${pick}</select></div>` });
  });

  wireDropzone($('#dropzone'), sec.id);
}

function renderFolder(page){
  const folder = Tree.get(state.nodeId);
  if (!folder) return renderOverview(page);

  const items = Tree.children(folder.id);
  const folders = items.filter(n => n.type === 'folder');
  const docs    = items.filter(n => n.type === 'doc');

  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${esc(folder.name)}</h1>
        <p>${folders.length} sub-folders · ${docs.length} documents</p>
      </div>
      <div class="page-head__actions">
        <button class="btn" id="fNewFolder">${ICO.folderNew} New sub-folder</button>
        <button class="btn btn--primary" id="fUpload">${ICO.upload} Upload documents</button>
      </div>
    </div>
    <div id="dropzone" class="dropzone">
      <strong>Drop files here to upload</strong>
      <span>or use the Upload button</span>
    </div>
    <div class="panel">
      <div class="panel__head"><h2>Contents</h2></div>
      <div class="panel__body"><div class="grid-items" id="fItems"></div></div>
    </div>`;

  const host = $('#fItems');
  folders.forEach(f => host.appendChild(folderTile(f)));
  docs.forEach(d => host.appendChild(docTile(d)));
  if (!items.length) host.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="empty__ico">▤</div><h3>This folder is empty</h3><p>Upload documents or create a sub-folder to get started.</p></div>`;

  $('#fNewFolder').addEventListener('click', () => newFolder(folder.id));
  $('#fUpload').addEventListener('click', () => pickFiles(folder.id));
  wireDropzone($('#dropzone'), folder.id);
}

/* ---------------- tiles (Paperless style) ---------------- */

/* mini "paper" preview used as a document thumbnail */
function thumbSvg(colour, accent){
  const lines = [30,26,30,18,28,24];
  const body = lines.map((w, i) =>
    `<rect x="9" y="${26 + i * 9}" width="${w}" height="3.2" rx="1.6" fill="#c9c9c4"/>`
  ).join('');
  return `<svg viewBox="0 0 84 104" width="60" height="60">
    <rect x="14" y="4" width="56" height="96" rx="3" fill="#fff" stroke="#d5d5d0"/>
    <rect x="14" y="4" width="56" height="13" rx="3" fill="${accent}"/>
    <rect x="14" y="14" width="56" height="3" fill="${accent}"/>
    ${body}
    <rect x="9" y="66" width="22" height="12" rx="2" fill="${accent}" opacity=".35"/>
  </svg>`;
}

const BADGE_COLOURS = {
  Dean:      '#2f6fd0',
  Academics: '#1a7f37',
  NBA:       '#b7791f',
  Records:   '#8250df',
  System:    '#5b6478'
};
function badgeFor(node){
  const path = Tree.path(node.id);
  const sec = path.find(p => p.type === 'section');
  const name = sec ? sec.name : 'System';
  const key = Object.keys(BADGE_COLOURS).find(k => name.toLowerCase().includes(k.toLowerCase())) || 'System';
  return { label: name, colour: BADGE_COLOURS[key] };
}

function folderTile(f){
  const count = Tree.children(f.id).filter(n => n.type === 'doc').length;
  const badge = badgeFor(f);
  const el = document.createElement('div');
  el.className = 'tile tile--folder';
  el.innerHTML = `
    <div class="tile__thumb">
      <span class="tile__badges"><span class="badge" style="background:${badge.colour}">${esc(badge.label)}</span></span>
      ${ICO.folderBig}
    </div>
    <div class="tile__body">
      <div class="tile__name">${esc(f.name)}</div>
      <div class="tile__meta">
        <div class="tile__row">${ICO.folderSm} <span>${count} document${count === 1 ? '' : 's'}</span></div>
        <div class="tile__row">${ICO.clock} <span>${timeAgo(f.created)}</span></div>
      </div>
      <div class="tile__acts">
        <button class="tile__act" data-a="open">${ICO.openSm} Open</button>
        <button class="tile__act tile__act--info" data-a="info" title="Details">${ICO.infoSm}</button>
        <button class="tile__act" data-a="rename">${ICO.editSm} Rename</button>
        <button class="tile__act tile__act--danger" data-a="delete">${ICO.trashSm}</button>
      </div>
    </div>`;

  el.addEventListener('click', e => {
    const act = e.target.closest('[data-a]')?.dataset.a;
    if (act === 'rename') { e.stopPropagation(); renameFolder(f.id); return; }
    if (act === 'delete') { e.stopPropagation(); deleteFolder(f.id); return; }
    if (act === 'info')   { e.stopPropagation(); showDetails(f.id); return; }
    if (act === 'open')   { e.stopPropagation(); openNode(f.id); return; }
    openNode(f.id);
  });
  return el;
}

function docTile(d){
  const st = fileStyle(d.meta?.ext);
  const accent = st.fg;
  const badge = badgeFor(d);
  const folder = d.parent ? Tree.get(d.parent) : null;
  const el = document.createElement('div');
  el.className = 'tile';
  el.innerHTML = `
    <div class="tile__thumb">
      <span class="tile__ext" style="background:${accent}">${esc((d.meta?.ext || 'file').toUpperCase())}</span>
      <span class="tile__badges"><span class="badge" style="background:${badge.colour}">${esc(badge.label)}</span></span>
      ${thumbSvg(st.bg, accent)}
    </div>
    <div class="tile__body">
      <div class="tile__name">${esc(d.name)}</div>
      <div class="tile__meta">
        <div class="tile__row">${ICO.docSm} <span>${esc(folder ? folder.name : '—')}</span></div>
        <div class="tile__row">${ICO.clock} <span>${timeAgo(d.created)}</span></div>
        <div class="tile__row">${ICO.hddSm} <span>${humanSize(d.meta?.size)}</span></div>
      </div>
      <div class="tile__acts">
        <button class="tile__act" data-a="preview">${ICO.eyeSm} Preview</button>
        <button class="tile__act tile__act--info" data-a="info" title="Details">${ICO.infoSm}</button>
        <button class="tile__act" data-a="download">${ICO.dlSm} Download</button>
        <button class="tile__act tile__act--danger" data-a="delete">${ICO.trashSm}</button>
      </div>
    </div>`;

  el.addEventListener('click', e => {
    const act = e.target.closest('[data-a]')?.dataset.a;
    if (act === 'preview')  { e.stopPropagation(); openDoc(d.id); return; }
    if (act === 'download') { e.stopPropagation(); downloadDoc(d.id); return; }
    if (act === 'delete')   { e.stopPropagation(); deleteDoc(d.id); return; }
    if (act === 'info')     { e.stopPropagation(); showDetails(d.id); return; }
    openDoc(d.id);
  });
  return el;
}

/* ---------------- recent / storage ---------------- */
function renderRecent(page){
  page.innerHTML = `
    <div class="page-head">
      <div><h1>Recent activity</h1><p>Everything that has happened in this vault.</p></div>
    </div>
    <div class="panel"><div class="panel__body" id="actFull"></div></div>`;
  paintActivity($('#actFull'), 60);
}

function paintActivity(host, limit){
  const acts = Meta.activity().slice(0, limit);
  if (!acts.length) {
    host.innerHTML = `<div class="empty"><div class="empty__ico">◷</div>
      <h3>No activity yet</h3><p>Upload a document or create a folder and it will show up here.</p></div>`;
    return;
  }
  host.innerHTML = acts.map(a => {
    const c = a.kind === 'upload' ? { bg:'var(--ok-bg)', fg:'var(--ok)', i:'↥' }
            : a.kind === 'create' ? { bg:'var(--primary-050)', fg:'var(--primary)', i:'+' }
            : a.kind === 'delete' ? { bg:'var(--danger-bg)', fg:'var(--danger)', i:'×' }
            : { bg:'var(--warn-bg)', fg:'var(--warn)', i:'✎' };
    return `<div class="act">
      <span class="act__ico" style="background:${c.bg};color:${c.fg}">${c.i}</span>
      <div class="act__txt"><b>${esc(a.text)}</b><span>${esc(a.detail || '')}</span></div>
      <time>${timeAgo(a.at)}</time>
    </div>`;
  }).join('');
}

function renderStorage(page){
  const st = Tree.stats();
  const QUOTA = 2 * 1024 * 1024 * 1024;
  const pct  = Math.min(100, Math.round((st.bytes / QUOTA) * 100));
  const byExt = {};
  Object.values(Tree.state().nodes).filter(n => n.type === 'doc').forEach(d => {
    const e = d.meta?.ext || 'other';
    byExt[e] = (byExt[e] || 0) + 1;
  });
  const rows = Object.entries(byExt).sort((a,b) => b[1] - a[1]);

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Storage</h1><p>What is currently held in this browser's local vault.</p></div>
      <div class="page-head__actions">
        <button class="btn btn--danger" id="resetBtn">Reset vault</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel__head"><h2>Usage</h2><span class="tag" style="background:var(--primary-050);color:var(--primary)">${pct}% used</span></div>
      <div class="panel__body" style="padding:18px">
        <div class="meter" style="height:10px;background:var(--line-2)">
          <div class="meter__fill" style="width:${pct}%;background:var(--primary)"></div>
        </div>
        <p style="font-size:13px;color:var(--ink-2);margin:12px 0 0">
          ${humanSize(st.bytes)} used of ${humanSize(QUOTA)} — ${st.docs} documents across ${st.folders} folders and ${st.sections} sections.
        </p>
      </div>
    </div>
    <div class="panel">
      <div class="panel__head"><h2>Documents by type</h2></div>
      <div class="panel__body">
        <table class="tbl">
          <thead><tr><th>Type</th><th>Documents</th></tr></thead>
          <tbody>${rows.length ? rows.map(([e,n]) => {
            const s = fileStyle(e);
            return `<tr><td><span class="tag" style="background:${s.bg};color:${s.fg}">${esc(e.toUpperCase())}</span></td><td>${n}</td></tr>`;
          }).join('') : '<tr><td colspan="2" style="color:var(--ink-3)">No documents uploaded yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;

  $('#resetBtn').addEventListener('click', () => {
    openModal('Reset the vault?', 'This permanently deletes every section, folder and uploaded document stored in this browser.', 'Yes, reset everything', async () => {
      await Files.clear();
      await Feat.clearAll();
      Tree.reset();
      Meta.log({ kind:'delete', text:'Vault reset', detail:'All local data cleared' });
      state.view = 'overview'; state.nodeId = null;
      buildNav(); render();
      toast('Vault reset', 'ok');
    }, { mode:'none' });
  });
}

/* ============================================================
   CREATE / RENAME / DELETE
   ============================================================ */
function newSection(){
  openModal('Create a new section', 'Sections group folders and documents, e.g. “Placement Cell” or “Hostel Records”.', 'Create section', () => {
    const name = $('#modalInput').value.trim();
    if (!name) { toast('Please enter a name for the section.', 'err'); return false; }
    const colours = ['#3d4fb8','#17916b','#b7791f','#8250df','#c0392b','#0e7490','#be185d'];
    const id = Tree.addSection(name, colours[Tree.sections().length % colours.length]);
    Meta.log({ kind:'create', text:`Section “${name}” created`, detail:'New management section' });
    buildNav(); openNode(id);
    toast(`Section “${name}” created`, 'ok');
  }, { mode:'prompt', label:'Section name' });
}

function newFolder(parentId){
  if (!parentId) { toast('Open a section first.', 'err'); return; }
  const parent = Tree.get(parentId);
  openModal('New folder', `Inside: ${parent?.name || ''}`, 'Create folder', () => {
    const name = $('#modalInput').value.trim();
    if (!name) { toast('Please enter a folder name.', 'err'); return false; }
    Tree.addFolder(name, parentId);
    Meta.log({ kind:'create', text:`Folder “${name}” created`, detail:`Inside ${parent?.name}` });
    buildNav(); render();
    toast(`Folder “${name}” created`, 'ok');
  }, { mode:'prompt', label:'Folder name' });
}

/* ---------------- direct actions used by the card buttons ---------------- */
function renameFolder(id){
  const f = Tree.get(id);
  if (!f) return;
  openModal('Rename folder', '', 'Save', () => {
    const name = $('#modalInput').value.trim();
    if (!name) { toast('Please enter a folder name.', 'err'); return false; }
    Tree.rename(id, name);
    Meta.log({ kind:'rename', text:`Folder renamed to “${name}”`, detail:'' });
    buildNav(); render();
    toast('Folder renamed', 'ok');
  }, { mode:'prompt', label:'Folder name', value:f.name });
}

function deleteFolder(id){
  const f = Tree.get(id);
  if (!f) return;
  openModal('Move folder to trash?', `“${f.name}” and everything inside it stays in Trash for 90 days.`, 'Move to trash', () => {
    Feat.trash(id);
    Meta.log({ kind:'delete', text:`Folder “${f.name}” deleted`, detail:'Removed with its contents' });
    if (state.nodeId === id) { state.view = 'overview'; state.nodeId = null; }
    buildNav(); render();
    toast('Folder deleted', 'ok');
  }, { mode:'none' });
}

function deleteDoc(id){
  const d = Tree.get(id);
  if (!d) return;
  openModal('Move to trash?', `“${d.name}” stays in Trash for 90 days and can be restored.`, 'Move to trash', async () => {
    Feat.trash(id);
    Meta.log({ kind:'delete', text:`Document “${d.name}” moved to trash`, detail:'Restorable for 90 days' });
    render();
    toast('Moved to trash', 'ok');
  }, { mode:'none' });
}

async function downloadDoc(id){
  const d = Tree.get(id);
  if (!d) return;
  const rec = await Files.get(id);
  if (!rec) { toast('File data is missing for this document.', 'err'); return; }
  Cloud.log('doc.download', id);
  // reuse a live URL so both preview and download can share it
  const url = URL.createObjectURL(rec.blob);
  liveUrls.push(url);
  triggerDownload(url, d.name);
  toast('Downloading ' + d.name, 'ok');
}

/* keep blob URLs alive for the session, revoke only on unload */
const liveUrls = [];
window.addEventListener('beforeunload', () => liveUrls.forEach(u => URL.revokeObjectURL(u)));

/* ============================================================
   DETAILS PANEL — who made it, when, and everything about it
   ============================================================ */
function fullDate(ts){
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:true
  });
}
function countInside(id){
  const s = Tree.state();
  let folders = 0, docs = 0;
  const walk = pid => {
    Object.values(s.nodes).filter(n => n.parent === pid).forEach(n => {
      if (n.type === 'doc') docs++;
      else { folders++; walk(n.id); }
    });
  };
  walk(id);
  return { folders, docs };
}

/* ============================================================
   METADATA EDITOR
   Shared by the Details panel and the upload flow.
   Tags are stored as full paths — "Department/CSE" nests under
   "Department", and a parent tag matches everything below it.
   ============================================================ */

/** HTML for the editor. `p` prefixes every id so two editors can coexist. */
function metaEditorHtml(p, { docType = 'Other', tags = [], fields = {} } = {}){
  const typeOptions = Tree.DOC_TYPES
    .map(t => `<option value="${esc(t)}"${t === docType ? ' selected' : ''}>${esc(t)}</option>`)
    .join('');

  const fieldRows = Tree.FIELD_DEFS.map(def => {
    const val = fields[def.key] || '';
    if (def.type === 'select') {
      const opts = ['', ...def.options]
        .map(o => `<option value="${esc(o)}"${String(val) === o ? ' selected' : ''}>${o ? esc(o) : '— none —'}</option>`)
        .join('');
      return `<div class="mf__row">
        <label for="${p}f_${def.key}">${esc(def.label)}</label>
        <select id="${p}f_${def.key}" data-field="${def.key}">${opts}</select>
      </div>`;
    }
    return `<div class="mf__row">
      <label for="${p}f_${def.key}">${esc(def.label)}</label>
      <input id="${p}f_${def.key}" data-field="${def.key}" type="text"
             value="${esc(val)}" placeholder="${esc(def.placeholder || '')}" />
    </div>`;
  }).join('');

  const suggestions = Tree.allTags().slice(0, 14);
  const chips = suggestions.length
    ? `<div class="mf__suggest">${suggestions.map(t =>
        `<button type="button" class="mf__chip" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`
    : '';

  return `
    <div class="metaform" data-metaform="${p}">
      <div class="mf__row">
        <label for="${p}type">Document type</label>
        <select id="${p}type" data-meta="type">${typeOptions}</select>
      </div>

      <div class="mf__row mf__row--tags">
        <label for="${p}tags">Tags</label>
        <input id="${p}tags" data-meta="tags" type="text"
               value="${esc(tags.join(', '))}"
               placeholder="Result/2025, Department/CSE — comma se separate karo" />
        ${chips}
      </div>

      <div class="mf__grid">${fieldRows}</div>
    </div>`;
}

/** Read the editor back out of the DOM. */
function readMetaEditor(p){
  const host = document.querySelector(`[data-metaform="${p}"]`);
  if (!host) return { docType:'Other', tags:[], fields:{} };

  const docType = host.querySelector('[data-meta="type"]')?.value || 'Other';

  const tags = (host.querySelector('[data-meta="tags"]')?.value || '')
    .split(',')
    .map(t => t.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

  const fields = {};
  host.querySelectorAll('[data-field]').forEach(el => {
    const v = (el.value || '').trim();
    if (v) fields[el.dataset.field] = v;
  });

  return { docType, tags, fields };
}

/** Wire the suggestion chips so clicking one appends it to the tag input. */
function wireMetaEditor(p){
  const host = document.querySelector(`[data-metaform="${p}"]`);
  if (!host) return;
  const input = host.querySelector('[data-meta="tags"]');
  host.querySelectorAll('.mf__chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      const cur = input.value.split(',').map(s => s.trim()).filter(Boolean);
      if (cur.includes(tag)) {
        input.value = cur.filter(t => t !== tag).join(', ');
        chip.classList.remove('is-on');
      } else {
        cur.push(tag);
        input.value = cur.join(', ');
        chip.classList.add('is-on');
      }
    });
  });
  // highlight chips already present
  const cur = input.value.split(',').map(s => s.trim()).filter(Boolean);
  host.querySelectorAll('.mf__chip').forEach(c => {
    if (cur.includes(c.dataset.tag)) c.classList.add('is-on');
  });
}

/** Pretty tag list for display (read-only). */
function tagChipsHtml(tags){
  if (!tags || !tags.length) return '<span class="meta__none">No tags</span>';
  return tags.map(t => `<span class="tagchip">${esc(t)}</span>`).join('');
}

function showDetails(id){
  const n = Tree.get(id);
  if (!n) return;

  const isDoc = n.type === 'doc';
  const st = isDoc ? fileStyle(n.meta?.ext) : null;
  const path = Tree.path(n.parent).map(p => p.name).join(' / ') || 'Top level';

  // header
  $('#detailsTitle').textContent = n.name;
  $('#detailsSub').textContent = isDoc
    ? `${(n.meta?.ext || 'file').toUpperCase()} · ${extOf(n.name).toUpperCase() || 'FILE'}`
    : (n.type === 'folder' ? 'Folder' : 'Section');
  const icoEl = $('#detailsIco');
  icoEl.innerHTML = isDoc ? ICO.doc : (n.type === 'folder' ? ICO.folder : ICO.section);
  icoEl.style.background = isDoc ? st.bg : 'var(--shell-chip)';
  icoEl.style.color = isDoc ? st.fg : 'var(--shell-green)';

  // uploader / creator
  const who = n.createdBy || (isDoc ? 'Unknown' : 'System');
  const whoMail = n.createdEmail || '';
  const initials = who.split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase() || '?';

  let rows = '';
  const row = (k, v, sub) =>
    `<div class="kv__row"><div class="kv__k">${esc(k)}</div>
      <div class="kv__v">${v}${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;

  rows += row(isDoc ? 'Uploaded by' : 'Created by', esc(who), whoMail || null);
  rows += row(isDoc ? 'Uploaded on' : 'Created on', esc(fullDate(n.created)), timeAgo(n.created));

  if (n.modified) {
    rows += row('Last modified', esc(fullDate(n.modified)), n.modifiedBy ? `by ${n.modifiedBy}` : null);
  }
  if (isDoc) {
    rows += row('File type', esc((n.meta?.ext || 'unknown').toUpperCase()));
    rows += row('Size', humanSize(n.meta?.size));
    if (n.meta?.mime) rows += row('MIME type', esc(n.meta.mime));
  }
  rows += row('Location', esc(path));

  if (!isDoc) {
    const c = countInside(id);
    rows += row('Contents', `${c.folders} folder${c.folders===1?'':'s'} · ${c.docs} document${c.docs===1?'':'s'}`);
  } else {
    rows += row('Document ID', `<code style="font-size:11.5px">${esc(n.id)}</code>`);
  }

  /* ---- metadata block (documents only) ---- */
  const metaBlockHtml = () => {
    if (!isDoc) return '';
    const type = n.docType || 'Other';
    const tags = Array.isArray(n.tags) ? n.tags : [];
    const fields = n.fields || {};
    const filled = Object.entries(fields)
      .map(([k, v]) => {
        const def = Tree.FIELD_DEFS.find(d => d.key === k);
        return `<div class="meta__f"><span>${esc(def ? def.label : k)}</span><strong>${esc(v)}</strong></div>`;
      }).join('');

    return `
      <div class="meta" id="metaBlock">
        <div class="meta__head">
          <span>Metadata</span>
          <button class="meta__edit" id="dEditMeta">${ICO.editSm} Edit</button>
        </div>
        <div class="meta__type"><span class="typechip">${esc(type)}</span></div>
        <div class="meta__tags">${tagChipsHtml(tags)}</div>
        ${filled ? `<div class="meta__fields">${filled}</div>` : ''}
      </div>`;
  };

  $('#detailsBody').innerHTML = `
    <div class="who">
      <span class="who__avatar">${esc(initials)}</span>
      <div class="who__txt">
        <div class="who__name">${esc(who)}</div>
        <div class="who__mail">${esc(whoMail || 'No email recorded')}</div>
      </div>
    </div>
    ${metaBlockHtml()}
    <div class="kv">${rows}</div>
    <div class="details__actions" id="detailsActions"></div>`;

  /* ---- inline metadata editing ---- */
  const wireMetaEdit = () => {
    const btn = $('#dEditMeta');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const block = $('#metaBlock');
      const p = 'ed';
      block.innerHTML = `
        <div class="meta__head"><span>Metadata</span></div>
        ${metaEditorHtml(p, { docType:n.docType || 'Other', tags:n.tags || [], fields:n.fields || {} })}
        <div class="meta__save">
          <button class="btn btn--sm" id="metaCancel">Cancel</button>
          <button class="btn btn--sm btn--primary" id="metaSave">Save</button>
        </div>`;
      wireMetaEditor(p);

      $('#metaCancel').addEventListener('click', () => showDetails(id));
      $('#metaSave').addEventListener('click', () => {
        const m = readMetaEditor(p);
        Tree.setMeta(id, m);
        Meta.log({ kind:'edit', text:`Metadata updated on “${n.name}”`, detail:`${m.docType}${m.tags.length ? ' · ' + m.tags.join(', ') : ''}` });
        toast('Metadata saved', 'ok');
        render();
        showDetails(id);
      });
    });
  };
  wireMetaEdit();

  // contextual actions
  const acts = $('#detailsActions');
  if (isDoc) {
    acts.innerHTML = `
      <button class="btn" id="dPreview">${ICO.eyeSm} Preview</button>
      <button class="btn btn--primary" id="dDownload">${ICO.dlSm} Download</button>`;
    $('#dPreview').addEventListener('click', () => { closeDetails(); openDoc(id); });
    $('#dDownload').addEventListener('click', () => downloadDoc(id));
  } else {
    acts.innerHTML = `
      <button class="btn btn--primary" id="dOpen">${ICO.openSm} Open</button>
      <button class="btn" id="dRename">${ICO.editSm} Rename</button>`;
    $('#dOpen').addEventListener('click', () => { closeDetails(); openNode(id); });
    $('#dRename').addEventListener('click', () => {
      closeDetails();
      if (n.type === 'folder') renameFolder(id); else newSection();
    });
  }

  if (window.Feat) Feat.decorate(id, $('#detailsBody'));
  $('#details').hidden = false;
}

function closeDetails(){ $('#details').hidden = true; }

/* ============================================================
   DOC OPEN / DOWNLOAD
   ============================================================ */
async function openDoc(id){
  const d = Tree.get(id);
  if (!d) return;
  const rec = await Files.get(id);
  if (!rec) { toast('File data is missing for this document.', 'err'); return; }
  Cloud.log('doc.view', id);

  // Never trust the type a file claims. Only these extensions may be previewed, and the blob is re-labelled with OUR
  // safe type, so an HTML/SVG file can never run as a page inside the app.
  const SAFE = { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', txt:'text/plain', csv:'text/plain', md:'text/plain' };
  const ext = String(d.meta?.ext || extOf(d.name) || '').toLowerCase();
  const mime = SAFE[ext] || '';
  const url = URL.createObjectURL(new Blob([rec.blob], { type: mime || 'application/octet-stream' }));
  liveUrls.push(url);
  const isViewable = !!mime;

  if (isViewable) {
    // wide modal for previewing
    openModal(d.name, `${humanSize(rec.size)} · ${mime || 'file'}`, 'Download', () => {
      triggerDownload(url, d.name);
    }, { mode:'custom', html:
      `<iframe src="${url}" title="preview" ${mime === 'application/pdf' ? '' : 'sandbox'}
         style="width:100%;height:min(64vh,560px);border:1px solid var(--shell-line);border-radius:8px;background:#fff"></iframe>` });

    // let the preview modal grow
    $('.modal__box').style.maxWidth = '820px';
  } else {
    triggerDownload(url, d.name);
    toast('Downloading ' + d.name, 'ok');
  }

  Meta.log({ kind:'download', text:`“${d.name}” opened`, detail:'' });
}
function triggerDownload(url, name){
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

/* ============================================================
   UPLOAD
   ============================================================ */
function pickFiles(parentId){
  const input = $('#fileInput');
  input.dataset.target = parentId || '';
  input.value = '';
  input.click();
}

/** Ask for type/tags/fields once, then apply to the whole batch. */
function askMetadataThen(files, parentId){
  const p = 'up';
  openModal(
    files.length === 1 ? 'Document details' : `Details for ${files.length} documents`,
    'Ye details is poore batch par lagegne. Baad me har document me alag se badal sakte ho.',
    'Upload',
    () => {
      const m = readMetaEditor(p);
      closeModal();
      commitFiles(files, parentId, m);
    },
    { mode:'custom', html: metaEditorHtml(p, {}) }
  );
  wireMetaEditor(p);
  // a second, quieter button: upload without metadata
  const box = $('.modal__actions');
  if (box && !$('#modalSkip')) {
    const skip = document.createElement('button');
    skip.className = 'btn btn--ghost';
    skip.id = 'modalSkip';
    skip.textContent = 'Skip';
    skip.addEventListener('click', () => {
      closeModal();
      commitFiles(files, parentId, { docType:'Other', tags:[], fields:{} });
    });
    box.insertBefore(skip, box.firstChild);
  }
  $('.modal__box').style.maxWidth = '620px';
}

async function handleFiles(files, parentId, meta){
  if (!files || !files.length) return;
  if (!meta) { askMetadataThen(files, parentId); return; }
  return commitFiles(files, parentId, meta);
}

async function commitFiles(files, parentId, meta){
  if (!files || !files.length) return;

  // decide destination: explicit target, else first folder of first section
  let target = parentId;
  if (!target) {
    const sec = Tree.sections()[0];
    if (!sec) { toast('Create a section first.', 'err'); return; }
    let folders = Tree.children(sec.id).filter(n => n.type === 'folder');
    if (!folders.length) target = Tree.addFolder('General', sec.id);
    else target = folders[0].id;
  }

  const dest = Tree.get(target);
  let count = 0;

  for (const file of files) {
    try {
      const chk = await Feat.checkDuplicate(file);
      if (chk.dup) { toast(`Duplicate skipped: ${file.name} (already in ${Tree.path(chk.dup.parent).map(p => p.name).join(' / ')})`, 'err'); continue; }
      const docId = Tree.addDoc({
        name: file.name,
        size: file.size,
        mime: file.type,
        ext: extOf(file.name),
        docType: meta?.docType,
        tags: meta?.tags,
        fields: meta?.fields
      }, target);
      await Files.put(docId, file);
      await Feat.afterUpload(docId, file, chk.hash, meta);
      count++;
    } catch (e) {
      console.error(e);
      toast(`Could not save ${file.name}`, 'err');
    }
  }

  if (count) {
    const suffix = meta?.docType && meta.docType !== 'Other' ? ` · ${meta.docType}` : '';
    Meta.log({ kind:'upload', text:`${count} document${count === 1 ? '' : 's'} uploaded`, detail:`Into ${dest?.name || 'folder'}${suffix}` });
    toast(`${count} document${count === 1 ? '' : 's'} uploaded`, 'ok');
  }
  buildNav();
  render();
}

/* dropzone */
function wireDropzone(zone, targetId){
  if (!zone) return;
  ['dragenter','dragover'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave','drop'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', e => {
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) handleFiles(files, targetId);
  });
}

/* ============================================================
   SEARCH
   ============================================================ */
function setupSearch(){
  const input = $('#search');
  const box   = $('#searchResults');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }

    const results = Feat.searchAll(q).slice(0, 25);
    if (!results.length) {
      box.innerHTML = `<div class="sr-empty">No matches for “${esc(q)}”</div>`;
      box.hidden = false;
      return;
    }

    box.innerHTML = results.map(n => {
      const path = Tree.path(n.parent).map(p => p.name).join(' / ') || 'Top level';
      const s = n.type === 'doc' ? fileStyle(n.meta?.ext)
              : n.type === 'folder' ? { bg:'var(--primary-050)', fg:'var(--primary)' }
              : { bg:'#fdf4de', fg:'var(--warn)' };
      const ico = n.type === 'doc' ? ICO.doc : n.type === 'folder' ? ICO.folder : ICO.section;
      return `<button class="sr-item" data-id="${n.id}" data-type="${n.type}">
        <span class="sr-item__ico" style="background:${s.bg};color:${s.fg}">${ico}</span>
        <span class="sr-item__txt">
          <span class="sr-item__name">${esc(n.name)}</span>
          <span class="sr-item__path">${esc(path)}</span>
        </span>
      </button>`;
    }).join('');
    box.hidden = false;

    $$('.sr-item', box).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id, type = b.dataset.type;
      box.hidden = true; input.value = '';
      if (type === 'doc') { openDoc(id); }
      else openNode(id);
    }));
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search')) box.hidden = true;
  });
}

/* ============================================================
   MODAL + TOAST
   ============================================================ */
let modalHandler = null;

/**
 * openModal(title, text, okLabel, onOk, opts)
 *   opts.mode : 'prompt' (default, shows a name input) | 'custom' (opts.html) | 'none'
 */
function openModal(title, text, okLabel, onOk, opts = {}){
  const mode  = opts.mode || 'prompt';
  const html  = opts.html || '';
  const label = opts.label || 'Name';
  const value = opts.value || '';

  $('#modalTitle').textContent = title;
  $('#modalText').textContent = text || '';

  const field = $('#modalField');
  if (mode === 'prompt') {
    field.classList.remove('hidden');
    field.innerHTML = `<div class="field"><label for="modalInput">${esc(label)}</label>
                        <input id="modalInput" type="text" value="${esc(value)}" /></div>`;
  } else if (mode === 'custom') {
    field.classList.remove('hidden');
    field.innerHTML = html;
  } else {
    field.classList.add('hidden');
    field.innerHTML = '';
  }

  $('#modalOk').textContent = okLabel || 'Confirm';
  modalHandler = onOk;
  $('#modal').hidden = false;

  if (mode === 'prompt') setTimeout(() => { const i = $('#modalInput'); if (i) { i.focus(); i.select(); } }, 40);
}

function closeModal(){
  $('#modal').hidden = true;
  modalHandler = null;
  const skip = $('#modalSkip');
  if (skip) skip.remove();
  const box = $('.modal__box');
  if (box) box.style.maxWidth = '';   // reset any preview widening
}

function toast(msg, kind = 'ok'){
  const t = document.createElement('div');
  t.className = 'toast toast--' + kind;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2800);
}

/* ============================================================
   GLOBAL WIRING
   ============================================================ */
function wireGlobal(){
  setupSearch();
  // buttons that point at another button (no inline handlers, so a strict security policy can stay on)
  document.addEventListener('click', e => { const t = e.target.closest('[data-click]'); if (t) document.getElementById(t.dataset.click)?.click(); });

  // theme toggle
  $('#themeBtn').addEventListener('click', toggleTheme);

  // details panel close
  $('#details').addEventListener('click', e => {
    if (e.target.hasAttribute('data-dclose')) closeDetails();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetails();
  });

  // upload button
  $('#uploadBtn').addEventListener('click', () => pickFiles(state.nodeId || ''));

  // file input
  $('#fileInput').addEventListener('change', e => {
    const files = [...e.target.files];
    const target = e.target.dataset.target || state.nodeId || '';
    if (files.length) handleFiles(files, target);
  });

  // add section from nav
  $('#addSectionBtn').addEventListener('click', newSection);

  // nav view buttons
  $$('.nav__item[data-view]').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view; state.nodeId = null;
    $$('.nav__item[data-view]').forEach(x => x.classList.toggle('nav__item--active', x === b));
    buildNav(); render(); closeSidebar();
  }));

  // modal
  $('#modal').addEventListener('click', e => {
    if (e.target.hasAttribute('data-close')) closeModal();
  });
  $('#modalOk').addEventListener('click', async () => {
    if (!modalHandler) { closeModal(); return; }
    const res = await modalHandler();
    if (res !== false) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
  });

  // profile
  $('#profileBtn').addEventListener('click', e => {
    e.stopPropagation();
    const m = $('#profileMenu');
    m.hidden = !m.hidden;
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#profileBtn')) $('#profileMenu').hidden = true;
  });
  $('#logoutBtn').addEventListener('click', () => {
    Cloud.signOut();
  });

  // sidebar (mobile)
  $('#burger').addEventListener('click', () => {
    $('#sidebar').classList.add('is-open');
    $('#scrim').classList.add('is-open');
  });
  $('#sidebarClose').addEventListener('click', closeSidebar);
  $('#scrim').addEventListener('click', closeSidebar);

  // storage meter
  const st = Tree.stats();
  const QUOTA = 2 * 1024 * 1024 * 1024;
  const pct = Math.min(100, Math.round((st.bytes / QUOTA) * 100));
  $('#storagePct').textContent = pct + '%';
  $('#storageBar').style.width = pct + '%';
  $('#storageText').textContent = `${humanSize(st.bytes)} of 2 GB local quota`;
}

function closeSidebar(){
  $('#sidebar').classList.remove('is-open');
  $('#scrim').classList.remove('is-open');
}
