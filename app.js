/* =====================================================================
   Sports Intelligence Terminal - app.js
   Core: centralized state (appState), persistence, AI paper-trading
   account, bet settlement, notifications, UI components, charts,
   router and event handling. Page views live in views.js.
   ===================================================================== */
(function () {
  'use strict';
  const SIT = window.SIT, D = SIT.Data, E = SIT.Engine, U = SIT.util;
  const STORE_KEY = 'sit.state.v1';
  const ALL_SPORTS = Object.keys(D.SPORTS);
  const HISTORY_DAYS = 60; // length of generated AI / user demo history

  /* ---------------- i18n (English now, structure ready for Ukrainian) ---------------- */
  const I18N = {
    en: {
      dashboard: 'Dashboard', scanner: 'Scanner', opportunities: 'Opportunities', live: 'Live', news: 'News', analytics: 'Analytics',
      ai: 'AI Analyst', 'ai-journal': 'AI Journal', journal: 'Bet Journal', settings: 'Settings', match: 'Match', more: 'More',
      searchPh: 'Search teams, players, leagues', demo: 'Demo data', scanBtn: 'Scan the market', runAi: 'Run AI scan'
    },
    uk: {} // add Ukrainian strings here; missing keys fall back to English
  };

  /* ---------------- state ---------------- */
  function todayStr() { return U.dateStr(SIT.clock.now()); }
  function defaultState() {
    return {
      version: 1,
      user: { name: 'You', startingBankroll: 500 },
      ai: { startingBankroll: 1000, lastScan: 0, autoScan: true, createdAt: Date.now() },
      bets: { ai: [], user: [] },
      seq: { ai: 0, user: 0 },
      matches: {}, // runtime: provided by SIT.Data (not persisted)
      news: {},    // runtime: provided by SIT.Data (not persisted)
      analytics: { range: 'ALL', src: 'all', sport: 'all', league: 'all', market: 'all', odds: 'all', result: 'all', tab: 'global' },
      settings: {
        currency: 'EUR', timezone: 'local', sports: ALL_SPORTS.slice(), leagues: [], risk: 'balanced', theme: 'dark', lang: 'en', clockOffset: 0,
        notif: { news: true, start: true, aiBet: true, aiSettle: true, odds: true, model: true }
      },
      ui: {
        scanner: { q: '', sport: 'all', date: 'today', league: 'all', country: 'all', status: 'all', conf: '0', market: 'all', sort: 'time', interest: '0', window: 'all' },
        aiRange: 'ALL', oppTab: 'all', vfMin: '3', newsSport: 'all', newsImpact: 'all',
        aiJ: { q: '', status: 'all', sport: 'all', market: 'all', limit: 40, sort: 'date', dir: 'desc' },
        uJ: { status: 'all' },
        matchTab: {}, matchSel: {}, sorts: {}
      },
      notifications: [],
      notified: {}
    };
  }
  function merge(def, saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return saved === undefined ? def : saved;
    const out = Array.isArray(def) ? def : Object.assign({}, def);
    Object.keys(saved).forEach((k) => { out[k] = def && typeof def[k] === 'object' && def[k] && !Array.isArray(def[k]) ? merge(def[k], saved[k]) : saved[k]; });
    return out;
  }
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) return merge(defaultState(), JSON.parse(raw)); } catch (e) { console.warn('State load failed', e); }
    return defaultState();
  }
  const S = load();
  SIT.appState = S;
  SIT.clock.offset = S.settings.clockOffset || 0;

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const { matches, news, ...persist } = S;
        persist.notifications = S.notifications.slice(0, 80);
        localStorage.setItem(STORE_KEY, JSON.stringify(persist));
      } catch (e) { toast('Could not save locally: ' + e.message, 'neg'); }
    }, 250);
  }

  const t = (k) => (I18N[S.settings.lang] && I18N[S.settings.lang][k]) || I18N.en[k] || k;

  /* ---------------- formatting ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tz = () => (S.settings.timezone === 'local' ? undefined : S.settings.timezone);
  function money(v, signed) {
    const s = new Intl.NumberFormat('en-GB', { style: 'currency', currency: S.settings.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v || 0));
    return (v < -0.004 ? '-' : signed && v > 0.004 ? '+' : '') + s;
  }
  const pct = (x, d = 1) => (x == null || isNaN(x) ? '-' : (x * 100).toFixed(d) + '%');
  const pp = (x, d = 1) => (x == null || isNaN(x) ? '-' : (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + ' pp');
  const signed = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
  const odds = (o) => (o == null ? '-' : Number(o).toFixed(2));
  function time(ts) { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz() }).format(ts); }
  function dayLabel(ts) {
    const ds = U.dateStr(ts), td = todayStr();
    if (ds === td) return 'Today'; if (ds === U.addDays(td, 1)) return 'Tomorrow'; if (ds === U.addDays(td, -1)) return 'Yesterday';
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: tz() }).format(ts);
  }
  const dateTime = (ts) => dayLabel(ts) + ' ' + time(ts);
  function ago(ts) {
    const d = (SIT.clock.now() - ts) / 60000;
    if (d < 1) return 'just now'; if (d < 60) return Math.floor(d) + 'm ago'; if (d < 1440) return Math.floor(d / 60) + 'h ago';
    return Math.floor(d / 1440) + 'd ago';
  }
  const plClass = (v) => (v > 0.004 ? 'pos' : v < -0.004 ? 'neg' : 'flat');
  const round2 = (x) => Math.round(x * 100) / 100;

  /* ---------------- icons ---------------- */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    scanner: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/>',
    opportunities: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    live: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    news: '<path d="M4 4h13v16H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v10a2 2 0 0 1-2 2"/><path d="M8 8h5M8 12h5M8 16h3"/>',
    analytics: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    ai: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    'ai-journal': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
    journal: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>', chevL: '<path d="M15 18l-6-6 6-6"/>', chevR: '<path d="M9 18l6-6-6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    ff: '<path d="M13 19l9-7-9-7zM2 19l9-7-9-7z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    sort: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'
  };
  const icon = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

  /* ---------------- small UI atoms ---------------- */
  const sportTag = (sp) => '<span class="sp sp-' + sp + '" data-tip="' + esc(D.SPORTS[sp].name) + '">' + D.SPORTS[sp].code + '</span>';
  const demoTag = (txt) => '<span class="demo-tag" data-tip="Generated demonstration data. Not real events or statistics.">' + (txt || 'Demo') + '</span>';
  const confTag = (c) => '<span class="cf cf-' + c.level.toLowerCase() + '" data-tip="Model confidence: ' + c.value + '/100 (' + c.level + '). Internal estimate based on data completeness and signal agreement.">' + c.value + '</span>';
  const confTagRaw = (v, level) => confTag({ value: v, level: level || (v >= 66 ? 'High' : v >= 50 ? 'Medium' : 'Low') });
  const riskTag = (lvl) => '<span class="rk rk-' + lvl.toLowerCase() + '">' + lvl + ' risk</span>';
  const impactTag = (lvl) => '<span class="imp imp-' + lvl.toLowerCase() + '">' + lvl + ' IMPACT</span>';
  const valTag = (v) => '<span class="val ' + (v > 0 ? 'pos' : 'neg') + '">' + pp(v) + '</span>';
  function statusTag(m) {
    const st = D.status(m);
    if (st === 'live') { const l = D.live(m); return '<span class="st st-live"><i></i>' + esc(l.label) + '</span>'; }
    if (st === 'finished') return '<span class="st st-ft">' + esc(D.live(m).label) + '</span>';
    return '<span class="st st-up">' + time(m.start) + '</span>';
  }
  function scoreHtml(m) {
    const st = D.status(m); if (st === 'upcoming') return '';
    const l = D.live(m); if (l.h == null) return '<span class="sc">-</span>';
    return '<span class="sc ' + (st === 'live' ? 'sc-live' : '') + '"><b>' + l.h + '</b><b>' + l.a + '</b></span>';
  }
  const empty = (title, body, action) => '<div class="empty"><div class="empty-t">' + esc(title) + '</div><div class="empty-b">' + esc(body) + '</div>' + (action || '') + '</div>';
  const kpi = (label, value, sub, cls, tip) => '<div class="kpi ' + (cls || '') + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '><div class="kpi-l">' + esc(label) + '</div><div class="kpi-v">' + value + '</div>' + (sub ? '<div class="kpi-s">' + sub + '</div>' : '') + '</div>';

  /* ---------------- dropdowns + date picker ---------------- */
  let ddReg = {};
  function dd(id, opts, value, onSelect, o) {
    o = o || {};
    ddReg[id] = onSelect;
    const cur = opts.find((x) => String(x.v) === String(value)) || opts[0];
    return '<div class="dd ' + (o.cls || '') + '" data-dd="' + id + '"><button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false" data-act="dd-toggle" data-id="' + id + '">' +
      (o.label ? '<span class="dd-lbl">' + esc(o.label) + '</span>' : '') + '<span class="dd-val">' + esc(cur ? cur.l : '') + '</span>' + icon('chevD', 'dd-chev') + '</button>' +
      '<div class="dd-menu" role="listbox" aria-label="' + esc(o.label || id) + '">' + (o.label ? '<div class="dd-head">' + esc(o.label) + '</div>' : '') +
      opts.map((x) => '<button type="button" role="option" aria-selected="' + (String(x.v) === String(value)) + '" class="dd-opt ' + (String(x.v) === String(value) ? 'on' : '') + '" data-act="dd-pick" data-id="' + id + '" data-v="' + esc(String(x.v)) + '"' + (x.disabled ? ' disabled' : '') + '><span>' + esc(x.l) + '</span>' + (x.n != null ? '<span class="dd-n">' + x.n + '</span>' : '') + (String(x.v) === String(value) ? icon('check', 'dd-ck') : '') + '</button>').join('') +
      '</div></div>';
  }
  let dpMonth = null;
  function datePicker(id, value, onSelect) {
    ddReg[id] = onSelect;
    const td = todayStr();
    const label = value === 'today' ? 'Today' : value === 'tomorrow' ? 'Tomorrow' : value === 'all' ? 'Next 3 days' : dayLabel(U.parseDate(value).getTime());
    const base = dpMonth || U.parseDate(value === 'today' || value === 'all' ? td : value === 'tomorrow' ? U.addDays(td, 1) : value);
    const y = base.getFullYear(), mo = base.getMonth();
    const first = new Date(y, mo, 1); const startDow = (first.getDay() + 6) % 7; const days = new Date(y, mo + 1, 0).getDate();
    const min = U.addDays(td, -HISTORY_DAYS), max = U.addDays(td, 3);
    const sel = value === 'today' ? td : value === 'tomorrow' ? U.addDays(td, 1) : value;
    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const ds = U.dateStr(new Date(y, mo, d)); const dis = ds < min || ds > max;
      cells += '<button type="button" class="dp-d ' + (ds === sel ? 'on ' : '') + (ds === td ? 'td ' : '') + '" ' + (dis ? 'disabled' : '') + ' data-act="dd-pick" data-id="' + id + '" data-v="' + ds + '">' + d + '</button>';
    }
    return '<div class="dd dp" data-dd="' + id + '"><button type="button" class="dd-btn" aria-haspopup="dialog" aria-expanded="false" data-act="dd-toggle" data-id="' + id + '">' + icon('calendar') + '<span class="dd-val">' + esc(label) + '</span>' + icon('chevD', 'dd-chev') + '</button>' +
      '<div class="dd-menu dp-menu" role="dialog" aria-label="Choose date"><div class="dp-quick">' +
      [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['all', 'Next 3 days']].map(([v, l]) => '<button type="button" class="chip ' + (value === v ? 'on' : '') + '" data-act="dd-pick" data-id="' + id + '" data-v="' + v + '">' + l + '</button>').join('') +
      '</div><div class="dp-head"><button type="button" class="ib" data-act="dp-nav" data-d="-1" aria-label="Previous month">' + icon('chevL') + '</button><b>' + new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(first) + '</b><button type="button" class="ib" data-act="dp-nav" data-d="1" aria-label="Next month">' + icon('chevR') + '</button></div>' +
      '<div class="dp-grid"><i>Mo</i><i>Tu</i><i>We</i><i>Th</i><i>Fr</i><i>Sa</i><i>Su</i>' + cells + '</div><div class="dp-note">History available for the last ' + HISTORY_DAYS + ' days.</div></div></div>';
  }
  function closeDropdowns(except) {
    document.querySelectorAll('.dd.open').forEach((d) => { if (d !== except) { d.classList.remove('open'); const b = d.querySelector('.dd-btn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
    if (!document.querySelector('.dd.open')) document.body.classList.remove('dd-sheet');
  }
  function positionMenu(ddEl) {
    const menu = ddEl.querySelector('.dd-menu'); const btn = ddEl.querySelector('.dd-btn');
    if (window.innerWidth < 640) { menu.style.cssText = ''; document.body.classList.add('dd-sheet'); return; }
    const r = btn.getBoundingClientRect();
    menu.style.position = 'fixed'; menu.style.minWidth = Math.max(r.width, 200) + 'px';
    const mw = Math.max(menu.offsetWidth, 200);
    let left = r.left; if (left + mw > window.innerWidth - 8) left = Math.max(8, r.right - mw);
    const below = window.innerHeight - r.bottom;
    menu.style.left = left + 'px';
    if (below < 280 && r.top > below) { menu.style.top = 'auto'; menu.style.bottom = (window.innerHeight - r.top + 6) + 'px'; menu.style.maxHeight = (r.top - 16) + 'px'; }
    else { menu.style.bottom = 'auto'; menu.style.top = (r.bottom + 6) + 'px'; menu.style.maxHeight = (below - 16) + 'px'; }
  }

  /* ---------------- modal, sheet, toast, tooltip ---------------- */
  const overlay = () => document.getElementById('overlay-root');
  let lastFocus = null;
  function openModal(title, body, o) {
    o = o || {};
    lastFocus = document.activeElement;
    closeModal(true);
    const w = document.createElement('div');
    w.className = 'modal-wrap'; w.dataset.act = 'modal-bg';
    w.innerHTML = '<div class="modal ' + (o.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="modal-h"><h3>' + title + '</h3><button type="button" class="ib" data-act="modal-close" aria-label="Close">' + icon('x') + '</button></div><div class="modal-b">' + body + '</div>' + (o.foot ? '<div class="modal-f">' + o.foot + '</div>' : '') + '</div>';
    overlay().appendChild(w);
    document.body.classList.add('noscroll');
    requestAnimationFrame(() => { w.classList.add('in'); const f = w.querySelector('[autofocus], input, textarea, .modal-b button, .modal-h button'); if (f) f.focus(); mountCharts(w); });
  }
  function closeModal(silent) {
    const w = overlay().querySelector('.modal-wrap'); if (!w) return;
    w.remove(); document.body.classList.remove('noscroll');
    if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function toast(msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg; box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3600);
  }
  function setupTooltip() {
    const tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    let cur = null;
    const show = (el) => {
      cur = el; tip.textContent = el.dataset.tip; tip.classList.add('on');
      const r = el.getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = r.left + r.width / 2 - tw / 2; left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
      let top = r.top - th - 8; if (top < 8) top = r.bottom + 8;
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    };
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el && el !== cur) show(el); else if (!el && cur) { cur = null; tip.classList.remove('on'); } });
    document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el); });
    document.addEventListener('focusout', () => { cur = null; tip.classList.remove('on'); });
    window.addEventListener('scroll', () => { cur = null; tip.classList.remove('on'); }, true);
  }

  /* ---------------- charts (dependency-free SVG) ---------------- */
  let chartReg = {}, chartSeq = 0;
  function chart(type, cfg) { const id = 'ch' + ++chartSeq; chartReg[id] = { type, cfg }; return '<div class="chart" id="' + id + '" style="height:' + (cfg.height || 200) + 'px"></div>'; }
  function mountCharts(root) {
    Object.keys(chartReg).forEach((id) => {
      const el = (root || document).querySelector('#' + id) || document.getElementById(id);
      if (!el) return;
      if (el.clientWidth === 0) return;
      try { drawLine(el, chartReg[id].cfg); } catch (e) { console.error(e); el.innerHTML = '<div class="chart-err">Chart unavailable</div>'; }
    });
  }
  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min; const step0 = span / n; const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => span / x <= n) || mag * 10;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step; const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }
  function drawLine(el, cfg) {
    const W = el.clientWidth, H = el.clientHeight || cfg.height || 200;
    const series = cfg.series.filter((s) => s.values && s.values.length);
    if (!series.length || series.every((s) => s.values.length < 2)) { el.innerHTML = '<div class="chart-empty">Not enough data points yet.</div>'; return; }
    const fmt = cfg.yFmt || ((v) => String(Math.round(v)));
    const n = Math.max(...series.map((s) => s.values.length));
    const all = series.flatMap((s) => s.values).filter((v) => v != null);
    let mn = Math.min(...all), mx = Math.max(...all);
    if (cfg.zero) { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
    const ticks = niceTicks(mn, mx, H < 140 ? 3 : 4); mn = ticks[0]; mx = ticks[ticks.length - 1];
    const compact = cfg.compact;
    const pl = compact ? 4 : Math.max(36, fmt(mx).length * 6.5 + 10), pr = compact ? 4 : 10, pt = compact ? 4 : 10, pb = compact ? 4 : 22;
    const x = (i) => pl + (n === 1 ? 0 : (i / (n - 1)) * (W - pl - pr));
    const y = (v) => pt + (1 - (v - mn) / (mx - mn || 1)) * (H - pt - pb);
    let svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" class="lc">';
    if (!compact) {
      ticks.forEach((tv) => { svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(tv) + '" y2="' + y(tv) + '" class="gl' + (tv === 0 ? ' zl' : '') + '"/><text x="' + (pl - 6) + '" y="' + (y(tv) + 3.5) + '" class="yl">' + esc(fmt(tv)) + '</text>'; });
      if (cfg.labels) {
        const k = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - pl) / 70))));
        cfg.labels.forEach((lb, i) => { if ((i % k === 0 && n - 1 - i >= k * 0.6) || i === n - 1) svg += '<text x="' + x(i) + '" y="' + (H - 6) + '" class="xl" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + esc(lb) + '</text>'; });
      }
    } else if (cfg.zero && mn < 0 && mx > 0) svg += '<line x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '" class="gl zl"/>';
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
      const col = s.color || 'var(--signal)';
      if (cfg.area && si === 0) {
        const base = y(Math.max(mn, Math.min(mx, cfg.zero ? 0 : mn)));
        svg += '<defs><linearGradient id="g' + el.id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".22"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>';
        svg += '<path d="' + d + 'L' + pts[pts.length - 1][0] + ' ' + base + 'L' + pts[0][0] + ' ' + base + 'Z" fill="url(#g' + el.id + ')" class="ar"/>';
      }
      svg += '<path d="' + d + '" pathLength="1" class="ln" style="stroke:' + col + (s.dash ? ';stroke-dasharray:4 4' : '') + '"/>';
    });
    svg += '<line class="hv" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '" style="opacity:0"/>';
    series.forEach((s, si) => { svg += '<circle class="hd" data-s="' + si + '" r="3.5" cx="-10" cy="-10" style="fill:' + (s.color || 'var(--signal)') + '"/>'; });
    svg += '<rect class="hov" x="' + pl + '" y="0" width="' + Math.max(1, W - pl - pr) + '" height="' + H + '" fill="transparent"/></svg>';
    el.innerHTML = svg + (compact ? '' : '<div class="ctip"></div>');
    if (compact) return;
    const hov = el.querySelector('.hov'), hv = el.querySelector('.hv'), tipEl = el.querySelector('.ctip'), dots = el.querySelectorAll('.hd');
    const move = (ev) => {
      const r = el.getBoundingClientRect(); const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const i = Math.max(0, Math.min(n - 1, Math.round(((cx - pl) / (W - pl - pr)) * (n - 1))));
      hv.setAttribute('x1', x(i)); hv.setAttribute('x2', x(i)); hv.style.opacity = 1;
      let html = cfg.labels ? '<b>' + esc(cfg.labels[i]) + '</b>' : '';
      series.forEach((s, si) => { const v = s.values[i]; if (v == null) return; dots[si].setAttribute('cx', x(i)); dots[si].setAttribute('cy', y(v)); html += '<div><i style="background:' + (s.color || 'var(--signal)') + '"></i>' + esc(s.name || '') + ' ' + esc((cfg.tipFmt || fmt)(v)) + '</div>'; });
      tipEl.innerHTML = html; tipEl.style.opacity = 1;
      const tw = tipEl.offsetWidth; tipEl.style.left = Math.min(W - tw - 4, Math.max(4, x(i) + 10 - (x(i) > W / 2 ? tw + 20 : 0))) + 'px'; tipEl.style.top = '6px';
    };
    const leave = () => { hv.style.opacity = 0; tipEl.style.opacity = 0; dots.forEach((d) => d.setAttribute('cx', -10)); };
    hov.addEventListener('mousemove', move); hov.addEventListener('touchmove', move, { passive: true }); hov.addEventListener('touchstart', move, { passive: true });
    hov.addEventListener('mouseleave', leave); hov.addEventListener('touchend', () => setTimeout(leave, 1500));
  }
  function spark(values, w, h, color, opts) {
    opts = opts || {};
    if (!values || values.length < 2) return '<svg width="' + w + '" height="' + h + '"></svg>';
    const mn = Math.min(...values, opts.zero ? 0 : Infinity), mx = Math.max(...values, opts.zero ? 0 : -Infinity);
    const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 2) + 1, h - 2 - ((v - mn) / (mx - mn || 1)) * (h - 4)]);
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path d="' + pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + '" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }
  function momentumBar(vals) {
    if (!vals || !vals.length) return '<div class="mom-empty">No momentum data yet</div>';
    const w = 18 * 10; let s = '<svg class="mom" viewBox="0 0 ' + w + ' 40" preserveAspectRatio="none" aria-label="Momentum"><line x1="0" x2="' + w + '" y1="20" y2="20" class="mz"/>';
    vals.forEach((v, i) => { const hgt = Math.abs(v) * 18; s += '<rect x="' + (i * 10 + 1) + '" width="8" y="' + (v >= 0 ? 20 - hgt : 20) + '" height="' + Math.max(1, hgt) + '" class="' + (v >= 0 ? 'mh' : 'ma') + '"/>'; });
    return s + '</svg>';
  }
  function donut(segs, size) {
    size = size || 120; const r = size / 2 - 10, c = 2 * Math.PI * r; const tot = segs.reduce((a, s) => a + s.v, 0) || 1; let off = 0;
    let s = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" class="donut"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="dn-bg"/>';
    segs.forEach((g) => { const len = (g.v / tot) * c; s += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="' + g.c + '" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + -off + '" class="dn-seg"/>'; off += len; });
    return s + '</svg>';
  }
  function hbars(rows, o) {
    o = o || {};
    if (!rows.length) return '<div class="chart-empty">No data for this selection.</div>';
    const mx = Math.max(...rows.map((r) => Math.abs(r.v))) || 1;
    return '<div class="hb">' + rows.map((r) => '<div class="hb-r"><span class="hb-l">' + esc(r.l) + (r.n != null ? ' <em>n=' + r.n + '</em>' : '') + '</span><span class="hb-t"><span class="hb-z"></span><span class="hb-b ' + (r.v >= 0 ? 'pos' : 'neg') + (r.n != null && r.n < 10 ? ' lown' : '') + '" style="width:' + (Math.abs(r.v) / mx) * 50 + '%;' + (r.v >= 0 ? 'left:50%' : 'right:50%') + '"></span></span><span class="hb-v ' + plClass(r.v) + '">' + (o.fmt ? o.fmt(r.v) : r.v) + '</span></div>').join('') + '</div>';
  }

  /* ---------------- bets: creation, settlement, statistics ---------------- */
  function selectionLabel(sel) { return sel.mk === 'BTTS' ? 'BTTS ' + sel.label : sel.label; }
  function makeBet(owner, m, sel, stake, placedAt, extra) {
    const no = ++S.seq[owner];
    return Object.assign({
      id: owner + '-' + no + '-' + (placedAt % 1e6), no, owner, placedAt, sport: m.sport, league: m.league, country: m.country,
      matchId: m.id, match: m.home + ' vs ' + m.away, home: m.home, away: m.away, start: m.start,
      marketKey: sel.mk, market: sel.mkName, selKey: sel.key, selection: selectionLabel(sel), line: sel.line,
      odds: sel.odds, stake, potential: round2(stake * (sel.odds - 1)),
      modelProb: sel.model, impliedProb: sel.implied, value: sel.value, ev: sel.ev,
      confidence: sel.conf.value, confLevel: sel.conf.level, modelScore: sel.score,
      reasoning: sel.reasoning,
      factors: sel.factors.map((f) => ({ key: f.key, label: f.label, value: f.value, detail: f.detail })),
      positives: sel.positives.map((f) => f.label + ': ' + f.detail),
      negatives: sel.against.slice(0, 6),
      risks: sel.risk.risks.map((r) => ({ key: r.key, label: r.label, detail: r.detail })), riskLevel: sel.risk.level,
      status: 'pending', pl: 0, settledAt: null, score: null, review: null
    }, extra || {});
  }
  function settleBet(b, m) {
    const res = D.evalSelection(m, b.marketKey, b.selKey, b.line);
    b.status = res === null ? 'void' : res ? 'won' : 'lost';
    b.pl = b.status === 'won' ? round2(b.stake * (b.odds - 1)) : b.status === 'lost' ? -b.stake : 0;
    b.settledAt = m.start + m.dur * 60000; b.score = D.scoreText(m);
    if (b.owner === 'ai' && b.status !== 'void') b.review = E.review(b, m);
  }
  function settleAll(silent) {
    let n = 0;
    [...S.bets.ai, ...S.bets.user].forEach((b) => {
      if (b.status !== 'pending' || !b.matchId || !b.selKey) return;
      const m = D.match(b.matchId); if (!m || D.status(m) !== 'finished') return;
      settleBet(b, m); n++;
      if (!silent) notify(b.owner === 'ai' ? 'aiSettle' : 'aiSettle', (b.owner === 'ai' ? 'AI bet #' + b.no : 'Your bet') + ' settled: ' + b.status.toUpperCase(), b.match + ', ' + b.selection + ' @ ' + odds(b.odds) + ' (' + money(b.pl, true) + ')', '#/' + (b.owner === 'ai' ? 'ai-journal' : 'journal'));
    });
    if (n) save();
    return n;
  }
  const settledBets = (bets) => bets.filter((b) => b.status === 'won' || b.status === 'lost' || b.status === 'void');
  const plSum = (bets) => bets.reduce((a, b) => a + (b.status === 'pending' ? 0 : b.pl || 0), 0);
  function bankroll(owner) { return (owner === 'ai' ? S.ai.startingBankroll : S.user.startingBankroll) + plSum(S.bets[owner]); }

  function stats(bets, startBank) {
    const st = { n: bets.length };
    const settled = settledBets(bets).slice().sort((a, b) => (a.settledAt || a.placedAt) - (b.settledAt || b.placedAt));
    const decided = settled.filter((b) => b.status !== 'void');
    st.wins = decided.filter((b) => b.status === 'won').length; st.losses = decided.length - st.wins;
    st.voids = settled.length - decided.length; st.pending = bets.filter((b) => b.status === 'pending').length;
    st.decided = decided.length;
    st.staked = decided.reduce((a, b) => a + b.stake, 0); st.pl = plSum(settled);
    st.roi = st.staked ? st.pl / st.staked : null; st.winRate = decided.length ? st.wins / decided.length : null;
    st.avgOdds = bets.length ? bets.reduce((a, b) => a + b.odds, 0) / bets.length : null;
    st.avgStake = bets.length ? bets.reduce((a, b) => a + b.stake, 0) / bets.length : null;
    st.largestWin = decided.reduce((a, b) => Math.max(a, b.pl), 0); st.largestLoss = decided.reduce((a, b) => Math.min(a, b.pl), 0);
    let cur = 0, curType = null, maxW = 0, maxL = 0, run = 0, runType = null;
    decided.forEach((b) => { if (b.status === runType) run++; else { runType = b.status; run = 1; } if (runType === 'won') maxW = Math.max(maxW, run); else maxL = Math.max(maxL, run); });
    cur = run; curType = runType;
    st.streak = curType ? (curType === 'won' ? 'W' : 'L') + cur : '-'; st.streakType = curType; st.maxWin = maxW; st.maxLoss = maxL;
    let bank = startBank || 0, peak = bank, dd = 0, ddPct = 0, cum = 0;
    st.series = [{ t: settled.length ? settled[0].settledAt - 864e5 : Date.now(), bank, cum: 0, roi: 0 }];
    let stk = 0;
    settled.forEach((b) => {
      bank += b.pl; cum += b.pl; if (b.status !== 'void') stk += b.stake;
      peak = Math.max(peak, bank); const d = peak - bank; if (d > dd) { dd = d; ddPct = peak ? d / peak : 0; }
      st.series.push({ t: b.settledAt, bank, cum, roi: stk ? cum / stk : 0 });
    });
    st.maxDD = dd; st.maxDDPct = ddPct; st.curDD = peak - bank; st.endBank = bank;
    st.rolling = decided.map((b, i) => { const w = decided.slice(Math.max(0, i - 19), i + 1); const s = w.reduce((a, x) => a + x.stake, 0); return s ? w.reduce((a, x) => a + x.pl, 0) / s : 0; });
    return st;
  }
  function groupStats(bets, keyFn) {
    const g = {};
    bets.forEach((b) => { const k = keyFn(b); (g[k] = g[k] || []).push(b); });
    return Object.entries(g).map(([k, list]) => { const s = stats(list, 0); return { key: k, n: list.length, decided: s.decided, wins: s.wins, losses: s.losses, pl: s.pl, staked: s.staked, roi: s.roi, winRate: s.winRate, avgOdds: s.avgOdds }; }).sort((a, b) => b.n - a.n);
  }
  const ODDS_BUCKETS = [['<1.60', 0, 1.6], ['1.60-1.99', 1.6, 2], ['2.00-2.49', 2, 2.5], ['2.50-2.99', 2.5, 3], ['3.00+', 3, 99]];
  const oddsBucket = (o) => (ODDS_BUCKETS.find((b) => o >= b[1] && o < b[2]) || ODDS_BUCKETS[4])[0];
  function rangeFilter(bets, range) {
    if (range === 'ALL') return bets;
    const days = { '7D': 7, '30D': 30, '90D': 90 }[range] || 9999; const from = SIT.clock.now() - days * 864e5;
    return bets.filter((b) => b.placedAt >= from);
  }

  /* ---------------- AI analyst account ---------------- */
  const prefSport = (m) => S.settings.sports.includes(m.sport) && (!S.settings.leagues.length || S.settings.leagues.includes(m.leagueId));
  function aiScan(manual) {
    const now = SIT.clock.now(); const bank = bankroll('ai'); const P = E.CONFIG.profiles[S.settings.risk] || E.CONFIG.profiles.balanced;
    const ms = D.matchesInRange(todayStr(), 2).filter((m) => D.status(m, now) === 'upcoming' && m.start - now < 36 * 3600e3 && m.start - now > 10 * 60e3 && prefSport(m));
    const already = new Set(S.bets.ai.map((b) => b.matchId));
    let exposure = S.bets.ai.filter((b) => b.status === 'pending').reduce((a, b) => a + b.stake, 0);
    const cands = ms.filter((m) => !already.has(m.id)).map((m) => { const a = E.analyzeMatch(m, now); return { m, a, dec: E.aiDecision(a, bank, S.settings.risk) }; })
      .filter((o) => o.dec.bet).sort((x, y) => y.dec.sel.value * y.dec.sel.conf.value - x.dec.sel.value * x.dec.sel.conf.value);
    const placed = [];
    for (const o of cands) {
      if (placed.length >= P.maxPerScan) break;
      if (exposure + o.dec.stake > bank * 0.15) break;
      const b = makeBet('ai', o.m, o.dec.sel, o.dec.stake, now); S.bets.ai.push(b); placed.push(b); exposure += b.stake;
      notify('aiBet', 'AI placed paper bet #' + b.no, b.match + ': ' + b.selection + ' @ ' + odds(b.odds) + ', stake ' + money(b.stake), '#/ai-journal/' + b.id);
    }
    S.ai.lastScan = now;
    if (manual || placed.length) notify('model', 'Model update', 'Re-rated ' + ms.length + ' upcoming matches. ' + cands.length + ' passed thresholds, ' + placed.length + ' paper bet(s) placed.', '#/ai');
    save();
    return { scanned: ms.length, candidates: cands.length, placed };
  }

  async function bootstrapHistory(onProgress) {
    const now = SIT.clock.now(); const td = todayStr(); let bank = S.ai.startingBankroll; const out = [];
    S.seq.ai = 0;
    for (let d = HISTORY_DAYS; d >= 0; d--) {
      const ds = U.addDays(td, -d); const c = [];
      D.matchesForDate(ds).forEach((m) => {
        const ref = m.start - 5 * 3600e3; if (ref > now || !prefSport(m)) return;
        const a = E.analyzeMatch(m, ref); const dec = E.aiDecision(a, bank, S.settings.risk);
        if (dec.bet) c.push({ m, dec, ref });
      });
      c.sort((x, y) => y.dec.sel.value * y.dec.sel.conf.value - x.dec.sel.value * x.dec.sel.conf.value);
      c.slice(0, 2).forEach((o) => { const b = makeBet('ai', o.m, o.dec.sel, o.dec.stake, o.ref); if (D.status(o.m, now) === 'finished') { settleBet(b, o.m); bank += b.pl; } out.push(b); });
      if (d % 6 === 0) { onProgress && onProgress(1 - d / HISTORY_DAYS); E.clearCache(); await new Promise((r) => setTimeout(r, 0)); }
    }
    out.sort((a, b) => a.placedAt - b.placedAt).forEach((b, i) => { b.no = i + 1; b.id = 'ai-' + b.no + '-' + (b.placedAt % 1e6); });
    S.seq.ai = out.length; S.bets.ai = out;
    E.clearCache();
  }
  function bootstrapUser() {
    const now = SIT.clock.now(); const td = todayStr(); const r = U.rng('user-history|' + td); const out = []; S.seq.user = 0;
    const notes = ['Home side in strong form, backing them at home.', 'Both teams have been leaking goals lately.', 'Price on the underdog looked too big after the team news.', 'Gut feeling, kept the stake small.', 'Followed the model signal, checked lineups first.', 'Took the early price before the market moved.', 'Derby game, expecting goals.', ''];
    for (let d = HISTORY_DAYS - 5; d >= 0; d--) {
      if (r() > 0.5) continue;
      const ms = D.matchesForDate(U.addDays(td, -d)).filter((m) => m.start + m.dur * 60000 < now || (d === 0 && m.start > now));
      if (!ms.length) continue;
      const m = U.pick(r, ms.filter((x) => x.sport === 'football' || r() < 0.4).concat(ms.slice(0, 1)));
      const mk = D.markets(m, m.start - 2 * 3600e3); const x = r();
      let market = mk[0], sel;
      if (x < 0.55) sel = market.sels.slice().sort((a, b) => a.odds - b.odds)[0];
      else if (x < 0.85 && mk[1]) { market = mk[1]; sel = market.sels[r() < 0.65 ? 0 : 1]; }
      else sel = U.pick(r, market.sels);
      const pseudo = { mk: market.key, mkName: market.name, line: market.line, key: sel.key, label: sel.label, odds: sel.odds };
      const stake = U.pick(r, [10, 10, 15, 20, 20, 25, 30, 50]);
      const b = { id: 'user-' + (++S.seq.user), no: S.seq.user, owner: 'user', placedAt: m.start - Math.round((1 + r() * 20) * 3600e3), sport: m.sport, league: m.league, country: m.country, matchId: m.id, match: m.home + ' vs ' + m.away, home: m.home, away: m.away, start: m.start, marketKey: pseudo.mk, market: pseudo.mkName, selKey: pseudo.key, selection: selectionLabel(pseudo), line: pseudo.line, odds: pseudo.odds, stake, potential: round2(stake * (pseudo.odds - 1)), impliedProb: 1 / pseudo.odds, reasoning: U.pick(r, notes), status: 'pending', pl: 0 };
      if (D.status(m, now) === 'finished') settleBet(b, m);
      out.push(b);
    }
    S.bets.user = out;
  }

  /* ---------------- notifications ---------------- */
  function notify(type, title, body, link, key) {
    if (key) { if (S.notified[key]) return; S.notified[key] = SIT.clock.now(); }
    if (S.settings.notif[type] === false) return;
    S.notifications.unshift({ id: 'nt' + Date.now() + Math.random().toString(36).slice(2, 6), type, title, body, link, time: SIT.clock.now(), read: false });
    S.notifications = S.notifications.slice(0, 80);
    updateChrome(); save();
  }
  function scanNotifications() {
    const now = SIT.clock.now(); const td = todayStr();
    D.news(td).filter((n) => n.impact === 'HIGH' && n.time <= now).forEach((n) => notify('news', 'High impact: ' + n.headline, n.why, n.matchIds[0] ? '#/match/' + encodeURIComponent(n.matchIds[0]) : '#/news', 'news|' + n.id));
    const betIds = new Set([...S.bets.ai, ...S.bets.user].filter((b) => b.status === 'pending').map((b) => b.matchId));
    D.matchesForDate(td).forEach((m) => {
      const mins = (m.start - now) / 60000;
      if (mins > 0 && mins <= 15 && (betIds.has(m.id) || (prefSport(m) && E.analyzeMatch(m, now).interest >= 75))) notify('start', 'Starting soon: ' + m.home + ' vs ' + m.away, m.league + ' kicks off at ' + time(m.start) + (betIds.has(m.id) ? '. You have an open position.' : '.'), '#/match/' + encodeURIComponent(m.id), 'start|' + m.id);
    });
    let oddsN = 0;
    D.matchesInRange(td, 2).forEach((m) => {
      if (oddsN >= 3 || D.status(m, now) !== 'upcoming' || !prefSport(m)) return;
      const mk = D.markets(m, now)[0];
      mk.sels.forEach((s) => { const mv = (s.odds - s.open) / s.open; if (Math.abs(mv) > 0.1 && oddsN < 3) { oddsN++; notify('odds', 'Unusual odds movement: ' + m.home + ' vs ' + m.away, s.label + ' ' + odds(s.open) + ' to ' + odds(s.odds) + ' (' + signed(mv * 100, 0) + '%). Cause not confirmed.', '#/match/' + encodeURIComponent(m.id), 'odds|' + m.id + s.key); } });
    });
    const keys = Object.keys(S.notified); if (keys.length > 600) keys.sort((a, b) => S.notified[a] - S.notified[b]).slice(0, keys.length - 500).forEach((k) => delete S.notified[k]);
  }

  /* ---------------- shell: chrome, router ---------------- */
  const NAV = [['dashboard', 'Dashboard'], ['scanner', 'Scanner'], ['opportunities', 'Opportunities'], ['live', 'Live'], ['news', 'News'], ['analytics', 'Analytics'], ['ai', 'AI Analyst'], ['ai-journal', 'AI Journal'], ['journal', 'Bet Journal'], ['settings', 'Settings']];
  const BOTTOM = ['dashboard', 'scanner', 'live', 'ai'];
  function shell() {
    const nav = NAV.map(([k]) => '<a href="#/' + k + '" class="nav-i" data-nav="' + k + '">' + icon(k) + '<span>' + t(k) + '</span><em class="nav-b" data-badge="' + k + '"></em></a>').join('');
    return '<aside class="sidebar" aria-label="Main navigation"><a class="brand" href="#/dashboard"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-t">SIT<small>Sports Intelligence Terminal</small></span></a><nav class="nav">' + nav + '</nav>' +
      '<div class="side-foot"><div class="feed-st"><span class="dot"></span>Demo feeds active</div><div class="side-note">All matches, odds and news are generated demo data.</div></div></aside>' +
      '<div class="main"><header class="topbar"><a class="brand brand-m" href="#/dashboard"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-t">SIT</span></a>' +
      '<div class="search"><span class="search-ic">' + icon('search') + '</span><input id="gsearch" type="search" placeholder="' + esc(t('searchPh')) + '" autocomplete="off" aria-label="Search" data-input="gsearch"><kbd>/</kbd><div class="search-pop" id="gsearch-pop"></div></div>' +
      '<div class="top-r"><button type="button" class="clock" data-act="go" data-href="#/settings" data-tip="Demo clock. Fast-forward it in Settings or Live to settle bets."><span id="clock-t"></span>' + demoTag('Demo') + '</button>' +
      '<button type="button" class="btn btn-sig hide-m" data-act="ai-run">' + icon('zap') + t('runAi') + '</button>' +
      '<button type="button" class="ib bell" data-act="notif-toggle" aria-label="Notifications">' + icon('bell') + '<em id="bell-n"></em></button></div></header>' +
      '<div class="ticker" id="ticker" aria-label="Live scores ticker"></div>' +
      '<main id="view" tabindex="-1"></main></div>' +
      '<nav class="bottomnav" aria-label="Mobile navigation">' + BOTTOM.map((k) => '<a href="#/' + k + '" data-nav="' + k + '">' + icon(k) + '<span>' + (k === 'dashboard' ? 'Home' : k === 'ai' ? 'AI' : t(k)) + '</span></a>').join('') + '<button type="button" data-act="more" data-nav="more">' + icon('more') + '<span>More</span></button></nav>' +
      '<div class="notif-panel" id="notif" aria-hidden="true"></div><div class="sheet" id="more-sheet" aria-hidden="true"></div>';
  }
  function updateChrome() {
    const r = currentRoute();
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const k = a.dataset.nav; const on = k === r.name || (r.name === 'match' && k === 'scanner') || (k === 'more' && !BOTTOM.includes(r.name) && r.name !== 'match');
      a.classList.toggle('on', on); if (a.tagName === 'A') a.setAttribute('aria-current', on ? 'page' : 'false');
    });
    const unread = S.notifications.filter((n) => !n.read).length;
    const bn = document.getElementById('bell-n'); if (bn) { bn.textContent = unread > 9 ? '9+' : unread || ''; bn.classList.toggle('on', unread > 0); }
    const live = D.matchesForDate(todayStr()).filter((m) => D.status(m) === 'live').length;
    const lb = document.querySelector('[data-badge="live"]'); if (lb) lb.textContent = live || '';
    const pend = S.bets.ai.filter((b) => b.status === 'pending').length;
    const ab = document.querySelector('[data-badge="ai-journal"]'); if (ab) ab.textContent = pend || '';
    const ct = document.getElementById('clock-t');
    if (ct) ct.textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz() }).format(SIT.clock.now()) + (SIT.clock.offset ? ' (+' + Math.round(SIT.clock.offset / 60000) + 'm)' : '');
    document.title = (live ? '(' + live + ' live) ' : '') + 'SIT - ' + t(r.name);
  }
  function renderTicker() {
    const el = document.getElementById('ticker'); if (!el) return;
    const items = D.matchesForDate(todayStr()).filter((m) => D.status(m) !== 'upcoming').sort((a, b) => (D.status(a) === 'live' ? 0 : 1) - (D.status(b) === 'live' ? 0 : 1)).slice(0, 16);
    if (!items.length) { el.innerHTML = '<div class="tk-empty">No live or finished events yet today</div>'; return; }
    const row = items.map((m) => { const l = D.live(m); const lv = l.status === 'live'; return '<a class="tk-i ' + (lv ? 'lv' : '') + '" href="#/match/' + encodeURIComponent(m.id) + '"><span class="tk-sp">' + D.SPORTS[m.sport].code + '</span>' + esc(short(m.home)) + ' <b>' + (l.h == null ? '-' : l.h + ':' + l.a) + '</b> ' + esc(short(m.away)) + '<em>' + esc(l.label) + '</em></a>'; }).join('');
    el.innerHTML = '<div class="tk-track">' + row + '<span aria-hidden="true" class="tk-dup">' + row + '</span></div>';
  }
  const short = (n) => (n.length > 16 ? n.split(' ').slice(-1)[0] : n);

  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [name, ...rest] = h.split('/');
    return { name: SIT.Views && SIT.Views[name] ? name : 'dashboard', params: rest.map(decodeURIComponent) };
  }
  let renderMeta = { quiet: false, busy: false };
  function render(opts) {
    opts = opts || {};
    const view = document.getElementById('view'); if (!view || !SIT.Views) return;
    const r = currentRoute(); chartReg = {}; ddReg = {};
    renderMeta.quiet = !!opts.quiet;
    document.body.classList.toggle('no-anim', !!opts.quiet);
    const y = window.scrollY;
    try { view.innerHTML = '<div class="page page-' + r.name + '">' + SIT.Views[r.name](r.params) + '</div>'; }
    catch (e) { console.error(e); view.innerHTML = '<div class="page">' + empty('This view failed to render', String(e.message || e), '<a class="btn" href="#/dashboard">Back to dashboard</a>') + '</div>'; }
    mountCharts(); updateChrome(); renderTicker();
    if (opts.keepScroll) window.scrollTo(0, y); else if (!opts.quiet) { window.scrollTo(0, 0); }
    if (opts.after) opts.after();
  }

  /* ---------------- notifications panel + more sheet ---------------- */
  function renderNotif() {
    const el = document.getElementById('notif');
    const list = S.notifications;
    el.innerHTML = '<div class="np-h"><b>Notifications</b><div><button type="button" class="lnk" data-act="notif-read">Mark all read</button><button type="button" class="ib" data-act="notif-toggle" aria-label="Close">' + icon('x') + '</button></div></div>' +
      (list.length ? '<div class="np-l">' + list.map((n) => '<a class="np-i ' + (n.read ? '' : 'unread') + ' np-' + n.type + '" href="' + esc(n.link || '#/dashboard') + '" data-act="notif-open" data-id="' + n.id + '"><span class="np-k">' + ({ news: 'News', start: 'Starting', aiBet: 'AI bet', aiSettle: 'Settled', odds: 'Odds', model: 'Model' }[n.type] || 'Info') + '</span><b>' + esc(n.title) + '</b><span>' + esc(n.body) + '</span><time>' + ago(n.time) + '</time></a>').join('') + '</div>' : empty('No notifications', 'Important news, AI bets and settlements will appear here.'));
  }
  function toggleNotif(force) {
    const el = document.getElementById('notif'); const open = force != null ? force : !el.classList.contains('open');
    if (open) renderNotif();
    el.classList.toggle('open', open); el.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('np-open', open);
  }
  function toggleMore(force) {
    const el = document.getElementById('more-sheet'); const open = force != null ? force : !el.classList.contains('open');
    if (open) el.innerHTML = '<div class="sheet-bg" data-act="more"></div><div class="sheet-p" role="dialog" aria-label="More sections"><div class="sheet-grab"></div>' + NAV.filter(([k]) => !BOTTOM.includes(k)).map(([k]) => '<a href="#/' + k + '" data-act="more-go" class="sheet-i">' + icon(k) + '<span>' + t(k) + '</span>' + icon('chevR', 'sheet-ch') + '</a>').join('') + '</div>';
    el.classList.toggle('open', open); el.setAttribute('aria-hidden', String(!open));
  }

  /* ---------------- global search ---------------- */
  function searchPop(q) {
    const pop = document.getElementById('gsearch-pop'); q = q.trim().toLowerCase();
    if (q.length < 2) { pop.classList.remove('on'); return; }
    const ms = D.matchesInRange(U.addDays(todayStr(), -1), 4).filter((m) => (m.home + ' ' + m.away + ' ' + m.league + ' ' + m.country).toLowerCase().includes(q)).slice(0, 7);
    pop.innerHTML = (ms.length ? ms.map((m) => '<a href="#/match/' + encodeURIComponent(m.id) + '" data-act="search-go">' + sportTag(m.sport) + '<span><b>' + esc(m.home) + ' vs ' + esc(m.away) + '</b><small>' + esc(m.league) + ', ' + dateTime(m.start) + '</small></span></a>').join('') : '<div class="sp-empty">No matches for "' + esc(q) + '"</div>') +
      '<button type="button" class="sp-all" data-act="search-all">Open in scanner</button>';
    pop.classList.add('on');
  }

  /* ---------------- events ---------------- */
  const Actions = {};
  function on(name, fn) { Actions[name] = fn; }
  on('dd-toggle', (el) => {
    const d = el.closest('.dd'); const open = !d.classList.contains('open');
    closeDropdowns(d); d.classList.toggle('open', open); el.setAttribute('aria-expanded', String(open));
    if (open) { positionMenu(d); const f = d.querySelector('.dd-opt.on, .dp-d.on, .dd-opt, .chip'); if (f) f.focus({ preventScroll: true }); }
    else document.body.classList.remove('dd-sheet');
  });
  on('dd-pick', (el) => { const fn = ddReg[el.dataset.id]; closeDropdowns(); dpMonth = null; if (fn) fn(el.dataset.v); });
  on('dp-nav', (el) => {
    const d = el.closest('.dd'); const id = d.dataset.dd; const cur = dpMonth || new Date(SIT.clock.now());
    dpMonth = new Date(cur.getFullYear(), cur.getMonth() + Number(el.dataset.d), 1);
    const fn = ddReg[id]; const val = S.ui.scanner.date; const wrap = document.createElement('div');
    wrap.innerHTML = datePicker(id, val, fn); const nd = wrap.firstChild; d.replaceWith(nd); nd.classList.add('open'); positionMenu(nd);
  });
  on('modal-close', () => closeModal());
  on('modal-bg', (el, e) => { if (e.target === el) closeModal(); });
  on('notif-toggle', () => toggleNotif());
  on('notif-read', () => { S.notifications.forEach((n) => (n.read = true)); save(); renderNotif(); updateChrome(); });
  on('notif-open', (el, e) => { const n = S.notifications.find((x) => x.id === el.dataset.id); if (n) n.read = true; save(); toggleNotif(false); location.hash = el.getAttribute('href'); e.preventDefault(); });
  on('more', () => toggleMore());
  on('more-go', (el, e) => { e.preventDefault(); toggleMore(false); location.hash = el.getAttribute('href'); });
  on('go', (el) => { location.hash = el.dataset.href; });
  on('search-go', (el, e) => { e.preventDefault(); document.getElementById('gsearch-pop').classList.remove('on'); location.hash = el.getAttribute('href'); });
  on('search-all', () => { const q = document.getElementById('gsearch').value; S.ui.scanner.q = q; S.ui.scanner.date = 'all'; save(); document.getElementById('gsearch-pop').classList.remove('on'); if (location.hash === '#/scanner') render(); else location.hash = '#/scanner'; });
  on('ai-run', () => { const r = aiScan(true); toast(r.placed.length ? 'AI placed ' + r.placed.length + ' paper bet(s) after scanning ' + r.scanned + ' matches.' : 'AI scanned ' + r.scanned + ' matches. No selection passed the ' + E.CONFIG.profiles[S.settings.risk].label.toLowerCase() + ' thresholds.', r.placed.length ? 'pos' : ''); render({ keepScroll: true }); });
  on('sort', (el) => { const k = el.dataset.table, c = el.dataset.col; const s = S.ui.sorts[k] || {}; S.ui.sorts[k] = { col: c, dir: s.col === c && s.dir === 'desc' ? 'asc' : 'desc' }; save(); render({ keepScroll: true }); });

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!e.target.closest('.dd')) closeDropdowns();
      if (!e.target.closest('.search')) { const p = document.getElementById('gsearch-pop'); if (p) p.classList.remove('on'); }
      if (document.body.classList.contains('np-open') && !e.target.closest('#notif') && !e.target.closest('.bell')) toggleNotif(false);
      if (!el) return;
      const fn = Actions[el.dataset.act]; if (!fn) return;
      if (el.tagName === 'A' && !['notif-open', 'more-go', 'search-go'].includes(el.dataset.act)) e.preventDefault();
      fn(el, e);
    });
    document.addEventListener('input', (e) => {
      const el = e.target.closest('[data-input]'); if (!el) return;
      if (el.dataset.input === 'gsearch') return searchPop(el.value);
      const fn = Actions['input:' + el.dataset.input]; if (fn) fn(el, e);
    });
    document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (!el) return; const fn = Actions['change:' + el.dataset.change]; if (fn) fn(el, e); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.querySelector('.dd.open')) { const d = document.querySelector('.dd.open'); closeDropdowns(); const b = d.querySelector('.dd-btn'); if (b) b.focus(); return; }
        if (overlay().querySelector('.modal-wrap')) return closeModal();
        if (document.body.classList.contains('np-open')) return toggleNotif(false);
        if (document.getElementById('more-sheet').classList.contains('open')) return toggleMore(false);
        const p = document.getElementById('gsearch-pop'); if (p) p.classList.remove('on');
      }
      if (e.key === 'Enter' && e.target.id === 'gsearch') { Actions['search-all'](); e.target.blur(); }
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); document.getElementById('gsearch').focus(); }
      const open = document.querySelector('.dd.open');
      if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const opts = [...open.querySelectorAll('.dd-opt:not([disabled]), .dp-d:not([disabled]), .chip')]; if (!opts.length) return;
        e.preventDefault(); const i = opts.indexOf(document.activeElement);
        opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length].focus();
      }
      if (e.target.getAttribute && e.target.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const tabs = [...e.target.parentElement.querySelectorAll('[role="tab"]')]; const i = tabs.indexOf(e.target);
        const nx = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; nx.focus(); nx.click();
      }
    });
    window.addEventListener('hashchange', () => { closeModal(true); toggleMore(false); render(); });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { closeDropdowns(); document.body.classList.add('no-anim'); mountCharts(); }, 150); });
    window.addEventListener('scroll', () => { if (window.innerWidth >= 640) closeDropdowns(); }, { passive: true });
  }

  function tick() {
    const changed = settleAll(false);
    scanNotifications();
    if (S.ai.autoScan && SIT.clock.now() - S.ai.lastScan > 30 * 60e3) aiScan(false);
    updateChrome();
    const busy = renderMeta.busy || document.querySelector('.dd.open') || overlay().querySelector('.modal-wrap') || (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName));
    const r = currentRoute().name;
    if (!busy && (changed || ['live', 'dashboard', 'match', 'scanner'].includes(r))) render({ keepScroll: true, quiet: true });
    else renderTicker();
  }

  function setTheme() { document.documentElement.dataset.theme = S.settings.theme; }

  async function start() {
    setTheme();
    document.getElementById('app').innerHTML = shell();
    setupTooltip(); bindEvents();
    if (!S.bets.ai.length) {
      const view = document.getElementById('view');
      view.innerHTML = '<div class="boot"><div class="boot-t">Building demo history</div><div class="boot-b">Running the model over the last ' + HISTORY_DAYS + ' days of generated fixtures to create the AI paper-trading record. This happens once.</div><div class="bar"><i id="boot-bar"></i></div></div>';
      await bootstrapHistory((p) => { const b = document.getElementById('boot-bar'); if (b) b.style.width = Math.round(p * 100) + '%'; });
      if (!S.bets.user.length) bootstrapUser();
      notify('model', 'Demo account ready', 'AI history generated: ' + S.bets.ai.length + ' paper bets over ' + HISTORY_DAYS + ' days. All data is demo data.', '#/ai');
      save();
    }
    settleAll(true); scanNotifications();
    if (S.ai.autoScan && SIT.clock.now() - S.ai.lastScan > 30 * 60e3) aiScan(false);
    render();
    setInterval(tick, 20000);
  }

  SIT.App = {
    S, t, I18N, esc, money, pct, pp, signed, odds, time, dayLabel, dateTime, ago, plClass, round2, icon, todayStr,
    sportTag, demoTag, confTag, confTagRaw, riskTag, impactTag, valTag, statusTag, scoreHtml, empty, kpi,
    dd, datePicker, openModal, closeModal, toast, chart, mountCharts, spark, momentumBar, donut, hbars,
    makeBet, settleBet, settleAll, stats, groupStats, ODDS_BUCKETS, oddsBucket, rangeFilter, bankroll, aiScan, prefSport,
    bootstrapHistory, bootstrapUser, notify, render, save, on, Actions, setTheme, defaultState, HISTORY_DAYS, ALL_SPORTS, STORE_KEY,
    start, renderMeta, set dpMonth(v) { dpMonth = v; }
  };
})();
