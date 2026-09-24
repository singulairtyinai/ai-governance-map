(() => {
'use strict';

// 1. DYNAMICALLY INJECT MODERN TECH THEME CSS
const style = document.createElement('style');
style.textContent = `
  :root { --bg-dark: #0f172a; --bg-card: #1e293b; --bg-hover: #334155; --primary: #3b82f6; --accent: #06b6d4; --text-main: #f8fafc; --text-muted: #94a3b8; --border: #334155; --danger: #ef4444; --warning: #f59e0b; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, var(--bg-dark) 0%, #1e1b4b 100%); color: var(--text-main); margin: 0; line-height: 1.6; min-height: 100vh; }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
  .container { max-width: 1400px; margin: 0 auto; padding: 1.5rem; }
  header { background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); padding: 1rem 0; position: sticky; top: 0; z-index: 100; }
  h1, h2, h3 { color: var(--text-main); margin-top: 0; }
  .nav { display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .nav a { padding: 0.5rem 1rem; border-radius: 6px; color: var(--text-muted); font-weight: 500; transition: all 0.2s; }
  .nav a:hover, .nav a[aria-current="page"] { background: var(--bg-hover); color: var(--text-main); }
  .nav a[aria-current="page"] { color: var(--primary); }
  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
  .btn { background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 600; transition: transform 0.2s; }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
  .btn-secondary { background: var(--bg-hover); border: 1px solid var(--border); }
  
  /* Table View Styles */
  .table-wrap { overflow-x: auto; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; min-width: 800px; }
  th, td { padding: 1rem; text-align: left; border-bottom: 1px solid var(--border); }
  th { background: #0f172a; color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; position: sticky; top: 0; }
  td { vertical-align: top; }
  tr:hover td { background: var(--bg-hover); }
  
  /* FIX: Core Focus Column Truncation */
  td.core-focus, th.core-focus { min-width: 250px; max-width: 350px; white-space: normal !important; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.5; }
  
  /* Badges & Flags */
  .flag { font-size: 1.25rem; margin-right: 0.5rem; vertical-align: middle; }
  .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-right: 0.25rem; }
  .badge-hard { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid var(--danger); }
  .badge-soft { background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid var(--warning); }
  .badge-std { background: rgba(6, 182, 212, 0.2); color: #67e8f9; border: 1px solid var(--accent); }
  
  /* Map View */
  #map { height: 600px; width: 100%; border-radius: 8px; border: 1px solid var(--border); z-index: 1; }
  
  /* Comparison Panel */
  #tray { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-top: 2px solid var(--primary); padding: 1rem 2rem; transform: translateY(100%); transition: transform 0.3s ease; z-index: 1000; display: flex; justify-content: space-between; align-items: center; }
  #tray:not([hidden]) { transform: translateY(0); }
  .tray-chip { background: var(--bg-hover); padding: 0.4rem 0.8rem; border-radius: 6px; margin-right: 0.5rem; font-size: 0.9rem; }
  
  /* Inputs */
  input[type="text"], select { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-main); padding: 0.6rem; border-radius: 6px; width: 100%; max-width: 400px; }
  input[type="text"]:focus, select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
`;
document.head.appendChild(style);

const LABEL = {
  category: { hard_law: 'Hard law', soft_law: 'Soft law', standard: 'Standard', process: 'Process', industry: 'Industry' },
  binding: { binding: 'Binding', pending: 'Not yet in force', non_binding: 'Non-binding' },
  domain: { civil: 'Civilian', military: 'Military', both: 'Civilian and military' },
  status: { in_force: 'In force', adopted: 'Adopted', draft: 'Draft or bill', ongoing: 'Ongoing', concluded: 'Concluded', revoked: 'Revoked', lapsed: 'Lapsed' },
  level: { international: 'International', regional: 'Regional', national: 'National', subnational: 'Subnational' }
};

const COUNTRY_FLAGS = {
  'US': '🇺🇸', 'EU': '🇪🇺', 'CN': '🇨🇳', 'GB': '🇬🇧', 'KR': '🇰🇷', 'JP': '🇯🇵', 
  'BR': '🇧🇷', 'IN': '🇮🇳', 'CA': '🇨🇦', 'PK': '🇵🇰', 'UN': '🇺🇳', 'INT': '🌍', 'ASEAN': '🌏'
};

let VIEWS = ['register', 'timeline', 'compare', 'map', 'glossary', 'about'];
const NAV_LABEL = { register: 'Register', timeline: 'Timeline', compare: 'Compare', map: 'Map', glossary: 'Glossary', about: 'About' };
const MAX_COMPARE = 3;

const state = {
  view: 'register',
  tableView: true, // Default to table view to show columns properly
  q: '',
  open: null,
  sort: 'year_desc',
  compare: [],
  f: { category: new Set(), domain: new Set(), binding: new Set(), region: new Set() }
};

let DATA = [];
let GLOSSARY = [];
let SECTIONS = { source_note: '', sections: [] };

const $ = (sel, root = document) => root.querySelector(sel);
const byId = (id) => DATA.find((d) => d.id === id);

function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

function getFlag(jurisdiction, countryCode) {
  if (countryCode && COUNTRY_FLAGS[countryCode]) return COUNTRY_FLAGS[countryCode];
  return '🏳️';
}

function matches(i, skip) {
  const f = state.f;
  if (skip !== 'category' && f.category.size && !f.category.has(i.category)) return false;
  if (f.binding.size && !f.binding.has(i.binding)) return false;
  if (f.region.size && !f.region.has(i.region)) return false;
  if (f.domain.size && ![...f.domain].some((d) => i.domain === d || i.domain === 'both')) return false;
  if (state.q.trim()) {
    const hay = [i.title, i.short, i.core_focus, i.summary, i.jurisdiction, i.kind, (i.sectors || []).join(' '), (i.key_points || []).join(' ')]
      .join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
  }
  return true;
}

function sorted(list) {
  const arr = [...list];
  const yr = (e) => e.year || 0;
  const by = {
    year_desc: (a, b) => yr(b) - yr(a) || a.title.localeCompare(b.title),
    year_asc: (a, b) => yr(a) - yr(b) || a.title.localeCompare(b.title),
    title: (a, b) => a.title.localeCompare(b.title),
    jurisdiction: (a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || yr(b) - yr(a)
  };
  return arr.sort(by[state.sort]);
}

function resetFilters() {
  state.q = '';
  Object.values(state.f).forEach((s) => s.clear());
  const qEl = $('#q');
  if (qEl) qEl.value = '';
}

function parseHash() {
  const parts = location.hash.replace(/^#/?/, '').split('/');
  state.view = VIEWS.includes(parts[0]) ? parts[0] : 'register';
  state.open = state.view === 'register' && parts[1] && byId(parts[1]) ? parts[1] : null;
}

function go(view, id) {
  location.hash = '#/' + view + (id ? '/' + id : '');
}

function onHash() {
  parseHash();
  if (state.view === 'register' && state.open) {
    const item = byId(state.open);
    if (item && !matches(item)) resetFilters();
  }
  syncUI({ scrollToOpen: state.view === 'register' && !!state.open });
}

function buildNav() {
  $('#nav').replaceChildren(...VIEWS.map((id) => {
    return h('a', { href: '#/' + id, dataset: { view: id }, text: NAV_LABEL[id] });
  }));
}

function buildFilters() {
  const regions = [...new Set(DATA.map((d) => d.region))].sort();
  const groups = [
    { key: 'category', title: 'Type', opts: Object.keys(LABEL.category), label: (v) => LABEL.category[v] },
    { key: 'domain', title: 'Domain', opts: ['civil', 'military', 'both'], label: (v) => LABEL.domain[v] },
    { key: 'binding', title: 'Legal force', opts: Object.keys(LABEL.binding), label: (v) => LABEL.binding[v] }
  ];
  const root = $('#filters');
  if (!root) return;
  root.replaceChildren(...groups.map((g) =>
    h('fieldset', { style: 'border: 1px solid var(--border); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.75rem;' },
      h('legend', { style: 'padding: 0 0.5rem; color: var(--text-muted); font-size: 0.85rem;', text: g.title }),
      h('div', { style: 'display: flex; flex-wrap: wrap; gap: 0.5rem;' }, g.opts.map((v) =>
        h('button', {
          type: 'button', class: 'btn btn-secondary', style: 'padding: 0.4rem 0.8rem; font-size: 0.85rem;', 'aria-pressed': 'false', text: g.label(v),
          dataset: { group: g.key, value: v },
          onclick: () => {
            const set = state.f[g.key];
            set.has(v) ? set.delete(v) : set.add(v);
            syncUI({});
          }
        })
      ))
    )
  ));
}

function renderRegister(main, opts) {
  const items = sorted(DATA.filter((i) => matches(i)));
  
  const viewToggle = h('div', { style: 'display: flex; gap: 0.5rem;' },
    h('button', { class: `btn ${state.tableView ? '' : 'btn-secondary'}`, text: '☰ Table', onclick: () => { state.tableView = true; syncUI({}); } }),
    h('button', { class: `btn ${!state.tableView ? '' : 'btn-secondary'}`, text: '☷ List', onclick: () => { state.tableView = false; syncUI({}); } })
  );

  const sortSel = h('select', {
    'aria-label': 'Sort entries', style: 'max-width: 200px;',
    onchange: (e) => { state.sort = e.target.value; syncUI({}); }
  }, [['year_desc', 'Newest first'], ['year_asc', 'Oldest first'], ['title', 'Title A-Z']]
    .map(([v, t]) => h('option', { value: v, text: t, selected: state.sort === v })));

  const toolbar = h('div', { class: 'toolbar' },
    h('p', { class: 'count', style: 'color: var(--text-muted); margin: 0;', text: `${items.length} of ${DATA.length} entries` }),
    h('div', { style: 'display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;' }, viewToggle, sortSel)
  );

  if (state.tableView) {
    // TABLE VIEW (Fixes column truncation)
    const table = h('div', { class: 'table-wrap' },
      h('table', null,
        h('thead', null, h('tr', null,
          h('th', { style: 'width: 40px;' }, h('input', { type: 'checkbox', id: 'select-all', onchange: (e) => {
            document.querySelectorAll('.cmp-cb').forEach(cb => { cb.checked = e.target.checked; cb.dispatchEvent(new Event('change')); });
          }})),
          h('th', { text: 'Type' }),
          h('th', { text: 'Instrument' }),
          h('th', { text: 'Jurisdiction' }),
          h('th', { text: 'Status' }),
          h('th', { class: 'core-focus', text: 'Core Focus' }),
          h('th', { text: 'Source' })
        )),
        h('tbody', null, items.map(i => {
          const flag = getFlag(i.jurisdiction, i.country_code);
          const badgeClass = i.category === 'hard_law' ? 'badge-hard' : (i.category === 'standard' ? 'badge-std' : 'badge-soft');
          return h('tr', { dataset: { id: i.id } },
            h('td', null, h('input', { type: 'checkbox', class: 'cmp-cb', dataset: { id: i.id }, onchange: (e) => toggleCompare(i.id, e.target.checked) })),
            h('td', null, h('span', { class: `badge ${badgeClass}`, text: LABEL.category[i.category] })),
            h('td', null, h('strong', { text: i.title }), h('div', { style: 'font-size: 0.85rem; color: var(--text-muted);', text: i.short })),
            h('td', null, h('span', { class: 'flag', text: flag }), i.jurisdiction),
            h('td', null, h('span', { style: `color: ${i.status === 'in_force' ? '#10b981' : '#f59e0b'}`, text: LABEL.status[i.status] })),
            h('td', { class: 'core-focus', text: i.core_focus || i.summary }),
            h('td', null, i.url ? h('a', { href: i.url, target: '_blank', text: 'View ↗' }) : h('span', { style: 'color: var(--text-muted);', text: 'N/A' }))
          );
        }))
      )
    );
    main.replaceChildren(toolbar, table);
  } else {
    // LIST VIEW (Original card style)
    main.replaceChildren(toolbar, items.length ? h('ul', { class: 'register', style: 'list-style: none; padding: 0;' }, items.map(i => {
      const flag = getFlag(i.jurisdiction, i.country_code);
      const badgeClass = i.category === 'hard_law' ? 'badge-hard' : (i.category === 'standard' ? 'badge-std' : 'badge-soft');
      return h('li', { class: 'entry', style: 'background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;', dataset: { id: i.id } },
        h('div', { style: 'display: flex; justify-content: space-between; align-items: flex-start;' },
          h('div', { style: 'flex: 1;' },
            h('div', { style: 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;' },
              h('span', { class: 'flag', text: flag }),
              h('strong', { style: 'font-size: 1.1rem;', text: i.title })
            ),
            h('div', { style: 'margin-bottom: 0.5rem;' }, 
              h('span', { class: `badge ${badgeClass}`, text: LABEL.category[i.category] }),
              h('span', { class: 'badge', style: 'background: var(--bg-hover); color: var(--text-muted);', text: LABEL.status[i.status] })
            ),
            h('p', { style: 'color: var(--text-muted); margin: 0.5rem 0;', text: i.core_focus || i.summary }),
            i.url ? h('a', { href: i.url, target: '_blank', text: 'Official Source ↗', style: 'font-size: 0.9rem;' }) : null
          ),
          h('input', { type: 'checkbox', class: 'cmp-cb', dataset: { id: i.id }, style: 'width: 20px; height: 20px; margin-left: 1rem;', onchange: (e) => toggleCompare(i.id, e.target.checked) })
        )
      );
    })) : h('div', { class: 'empty', style: 'text-align: center; padding: 3rem; color: var(--text-muted);' }, h('h2', { text: 'No entries match' }), h('button', { class: 'btn', text: 'Clear filters', onclick: () => { resetFilters(); syncUI({}); } })));
  }
}

function toggleCompare(id, isChecked) {
  if (isChecked) {
    if (state.compare.length >= MAX_COMPARE) {
      alert(`You can compare up to ${MAX_COMPARE} entries.`);
      document.querySelector(`.cmp-cb[data-id="${id}"]`).checked = false;
      return;
    }
    if (!state.compare.includes(id)) state.compare.push(id);
  } else {
    state.compare = state.compare.filter(x => x !== id);
  }
  renderTray();
}

function renderTray() {
  const tray = $('#tray');
  if (!tray) return;
  tray.hidden = state.compare.length === 0;
  $('#tray-items').replaceChildren(...state.compare.map((id) => h('span', { class: 'tray-chip', text: byId(id).short || byId(id).title })));
  const cmpBtn = $('#tray-compare');
  if (cmpBtn) cmpBtn.disabled = state.compare.length < 2;
}

function renderCompare(main) {
  const items = state.compare.map(byId).filter(Boolean);
  if (items.length < 2) {
    main.replaceChildren(
      h('h2', { text: 'Compare Policies' }),
      h('p', { style: 'color: var(--text-muted);', text: `Select ${2 - items.length} more entr${items.length === 0 ? 'ies' : 'y'} in the Register to compare them side-by-side.` }),
      h('a', { class: 'btn', href: '#/register', text: 'Go to Register' })
    );
    return;
  }

  const rows = [
    ['Type', (i) => LABEL.category[i.category]],
    ['Jurisdiction', (i) => `${getFlag(i.jurisdiction, i.country_code)} ${i.jurisdiction}`],
    ['Status', (i) => LABEL.status[i.status]],
    ['Core Focus', (i) => i.core_focus || i.summary],
    ['Key Points', (i) => h('ul', { style: 'padding-left: 1.2rem; margin: 0;' }, (i.key_points || []).map((k) => h('li', { text: k })))],
    ['Source', (i) => i.url ? h('a', { href: i.url, target: '_blank', text: 'View Official Document ↗' }) : 'No source link']
  ];

  main.replaceChildren(
    h('h2', { text: 'Side-by-Side Comparison' }),
    h('div', { class: 'table-wrap', style: 'margin-top: 1rem;' }, h('table', null,
      h('thead', null, h('tr', null, 
        h('th', { style: 'width: 150px;', text: 'Feature' }),
        ...items.map((i) => h('th', { text: i.title }))
      )),
      h('tbody', null, rows.map(([label, fn]) =>
        h('tr', null, 
          h('th', { style: 'background: var(--bg-hover); font-weight: 600;', text: label }), 
          ...items.map((i) => h('td', null, fn(i)))
        )
      ))
    )),
    h('button', { class: 'btn btn-secondary', style: 'margin-top: 1rem;', text: 'Clear Selection', onclick: () => { state.compare = []; renderTray(); syncUI({}); } })
  );
}

// --- MAP VIEW LOGIC ---
async function loadLeaflet() {
  if (window.L) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  await new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

function renderMap(main) {
  main.replaceChildren(h('h2', { text: 'Global AI Governance Map' }), h('div', { id: 'map' }));
  loadLeaflet().then(() => {
    setTimeout(() => {
      const map = L.map('map').setView([20, 0], 2);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB',
        maxZoom: 19
      }).addTo(map);

      const countryCounts = {};
      DATA.forEach(i => {
        if (i.country_code && i.country_code !== 'INT' && i.country_code !== 'UN' && i.country_code !== 'ASEAN') {
          countryCounts[i.country_code] = (countryCounts[i.country_code] || 0) + 1;
        }
      });

      const coords = { 
        'US': [37.0902, -95.7129], 'EU': [50.8503, 4.3517], 'CN': [35.8617, 104.1954], 
        'GB': [55.3781, -3.4360], 'KR': [35.9078, 127.7669], 'JP': [36.2048, 138.2529],
        'BR': [-14.2350, -51.9253], 'IN': [20.5937, 78.9629], 'CA': [56.1304, -106.3468],
        'PK': [30.3753, 69.3451]
      };

      Object.keys(countryCounts).forEach(code => {
        if (coords[code]) {
          const count = countryCounts[code];
          L.circleMarker(coords[code], {
            radius: Math.min(count * 8, 30),
            fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 0.7
          }).addTo(map).bindPopup(`<strong>${COUNTRY_FLAGS[code] || ''} ${code}</strong><br>${count} AI policy/ies`);
        }
      });
      map.invalidateSize();
    }, 100);
  });
}

function renderGlossary(main) {
  main.replaceChildren(
    h('h2', { text: 'Glossary' }),
    h('div', { class: 'table-wrap', style: 'margin-top: 1rem;' }, h('table', null,
      h('thead', null, h('tr', null, ['Term', 'Definition', 'Why it matters'].map((t) => h('th', { text: t })))),
      h('tbody', null, GLOSSARY.map((g) => h('tr', null,
        h('td', { style: 'font-weight: 600;', text: g.term }), h('td', { text: g.definition }), h('td', { text: g.why }))))
    ))
  );
}

function renderAbout(main) {
  main.replaceChildren(h('div', { style: 'max-width: 800px;' },
    h('h2', { text: 'About this register' }),
    h('p', { text: 'This register brings AI governance instruments into one searchable place: binding laws, non-binding instruments, technical standards and ongoing international processes, for both civilian and military uses of AI.' }),
    h('h3', { text: 'Data Quality' }),
    h('p', { text: 'Each entry shows whether a maintainer has checked it against the primary source. Entries marked as not yet checked should be confirmed before you rely on them.' })
  ));
}

function renderMain(opts = {}) {
  const main = $('#main');
  if (state.view === 'register') renderRegister(main, opts);
  else if (state.view === 'timeline') renderRegister(main, opts); // Simplified for this update
  else if (state.view === 'compare') renderCompare(main);
  else if (state.view === 'map') renderMap(main);
  else if (state.view === 'glossary') renderGlossary(main);
  else if (state.view === 'about') renderAbout(main);
}

function syncUI(opts) {
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.view === state.view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  renderTray();
  renderMain(opts);
  const label = NAV_LABEL[state.view] || state.view;
  document.title = `${label} | AI Governance Map`;
}

async function init() {
  try {
    const [inst, gloss, sections] = await Promise.all([
      fetch('data/instruments.json').then((r) => r.ok ? r.json() : Promise.reject('instruments.json failed')),
      fetch('data/glossary.json').then((r) => r.ok ? r.json() : []),
      fetch('data/sections.json').then((r) => r.ok ? r.json() : { sections: [] })
    ]);
    DATA = inst;
    GLOSSARY = gloss;
    SECTIONS = sections;
  } catch (err) {
    $('#main').replaceChildren(h('div', { class: 'empty', style: 'color: var(--danger); text-align: center; padding: 3rem;' }, 
      h('h2', { text: 'Data Load Error' }), 
      h('p', { text: 'Please run this via a local server: python -m http.server -d site 8000' })
    ));
    return;
  }
  
  buildNav();
  buildFilters();
  
  const qEl = $('#q');
  if (qEl) qEl.addEventListener('input', (e) => { state.q = e.target.value; syncUI({}); });
  
  const clearBtn = $('#clear-filters');
  if (clearBtn) clearBtn.addEventListener('click', () => { resetFilters(); syncUI({}); });
  
  const trayCmp = $('#tray-compare');
  if (trayCmp) trayCmp.addEventListener('click', () => go('compare'));
  
  const trayClr = $('#tray-clear');
  if (trayClr) trayClr.addEventListener('click', () => { state.compare = []; syncUI({}); });
  
  window.addEventListener('hashchange', onHash);
  parseHash();
  syncUI({});
}

init();
})();
