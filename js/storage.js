/* ============================================================
   storage.js — persistence layer
   • Folder / section tree  → localStorage
   • Uploaded file bytes    → IndexedDB (localStorage can't hold blobs)
   ============================================================ */

const Store = (() => {

  /* ---------------- constants ---------------- */
  const TREE_KEY  = 'eit_dms_tree';
  const META_KEY  = 'eit_dms_meta';
  const DB_NAME   = 'eit_dms_files';
  const DB_STORE  = 'files';

  /* ---------------- id helper ---------------- */
  let counter = Date.now() % 100000;
  const uid = (p = 'n') => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;

  /* ============================================================
     TREE  (localStorage)
     ============================================================
     node = { id, type:'section'|'folder'|'doc', name, parent,
              created, createdBy, meta:{ size, mime, ext },
              docType, tags:[ 'Department/CSE', 'Year/2025' ], fields:{...} }
     Sections live at parent === null.
     ============================================================ */

  /* ---- metadata vocabulary ---- */
  const DOC_TYPES = [
    'Result', 'Circular', 'Notice', 'Syllabus', 'Thesis', 'Minutes',
    'Certificate', 'Fee Record', 'Admission', 'NBA Evidence', 'Timetable', 'Other'
  ];

  /* custom fields available on every document */
  const FIELD_DEFS = [
    { key:'department', label:'Department', type:'select',
      options:['CSE','IT','ECE','EEE','ME','CE','MBA','Applied Sciences','Administration'] },
    { key:'programme',  label:'Programme',  type:'select',
      options:['B.Tech','M.Tech','MBA','BBA','B.Sc','Diploma'] },
    { key:'batch',      label:'Batch',      type:'text', placeholder:'e.g. 2022-26' },
    { key:'semester',   label:'Semester',   type:'select',
      options:['1','2','3','4','5','6','7','8'] },
    { key:'year',       label:'Year',       type:'text', placeholder:'e.g. 2025' },
    { key:'rollNo',     label:'Roll No.',   type:'text', placeholder:'e.g. 02116403122' },
    { key:'issuedBy',   label:'Issued by',  type:'text', placeholder:'e.g. GGSIPU, AICTE' }
  ];

  const SCHEMA_VERSION = 2;

  /* fill in metadata defaults for nodes created before this version */
  const normaliseNode = n => {
    if (!n || typeof n !== 'object') return n;
    if (!n.meta || typeof n.meta !== 'object') n.meta = {};
    if (n.type === 'doc') {
      if (typeof n.docType !== 'string' || !n.docType) n.docType = 'Other';
      if (!Array.isArray(n.tags)) n.tags = [];
      if (!n.fields || typeof n.fields !== 'object') n.fields = {};
    }
    return n;
  };

  const Tree = {

    DOC_TYPES,
    FIELD_DEFS,

    read(){
      try {
        const raw = localStorage.getItem(TREE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.nodes || typeof parsed.nodes !== 'object') return null;
        if (!Array.isArray(parsed.order)) parsed.order = [];

        // one-time migration: give every document a docType / tags / fields
        if (parsed.v !== SCHEMA_VERSION) {
          Object.values(parsed.nodes).forEach(normaliseNode);
          parsed.v = SCHEMA_VERSION;
          try { localStorage.setItem(TREE_KEY, JSON.stringify(parsed)); } catch {}
        }
        return parsed;
      } catch { return null; }
    },

    write(state){
      try {
        localStorage.setItem(TREE_KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        console.error('tree write failed', e);
        return false;
      }
    },

    empty(){ return { nodes: {}, order: [], v: SCHEMA_VERSION }; },

    /* ---- seed the default sections & folders on first run ---- */
    seed(){
      const state = Tree.empty();
      const add = (type, name, parent, meta) => {
        const id = uid(type === 'section' ? 's' : 'f');
        state.nodes[id] = {
          id, type, name, parent,
          created: Date.now(),
          createdBy: 'System',
          meta: meta || {}
        };
        if (!parent) state.order.push(id);
        return id;
      };

      const sec = (name, colour, folders) => {
        const sid = add('section', name, null, { colour });
        folders.forEach(fname => add('folder', fname, sid));
        return sid;
      };

      sec("Dean's Office", '#3d4fb8', [
        'Notices & Circulars', 'Official Correspondence', 'Faculty Affairs', 'Student Grievances'
      ]);
      sec('Academics', '#17916b', [
        'Course Files', 'Timetables', 'Examination Cell', 'Results & Transcripts', 'Curriculum'
      ]);
      sec('NBA Report', '#b7791f', [
        'SAR Data', 'Accreditation Evidence', 'Committees', 'PEOs & Outcomes', 'Photographs'
      ]);
      sec('College Records', '#8250df', [
        'Admission Records', 'Fee Records', 'Student Records', 'Faculty Records', 'Infrastructure'
      ]);
      sec('System', '#5b6478', [
        'Templates', 'Circulars Archive', 'Meeting Minutes', 'Audit Log'
      ]);

      Tree.write(state);
      return state;
    },

    state(){ return Tree.read() || Tree.seed(); },

    get(id){ return Tree.state().nodes[id] || null; },

    children(parentId){
      const s = Tree.state();
      // top level = sections, in their stored order
      if (parentId === null) {
        return (s.order || []).map(id => s.nodes[id]).filter(Boolean);
      }
      // nested = folders & documents whose parent matches
      return Object.values(s.nodes)
        .filter(n => n.parent === parentId)
        .sort((a, b) => (a.created || 0) - (b.created || 0));
    },

    sections(){ return Tree.children(null); },

    /* ---- who is acting (set by the dashboard once signed in) ---- */
    _actor: { name:'You', email:'' },
    setActor(name, email){ Tree._actor = { name: name || 'You', email: email || '' }; },
    actor(){ return Tree._actor; },

    /* ---- mutations ---- */
    addSection(name, colour){
      const s = Tree.state();
      const id = uid('s');
      const a = Tree.actor();
      s.nodes[id] = {
        id, type:'section', name, parent:null,
        created:Date.now(), createdBy:a.name, createdEmail:a.email,
        meta:{ colour: colour || '#3d4fb8' }
      };
      s.order.push(id);
      Tree.write(s);
      return id;
    },

    addFolder(name, parentId){
      const s = Tree.state();
      const id = uid('f');
      const a = Tree.actor();
      s.nodes[id] = {
        id, type:'folder', name, parent:parentId,
        created:Date.now(), createdBy:a.name, createdEmail:a.email, meta:{}
      };
      Tree.write(s);
      return id;
    },

    addDoc({ name, size, mime, ext, docType, tags, fields }, parentId){
      const s = Tree.state();
      const id = uid('d');
      const a = Tree.actor();
      s.nodes[id] = {
        id, type:'doc', name, parent:parentId,
        created:Date.now(), createdBy:a.name, createdEmail:a.email,
        modified:Date.now(), modifiedBy:a.name,
        docType: docType || 'Other',
        tags: Array.isArray(tags) ? tags.slice() : [],
        fields: (fields && typeof fields === 'object') ? { ...fields } : {},
        meta:{ size, mime, ext, uploads:1 }
      };
      Tree.write(s);
      return id;
    },

    /* ---- apply metadata to one document ---- */
    setMeta(id, patch){
      const s = Tree.state();
      const n = s.nodes[id];
      if (!n || n.type !== 'doc') return false;
      const a = Tree.actor();
      if (typeof patch.docType === 'string' && patch.docType) n.docType = patch.docType;
      if (Array.isArray(patch.tags)) n.tags = patch.tags.slice();
      if (patch.fields && typeof patch.fields === 'object') {
        n.fields = { ...(n.fields || {}), ...patch.fields };
        // drop empty values so the panel stays clean
        Object.keys(n.fields).forEach(k => {
          const v = n.fields[k];
          if (v === '' || v === null || typeof v === 'undefined') delete n.fields[k];
        });
      }
      n.modified = Date.now();
      n.modifiedBy = a.name;
      Tree.write(s);
      return true;
    },

    /* ---- every tag in use, as a set of full paths ---- */
    allTags(){
      const s = Tree.state();
      const set = new Set();
      Object.values(s.nodes).forEach(n => {
        if (n.type === 'doc' && Array.isArray(n.tags)) n.tags.forEach(t => t && set.add(t));
      });
      return [...set].sort((a, b) => a.localeCompare(b));
    },

    /* ---- nested tag tree built from 'Parent/Child' paths ---- */
    tagTree(){
      const root = { name:'', children:{} };
      Tree.allTags().forEach(path => {
        let cur = root;
        path.split('/').filter(Boolean).forEach(part => {
          if (!cur.children[part]) cur.children[part] = { name:part, children:{} };
          cur = cur.children[part];
        });
      });
      const count = p => Object.values(Tree.state().nodes)
        .filter(n => n.type === 'doc' && Array.isArray(n.tags) && n.tags.includes(p)).length;

      const walk = (node, prefix) => Object.values(node.children)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(c => {
          const full = prefix ? `${prefix}/${c.name}` : c.name;
          return { name:c.name, path:full, count:count(full), children:walk(c, full) };
        });
      return walk(root, '');
    },

    /* ---- documents matching a metadata filter ----
       filter({ types:['Result'], tags:['Department/CSE'], year:'2025',
                department:'CSE', fields:{ batch:'2022-26' } })
       an empty / missing criterion is ignored */
    filter(f = {}){
      const s = Tree.state();
      const has = (arr) => Array.isArray(arr) && arr.length > 0;
      return Object.values(s.nodes).filter(n => {
        if (n.type !== 'doc') return false;
        if (has(f.types) && !f.types.includes(n.docType || 'Other')) return false;
        if (has(f.tags)) {
          const own = n.tags || [];
          // a tag matches itself and everything nested under it
          const hit = f.tags.some(t => own.some(o => o === t || o.startsWith(t + '/')));
          if (!hit) return false;
        }
        if (f.year && String((n.fields || {}).year || '') !== String(f.year)) return false;
        if (f.department && (n.fields || {}).department !== f.department) return false;
        if (f.fields && typeof f.fields === 'object') {
          for (const [k, v] of Object.entries(f.fields)) {
            if (v === '' || v == null) continue;
            if (String((n.fields || {})[k] || '') !== String(v)) return false;
          }
        }
        return true;
      });
    },

    /* ---- distinct values actually in use for a custom field ---- */
    fieldValues(key){
      const s = Tree.state();
      const set = new Set();
      Object.values(s.nodes).forEach(n => {
        if (n.type === 'doc' && n.fields && n.fields[key]) set.add(n.fields[key]);
      });
      return [...set].sort();
    },

    rename(id, name){
      const s = Tree.state();
      if (!s.nodes[id]) return false;
      const a = Tree.actor();
      s.nodes[id].name = name;
      s.nodes[id].modified = Date.now();
      s.nodes[id].modifiedBy = a.name;
      Tree.write(s);
      return true;
    },

    remove(id){
      const s = Tree.state();
      const kill = [];
      const walk = nid => {
        const n = s.nodes[nid];
        if (!n) return;
        if (n.type === 'doc') kill.push(nid);
        else {
          // remove descendants first
          Object.values(s.nodes).filter(c => c.parent === nid).forEach(c => walk(c.id));
          if (n.type === 'section') s.order = s.order.filter(x => x !== nid);
        }
        delete s.nodes[nid];
      };
      walk(id);
      Tree.write(s);
      kill.forEach(fid => Files.remove(fid));
      return kill.length;
    },

    move(id, newParent){
      const s = Tree.state();
      if (!s.nodes[id]) return false;
      s.nodes[id].parent = newParent;
      Tree.write(s);
      return true;
    },

    /* ---- search across the whole tree ---- */
    search(term){
      const q = term.trim().toLowerCase();
      if (!q) return [];
      const s = Tree.state();
      return Object.values(s.nodes).filter(n => {
        if (n.type === 'doc' || n.type === 'folder' || n.type === 'section') {
          return n.name.toLowerCase().includes(q);
        }
        return false;
      });
    },

    /* ---- path breadcrumb for a node ---- */
    path(id){
      const s = Tree.state();
      const out = [];
      let cur = s.nodes[id];
      let guard = 0;
      while (cur && guard++ < 50) {
        out.unshift(cur);
        cur = cur.parent ? s.nodes[cur.parent] : null;
      }
      return out;
    },

    /* ---- stats for the overview cards ---- */
    stats(){
      const s = Tree.state();
      const nodes = Object.values(s.nodes);
      const count = t => nodes.filter(n => n.type === t).length;
      return {
        sections: count('section'),
        folders:  count('folder'),
        docs:     count('doc'),
        bytes:    nodes.filter(n => n.type === 'doc').reduce((a, n) => a + (n.meta?.size || 0), 0)
      };
    },

    reset(){ localStorage.removeItem(TREE_KEY); return Tree.seed(); }
  };

  /* ============================================================
     FILES  (IndexedDB)
     ============================================================ */
  const Files = {
    _db: null,

    open(){
      if (Files._db) return Promise.resolve(Files._db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath:'id' });
        };
        req.onsuccess = () => { Files._db = req.result; resolve(req.result); };
        req.onerror = () => reject(req.error);
      });
    },

    async put(id, file){
      const db = await Files.open();
      const blob = file instanceof Blob ? file : new Blob([file]);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ id, blob, name:file.name, type:file.type, size:blob.size });
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => reject(tx.error);
      });
    },

    async get(id){
      const db = await Files.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror  = () => reject(req.error);
      });
    },

    async remove(id){
      const db = await Files.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => reject(tx.error);
      });
    },

    async clear(){
      const db = await Files.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => reject(tx.error);
      });
    }
  };

  /* ---------------- meta (recent activity etc.) ---------------- */
  const Meta = {
    read(){
      try { return JSON.parse(localStorage.getItem(META_KEY)) || { activity: [] }; }
      catch { return { activity: [] }; }
    },
    log(entry){
      const m = Meta.read();
      m.activity = m.activity || [];
      m.activity.unshift({ ...entry, at: Date.now() });
      m.activity = m.activity.slice(0, 60);
      localStorage.setItem(META_KEY, JSON.stringify(m));
    },
    activity(){ return Meta.read().activity || []; }
  };

  return { Tree, Files, Meta, uid };
})();

window.Store = Store;
