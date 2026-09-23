(() => {
  'use strict';

  const DATA_PATH = 'site/data/instruments.json';
  const ENUM = {
    region: ['Global', 'Europe', 'Asia-Pacific', 'Americas', 'Africa', 'Middle East'],
    level: ['international', 'regional', 'national', 'subnational'],
    category: ['hard_law', 'soft_law', 'standard', 'process'],
    binding: ['binding', 'pending', 'non_binding'],
    status: ['in_force', 'adopted', 'draft', 'ongoing', 'concluded', 'revoked'],
    domain: ['civil', 'military', 'both']
  };
  const CAT_LABEL = { hard_law: 'Hard law', soft_law: 'Soft law', standard: 'Standard', process: 'Process' };
  const ORDER = ['id', 'title', 'short', 'jurisdiction', 'region', 'level', 'category', 'kind', 'binding', 'status',
    'status_note', 'year', 'domain', 'sectors', 'summary', 'key_points', 'related', 'url', 'verify', 'last_verified'];

  const $ = (s) => document.querySelector(s);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }

  let entries = [];
  let baseEntries = [];
  let baseText = '';
  let mode = null; // 'github' | 'local'
  let sha = null;
  let cfg = null;
  let editingId = null;
  let idTouched = false;

  /* ---------- Serialisation (matches the formatting of the shipped file) ---------- */

  function fmtEntry(e) {
    const lines = [];
    for (const k of ORDER) {
      if (!(k in e)) continue;
      const v = e[k];
      let s;
      if (k === 'key_points') s = v.length ? '[\n' + v.map((x) => '      ' + JSON.stringify(x)).join(',\n') + '\n    ]' : '[]';
      else if (Array.isArray(v)) s = '[' + v.map((x) => JSON.stringify(x)).join(', ') + ']';
      else s = JSON.stringify(v);
      lines.push(`    ${JSON.stringify(k)}: ${s}`);
    }
    return '  {\n' + lines.join(',\n') + '\n  }';
  }
  const serialize = (list) => '[\n' + list.map(fmtEntry).join(',\n') + '\n]\n';

  function fromB64(b64) {
    return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  }
  function toB64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  /* ---------- Validation (mirrors schema/instrument.schema.json) ---------- */

  function validateEntry(e, others) {
    const err = [];
    const ids = new Set(others.map((o) => o.id));
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id || '')) err.push('Id must use lowercase letters, numbers and single hyphens, for example "eu-ai-act".');
    else if (ids.has(e.id)) err.push(`Id "${e.id}" is already used by another entry.`);
    if ((e.title || '').length < 3) err.push('Title is required.');
    if (!e.short) err.push('One-line descriptor is required.');
    if (!e.jurisdiction) err.push('Jurisdiction is required.');
    if (!e.kind) err.push('Form is required.');
    if ((e.summary || '').length < 20) err.push('Summary needs at least 20 characters.');
    if (!Number.isInteger(e.year) || e.year < 1990 || e.year > 2100) err.push('Year must be between 1990 and 2100.');
    for (const k of Object.keys(ENUM)) if (!ENUM[k].includes(e[k])) err.push(`Choose a valid value for ${k}.`);
    if (e.url) {
      try { if (!/^https?:$/.test(new URL(e.url).protocol)) throw new Error(); } catch { err.push('Source link must be a full web address starting with https://.'); }
    }
    if (e.last_verified && !/^\d{4}-\d{2}-\d{2}$/.test(e.last_verified)) err.push('Last checked must be a date.');
    const all = new Set([...ids, e.id]);
    for (const r of e.related || []) {
      if (r === e.id) err.push('An entry cannot be related to itself.');
      else if (!all.has(r)) err.push(`Related entry "${r}" does not exist.`);
    }
    return err;
  }

  function validateAll() {
    const out = [];
    entries.forEach((e) => validateEntry(e, entries.filter((o) => o !== e)).forEach((m) => out.push(`${e.id || '(no id)'}: ${m}`)));
    return out;
  }

  /* ---------- UI helpers ---------- */

  function connectMsg(text, kind) {
    const m = $('#connect-msg');
    m.textContent = text;
    m.className = 'msg' + (kind ? ' ' + kind : '');
  }

  const isDirty = () => serialize(entries) !== baseText;

  function updateSaveBar() {
    const dirty = isDirty();
    const m = $('#save-msg');
    m.replaceChildren(dirty ? h('span', { class: 'dirty-dot', 'aria-hidden': 'true' }) : '', dirty ? 'You have unsaved changes.' : 'No unsaved changes.');
    $('#btn-save').disabled = !dirty;
    $('#btn-discard').hidden = !dirty;
  }

  function renderList() {
    const q = $('#filter').value.trim().toLowerCase();
    const rows = entries
      .filter((e) => !q || (e.title + ' ' + e.jurisdiction).toLowerCase().includes(q))
      .map((e) => h('tr', null,
        h('td', null, h('strong', { text: e.title }), h('br'), h('small', { text: e.id })),
        h('td', { text: CAT_LABEL[e.category] || e.category }),
        h('td', { text: e.jurisdiction }),
        h('td', { text: String(e.year) }),
        h('td', null, h('div', { class: 'row' },
          h('button', { type: 'button', class: 'link-btn', text: 'Edit', 'aria-label': 'Edit ' + e.title, onclick: () => openEditor(e.id) }),
          h('button', { type: 'button', class: 'link-btn danger', text: 'Delete', 'aria-label': 'Delete ' + e.title, onclick: () => removeEntry(e.id) })))));
    $('#rows').replaceChildren(...rows);
    updateSaveBar();
  }

  function afterLoad() {
    baseEntries = clone(entries);
    baseText = serialize(entries);
    $('#list-panel').hidden = false;
    $('#savebar').hidden = false;
    $('#btn-save').textContent = mode === 'github' ? 'Save to GitHub' : 'Download JSON';
    renderList();
  }

  /* ---------- Loading ---------- */

  function gh(path, { method = 'GET', query = '', body } = {}) {
    return fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}${query}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body
    });
  }

  async function connectGithub() {
    cfg = {
      owner: $('#owner').value.trim(), repo: $('#repo').value.trim(),
      branch: $('#branch').value.trim() || 'main', token: $('#token').value.trim()
    };
    if (!cfg.owner || !cfg.repo || !cfg.token) { connectMsg('Enter the user, repository and access token.', 'bad'); return; }
    connectMsg('Loading entries…');
    try {
      const r = await gh(DATA_PATH, { query: `?ref=${encodeURIComponent(cfg.branch)}` });
      if (r.status === 401 || r.status === 403) throw new Error('GitHub rejected the token. Check that it is valid and has Contents access to this repository.');
      if (r.status === 404) throw new Error('File not found. Check the user, repository and branch, and that the token can access the repository.');
      if (!r.ok) throw new Error(`GitHub returned an error (${r.status}).`);
      const j = await r.json();
      entries = JSON.parse(fromB64(j.content));
      sha = j.sha;
      mode = 'github';
      afterLoad();
      connectMsg(`Connected. ${entries.length} entries loaded from ${cfg.owner}/${cfg.repo} (${cfg.branch}).`, 'ok');
    } catch (err) {
      connectMsg(err.message, 'bad');
    }
  }

  async function loadLocal() {
    connectMsg('Loading entries…');
    try {
      const r = await fetch('../data/instruments.json');
      if (!r.ok) throw new Error(`Could not load the data file (${r.status}).`);
      entries = await r.json();
      mode = 'local';
      afterLoad();
      connectMsg(`${entries.length} entries loaded from this site. Saving will download the updated file for you to commit.`, 'ok');
    } catch (err) {
      connectMsg(err.message, 'bad');
    }
  }

  /* ---------- Editing ---------- */

  const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function openEditor(id) {
    editingId = id;
    idTouched = !!id;
    const e = id ? entries.find((x) => x.id === id) : {
      id: '', title: '', short: '', jurisdiction: '', region: 'Global', level: 'international', category: 'soft_law', kind: '',
      binding: 'non_binding', status: 'adopted', status_note: '', year: new Date().getFullYear(), domain: 'civil',
      sectors: [], summary: '', key_points: [], related: [], url: '', verify: false, last_verified: ''
    };
    const set = (k, v) => { $('#f-' + k).value = v == null ? '' : v; };
    ['id', 'title', 'short', 'jurisdiction', 'region', 'level', 'category', 'kind', 'binding', 'status', 'status_note', 'year', 'domain', 'summary', 'url', 'last_verified']
      .forEach((k) => set(k, e[k]));
    set('sectors', (e.sectors || []).join(', '));
    set('key_points', (e.key_points || []).join('\n'));
    $('#f-verify').checked = !!e.verify;
    $('#f-id').readOnly = !!id;
    $('#f-related').replaceChildren(...entries.filter((x) => x.id !== id)
      .map((x) => h('option', { value: x.id, text: x.title, selected: (e.related || []).includes(x.id) })));
    $('#editor-h').textContent = id ? 'Edit entry' : 'Add new entry';
    $('#errors').hidden = true;
    $('#editor').hidden = false;
    $('#editor').scrollIntoView({ block: 'start' });
    $('#f-title').focus({ preventScroll: true });
  }

  function closeEditor() {
    $('#editor').hidden = true;
    editingId = null;
  }

  function readForm() {
    const g = (k) => $('#f-' + k).value.trim();
    const e = {
      id: g('id'), title: g('title'), short: g('short'), jurisdiction: g('jurisdiction'), region: g('region'), level: g('level'),
      category: g('category'), kind: g('kind'), binding: g('binding'), status: g('status'), status_note: g('status_note'),
      year: parseInt(g('year'), 10), domain: g('domain'),
      sectors: g('sectors').split(',').map((s) => s.trim()).filter(Boolean),
      summary: g('summary'),
      key_points: $('#f-key_points').value.split('\n').map((s) => s.trim()).filter(Boolean),
      related: [...$('#f-related').selectedOptions].map((o) => o.value),
      url: g('url') || null, verify: $('#f-verify').checked, last_verified: g('last_verified') || null
    };
    if (!e.status_note) delete e.status_note;
    return e;
  }

  function submitForm(ev) {
    ev.preventDefault();
    const e = readForm();
    const others = entries.filter((x) => x.id !== editingId);
    const errs = validateEntry(e, others);
    const box = $('#errors');
    if (errs.length) {
      box.replaceChildren(h('strong', { text: 'Fix these before applying:' }), h('ul', null, errs.map((m) => h('li', { text: m }))));
      box.hidden = false;
      box.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (editingId) entries[entries.findIndex((x) => x.id === editingId)] = e;
    else entries.push(e);
    closeEditor();
    renderList();
    connectMsg(`Entry "${e.title}" applied. Remember to save.`, 'ok');
  }

  function removeEntry(id) {
    const e = entries.find((x) => x.id === id);
    if (!e || !window.confirm(`Delete "${e.title}"? Links from other entries will be removed too.`)) return;
    entries = entries.filter((x) => x.id !== id);
    entries.forEach((x) => { x.related = (x.related || []).filter((r) => r !== id); });
    renderList();
  }

  /* ---------- Saving ---------- */

  function changeSummary() {
    const before = new Map(baseEntries.map((e) => [e.id, JSON.stringify(e)]));
    const now = new Map(entries.map((e) => [e.id, JSON.stringify(e)]));
    const added = [...now.keys()].filter((k) => !before.has(k));
    const removed = [...before.keys()].filter((k) => !now.has(k));
    const edited = [...now.keys()].filter((k) => before.has(k) && before.get(k) !== now.get(k));
    const parts = [];
    if (added.length) parts.push('add ' + added.join(', '));
    if (edited.length) parts.push('edit ' + edited.join(', '));
    if (removed.length) parts.push('remove ' + removed.join(', '));
    return 'Register: ' + (parts.join('; ') || 'update entries');
  }

  async function save() {
    const errs = validateAll();
    if (errs.length) { connectMsg('Cannot save. ' + errs[0], 'bad'); return; }
    const text = serialize(entries);

    if (mode === 'local') {
      const blob = new Blob([text], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'instruments.json' });
      document.body.append(a);
      a.click();
      a.remove();
      baseEntries = clone(entries);
      baseText = text;
      updateSaveBar();
      connectMsg('Downloaded instruments.json. Replace site/data/instruments.json in your repository with it and commit.', 'ok');
      return;
    }

    $('#btn-save').disabled = true;
    connectMsg('Saving to GitHub…');
    try {
      const r = await gh(DATA_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: changeSummary(), content: toB64(text), sha, branch: cfg.branch })
      });
      if (r.status === 409 || r.status === 422) throw new Error('The file changed on GitHub after you loaded it. Reload this page, connect again, and re-apply your changes so nothing is overwritten.');
      if (r.status === 401 || r.status === 403) throw new Error('GitHub rejected the token for writing. It needs Contents: Read and write on this repository.');
      if (!r.ok) throw new Error(`GitHub returned an error (${r.status}).`);
      const j = await r.json();
      sha = j.content.sha;
      baseEntries = clone(entries);
      baseText = text;
      updateSaveBar();
      connectMsg('Saved. GitHub is redeploying the site, which usually takes about a minute.', 'ok');
    } catch (err) {
      connectMsg(err.message, 'bad');
      updateSaveBar();
    }
  }

  /* ---------- Wiring ---------- */

  (function prefill() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    if (!m) return;
    $('#owner').value = m[1];
    const seg = location.pathname.split('/').filter(Boolean)[0];
    $('#repo').value = seg && seg !== 'admin' ? seg : `${m[1]}.github.io`;
  })();

  $('#btn-github').addEventListener('click', connectGithub);
  $('#btn-local').addEventListener('click', loadLocal);
  $('#btn-new').addEventListener('click', () => openEditor(null));
  $('#btn-cancel').addEventListener('click', closeEditor);
  $('#form').addEventListener('submit', submitForm);
  $('#filter').addEventListener('input', renderList);
  $('#btn-save').addEventListener('click', save);
  $('#btn-discard').addEventListener('click', () => {
    if (!window.confirm('Discard all unsaved changes?')) return;
    entries = clone(baseEntries);
    closeEditor();
    renderList();
  });
  $('#f-id').addEventListener('input', () => { idTouched = true; });
  $('#f-title').addEventListener('input', (e) => { if (!editingId && !idTouched) $('#f-id').value = slug(e.target.value); });
  window.addEventListener('beforeunload', (e) => { if (mode && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
})();
