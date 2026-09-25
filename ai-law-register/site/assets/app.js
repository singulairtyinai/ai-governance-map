(() => {
  'use strict';

  const LABEL = {
    category: { hard_law: 'Hard law', soft_law: 'Soft law', standard: 'Standard', process: 'Process', industry: 'Industry' },
    binding: { binding: 'Binding', pending: 'Not yet in force', non_binding: 'Non-binding' },
    domain: { civil: 'Civilian', military: 'Military', both: 'Civilian and military' },
    status: { in_force: 'In force', adopted: 'Adopted', draft: 'Draft or bill', ongoing: 'Ongoing', concluded: 'Concluded', revoked: 'Revoked', lapsed: 'Lapsed' },
    level: { international: 'International', regional: 'Regional', national: 'National', subnational: 'Subnational' }
  };
  let VIEWS = ['register', 'map', 'timeline', 'compare', 'glossary', 'about'];
  const NAV_LABEL = { register: 'Register', map: 'Map', timeline: 'Timeline', compare: 'Compare', glossary: 'Glossary', about: 'About' };
  const SIDEBAR_VIEWS = ['register', 'timeline'];
  const MAX_COMPARE = 3;

  /* ---------- Country flags ---------- */
  // Only sovereign states get a flag; institutions and multilateral bodies (Council of
  // Europe, ASEAN, G7, OECD, industry groups) intentionally get none rather than a wrong one.
  const FLAG_RULES = [
    [/european union/i, '🇪🇺'],
    [/united nations/i, '🇺🇳'],
    [/\bunited states\b|U\.S\.A?\.?\b/i, '🇺🇸'],
    [/\bchina\b/i, '🇨🇳'],
    [/\bindia\b/i, '🇮🇳'],
    [/\bjapan\b/i, '🇯🇵'],
    [/south korea|republic of korea/i, '🇰🇷'],
    [/\bbrazil\b/i, '🇧🇷'],
    [/\bpakistan\b/i, '🇵🇰'],
    [/united kingdom/i, '🇬🇧'],
    [/\bcanada\b/i, '🇨🇦'],
    [/\bfrance\b/i, '🇫🇷'],
    [/\bgermany\b/i, '🇩🇪'],
    [/\bsingapore\b/i, '🇸🇬'],
    [/\baustralia\b/i, '🇦🇺'],
    [/\bnetherlands\b/i, '🇳🇱']
  ];
  function flagFor(text) {
    if (!text) return '';
    for (const [re, flag] of FLAG_RULES) if (re.test(text)) return flag;
    return '';
  }
  function flagged(text) {
    const f = flagFor(text);
    return f ? h('span', null, h('span', { class: 'flag', 'aria-hidden': 'true' }, f), text) : text;
  }

  /* ---------- Map: jurisdiction -> ISO3 for the world map ---------- */
  const EU27 = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'];
  const ISO_RULES = [
    [/european union/i, EU27],
    [/\bunited states\b/i, ['USA']],
    [/\bchina\b/i, ['CHN']],
    [/\bjapan\b/i, ['JPN']],
    [/south korea|republic of korea/i, ['KOR']],
    [/\bindia\b/i, ['IND']],
    [/\bbrazil\b/i, ['BRA']],
    [/\bpakistan\b/i, ['PAK']],
    [/united kingdom/i, ['GBR']],
    [/\bcanada\b/i, ['CAN']],
    [/\bfrance\b/i, ['FRA']],
    [/\bgermany\b/i, ['DEU']],
    [/\bsingapore\b/i, ['SGP']],
    [/\baustralia\b/i, ['AUS']],
    [/\bnetherlands\b/i, ['NLD']]
  ];
  function isoFor(jurisdiction) {
    for (const [re, isos] of ISO_RULES) if (re.test(jurisdiction || '')) return isos;
    return [];
  }
  let WORLD = [];

  /* ---------- Theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    $('#theme-toggle').addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  }

  const state = {
    view: 'register',
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

  // Small DOM helper. All text goes through textContent, so data can never inject markup.
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

  function announce(msg) {
    const live = $('#live');
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 30);
  }

  /* ---------- Filtering ---------- */

  function matches(i, skip) {
    const f = state.f;
    if (skip !== 'category' && f.category.size && !f.category.has(i.category)) return false;
    if (f.binding.size && !f.binding.has(i.binding)) return false;
    if (f.region.size && !f.region.has(i.region)) return false;
    if (f.domain.size && ![...f.domain].some((d) => i.domain === d || i.domain === 'both')) return false;
    if (state.q.trim()) {
      const hay = [i.title, i.short, i.summary, i.jurisdiction, i.kind, (i.sectors || []).join(' '), (i.key_points || []).join(' ')]
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
    $('#q').value = '';
  }

  /* ---------- Routing ---------- */

  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
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

  /* ---------- Nav ---------- */

  function buildNav() {
    VIEWS = ['register', 'map', ...SECTIONS.sections.map((s) => s.id), 'timeline', 'compare', 'glossary', 'about'];
    $('#nav').replaceChildren(...VIEWS.map((id) => {
      const sec = SECTIONS.sections.find((s) => s.id === id);
      const label = NAV_LABEL[id] || (sec && sec.nav) || id;
      return h('a', { href: '#/' + id, dataset: { view: id }, text: label });
    }));
  }

  /* ---------- Reference sections (from the compiled framework note) ---------- */

  function catClass(label) {
    const t = (label || '').toLowerCase();
    if (t.startsWith('hard law')) return 'hard_law';
    if (t.startsWith('soft law')) return 'soft_law';
    if (t.includes('standard')) return 'standard';
    if (t.includes('industry')) return 'industry';
    return 'process';
  }

  function renderBlock(b) {
    if (b.type === 'text') {
      return h('div', { class: 'block' },
        b.title ? h('h3', { text: (b.number ? b.number + '. ' : '') + b.title }) : null,
        b.paragraphs.map((p) => h('p', { text: p })));
    }
    if (b.type === 'bullets') {
      return h('div', { class: 'block' },
        b.title ? h('h3', { text: (b.number ? b.number + '. ' : '') + b.title }) : null,
        h('ul', null, b.items.map((i) => h('li', { text: i }))));
    }
    if (b.type === 'note') return h('div', { class: 'status-note block', text: b.text });
    if (b.type === 'table') {
      const checkCol = b.linkColumn || 0;
      const compareable = b.rows.some((r) => r.ref && byId(r.ref));
      const rows = b.rows.map((r) => {
        const cells = r.cells.map((c, i) => {
          const inLink = b.linkColumn === i && r.ref && byId(r.ref);
          let content = c;
          if (b.flagColumn === i) content = flagged(c);
          else if (inLink) content = h('a', { href: `#/register/${r.ref}`, text: c });
          const td = h('td', null,
            content,
            (r.check && i === checkCol) ? h('div', { class: 'cell-check' }, h('span', { 'aria-hidden': 'true' }, '⚠ '), r.check) : null);
          if (b.tagColumn === i) { td.classList.add('tag-cell'); td.dataset.cat = catClass(c); }
          return td;
        });
        if (compareable) {
          const item = r.ref && byId(r.ref);
          cells.unshift(h('td', { class: 'pick-col' }, item ? h('input', {
            type: 'checkbox', checked: state.compare.includes(item.id), 'aria-label': `Select ${item.title} for comparison`,
            onchange: (e) => {
              if (e.target.checked) {
                if (state.compare.length >= MAX_COMPARE) { e.target.checked = false; announce(`You can compare up to ${MAX_COMPARE} entries.`); return; }
                state.compare.push(item.id);
              } else {
                state.compare = state.compare.filter((x) => x !== item.id);
              }
              renderTray();
            }
          }) : null));
        }
        return h('tr', null, cells);
      });
      return h('div', { class: 'block' },
        (b.title || b.number) ? h('h3', { text: (b.number ? b.number + '. ' : '') + (b.title || '') }) : null,
        h('div', { class: 'tablewrap' }, h('table', null,
          h('thead', null, h('tr', null, compareable ? h('th', { class: 'pick-col', scope: 'col' }, h('span', { class: 'sr', text: 'Compare' })) : null,
            b.columns.map((col) => h('th', { scope: 'col', text: col })))),
          h('tbody', null, rows))));
    }
    return null;
  }

  function renderSection(main, sec) {
    main.replaceChildren(h('div', { class: 'prose section-page' },
      h('div', { class: 'sec-head' }, sec.number ? h('span', { class: 'sec-num', text: sec.number }) : null, h('h2', { class: 'h2', text: sec.title })),
      sec.intro ? h('p', { class: 'lede', text: sec.intro }) : null,
      sec.blocks.map(renderBlock),
      SECTIONS.source_note ? h('p', { class: 'sec-source', text: SECTIONS.source_note }) : null));
  }

  /* ---------- Sidebar, spectrum, tray ---------- */

  function buildFilters() {
    const regions = [...new Set(DATA.map((d) => d.region))].sort();
    const groups = [
      { key: 'category', title: 'Type', opts: Object.keys(LABEL.category), label: (v) => LABEL.category[v] },
      { key: 'domain', title: 'Domain', opts: ['civil', 'military'], label: (v) => LABEL.domain[v] },
      { key: 'binding', title: 'Legal force', opts: Object.keys(LABEL.binding), label: (v) => LABEL.binding[v] },
      { key: 'region', title: 'Region', opts: regions, label: (v) => v }
    ];
    const root = $('#filters');
    root.replaceChildren(...groups.map((g) =>
      h('fieldset', null,
        h('legend', { text: g.title }),
        h('div', { class: 'chips' }, g.opts.map((v) =>
          h('button', {
            type: 'button', class: 'chip', 'aria-pressed': 'false', text: g.label(v),
            dataset: { group: g.key, value: v },
            onclick: () => {
              const set = state.f[g.key];
              set.has(v) ? set.delete(v) : set.add(v);
              afterFilterChange();
            }
          })
        ))
      )
    ));
  }

  function afterFilterChange() {
    if (!['register', 'timeline'].includes(state.view)) { go('register'); return; }
    if (state.view === 'register' && state.open) {
      history.replaceState(null, '', '#/register');
      state.open = null;
    }
    syncUI({});
  }

  function syncChips() {
    document.querySelectorAll('.chip').forEach((c) => {
      c.setAttribute('aria-pressed', String(state.f[c.dataset.group].has(c.dataset.value)));
    });
  }

  function renderSpectrum() {
    const root = $('#spectrum');
    const counts = {};
    Object.keys(LABEL.category).forEach((k) => { counts[k] = 0; });
    DATA.filter((i) => matches(i, 'category')).forEach((i) => { counts[i.category]++; });
    root.classList.toggle('has-selection', state.f.category.size > 0);
    root.replaceChildren(...Object.keys(LABEL.category).map((k) =>
      h('button', {
        type: 'button', class: 'seg', dataset: { cat: k },
        'aria-pressed': String(state.f.category.has(k)),
        style: `flex-grow:${Math.max(counts[k], 1)}`,
        onclick: () => {
          const s = state.f.category;
          s.has(k) ? s.delete(k) : s.add(k);
          afterFilterChange();
        }
      }, LABEL.category[k], h('small', { text: `${counts[k]} ${counts[k] === 1 ? 'entry' : 'entries'}` }))
    ));
  }

  function renderTray() {
    const tray = $('#tray');
    tray.hidden = state.compare.length === 0;
    $('#tray-items').replaceChildren(...state.compare.map((id) => h('span', { class: 'tray-chip', text: byId(id).title })));
    $('#tray-compare').disabled = state.compare.length < 2;
  }

  /* ---------- Views ---------- */

  function tag(i) {
    return h('div', { class: 'tags' },
      h('span', { class: 'tag-cat', text: LABEL.category[i.category] }),
      h('span', { class: 'bind', dataset: { b: i.binding } }, h('i', { 'aria-hidden': 'true' }), LABEL.binding[i.binding]),
      h('span', { text: LABEL.domain[i.domain] })
    );
  }

  function sourceBlock(i) {
    return h('p', { class: 'source' },
      i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener noreferrer', text: 'Read the primary source' })
            : h('span', { class: 'badge', text: 'No source link added yet' }));
  }

  function detail(i) {
    const rel = (i.related || []).map(byId).filter(Boolean);
    return h('div', { class: 'detail', id: 'd-' + i.id, hidden: state.open !== i.id },
      h('p', { class: 'summary', text: i.summary }),
      i.key_points && i.key_points.length ? [h('h3', { text: 'Key points' }), h('ul', null, i.key_points.map((k) => h('li', { text: k })))] : null,
      i.status_note ? h('div', { class: 'status-note' }, h('strong', { text: LABEL.status[i.status] + '. ' }), i.status_note) : null,
      h('dl', { class: 'facts' },
        h('dt', { text: 'Form' }), h('dd', { text: i.kind }),
        h('dt', { text: 'Jurisdiction' }), h('dd', null, flagged(i.jurisdiction), ` \u2014 level: ${LABEL.level[i.level].toLowerCase()}.`),
        h('dt', { text: 'Sectors' }), h('dd', { text: (i.sectors || []).join(', ') || 'Not specified' })
      ),
      rel.length ? [h('h3', { text: 'Related entries' }), h('div', { class: 'rel' }, rel.map((r) =>
        h('a', { class: 'badge', href: `#/register/${r.id}`, text: r.title })))] : null,
      sourceBlock(i),
      h('p', null,
        i.last_verified ? h('span', { class: 'badge', text: 'Checked ' + i.last_verified })
                        : h('span', { class: 'badge warn', text: 'Not yet checked against the primary source' }),
        ' ',
        i.verify ? h('span', { class: 'badge warn', text: 'Status changes quickly, so check for updates' }) : null)
    );
  }

  function entryEl(i) {
    const open = state.open === i.id;
    return h('li', { class: 'entry', dataset: { cat: i.category, id: i.id } },
      h('div', { class: 'entry-head' },
        h('label', { class: 'pick' },
          h('input', {
            type: 'checkbox', checked: state.compare.includes(i.id), 'aria-label': `Select ${i.title} for comparison`,
            onchange: (e) => {
              if (e.target.checked) {
                if (state.compare.length >= MAX_COMPARE) {
                  e.target.checked = false;
                  announce(`You can compare up to ${MAX_COMPARE} entries.`);
                  return;
                }
                state.compare.push(i.id);
              } else {
                state.compare = state.compare.filter((x) => x !== i.id);
              }
              renderTray();
            }
          })),
        h('button', {
          type: 'button', class: 'entry-toggle', 'aria-expanded': String(open), 'aria-controls': 'd-' + i.id,
          dataset: { id: i.id }, onclick: () => toggleEntry(i.id)
        },
          h('span', null,
            h('span', { class: 'entry-title', text: i.title }),
            h('span', { class: 'entry-short', text: i.short }),
            tag(i)),
          h('span', { class: 'meta' }, h('span', { class: 'who' }, flagged(i.jurisdiction)), h('br'), i.year))
      ),
      detail(i)
    );
  }

  function toggleEntry(id) {
    state.open = state.open === id ? null : id;
    history.replaceState(null, '', '#/register' + (state.open ? '/' + state.open : ''));
    renderMain({ focusId: id });
  }

  function renderRegister(main, opts) {
    const items = sorted(DATA.filter((i) => matches(i)));
    const sortSel = h('select', {
      id: 'sort', 'aria-label': 'Sort entries',
      onchange: (e) => { state.sort = e.target.value; renderMain({ focusSort: true }); }
    }, [['year_desc', 'Newest first'], ['year_asc', 'Oldest first'], ['title', 'Title A to Z'], ['jurisdiction', 'Jurisdiction']]
      .map(([v, t]) => h('option', { value: v, text: t, selected: state.sort === v })));

    main.replaceChildren(
      h('div', { class: 'toolbar' },
        h('p', { class: 'count', text: `${items.length} of ${DATA.length} entries` }), sortSel),
      items.length
        ? h('ul', { class: 'register' }, items.map(entryEl))
        : h('div', { class: 'empty' }, h('h2', { text: 'No entries match these filters' }),
            h('p', { text: 'Remove a filter or shorten your search to see more.' }),
            h('button', { type: 'button', class: 'btn', text: 'Clear all filters', onclick: () => { resetFilters(); syncUI({}); } }))
    );
    announce(`${items.length} entries shown`);

    if (opts.focusId) {
      const b = main.querySelector(`.entry-toggle[data-id="${opts.focusId}"]`);
      if (b) b.focus();
    }
    if (opts.focusSort) $('#sort').focus();
    if (opts.scrollToOpen && state.open) {
      const el = main.querySelector(`.entry[data-id="${state.open}"]`);
      if (el) { el.scrollIntoView({ block: 'start' }); el.querySelector('.entry-toggle').focus({ preventScroll: true }); }
    }
  }

  function renderTimeline(main) {
    const all = DATA.filter((i) => matches(i));
    const items = all.filter((i) => i.year);
    const undated = all.length - items.length;
    const years = [...new Set(items.map((i) => i.year))].sort((a, b) => a - b);
    main.replaceChildren(
      h('h2', { class: 'h2', text: 'Timeline' }),
      h('p', { class: 'lede', text: 'When each instrument or process began, by year. Select an entry to open it in the register.' }),
      undated ? h('p', { class: 'count', text: `${undated} matching ${undated === 1 ? 'entry has' : 'entries have'} no clear year and are not shown here; see the register.` }) : null,
      h('div', { class: 'legend' }, Object.keys(LABEL.category).map((k) =>
        h('span', { style: `--c: var(--${k === 'hard_law' ? 'hard' : k === 'soft_law' ? 'soft' : k})`, text: LABEL.category[k] }))),
      items.length ? h('ol', { class: 'tl' }, years.map((y) =>
        h('li', { class: 'tl-year' },
          h('h2', { text: y }),
          h('ul', { class: 'tl-items' }, sorted(items.filter((i) => i.year === y)).map((i) =>
            h('li', { class: 'tl-item', dataset: { cat: i.category } },
              h('button', { type: 'button', onclick: () => go('register', i.id) },
                h('span', { class: 't', text: i.title }),
                h('span', { class: 's' }, h('br'), `${i.jurisdiction}. ${LABEL.binding[i.binding]}.`)))))
        ))) : h('div', { class: 'empty' }, h('h2', { text: 'No entries match these filters' }))
    );
  }

  function renderCompare(main) {
    const items = state.compare.map(byId).filter(Boolean);
    if (items.length < 2) {
      main.replaceChildren(
        h('h2', { class: 'h2', text: 'Compare' }),
        h('p', { class: 'lede', text: 'Select two or three entries in the register, then choose Compare, to see them side by side.' }),
        h('a', { class: 'btn', href: '#/register', text: 'Go to the register', style: 'text-decoration:none;display:inline-block' }));
      return;
    }
    const rows = [
      ['Type', (i) => LABEL.category[i.category]],
      ['Legal force', (i) => LABEL.binding[i.binding]],
      ['Status', (i) => [h('strong', { text: LABEL.status[i.status] }), i.status_note ? h('div', { text: i.status_note }) : null]],
      ['Jurisdiction', (i) => i.jurisdiction],
      ['Year', (i) => String(i.year)],
      ['Domain', (i) => LABEL.domain[i.domain]],
      ['Sectors', (i) => (i.sectors || []).join(', ') || 'Not specified'],
      ['Summary', (i) => i.summary],
      ['Key points', (i) => h('ul', null, (i.key_points || []).map((k) => h('li', { text: k })))],
      ['Source', (i) => i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener noreferrer', text: 'Primary source' }) : 'No source link added yet']
    ];
    main.replaceChildren(
      h('h2', { class: 'h2', text: 'Compare' }),
      h('p', { class: 'lede', text: 'Side-by-side view of the entries you selected.' }),
      h('div', { class: 'tablewrap cmp' }, h('table', null,
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: '' }),
          items.map((i) => h('th', { scope: 'col' }, h('a', { href: `#/register/${i.id}`, text: i.title }))))),
        h('tbody', null, rows.map(([label, fn]) =>
          h('tr', null, h('th', { scope: 'row', text: label }), items.map((i) => h('td', null, fn(i)))))))),
      h('p', null, h('button', { type: 'button', class: 'link-btn', text: 'Clear selection', onclick: () => { state.compare = []; renderTray(); syncUI({}); } }))
    );
  }

  function renderGlossary(main) {
    main.replaceChildren(
      h('h2', { class: 'h2', text: 'Glossary' }),
      h('p', { class: 'lede', text: 'Key terms in plain language, and why each one matters when reading AI laws and negotiating texts.' }),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Term', 'Plain-language definition', 'Why it matters'].map((t) => h('th', { scope: 'col', text: t })))),
        h('tbody', null, GLOSSARY.map((g) => h('tr', null,
          h('td', { class: 'term', text: g.term }), h('td', { text: g.definition }), h('td', { text: g.why }))))))
    );
  }

  function renderAbout(main) {
    main.replaceChildren(h('div', { class: 'prose' },
      h('h2', { class: 'h2', text: 'About this register' }),
      h('p', { text: 'This register brings AI governance instruments into one searchable place: binding laws, non-binding instruments, technical standards and ongoing international processes, for both civilian and military uses of AI.' }),
      h('h2', { text: 'Reference sections' }),
      h('p', { text: 'Civilian AI, Military AI, Industry and National and regional lay out a fuller narrative than the register: consolidated tables, the UN resolution tracks with vote counts, and the two competing coalitions in military AI governance. Rows link through to the matching register entry where one exists, and rows flagged with a warning have not been independently checked yet.' }),
      h('h2', { text: 'How entries are classified' }),
      h('ul', null,
        h('li', null, h('strong', { text: 'Hard law: ' }), 'treaties, statutes, regulations and executive orders that create binding obligations.'),
        h('li', null, h('strong', { text: 'Soft law: ' }), 'declarations, principles, policies, resolutions and codes that are not legally binding.'),
        h('li', null, h('strong', { text: 'Standard: ' }), 'technical or management standards, usually voluntary unless a law or contract requires them.'),
        h('li', null, h('strong', { text: 'Process: ' }), 'ongoing negotiations, working groups and summit series that produce or shape the other three.')),
      h('p', { text: 'Legal force is shown separately, because a hard-law instrument can be adopted but not yet in force, and a soft-law text can still carry weight in practice.' }),
      h('h2', { text: 'Data quality' }),
      h('p', { text: 'Each entry shows whether a maintainer has checked it against the primary source, and flags entries whose status changes quickly. Entries marked as not yet checked should be confirmed before you rely on them.' }),
      h('h2', { text: 'Contributing' }),
      h('p', null, 'Maintainers add and correct entries through the admin page. Others can propose changes by editing ', h('code', { text: 'site/data/instruments.json' }), ' and opening a pull request. Please cite the official text or an official page.'),
      h('h2', { text: 'Limits' }),
      h('p', { text: 'This is a reference aid, not legal advice. Summaries are simplified, and the primary text always prevails.' })
    ));
  }

  /* ---------- Map ---------- */

  function renderMap(main) {
    const index = {};
    DATA.forEach((i) => { isoFor(i.jurisdiction).forEach((iso) => { (index[iso] = index[iso] || []).push(i); }); });
    const iso3s = Object.keys(index);
    const byIso = (iso) => WORLD.find((w) => w.iso3 === iso) || { name: iso, iso3: iso, d: null };

    const svgHolder = h('div', { class: 'map-svg-holder', id: 'map-svg-holder' });
    const tip = h('div', { class: 'map-tip', id: 'map-tip' });
    const results = h('div', { class: 'map-results', id: 'map-results' },
      h('p', { class: 'count', text: 'Select a highlighted country above, or pick one from the list below.' }));
    const indexList = h('div', { class: 'map-list', id: 'map-list' });

    main.replaceChildren(
      h('h2', { class: 'h2', text: 'Map' }),
      h('p', { class: 'lede', text: 'Countries and the European Union with at least one national law, policy or strategy on record. Select a highlighted country \u2014 on the map or in the list below \u2014 to see its entries.' }),
      h('div', { class: 'map-wrap' },
        svgHolder, tip,
        h('div', { class: 'map-legend' },
          h('span', { class: 'sw' }, h('i', { style: 'background:var(--accent);opacity:.6' }), `${iso3s.length} jurisdictions on record`),
          h('span', { class: 'sw' }, h('i', { style: 'background:var(--wash)' }), 'Nothing on record yet'))),
      results, indexList
    );

    function showResults(c, entries) {
      results.replaceChildren(
        h('h3', null, flagged(c.name)),
        h('ul', null, entries.map((i) => h('li', null, h('a', { href: `#/register/${i.id}`, text: i.title }), ` \u2014 ${LABEL.category[i.category]}, ${LABEL.binding[i.binding]}`))));
      results.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (!WORLD.length) {
      svgHolder.replaceChildren(h('div', { class: 'map-status', text: 'Map data could not be loaded.' }));
    } else {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 960 500');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'World map. Highlighted countries have at least one AI governance entry on record.');
      WORLD.forEach((c) => {
        if (!c.d) return;
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', c.d);
        path.setAttribute('class', 'map-country');
        path.dataset.iso3 = c.iso3;
        const entries = index[c.iso3];
        if (entries && entries.length) {
          path.dataset.has = '1';
          path.addEventListener('mouseenter', (e) => showTip(c, entries, e));
          path.addEventListener('mousemove', moveTip);
          path.addEventListener('mouseleave', hideTip);
          path.addEventListener('click', () => selectCountry(c.iso3));
        }
        svg.appendChild(path);
      });
      svgHolder.replaceChildren(svg);

      function showTip(c, entries, e) {
        tip.style.display = 'block';
        tip.replaceChildren(h('strong', null, flagged(c.name)), h('span', { text: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} \u2014 select to view` }));
        moveTip(e);
      }
      function moveTip(e) {
        const rect = svgHolder.getBoundingClientRect();
        tip.style.left = Math.min(e.clientX - rect.left + 14, rect.width - 200) + 'px';
        tip.style.top = (e.clientY - rect.top + 14) + 'px';
      }
      function hideTip() { tip.style.display = 'none'; }
      function selectCountry(iso) {
        svg.querySelectorAll('.map-country.is-active').forEach((p) => p.classList.remove('is-active'));
        const el = svg.querySelector(`path[data-iso3="${iso}"]`);
        if (el) el.classList.add('is-active');
        showResults(byIso(iso), index[iso]);
      }
      indexList.selectCountry = selectCountry;
    }

    const sortedIso = [...iso3s].sort((a, b) => byIso(a).name.localeCompare(byIso(b).name));
    indexList.replaceChildren(
      h('h3', { text: 'All jurisdictions on record' }),
      h('div', { class: 'chips' }, sortedIso.map((iso) => {
        const c = byIso(iso);
        return h('button', {
          type: 'button', class: 'chip',
          onclick: () => { if (indexList.selectCountry) indexList.selectCountry(iso); else showResults(c, index[iso]); }
        }, flagged(c.name), h('span', { class: 'count', text: ` (${index[iso].length})` }));
      }))
    );
  }

  /* ---------- Orchestration ---------- */

  function renderMain(opts = {}) {
    const main = $('#main');
    const sec = SECTIONS.sections.find((s) => s.id === state.view);
    if (state.view === 'register') renderRegister(main, opts);
    else if (state.view === 'map') renderMap(main);
    else if (state.view === 'timeline') renderTimeline(main);
    else if (state.view === 'compare') renderCompare(main);
    else if (state.view === 'glossary') renderGlossary(main);
    else if (state.view === 'about') renderAbout(main);
    else if (sec) renderSection(main, sec);
    else renderAbout(main);
  }

  function syncUI(opts) {
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.view === state.view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('#layout').classList.toggle('no-side', !SIDEBAR_VIEWS.includes(state.view));
    $('#spectrum').hidden = !SIDEBAR_VIEWS.includes(state.view);
    syncChips();
    renderSpectrum();
    renderTray();
    renderMain(opts);
    const sec = SECTIONS.sections.find((s) => s.id === state.view);
    const label = sec ? sec.title : NAV_LABEL[state.view] || state.view;
    document.title = state.view === 'register' && state.open
      ? `${byId(state.open).title} | AI Law Register`
      : `${label} | AI Law Register`;
  }

  function showError(err) {
    $('#main').replaceChildren(h('div', { class: 'empty' },
      h('h2', { text: 'The data could not be loaded' }),
      h('p', { text: 'Browsers block data files when a page is opened directly from disk. Serve the site through a local web server, or open the published GitHub Pages address.' }),
      h('p', null, 'From the project folder, run ', h('code', { text: 'python -m http.server -d site 8000' }), ' and open ', h('code', { text: 'http://localhost:8000' }), '.'),
      h('p', { class: 'count', text: String(err) })));
  }

  async function init() {
    try {
      const [inst, gloss, sections, world] = await Promise.all([
        fetch('data/instruments.json').then((r) => { if (!r.ok) throw new Error('instruments.json: HTTP ' + r.status); return r.json(); }),
        fetch('data/glossary.json').then((r) => { if (!r.ok) throw new Error('glossary.json: HTTP ' + r.status); return r.json(); }),
        fetch('data/sections.json').then((r) => { if (!r.ok) throw new Error('sections.json: HTTP ' + r.status); return r.json(); }),
        fetch('data/world-map.json').then((r) => { if (!r.ok) throw new Error('world-map.json: HTTP ' + r.status); return r.json(); }).catch(() => [])
      ]);
      DATA = inst;
      GLOSSARY = gloss;
      SECTIONS = sections;
      WORLD = world;
    } catch (err) {
      showError(err);
      return;
    }

    buildNav();
    buildFilters();
    initTheme();
    $('#q').addEventListener('input', (e) => {
      state.q = e.target.value;
      if (state.view === 'register' && state.open) { state.open = null; history.replaceState(null, '', '#/register'); }
      renderSpectrum();
      renderMain({});
    });
    $('#clear-filters').addEventListener('click', () => { resetFilters(); syncUI({}); });
    $('#tray-compare').addEventListener('click', () => go('compare'));
    $('#tray-clear').addEventListener('click', () => {
      state.compare = [];
      syncUI({});
    });
    window.addEventListener('hashchange', onHash);

    if (window.matchMedia('(max-width: 860px)').matches) $('.side-details').open = false;

    parseHash();
    syncUI({ scrollToOpen: state.view === 'register' && !!state.open });
  }

  init();
})();
