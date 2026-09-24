(() => {
'use strict';

// ---------------------------------------------------------------------------
// Labels & constants
// ---------------------------------------------------------------------------
const LABEL = {
  category: { hard_law: 'Hard law', soft_law: 'Soft law', standard: 'Standard', process: 'Process', industry: 'Industry' },
  binding: { binding: 'Binding', pending: 'Not yet in force', non_binding: 'Non-binding' },
  domain: { civil: 'Civilian', military: 'Military', both: 'Civilian and military' },
  status: { in_force: 'In force', adopted: 'Adopted', draft: 'Draft or bill', ongoing: 'Ongoing', concluded: 'Concluded', revoked: 'Revoked', lapsed: 'Lapsed' },
  level: { international: 'International', regional: 'Regional', national: 'National', subnational: 'Subnational' }
};

const BADGE_CLASS = { hard_law: 'badge-hard', soft_law: 'badge-soft', standard: 'badge-std', process: 'badge-process', industry: 'badge-industry' };

const COUNTRY_FLAGS = {
  EU: '🇪🇺', US: '🇺🇸', CN: '🇨🇳', GB: '🇬🇧', KR: '🇰🇷', JP: '🇯🇵', BR: '🇧🇷', IN: '🇮🇳',
  CA: '🇨🇦', PK: '🇵🇰', UN: '🇺🇳', INT: '🌍', ASEAN: '🌏', FR: '🇫🇷', DE: '🇩🇪', AU: '🇦🇺',
  SG: '🇸🇬', NL: '🇳🇱', IT: '🇮🇹', ES: '🇪🇸', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮',
  IE: '🇮🇪', PL: '🇵🇱', CH: '🇨🇭', AT: '🇦🇹', IL: '🇮🇱', TR: '🇹🇷', UA: '🇺🇦', RU: '🇷🇺',
  MX: '🇲🇽', AR: '🇦🇷', CL: '🇨🇱', CO: '🇨🇴', NG: '🇳🇬', KE: '🇰🇪', ZA: '🇿🇦', NZ: '🇳🇿',
  MY: '🇲🇾', ID: '🇮🇩', TH: '🇹🇭', PH: '🇵🇭', VN: '🇻🇳', AE: '🇦🇪', SA: '🇸🇦', EG: '🇪🇬',
  MA: '🇲🇦', TN: '🇹🇳', RS: '🇷🇸', TW: '🇹🇼'
};

// Coarse lat/lng for the map view. Add more as country_code coverage grows.
const COORDS = {
  EU: [50.85, 4.35], US: [37.09, -95.71], CN: [35.86, 104.19], GB: [55.38, -3.44],
  KR: [35.91, 127.77], JP: [36.20, 138.25], BR: [-14.24, -51.93], IN: [20.59, 78.96],
  CA: [56.13, -106.35], PK: [30.38, 69.35], FR: [46.60, 1.88], DE: [51.17, 10.45],
  AU: [-25.27, 133.78], SG: [1.35, 103.82], NL: [52.13, 5.29], IT: [41.87, 12.57],
  ES: [40.46, -3.75], SE: [60.13, 18.64], NO: [60.47, 8.47], DK: [56.26, 9.50],
  FI: [61.92, 25.75], IE: [53.41, -8.24], PL: [51.92, 19.15], CH: [46.80, 8.23],
  AT: [47.52, 14.55], IL: [31.05, 34.85], TR: [38.96, 35.24], UA: [48.38, 31.17],
  RU: [61.52, 105.38], MX: [23.63, -102.55], AR: [-38.42, -63.62], CL: [-35.68, -71.54],
  CO: [4.57, -74.30], NG: [9.08, 8.68], KE: [-0.02, 37.91], ZA: [-30.56, 22.94],
  NZ: [-40.90, 174.89], MY: [4.21, 101.98], ID: [-0.79, 113.92], TH: [15.87, 100.99],
  PH: [12.88, 121.77], VN: [14.06, 108.28], AE: [23.42, 53.85], SA: [23.89, 45.08],
  EG: [26.82, 30.80], MA: [31.79, -7.09], TN: [33.88, 9.54], RS: [44.02, 21.01],
  TW: [23.70, 120.96]
};

const VIEWS = ['register', 'timeline', 'map', 'compare', 'sections', 'glossary', 'about'];
const NAV_LABEL = { register: 'Register', timeline: 'Timeline', map: 'Map', compare: 'Compare', sections: 'Briefing', glossary: 'Glossary', about: 'About' };
const MAX_COMPARE = 3;

// ---------------------------------------------------------------------------
// State (search / filters / sort persisted in sessionStorage)
// ---------------------------------------------------------------------------
const state = {
  view: 'register',
  open: null,
  q: '',
  sort: 'year_desc',
  layout: 'table',
  compare: [],
  f: { category: new Set(), domain: new Set(), binding: new Set(), region: new Set() },
  section: 'overview'
};

let DATA = [];
let GLOSSARY = [];
let SECTIONS = { source_note: '', sections: [] };
let leafletPromise = null;
let mapInstance = null;

const $ = (sel, root = document) => root.querySelector(sel);
const byId = (id) => DATA.find((d) => d.id === id);

function saveState() {
  try {
    sessionStorage.setItem('aigov-state', JSON.stringify({
      q: state.q, sort: state.sort, layout: state.layout, compare: state.compare,
      f: Object.fromEntries(Object.entries(state.f).map(([k, s]) => [k, [...s]]))
    }));
  } catch (_) { /* storage unavailable */ }
}

function loadState() {
  try {
    const raw = sessionStorage.getItem('aigov-state');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.q === 'string') state.q = s.q;
    if (typeof s.sort === 'string') state.sort = s.sort;
    if (typeof s.layout === 'string') state.layout = s.layout;
    if (Array.isArray(s.compare)) state.compare = s.compare.filter(byId);
    if (s.f) for (const k of Object.keys(state.f)) if (Array.isArray(s.f[k])) state.f[k] = new Set(s.f[k].filter(Boolean));
  } catch (_) { /* corrupt state, ignore */ }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
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
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

function highlight(text, query) {
  const q = (query || '').trim();
  if (!q) return document.createTextNode(text || '');
  const frag = document.createDocumentFragment();
  const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  let last = 0;
  for (const m of String(text || '').matchAll(rx)) {
    frag.append(document.createTextNode(String(text).slice(last, m.index)));
    frag.append(h('mark', { text: m[0] }));
    last = m.index + m[0].length;
  }
  frag.append(document.createTextNode(String(text || '').slice(last)));
  return frag;
}

function toast(msg, isError) {
  const t = h('div', { class: 'toast' + (isError ? ' error' : ''), text: msg });
  $('#toast-container').append(t);
  setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 300); }, 2600);
}

function getFlag(code) {
  return (code && COUNTRY_FLAGS[code]) || '🏳️';
}

// ---------------------------------------------------------------------------
// Filtering / sorting
// ---------------------------------------------------------------------------
function matches(i) {
  const f = state.f;
  if (f.category.size && !f.category.has(i.category)) return false;
  if (f.binding.size && !f.binding.has(i.binding)) return false;
  if (f.region.size && !f.region.has(i.region)) return false;
  if (f.domain.size && ![...f.domain].some((d) => i.domain === d || i.domain === 'both')) return false;
  if (state.q.trim()) {
    const hay = [i.title, i.short, i.core_focus, i.summary, i.jurisdiction, i.kind, i.approach,
      (i.sectors || []).join(' '), (i.key_points || []).join(' ')].join(' ').toLowerCase();
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
  return arr.sort(by[state.sort] || by.year_desc);
}

function activeFilterCount() {
  return Object.values(state.f).reduce((n, s) => n + s.size, 0) + (state.q.trim() ? 1 : 0);
}

function resetFilters() {
  state.q = '';
  Object.values(state.f).forEach((s) => s.clear());
}

// ---------------------------------------------------------------------------
// Routing (hash-based)
// ---------------------------------------------------------------------------
function parseHash() {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  state.view = VIEWS.includes(parts[0]) ? parts[0] : 'register';
  state.open = parts[1] && byId(parts[1]) ? parts[1] : null;
  if (state.view === 'sections' && parts[1]) state.section = parts[1];
}

function go(view, id) {
  location.hash = '#/' + view + (id ? '/' + id : '');
}

function onHash() {
  parseHash();
  syncUI();
}

// ---------------------------------------------------------------------------
// Navigation & filters UI
// ---------------------------------------------------------------------------
function buildNav() {
  $('#nav').replaceChildren(...VIEWS.map((id) =>
    h('a', { href: '#/' + id, dataset: { view: id }, text: NAV_LABEL[id] })
  ));
}

function buildFilters() {
  const regions = [...new Set(DATA.map((d) => d.region))].sort();
  const groups = [
    { key: 'category', title: 'Type', opts: Object.keys(LABEL.category), label: (v) => LABEL.category[v] },
    { key: 'domain', title: 'Domain', opts: ['civil', 'military', 'both'], label: (v) => LABEL.domain[v] },
    { key: 'binding', title: 'Legal force', opts: Object.keys(LABEL.binding), label: (v) => LABEL.binding[v] },
    { key: 'region', title: 'Region', opts: regions, label: (v) => v }
  ];
  const root = $('#filters');
  if (!root) return;
  root.replaceChildren(...groups.map((g) =>
    h('fieldset', null,
      h('legend', { text: g.title }),
      h('div', { class: 'filter-group' }, g.opts.map((v) =>
        h('button', {
          type: 'button', class: 'chip', 'aria-pressed': state.f[g.key].has(v) ? 'true' : 'false',
          text: g.label(v), dataset: { group: g.key, value: v },
          onclick: () => {
            const set = state.f[g.key];
            set.has(v) ? set.delete(v) : set.add(v);
            saveState();
            syncUI();
          }
        })
      ))
    )
  ));
}

function buildSearchBar() {
  const main = $('#main');
  const input = h('input', {
    type: 'search', id: 'q', placeholder: 'Search titles, jurisdictions, keywords…  (press / to focus)',
    'aria-label': 'Search the register', value: state.q,
    oninput: (e) => { state.q = e.target.value; saveState(); renderResultsOnly(); }
  });
  const clearBtn = h('button', {
    type: 'button', class: 'btn btn-secondary', id: 'clear-filters', text: 'Reset filters',
    onclick: () => { resetFilters(); saveState(); syncUI(); }
  });
  const countEl = h('p', { class: 'count', id: 'result-count' });
  main.replaceChildren(
    h('div', { class: 'search-row' }, input, clearBtn, countEl),
    h('div', { class: 'filters', id: 'filters' }),
    h('div', { id: 'results' })
  );
  buildFilters();
}

// ---------------------------------------------------------------------------
// Register view (table + card layouts)
// ---------------------------------------------------------------------------
function verifyBadge(i) {
  if (i.last_verified) return null;
  return h('span', { class: 'verify-flag', title: 'Not yet checked against its primary source', text: '⚠ Not yet checked' });
}

function tableRows(items) {
  return items.map((i) => {
    const cb = h('input', {
      type: 'checkbox', class: 'cmp-cb', 'aria-label': 'Select ' + i.title + ' for comparison',
      dataset: { id: i.id }, checked: state.compare.includes(i.id),
      onchange: (e) => toggleCompare(i.id, e.target.checked)
    });
    return h('tr', { dataset: { id: i.id } },
      h('td', null, cb),
      h('td', null, h('span', { class: 'badge ' + (BADGE_CLASS[i.category] || 'badge-soft'), text: LABEL.category[i.category] || i.category })),
      h('td', null,
        h('strong.entry-title', { role: 'link', tabindex: '0', onclick: () => openEntry(i.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEntry(i.id); } } },
          highlight(i.title, state.q)),
        verifyBadge(i),
        h('div', { class: 'muted', style: 'font-size:0.85rem;' }, highlight(i.short || '', state.q))
      ),
      h('td', null, h('span', { class: 'flag', text: getFlag(i.country_code) }), highlight(i.jurisdiction, state.q)),
      h('td', null, h('span', { class: 'status-' + i.status, text: LABEL.status[i.status] || i.status })),
      h('td', { class: 'core-focus' }, highlight(i.core_focus || i.summary || '', state.q)),
      h('td', null, i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener', text: 'View ↗' }) : h('span', { class: 'muted', text: 'No link' }))
    );
  });
}

function renderRegister() {
  const items = sorted(DATA.filter(matches));
  const results = $('#results');
  if (!results) return;

  const layoutToggle = h('div', { style: 'display:flex; gap:0.5rem;', role: 'group', 'aria-label': 'Layout' },
    h('button', { class: 'btn btn-sm ' + (state.layout === 'table' ? '' : 'btn-secondary'), type: 'button', 'aria-pressed': state.layout === 'table' ? 'true' : 'false', text: '☰ Table', onclick: () => { state.layout = 'table'; saveState(); syncUI(); } }),
    h('button', { class: 'btn btn-sm ' + (state.layout === 'cards' ? '' : 'btn-secondary'), type: 'button', 'aria-pressed': state.layout === 'cards' ? 'true' : 'false', text: '▤ Cards', onclick: () => { state.layout = 'cards'; saveState(); syncUI(); } })
  );

  const sortSel = h('select', {
    'aria-label': 'Sort entries', style: 'max-width:200px;',
    onchange: (e) => { state.sort = e.target.value; saveState(); syncUI(); }
  }, [['year_desc', 'Newest first'], ['year_asc', 'Oldest first'], ['title', 'Title A–Z'], ['jurisdiction', 'Jurisdiction A–Z']]
    .map(([v, t]) => h('option', { value: v, text: t, selected: state.sort === v })));

  const toolbar = h('div', { class: 'toolbar' },
    h('p', { class: 'count', text: `${items.length} of ${DATA.length} entries` + (activeFilterCount() ? ` · ${activeFilterCount()} filter${activeFilterCount() > 1 ? 's' : ''} active` : '') }),
    h('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, layoutToggle, sortSel)
  );

  const selectAll = h('input', {
    type: 'checkbox', id: 'select-all', 'aria-label': 'Select all visible entries for comparison',
    onchange: (e) => {
      document.querySelectorAll('#results .cmp-cb').forEach((cb) => {
        if (cb.checked !== e.target.checked) { cb.checked = e.target.checked; toggleCompare(cb.dataset.id, e.target.checked, true); }
      });
    }
  });

  let body;
  if (!items.length) {
    body = h('div', { class: 'empty' },
      h('h2', { text: 'No entries match' }),
      h('p', { text: 'Try fewer words, or reset the filters.' }),
      h('button', { class: 'btn', type: 'button', text: 'Clear filters', onclick: () => { resetFilters(); saveState(); syncUI(); } })
    );
  } else if (state.layout === 'table') {
    body = h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null,
        h('th', { style: 'width:40px;' }, selectAll),
        h('th', { text: 'Type' }), h('th', { text: 'Instrument' }), h('th', { text: 'Jurisdiction' }),
        h('th', { text: 'Status' }), h('th', { class: 'core-focus', text: 'Core focus' }), h('th', { text: 'Source' })
      )),
      h('tbody', null, tableRows(items))
    ));
  } else {
    body = h('ul', { class: 'register' }, items.map((i) =>
      h('li', { class: 'entry', dataset: { id: i.id } },
        h('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;' },
          h('div', { style: 'flex:1; min-width:0;' },
            h('div', { style: 'display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;' },
              h('span', { class: 'flag', text: getFlag(i.country_code) }),
              h('strong.entry-title', { role: 'link', tabindex: '0', onclick: () => openEntry(i.id), onkeydown: (e) => { if (e.key === 'Enter') openEntry(i.id); } }, highlight(i.title, state.q)),
              verifyBadge(i)
            ),
            h('div', { style: 'margin:0.4rem 0;' },
              h('span', { class: 'badge ' + (BADGE_CLASS[i.category] || 'badge-soft'), text: LABEL.category[i.category] || i.category }),
              h('span', { class: 'status-' + i.status, style: 'font-size:0.85rem;', text: LABEL.status[i.status] || i.status })
            ),
            h('p', { class: 'muted', style: 'margin:0.4rem 0;' }, highlight(i.core_focus || i.summary || '', state.q)),
            i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener', style: 'font-size:0.9rem;', text: 'Official source ↗' }) : null
          ),
          h('label', { style: 'display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; color:var(--text-muted); white-space:nowrap;' },
            h('input', { type: 'checkbox', class: 'cmp-cb', dataset: { id: i.id }, checked: state.compare.includes(i.id), style: 'width:auto;', onchange: (e) => toggleCompare(i.id, e.target.checked) }),
            'Compare')
        )
      )
    ));
  }
  results.replaceChildren(toolbar, body);
}

// ---------------------------------------------------------------------------
// Timeline view
// ---------------------------------------------------------------------------
function renderTimeline() {
  const items = DATA.filter(matches);
  const byYear = new Map();
  items.forEach((i) => {
    const y = i.year || null;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(i);
  });
  const years = [...byYear.keys()].filter((y) => y != null).sort((a, b) => b - a);
  const undated = byYear.get(null) || [];

  const tl = h('div', { class: 'timeline' });
  years.forEach((y) => {
    tl.append(h('h3', { class: 'tl-year', text: String(y) }));
    byYear.get(y).sort((a, b) => a.title.localeCompare(b.title)).forEach((i) => {
      tl.append(h('div', { class: 'tl-item' },
        h('div', { style: 'display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;' },
          h('span', { class: 'flag', text: getFlag(i.country_code) }),
          h('strong.entry-title', { role: 'link', tabindex: '0', onclick: () => openEntry(i.id), onkeydown: (e) => { if (e.key === 'Enter') openEntry(i.id); }, text: i.title }),
          h('span', { class: 'badge ' + (BADGE_CLASS[i.category] || 'badge-soft'), text: LABEL.category[i.category] || i.category }),
          h('span', { class: 'status-' + i.status, style: 'font-size:0.85rem;', text: LABEL.status[i.status] || i.status })
        ),
        h('div', { class: 'muted', style: 'font-size:0.9rem;', text: i.core_focus || i.summary })
      ));
    });
  });
  if (undated.length) {
    tl.append(h('h3', { class: 'tl-year tl-no-date', text: 'Undated / ongoing' }));
    undated.forEach((i) => {
      tl.append(h('div', { class: 'tl-item' },
        h('strong.entry-title', { role: 'link', tabindex: '0', onclick: () => openEntry(i.id), onkeydown: (e) => { if (e.key === 'Enter') openEntry(i.id); }, text: i.title })
      ));
    });
  }

  const results = $('#results');
  results.replaceChildren(
    h('div', { class: 'toolbar' },
      h('p', { class: 'count', text: `${items.length} entries across ${years.length} years` }),
      h('div', null, h('button', { class: 'btn btn-sm', type: 'button', text: '⟲ Reverse order', onclick: () => { state.sort = state.sort === 'year_asc' ? 'year_desc' : 'year_asc'; saveState(); syncUI(); } }))
    ),
    items.length ? tl : h('div', { class: 'empty' }, h('h2', { text: 'Nothing to plot' }), h('p', { text: 'Adjust the filters to see the timeline.' }))
  );
}

// ---------------------------------------------------------------------------
// Map view (Leaflet loaded lazily, with graceful fallback)
// ---------------------------------------------------------------------------
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
  leafletPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Leaflet failed to load'));
    document.head.appendChild(s);
  });
  return leafletPromise;
}

function renderMap() {
  const results = $('#results');
  results.replaceChildren(
    h('div', { class: 'legend' },
      h('span', null, h('span', { class: 'dot' }), 'Circle size = number of instruments'),
      h('span', { text: 'Click a circle to list its entries; click an entry to open it.' })
    ),
    h('div', { id: 'map', class: 'map-loading', text: 'Loading map…' })
  );
  loadLeaflet().then(() => {
    const holder = $('#map');
    if (!holder) return;
    holder.classList.remove('map-loading');
    holder.textContent = '';
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    const L = window.L;
    mapInstance = L.map('map', { worldCopyJump: true }).setView([25, 10], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19
    }).addTo(mapInstance);

    const grouped = {};
    DATA.filter(matches).forEach((i) => {
      const c = i.country_code;
      if (!c || !COORDS[c]) return;
      (grouped[c] = grouped[c] || []).push(i);
    });
    Object.entries(grouped).forEach(([code, list]) => {
      const marker = L.circleMarker(COORDS[code], {
        radius: Math.min(8 + list.length * 4, 30),
        fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 0.7
      }).addTo(mapInstance);
      const popup = document.createElement('div');
      popup.innerHTML = `<strong>${getFlag(code)} ${code}</strong><br>${list.length} AI policy instrument${list.length > 1 ? 's' : ''}`;
      const ul = document.createElement('ul');
      ul.className = 'map-popup-list';
      list.forEach((i) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#/register/' + i.id;
        a.textContent = i.short || i.title;
        a.addEventListener('click', (e) => { e.preventDefault(); openEntry(i.id); });
        li.append(a);
        ul.append(li);
      });
      popup.append(ul);
      marker.bindPopup(popup);
    });
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 50);
  }).catch(() => {
    const holder = $('#map');
    if (holder) holder.replaceChildren(h('div', { class: 'empty' },
      h('h2', { text: 'Map library unavailable' }),
      h('p', { text: 'Leaflet could not be loaded from the CDN (are you offline?). The table and timeline views still work.' })
    ));
  });
}

// ---------------------------------------------------------------------------
// Compare view & tray
// ---------------------------------------------------------------------------
function toggleCompare(id, isChecked, skipRender) {
  if (isChecked) {
    if (state.compare.length >= MAX_COMPARE) {
      toast(`You can compare up to ${MAX_COMPARE} entries.`);
      const cb = document.querySelector(`.cmp-cb[data-id="${CSS.escape(id)}"]`);
      if (cb) cb.checked = false;
      return;
    }
    if (!state.compare.includes(id)) state.compare.push(id);
    toast(`Added “${(byId(id) || {}).short || 'entry'}” to comparison (${state.compare.length}/${MAX_COMPARE}).`);
  } else {
    state.compare = state.compare.filter((x) => x !== id);
  }
  saveState();
  if (!skipRender) renderTray();
  else renderTray();
}

function renderTray() {
  const tray = $('#tray');
  if (!tray) return;
  tray.hidden = state.compare.length === 0;
  $('#tray-items').replaceChildren(...state.compare.map((id) => {
    const i = byId(id);
    if (!i) return null;
    return h('span', { class: 'tray-chip' },
      h('span', { text: (i.short || i.title) }),
      h('button', { type: 'button', 'aria-label': 'Remove ' + i.title + ' from comparison', text: '×', onclick: () => {
        state.compare = state.compare.filter((x) => x !== id);
        saveState();
        syncUI();
      } })
    );
  }));
  const cmpBtn = $('#tray-compare');
  if (cmpBtn) cmpBtn.disabled = state.compare.length < 2;
}

function renderCompare() {
  const items = state.compare.map(byId).filter(Boolean);
  const results = $('#results');
  if (items.length < 2) {
    results.replaceChildren(
      h('div', { class: 'empty' },
        h('h2', { text: 'Pick at least two entries to compare' }),
        h('p', { text: `Currently ${items.length} selected (maximum ${MAX_COMPARE}). Tick the checkboxes in the Register or Map popups.` }),
        h('a', { class: 'btn', href: '#/register', text: 'Go to Register →' })
      )
    );
    return;
  }
  const rows = [
    ['Type', (i) => LABEL.category[i.category] || i.category],
    ['Legal force', (i) => LABEL.binding[i.binding] || i.binding],
    ['Jurisdiction', (i) => `${getFlag(i.country_code)} ${i.jurisdiction}`],
    ['Level', (i) => LABEL.level[i.level] || i.level],
    ['Status', (i) => LABEL.status[i.status] || i.status],
    ['Year', (i) => i.year || '—'],
    ['Domain', (i) => LABEL.domain[i.domain] || i.domain],
    ['Approach', (i) => i.approach || '—'],
    ['Sectors', (i) => (i.sectors || []).join(', ') || '—'],
    ['Core focus', (i) => i.core_focus || i.summary],
    ['Key points', (i) => h('ul', { style: 'padding-left:1.2rem; margin:0;' }, (i.key_points || []).map((k) => h('li', { text: k })))],
    ['Verification', (i) => i.last_verified ? `Checked ${i.last_verified}` : '⚠ Not yet checked'],
    ['Source', (i) => i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener', text: 'Official document ↗' }) : h('span', { class: 'muted', text: 'No source link' })]
  ];
  results.replaceChildren(
    h('h2', { text: 'Side-by-side comparison' }),
    h('div', { class: 'table-wrap', style: 'margin-top:1rem;' }, h('table', null,
      h('thead', null, h('tr', null,
        h('th', { style: 'width:140px;', text: 'Feature' }),
        ...items.map((i) => h('th', null,
          h('div', { text: i.title }),
          h('button', { class: 'btn btn-sm btn-secondary', type: 'button', style: 'margin-top:0.4rem;', text: 'Remove', onclick: () => {
            state.compare = state.compare.filter((x) => x !== i.id); saveState(); syncUI();
          } })
        ))
      )),
      h('tbody', null, rows.map(([label, fn]) =>
        h('tr', null,
          h('th', { style: 'background:var(--bg-hover); font-weight:600;', text: label }),
          ...items.map((i) => { const v = fn(i); return h('td', null, v.nodeType ? v : String(v)); })
        )
      ))
    )),
    h('button', { class: 'btn btn-secondary', style: 'margin-top:1rem;', type: 'button', text: 'Clear selection', onclick: () => { state.compare = []; saveState(); syncUI(); } })
  );
}

// ---------------------------------------------------------------------------
// Sections (narrative briefing pages)
// ---------------------------------------------------------------------------
function renderSectionsShell() {
  const results = $('#results');
  const nav = h('div', { class: 'section-nav', id: 'section-nav' });
  results.replaceChildren(nav, h('div', { class: 'sections', id: 'sections-body' }));
  nav.replaceChildren(...SECTIONS.sections.map((s) =>
    h('button', {
      class: 'chip', type: 'button', 'aria-pressed': state.section === s.id ? 'true' : 'false',
      text: s.nav || s.title,
      onclick: () => { state.section = s.id; syncUI(); }
    })
  ));
}

function renderSections() {
  if (!$('#section-nav')) renderSectionsShell();
  else $('#section-nav').querySelectorAll('.chip').forEach((b, idx) => {
    b.setAttribute('aria-pressed', SECTIONS.sections[idx] && SECTIONS.sections[idx].id === state.section ? 'true' : 'false');
  });
  const body = $('#sections-body');
  if (!body) return;
  const sec = SECTIONS.sections.find((s) => s.id === state.section) || SECTIONS.sections[0];
  if (!sec) { body.replaceChildren(h('div', { class: 'empty', text: 'No section content available.' })); return; }

  const out = [h('h2', { text: `${sec.number ? sec.number + '. ' : ''}${sec.title}` })];
  if (sec.intro) out.push(h('p', { text: sec.intro }));

  for (const b of sec.blocks || []) {
    if (b.type === 'text') {
      out.push(b.title ? h('h3', { class: 'block-title', text: `${b.number ? b.number + ' ' : ''}${b.title}` }) : null);
      (b.paragraphs || []).forEach((p) => out.push(h('p', { text: p })));
    } else if (b.type === 'note') {
      out.push(h('div', { class: 'note' }, h('strong', { text: '⚠ Caveat: ' }), b.text));
    } else if (b.type === 'bullets') {
      out.push(h('ul', {}, (b.items || []).map((it) => h('li', { text: it }))));
    } else if (b.type === 'table') {
      if (b.title) out.push(h('h3', { class: 'block-title', text: `${b.number ? b.number + ' ' : ''}${b.title}` }));
      out.push(h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, (b.columns || []).map((c) => h('th', { text: c })))),
        h('tbody', null, (b.rows || []).map((r) => h('tr', null, (r.cells || []).map((cell, ci) => {
          const td = h('td', null, cell);
          if (b.tagColumn === ci) td.prepend(h('span', { class: 'badge badge-soft', text: cell }));
          if (r.ref && b.linkColumn === ci) {
            td.textContent = '';
            td.append(cell);
            const target = byId(r.ref);
            td.append(h('a', { class: 'ref-link', href: '#/register/' + r.ref, text: '→ ' + (target ? target.short || target.title : r.ref), onclick: (e) => { e.preventDefault(); openEntry(r.ref); } }));
          }
          if (r.check && ci === 0) {
            td.append(h('span', { class: 'check-icon', title: r.check, 'aria-label': 'Needs verification: ' + r.check, text: '⚠' }));
          }
          return td;
        }))))
      )));
    }
  }
  body.replaceChildren(...out.flat(Infinity).filter(Boolean));
}

// ---------------------------------------------------------------------------
// Glossary & About
// ---------------------------------------------------------------------------
function renderGlossary() {
  const results = $('#results');
  const term = state.q.trim().toLowerCase();
  const rows = GLOSSARY.filter((g) => !term || (g.term + ' ' + g.definition).toLowerCase().includes(term));
  results.replaceChildren(
    h('h2', { text: 'Glossary' }),
    rows.length ? h('div', { class: 'table-wrap', style: 'margin-top:1rem;' }, h('table', null,
      h('thead', null, h('tr', null, ['Term', 'Definition', 'Why it matters'].map((t) => h('th', { text: t })))),
      h('tbody', null, rows.map((g) => h('tr', null,
        h('td', { style: 'font-weight:600;' }, highlight(g.term, state.q)),
        h('td', null, highlight(g.definition, state.q)),
        h('td', { class: 'muted' }, g.why))))
    )) : h('div', { class: 'empty' }, h('p', { text: 'No glossary terms match your search.' }))
  );
}

function renderAbout() {
  const results = $('#results');
  const unverified = DATA.filter((d) => !d.last_verified).length;
  results.replaceChildren(h('div', { style: 'max-width:800px;' },
    h('h2', { text: 'About this register' }),
    h('p', { text: 'This register brings AI governance instruments into one searchable place: binding laws, non-binding instruments, technical standards and ongoing international processes, for both civilian and military uses of AI.' }),
    h('h3', { text: 'How to use it' }),
    h('ul', {},
      h('li', { text: 'Search and filter the Register, then switch between Table, Cards, Timeline and Map views.' }),
      h('li', { text: `Tick up to ${MAX_COMPARE} entries to compare them side by side.` }),
      h('li', { text: 'Click any entry title to open its full record.' }),
      h('li', { text: 'Press “/” anywhere to jump to the search box.' })),
    h('h3', { text: 'Data quality' }),
    h('p', { text: `Each entry shows whether a maintainer has checked it against the primary source. ${unverified} of ${DATA.length} entries are marked “Not yet checked” — confirm them before relying on the register.` }),
    h('p', {}, h('a', { href: 'admin/', text: 'Open the admin control panel' }), ' to add or edit entries.')
  ));
}

// ---------------------------------------------------------------------------
// Entry detail modal
// ---------------------------------------------------------------------------
function openEntry(id) {
  const i = byId(id);
  if (!i) return;
  go('register', id);
  const modal = $('#entry-modal');
  const body = $('#modal-body');
  const related = (i.related || []).map(byId).filter(Boolean);
  const field = (label, val) => val ? h('p', { style: 'margin:0.35rem 0;' }, h('strong', { text: label + ': ' }), h('span', { class: 'muted', text: val })) : null;
  body.replaceChildren(
    h('h2', { id: 'modal-title', style: 'margin:0 0 0.25rem;' }, getFlag(i.country_code) + ' ', i.title),
    h('p', { class: 'muted', style: 'margin-top:0;', text: i.short }),
    h('p', {},
      h('span', { class: 'badge ' + (BADGE_CLASS[i.category] || 'badge-soft'), text: LABEL.category[i.category] || i.category }),
      h('span', { class: 'badge', style: 'background:var(--bg-hover); color:var(--text-muted); border:1px solid var(--border);', text: LABEL.binding[i.binding] || i.binding }),
      h('span', { class: 'status-' + i.status, style: 'margin-left:0.25rem;', text: LABEL.status[i.status] || i.status })
    ),
    field('Jurisdiction', `${i.jurisdiction} (${LABEL.level[i.level] || i.level}, ${i.region})`),
    field('Year', i.year),
    field('Domain', LABEL.domain[i.domain]),
    field('Approach', i.approach),
    field('Sectors', (i.sectors || []).join(', ')),
    h('p', { style: 'margin:0.6rem 0;' }, i.summary),
    i.status_note ? field('Status note', i.status_note) : null,
    (i.key_points || []).length ? h('div', {}, h('h3', { style: 'margin-bottom:0.25rem;', text: 'Key points' }), h('ul', {}, i.key_points.map((k) => h('li', { text: k })))) : null,
    i.sponsors ? field('Sponsors', Array.isArray(i.sponsors) ? i.sponsors.join(', ') : i.sponsors) : null,
    i.votes ? field('Vote', typeof i.votes === 'string' ? i.votes : Object.entries(i.votes).map(([k, v]) => `${k}: ${v}`).join(' · ')) : null,
    h('p', { style: 'margin:0.6rem 0;' }, i.last_verified
      ? h('span', { style: 'color:var(--success);', text: `✓ Verified against source on ${i.last_verified}` })
      : h('span', { class: 'verify-flag', text: '⚠ Not yet checked against its primary source' })),
    related.length ? h('div', {}, h('h3', { style: 'margin-bottom:0.25rem;', text: 'Related entries' }),
      h('div', { class: 'related-links' }, related.map((r) =>
        h('a', { href: '#/register/' + r.id, text: r.short || r.title, onclick: (e) => { e.preventDefault(); openEntry(r.id); } })))) : null,
    h('div', { class: 'modal-actions' },
      i.url ? h('a', { class: 'btn', href: i.url, target: '_blank', rel: 'noopener', text: 'Official source ↗' }) : null,
      h('button', { class: 'btn btn-secondary', type: 'button', text: state.compare.includes(i.id) ? 'Remove from comparison' : '+ Add to comparison', onclick: () => {
        if (state.compare.includes(i.id)) { state.compare = state.compare.filter((x) => x !== i.id); saveState(); syncUI(); }
        else toggleCompare(i.id, true);
      } })
    )
  );
  if (!modal.open) modal.showModal();
}

// ---------------------------------------------------------------------------
// Rendering pipeline
// ---------------------------------------------------------------------------
function renderResults() {
  switch (state.view) {
    case 'register': renderRegister(); break;
    case 'timeline': renderTimeline(); break;
    case 'map': renderMap(); break;
    case 'compare': renderCompare(); break;
    case 'sections': renderSections(); break;
    case 'glossary': renderGlossary(); break;
    case 'about': renderAbout(); break;
  }
}

function renderResultsOnly() {
  // cheap re-render for typing in the search box (keeps focus in the input)
  if (['register', 'timeline', 'glossary'].includes(state.view)) renderResults();
}

function syncUI() {
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.view === state.view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  renderTray();
  if (['register', 'timeline', 'map', 'compare', 'sections', 'glossary', 'about'].includes(state.view)) {
    if (!$('#results')) buildSearchBar();
    renderResults();
  }
  const label = NAV_LABEL[state.view] || state.view;
  document.title = `${label} | AI Governance Map`;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  try {
    const [inst, gloss, sections] = await Promise.all([
      fetch('data/instruments.json').then((r) => r.ok ? r.json() : Promise.reject(new Error('instruments.json failed'))),
      fetch('data/glossary.json').then((r) => (r.ok ? r.json() : Promise.resolve([]))).catch(() => []),
      fetch('data/sections.json').then((r) => (r.ok ? r.json() : Promise.resolve({ sections: [] }))).catch(() => ({ sections: [] }))
    ]);
    if (!Array.isArray(inst)) throw new Error('instruments.json is not an array');
    DATA = inst;
    GLOSSARY = Array.isArray(gloss) ? gloss : [];
    SECTIONS = sections && Array.isArray(sections.sections) ? sections : { source_note: '', sections: [] };
  } catch (err) {
    $('#main').replaceChildren(h('div', { class: 'empty', style: 'color:var(--danger);' },
      h('h2', { text: 'Data load error' }),
      h('p', { text: 'Could not load the register data. Serve the site over HTTP, e.g.: python -m http.server -d site 8000' }),
      h('p', { class: 'muted', text: String(err && err.message || err) })
    ));
    return;
  }

  loadState();
  buildNav();

  const st = $('#stat-total'); if (st) st.textContent = DATA.length;
  const sj = $('#stat-jurisdictions'); if (sj) sj.textContent = new Set(DATA.map((d) => d.jurisdiction)).size;

  // Modal close on backdrop click
  const modal = $('#entry-modal');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
  modal.addEventListener('close', () => { if (state.view === 'register' && state.open) history.replaceState(null, '', '#/register'); });

  // Tray buttons
  $('#tray-compare').addEventListener('click', () => go('compare'));
  $('#tray-clear').addEventListener('click', () => { state.compare = []; saveState(); syncUI(); });

  // "/" focuses search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      const q = $('#q');
      if (q) q.focus();
    }
  });

  window.addEventListener('hashchange', onHash);
  parseHash();
  syncUI();

  if (state.open) openEntry(state.open);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
