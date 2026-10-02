/* =====================================================================
   SIT - app.js
   Ядро: стан і збереження, форматування, компоненти, графіки,
   шапка й навігація, роутер, ставки (ваші й AI), сповіщення, запуск.
   Сторінки описані у views.js.
   ===================================================================== */
(function () {
  'use strict';
  const SIT = window.SIT, D = SIT.Data, M = SIT.Model, U = SIT.U;
  const KEY = 'sit.v3';
  const HISTORY_DAYS = 40;
  const H = 3600e3;

  /* ---------------- стан ---------------- */
  function defaults() {
    return {
      profile: { name: '', color: '#2357e8', since: Date.now(), ready: false },
      settings: { currency: 'EUR', risk: 'balanced', sports: ['football', 'tennis', 'esports'], autoAI: true, clock: 0, notif: { news: true, start: true, ai: true, settle: true } },
      user: { start: 1000 }, ai: { start: 1000, lastScan: 0 },
      bets: { ai: [], user: [] }, seq: { ai: 0, user: 0 },
      fav: [], notifs: [], seen: {},
      ui: { mSport: 'all', mDay: '0', mStatus: 'all', q: '', oCat: 'all', oSort: 'interest', liveSport: 'all', aiRange: '30', aiStatus: 'all', aiSport: 'all', aiLimit: 25, newsSport: 'all', newsImp: 'all', meTab: 'overview', betF: 'all', stRange: 'all', mTab: {}, mSel: {}, oSel: {} }
    };
  }
  function merge(a, b) { Object.keys(b || {}).forEach((k) => { if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) && b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) merge(a[k], b[k]); else a[k] = b[k]; }); return a; }
  const S = defaults();
  function replaceState(n) { Object.keys(S).forEach((k) => delete S[k]); Object.assign(S, n); }
  function load() { try { const raw = localStorage.getItem(KEY); if (raw) replaceState(merge(defaults(), JSON.parse(raw))); } catch (e) { replaceState(defaults()); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* приватний режим */ } }
  const now = () => SIT.clock.now();
  const getPath = (p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S);
  function setPath(p, v) { const ks = p.split('.'); const last = ks.pop(); let o = S; ks.forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[last] = v; }

  /* ---------------- форматування ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CUR = { EUR: '€', USD: '$', UAH: '₴', PLN: 'zł' };
  function money(v, signed) {
    v = Math.round((v || 0) * 100) / 100; const n = Math.abs(v);
    const s = n.toLocaleString('uk-UA', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    const c = S.settings.currency; const body = c === 'EUR' || c === 'USD' ? CUR[c] + s : s + ' ' + (CUR[c] || c);
    return (v < 0 ? '-' : signed && v > 0 ? '+' : '') + body;
  }
  const num = (v, d) => (v == null || isNaN(v) ? '-' : Number(v).toFixed(d == null ? 1 : d).replace('.', ','));
  const pct = (p, d) => (p == null || isNaN(p) ? '-' : num(p * 100, d == null ? 1 : d) + '%');
  const pp = (v) => (v > 0 ? '+' : '') + num(v * 100, 1) + ' п.п.';
  const odds = (o) => (o == null ? '-' : Number(o).toFixed(2).replace('.', ','));
  const time = (t) => new Date(t).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  function dayLabel(t) {
    const d = U.ds(t), td = U.ds(now());
    if (d === td) return 'Сьогодні'; if (d === U.addDays(td, 1)) return 'Завтра'; if (d === U.addDays(td, -1)) return 'Вчора';
    return new Date(t).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  }
  const dateTime = (t) => dayLabel(t) + ', ' + time(t);
  function ago(t) { const m = Math.round((now() - t) / 60000); if (m < 1) return 'щойно'; if (m < 60) return m + ' хв тому'; if (m < 1440) return Math.round(m / 60) + ' год тому'; return Math.round(m / 1440) + ' дн. тому'; }
  function plural(n, f) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2]; }
  const plCls = (v) => (v > 0.004 ? 'pos' : v < -0.004 ? 'neg' : 'muted');
  const initials = (n) => (n || 'Гість').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  /* ---------------- іконки ---------------- */
  const P = {
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>', live: '<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.6 4.6a10.5 10.5 0 000 14.8M19.4 4.6a10.5 10.5 0 010 14.8"/>',
    ai: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>', news: '<path d="M5 4h11v16H5zM16 8h3v10a2 2 0 01-2 2M8 8h5M8 12h5M8 16h3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20a2 2 0 004 0"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>', plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chevL: '<path d="M15 5l-7 7 7 7"/>', chevR: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12l4.5 4.5L19 7"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>', alert: '<path d="M12 4l9 16H3zM12 10v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', refresh: '<path d="M20 12a8 8 0 11-2.3-5.6M20 4v5h-5"/>',
    football: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4zM12 3v4.5M15.8 10.3l4.4-1.2M14.3 14.7l2.6 4M9.7 14.7l-2.6 4M8.2 10.3L3.8 9.1"/>',
    tennis: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8"/>',
    esports: '<path d="M7 8h10a4 4 0 014 4.5l-.6 3.7a2.4 2.4 0 01-4.1 1.2L14.5 15h-5l-1.8 2.4a2.4 2.4 0 01-4.1-1.2L3 12.5A4 4 0 017 8z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>'
  };
  const icon = (k, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[k] || '') + '</svg>';

  /* ---------------- атоми ---------------- */
  const sportIc = (sp) => '<span class="spi spi-' + sp + '" title="' + esc(D.SPORTS[sp].name) + '">' + icon(sp) + '</span>';
  const CONF = { high: 'Висока', medium: 'Середня', low: 'Низька' };
  const RISK = { high: 'Високий ризик', medium: 'Середній ризик', low: 'Низький ризик' };
  const IMP = { high: 'Високий вплив', medium: 'Середній вплив', low: 'Низький вплив' };
  const RES = { pending: 'Очікує', won: 'Виграш', lost: 'Програш', void: 'Повернення' };
  const confB = (c) => '<span class="b b-' + c.level + '" title="Впевненість моделі: внутрішня оцінка на основі повноти даних і узгодженості факторів">Впевненість ' + c.value + '</span>';
  const riskB = (l) => '<span class="b b-r' + l + '">' + RISK[l] + '</span>';
  const impB = (l) => '<span class="b b-i' + l + '">' + IMP[l] + '</span>';
  const valB = (v) => '<span class="vb ' + (v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : 'muted') + '" title="Різниця між оцінкою моделі та ймовірністю в коефіцієнті">' + pp(v) + '</span>';
  const resB = (st) => '<span class="b b-' + st + '">' + RES[st] + '</span>';
  const demoB = (t) => '<span class="demo" title="Згенеровані демонстраційні дані">' + (t || 'Демо') + '</span>';
  function statusLine(m) {
    const l = D.live(m);
    if (l.status === 'live') return '<span class="st-live"><i></i>' + esc(l.label) + '</span>';
    if (l.status === 'finished') return '<span class="st-fin">Завершено</span>';
    return '<span class="st-up">' + time(m.start) + '</span>';
  }
  const empty = (t, b, a) => '<div class="empty"><b>' + t + '</b>' + (b ? '<p>' + b + '</p>' : '') + (a || '') + '</div>';
  const note = (t, kind) => '<div class="note ' + (kind || '') + '">' + icon(kind === 'warn' ? 'alert' : 'info') + '<span>' + t + '</span></div>';
  const tile = (l, v, s, cls) => '<div class="tile ' + (cls || '') + '"><span class="tile-l">' + l + '</span><b class="tile-v">' + v + '</b>' + (s ? '<span class="tile-s">' + s + '</span>' : '') + '</div>';
  const plSpan = (v) => '<span class="' + plCls(v) + '">' + money(v, true) + '</span>';
  function chips(path, items) {
    const cur = String(getPath(path));
    return '<div class="chips" role="tablist">' + items.map(([v, l, n]) => '<button type="button" role="tab" aria-selected="' + (cur === String(v)) + '" class="chip' + (cur === String(v) ? ' on' : '') + '" data-act="set" data-k="' + path + '" data-v="' + esc(v) + '">' + l + (n != null ? '<em>' + n + '</em>' : '') + '</button>').join('') + '</div>';
  }
  function select(path, opts, label) {
    const cur = String(getPath(path));
    return '<label class="sel">' + (label ? '<span>' + label + '</span>' : '') + '<select data-ch="set" data-k="' + path + '">' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === cur ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>';
  }
  const sw = (path, label) => { const v = !!getPath(path); return '<button type="button" role="switch" aria-checked="' + v + '" class="sw' + (v ? ' on' : '') + '" data-act="toggle" data-k="' + path + '"><i></i><span>' + label + '</span></button>'; };

  /* ---------------- графіки ---------------- */
  function lineChart(cfg) {
    const series = cfg.series.filter((s) => s.values.length);
    const n = Math.max(0, ...series.map((s) => s.values.length));
    if (n < 2) return '<div class="chart-empty">Поки що замало даних для графіка.</div>';
    const W = 720, Hh = cfg.height || 240, pl = 64, pr = 16, pt = 14, pb = 30;
    const all = series.flatMap((s) => s.values); let mn = Math.min(...all), mx = Math.max(...all);
    if (cfg.zero) { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
    if (mn === mx) { mn -= 1; mx += 1; } const pad = (mx - mn) * 0.08; mn -= pad; mx += pad;
    const x = (i) => pl + (i / (n - 1)) * (W - pl - pr); const y = (v) => pt + (1 - (v - mn) / (mx - mn)) * (Hh - pt - pb);
    const fmt = cfg.fmt || ((v) => Math.round(v));
    let g = '';
    for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * (k / 3); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (pl - 8) + '" y="' + (y(v) + 4) + '" class="yl">' + esc(fmt(v)) + '</text>'; }
    if (cfg.zero && mn < 0 && mx > 0) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="zl"/>';
    if (cfg.labels) [0, Math.floor((n - 1) / 2), n - 1].forEach((i, k) => { g += '<text x="' + x(i) + '" y="' + (Hh - 8) + '" class="xl" text-anchor="' + (k === 0 ? 'start' : k === 2 ? 'end' : 'middle') + '">' + esc(cfg.labels[i] || '') + '</text>'; });
    series.forEach((s, si) => {
      const d = s.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
      if (si === 0 && cfg.area) g += '<path d="' + d + 'L' + x(s.values.length - 1) + ' ' + (Hh - pb) + 'L' + pl + ' ' + (Hh - pb) + 'Z" class="ar" style="fill:' + s.color + '"/>';
      g += '<path d="' + d + '" class="ln" style="stroke:' + s.color + '"/>';
      const lv = s.values[s.values.length - 1]; g += '<circle cx="' + x(s.values.length - 1) + '" cy="' + y(lv) + '" r="4" style="fill:' + s.color + '"/>';
    });
    const legend = series.length > 1 ? '<div class="legend">' + series.map((s) => '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(cfg.title || 'Графік') + '">' + g + '</svg>' + legend + '</div>';
  }
  function hbars(rows, fmt) {
    if (!rows.length) return '<div class="chart-empty">Немає даних.</div>';
    const mx = Math.max(...rows.map((r) => Math.abs(r.v))) || 1;
    return '<div class="hb">' + rows.map((r) => '<div class="hb-r"><span class="hb-l">' + esc(r.l) + (r.n != null ? ' <em>' + r.n + '</em>' : '') + '</span><span class="hb-t"><i class="' + (r.v >= 0 ? 'pos' : 'neg') + '" style="width:' + (Math.abs(r.v) / mx) * 50 + '%;' + (r.v >= 0 ? 'left:50%' : 'right:50%') + '"></i></span><span class="hb-v ' + plCls(r.v) + '">' + (fmt ? fmt(r.v) : r.v) + '</span></div>').join('') + '</div>';
  }
  function momBars(vals) {
    if (!vals || !vals.length) return '<div class="chart-empty sm">Даних про перевагу ще немає.</div>';
    return '<div class="mom" aria-label="Перевага в матчі">' + vals.map((v) => '<span class="mc"><i class="t"><b style="height:' + (v > 0 ? Math.max(8, v * 100) : 0) + '%"></b></i><i class="d"><b style="height:' + (v < 0 ? Math.max(8, -v * 100) : 0) + '%"></b></i></span>').join('') + '</div>';
  }

  /* ---------------- модальне вікно, тост ---------------- */
  const root = () => document.getElementById('overlay');
  function openModal(title, body, foot, wide) {
    closeModal(true);
    const w = document.createElement('div'); w.className = 'mw';
    w.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="mh"><h3>' + title + '</h3><button type="button" class="ib" data-act="close" aria-label="Закрити">' + icon('x') + '</button></div><div class="mb">' + body + '</div>' + (foot ? '<div class="mf">' + foot + '</div>' : '') + '</div>';
    root().appendChild(w); document.body.classList.add('noscroll');
    requestAnimationFrame(() => { w.classList.add('in'); const f = w.querySelector('input, select, textarea, .mb button, .mh button'); if (f) f.focus(); });
  }
  function closeModal(instant) {
    const w = root() && root().querySelector('.mw'); if (!w) return;
    document.body.classList.remove('noscroll');
    if (instant) w.remove(); else { w.classList.remove('in'); setTimeout(() => w.remove(), 160); }
  }
  function toast(msg, kind) {
    let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.setAttribute('role', 'status'); t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
  }

  /* ---------------- ставки ---------------- */
  const prefSport = (m) => S.settings.sports.includes(m.sport);
  function snapshot(s) {
    return { model: s.model, implied: s.implied, value: s.value, conf: s.conf.value, risk: s.risk.level, risks: s.risk.list.map((r) => r.label),
      factors: s.factors.filter((x) => !x.missing).map((x) => ({ label: x.label, value: x.value, detail: x.detail })), reasoning: M.reasoning(s),
      pros: s.pos.map((x) => x.label + ': ' + x.detail), cons: M.against(s) };
  }
  function makeBet(owner, m, s, stake, t, extra) {
    const no = ++S.seq[owner];
    const b = Object.assign({ id: owner + '-' + no + '-' + (t % 100000), no, owner, placedAt: t, matchId: m.id, sport: m.sport, tour: m.tourName, match: m.home + ' проти ' + m.away, start: m.start,
      mk: s.mk, mkName: s.mkName, key: s.key, selection: s.label, odds: s.odds, stake: U.round2(stake), status: 'pending', pl: 0, settledAt: null, score: null, review: null }, snapshot(s), extra || {});
    S.bets[owner].push(b); return b;
  }
  function settleBet(b, m) {
    const r = D.settle(m, b.mk, b.key);
    b.status = r; b.pl = r === 'won' ? U.round2(b.stake * (b.odds - 1)) : r === 'lost' ? -b.stake : 0;
    b.settledAt = D.endOf(m); b.score = D.scoreText(m);
    if (b.model != null) b.review = M.review(b, m);
  }
  function settleAll(t, quiet) {
    let n = 0;
    ['ai', 'user'].forEach((o) => S.bets[o].forEach((b) => {
      if (b.status !== 'pending' || !b.matchId) return;
      const m = D.match(b.matchId); if (!m || t < D.endOf(m)) return;
      settleBet(b, m); n++;
      if (!quiet && S.settings.notif.settle) notify('settle', (o === 'ai' ? 'Ставка AI №' + b.no : 'Ваша ставка') + ': ' + RES[b.status].toLowerCase(), b.match + ', ' + b.selection + ' (' + money(b.pl, true) + ')', o === 'ai' ? '#/ai/' + b.id : '#/me/bets');
    }));
    return n;
  }
  function stats(bets, start) {
    const dec = bets.filter((b) => b.status === 'won' || b.status === 'lost');
    const settled = bets.filter((b) => b.status !== 'pending').sort((a, b) => (a.settledAt || a.placedAt) - (b.settledAt || b.placedAt));
    const staked = dec.reduce((s, b) => s + b.stake, 0), pl = settled.reduce((s, b) => s + b.pl, 0);
    const wins = dec.filter((b) => b.status === 'won').length;
    let bank = start, peak = start, maxDD = 0; const series = [{ t: settled.length ? (settled[0].settledAt || settled[0].placedAt) - H : now(), bank: start, cum: 0 }];
    settled.forEach((b) => { bank += b.pl; peak = Math.max(peak, bank); maxDD = Math.max(maxDD, peak - bank); series.push({ t: b.settledAt || b.placedAt, bank, cum: bank - start }); });
    let streak = 0, sType = null; for (let i = settled.length - 1; i >= 0; i--) { const s = settled[i].status; if (s === 'void') continue; if (!sType) sType = s; if (s === sType) streak++; else break; }
    return { n: bets.length, decided: dec.length, wins, losses: dec.length - wins, voids: bets.filter((b) => b.status === 'void').length, pending: bets.filter((b) => b.status === 'pending').length,
      staked, pl, roi: staked ? pl / staked : null, winRate: dec.length ? wins / dec.length : null, avgOdds: dec.length ? dec.reduce((s, b) => s + b.odds, 0) / dec.length : null,
      avgStake: bets.length ? bets.reduce((s, b) => s + b.stake, 0) / bets.length : null, best: Math.max(0, ...settled.map((b) => b.pl)), worst: Math.min(0, ...settled.map((b) => b.pl)),
      streak: streak ? (sType === 'won' ? 'В' : 'П') + streak : '-', streakType: sType, maxDD, series, bank: start + pl };
  }
  function group(bets, keyFn) {
    const g = {}; bets.forEach((b) => { const k = keyFn(b); (g[k] = g[k] || []).push(b); });
    return Object.keys(g).map((k) => Object.assign({ key: k }, stats(g[k], 0))).sort((a, b) => b.n - a.n);
  }
  const bankroll = (o) => S[o].start + S.bets[o].filter((b) => b.status !== 'pending').reduce((s, b) => s + b.pl, 0);
  const exposure = (o) => S.bets[o].filter((b) => b.status === 'pending').reduce((s, b) => s + b.stake, 0);
  const oddsBand = (o) => (o < 1.5 ? 'до 1,50' : o < 2 ? '1,50 - 1,99' : o < 3 ? '2,00 - 2,99' : '3,00 і більше');
  const inRange = (bets, days) => (days === 'all' ? bets : bets.filter((b) => b.placedAt >= now() - Number(days) * 864e5));

  /* ---------------- AI ---------------- */
  function aiScan(manual) {
    const t = now();
    const have = new Set(S.bets.ai.map((b) => b.matchId));
    const ms = D.matchesInRange(U.ds(t), 2).filter((m) => D.status(m, t) === 'upcoming' && m.start - t < 24 * H && prefSport(m) && !have.has(m.id));
    const picks = M.aiPick(ms.map((m) => M.analyze(m, t)), bankroll('ai'), S.settings.risk, exposure('ai'));
    picks.forEach((p) => { const b = makeBet('ai', p.a.m, p.s, p.stake, t); if (S.settings.notif.ai) notify('ai', 'AI зробив ставку №' + b.no, b.match + ': ' + b.selection + ', коеф. ' + odds(b.odds) + ', сума ' + money(b.stake), '#/ai/' + b.id); });
    S.ai.lastScan = t; save();
    if (manual) toast(picks.length ? 'AI проаналізував ' + ms.length + ' ' + plural(ms.length, ['матч', 'матчі', 'матчів']) + ' і зробив ' + picks.length + ' ' + plural(picks.length, ['ставку', 'ставки', 'ставок']) : 'AI проаналізував ' + ms.length + ' ' + plural(ms.length, ['матч', 'матчі', 'матчів']) + '. Жоден варіант не пройшов пороги.', picks.length ? 'ok' : '');
    return { scanned: ms.length, placed: picks };
  }
  async function bootstrap(progress) {
    const t = now(); const today = U.ds(t);
    for (let i = -HISTORY_DAYS; i <= 0; i++) {
      const ds = U.addDays(today, i); const ref = U.dayStart(ds) + 9 * H; if (ref > t) break;
      const bank = S.ai.start + S.bets.ai.filter((b) => b.status !== 'pending' && b.settledAt <= ref).reduce((s, b) => s + b.pl, 0);
      const ms = D.matchesForDate(ds).filter((m) => m.start > ref && prefSport(m));
      const openExp = S.bets.ai.filter((b) => b.status === 'pending' || b.settledAt > ref).reduce((s, b) => s + b.stake, 0);
      M.aiPick(ms.map((m) => M.analyze(m, ref)), bank, S.settings.risk, openExp).slice(0, 2).forEach((p) => {
        const b = makeBet('ai', p.a.m, p.s, p.stake, ref + Math.floor(Math.random() * 40) * 60000);
        const m = p.a.m; if (t >= D.endOf(m)) settleBet(b, m);
      });
      if (progress) progress((i + HISTORY_DAYS + 1) / (HISTORY_DAYS + 1));
      if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    S.ai.lastScan = t;
  }
  const NOTES = ['Господарі в хорошій формі, граю на них.', 'Обидві команди останнім часом багато пропускають.', 'Після новин про склад коефіцієнт здався завищеним.', 'Інтуїція, тому невелика сума.', 'Пішов за сигналом моделі.', 'Взяв ранній коефіцієнт, поки ринок не зрушив.', 'Фаворит після відпочинку, суперник грав учора.'];
  function seedUserBets() {
    const t = now(); const r = U.rng('user-seed|' + U.ds(t));
    for (let i = 18; i >= 0; i -= 2) {
      const ms = D.matchesForDate(U.addDays(U.ds(t), -i)).filter((m) => D.status(m, t) === 'finished' && prefSport(m)); if (!ms.length) continue;
      const m = U.pick(r, ms); const a = M.analyze(m, m.start - 3 * H); const mk = U.pick(r, a.markets); const s = U.pick(r, mk.sels.filter((x) => x.key !== 'draw'));
      const b = makeBet('user', m, s, [10, 15, 20, 25, 30][Math.floor(r() * 5)], m.start - (2 + r() * 20) * H, { note: U.pick(r, NOTES) }); settleBet(b, m);
    }
    D.matchesInRange(U.ds(t), 2).filter((m) => D.status(m, t) === 'upcoming' && prefSport(m)).slice(2, 4).forEach((m) => { const a = M.analyze(m, t); makeBet('user', m, a.best, 20, t - 30 * 60000, { note: U.pick(r, NOTES) }); });
  }

  /* ---------------- сповіщення ---------------- */
  function notify(type, title, body, link) {
    S.notifs.unshift({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, title, body, link, t: now(), read: false });
    S.notifs = S.notifs.slice(0, 60);
  }
  function scanNotifs() {
    const t = now();
    if (S.settings.notif.start) {
      const myMatches = new Set(S.bets.user.filter((b) => b.status === 'pending' && b.matchId).map((b) => b.matchId));
      D.matchesInRange(U.ds(t), 2).forEach((m) => {
        const fav = S.fav.includes(m.home) || S.fav.includes(m.away);
        if ((myMatches.has(m.id) || fav) && m.start > t && m.start - t < 30 * 60000 && !S.seen['st' + m.id]) {
          S.seen['st' + m.id] = 1; notify('start', 'Скоро початок: ' + m.home + ' проти ' + m.away, m.tourName + ', старт о ' + time(m.start) + (myMatches.has(m.id) ? '. У вас є ставка на цей матч.' : '.'), '#/match/' + encodeURIComponent(m.id));
        }
      });
    }
    if (S.settings.notif.news) D.news(t, 1).filter((n) => t - n.time < 3 * H && (n.impact === 'high' || S.fav.includes(n.team))).forEach((n) => {
      if (S.seen['nw' + n.id]) return; S.seen['nw' + n.id] = 1; notify('news', n.title, n.why, n.matchIds[0] ? '#/match/' + encodeURIComponent(n.matchIds[0]) + '/news' : '#/news');
    });
    const keys = Object.keys(S.seen); if (keys.length > 800) keys.slice(0, 400).forEach((k) => delete S.seen[k]);
  }

  /* ---------------- шапка ---------------- */
  const NAV = [['', 'Головна'], ['matches', 'Матчі'], ['opps', 'Можливості'], ['live', 'Наживо'], ['ai', 'AI-аналітик'], ['news', 'Новини'], ['me', 'Кабінет']];
  function header() {
    const r = route().name; const liveN = D.matchesInRange(U.addDays(U.ds(now()), -1), 2).filter((m) => D.status(m) === 'live').length;
    const unread = S.notifs.filter((n) => !n.read).length;
    return '<header class="top"><div class="top-in">' +
      '<a class="logo" href="#/" aria-label="SIT, на головну"><span class="logo-m" aria-hidden="true"><i></i><i></i><i></i></span><span class="logo-t">SIT<small>спортивна аналітика</small></span></a>' +
      '<nav class="nav" aria-label="Розділи">' + NAV.map(([k, l]) => '<a href="#/' + k + '" class="' + (r === k || (k === 'matches' && r === 'match') ? 'on' : '') + '"' + (r === k ? ' aria-current="page"' : '') + '>' + l + (k === 'live' && liveN ? '<em>' + liveN + '</em>' : '') + '</a>').join('') + '</nav>' +
      '<div class="top-r"><button type="button" class="clock" data-act="go" data-href="#/live" title="Демо-час. Його можна перемотати в розділі Наживо">' + icon('clock') + '<span>' + time(now()) + '</span>' + (S.settings.clock ? '<em>демо</em>' : '') + '</button>' +
      '<button type="button" class="ib bell" data-act="notif" aria-label="Сповіщення">' + icon('bell') + (unread ? '<span class="cnt">' + Math.min(unread, 99) + '</span>' : '') + '</button>' +
      '<a class="ava" href="#/me" style="background:' + esc(S.profile.color) + '" title="Особистий кабінет">' + esc(initials(S.profile.name)) + '</a></div>' +
      '</div></header>';
  }
  function notifPanel() {
    const list = S.notifs.slice(0, 30);
    return '<div class="np-h"><b>Сповіщення</b><button type="button" class="lnk" data-act="notif-read">Прочитати всі</button></div>' +
      (list.length ? '<div class="np-l">' + list.map((n) => '<a class="np-i' + (n.read ? '' : ' unread') + '" href="' + esc(n.link || '#/') + '" data-act="notif-open" data-id="' + n.id + '"><b>' + esc(n.title) + '</b><span>' + esc(n.body) + '</span><time>' + ago(n.t) + '</time></a>').join('') + '</div>'
        : '<div class="np-e">Поки що сповіщень немає. Тут з’являться важливі новини, ставки AI та результати ваших ставок.</div>');
  }

  /* ---------------- роутер ---------------- */
  function route() { const h = location.hash.replace(/^#\/?/, ''); const [name, ...params] = h.split('/'); return { name: name || '', params: params.map(decodeURIComponent) }; }
  const Views = {}; SIT.Views = Views;
  let rendering = { quiet: false, busy: false };
  function render(opts) {
    opts = opts || {};
    const app = document.getElementById('app'); if (!app) return;
    const r = route(); const y = window.scrollY;
    rendering.quiet = !!opts.quiet;
    let body;
    try { body = (Views[r.name] || Views[''])(r.params); }
    catch (e) { console.error(e); body = empty('Не вдалося показати сторінку', esc(e.message), '<a class="btn" href="#/">На головну</a>'); }
    app.innerHTML = header() + '<main class="wrap" id="main" tabindex="-1">' + body + '</main><footer class="foot"><div class="wrap-f">SIT, персональний термінал спортивної аналітики. Усі матчі, коефіцієнти й новини тут демонстраційні. Ставки паперові, гроші віртуальні.</div></footer>';
    if (opts.keepScroll || opts.quiet) window.scrollTo(0, y); else window.scrollTo(0, 0);
    document.title = 'SIT, ' + (NAV.find((n) => n[0] === r.name) || ['', 'Матч'])[1];
    if (opts.after) opts.after();
  }
  const rerender = () => { save(); render({ keepScroll: true }); };

  /* ---------------- події ---------------- */
  const Actions = {}, Inputs = {}, Changes = {};
  const on = (n, f) => (Actions[n] = f), onInput = (n, f) => (Inputs[n] = f), onChange = (n, f) => (Changes[n] = f);
  on('set', (el) => { setPath(el.dataset.k, el.dataset.v); rerender(); });
  on('toggle', (el) => { setPath(el.dataset.k, !getPath(el.dataset.k)); rerender(); });
  on('go', (el) => { location.hash = el.dataset.href; });
  on('close', () => closeModal());
  on('notif', () => {
    const np = document.getElementById('np');
    if (np.classList.contains('open')) { np.classList.remove('open'); return; }
    np.innerHTML = notifPanel(); np.classList.add('open');
  });
  on('notif-read', () => { S.notifs.forEach((n) => (n.read = true)); save(); document.getElementById('np').innerHTML = notifPanel(); render({ keepScroll: true }); document.getElementById('np').classList.add('open'); });
  on('notif-open', (el) => { const n = S.notifs.find((x) => x.id === el.dataset.id); if (n) n.read = true; save(); document.getElementById('np').classList.remove('open'); });
  on('fav', (el) => { const tm = el.dataset.team; const i = S.fav.indexOf(tm); if (i >= 0) S.fav.splice(i, 1); else S.fav.push(tm); toast(i >= 0 ? tm + ' прибрано з обраного' : tm + ' додано в обране', 'ok'); rerender(); });
  on('clock', (el) => {
    const mins = Number(el.dataset.m);
    S.settings.clock = mins === 0 ? 0 : (S.settings.clock || 0) + mins * 60000; SIT.clock.offset = S.settings.clock; M.clearCache();
    const n = settleAll(now()); save();
    toast(mins === 0 ? 'Демо-час повернуто до реального' : 'Час перемотано на ' + (mins >= 60 ? mins / 60 + ' год' : mins + ' хв') + (n ? '. Розраховано ставок: ' + n : ''), 'ok');
    render({ keepScroll: true });
  });
  on('ai-run', () => { aiScan(true); rerender(); });
  onChange('set', (el) => { setPath(el.dataset.k, el.value); rerender(); });

  function bind() {
    document.addEventListener('click', (e) => {
      const np = document.getElementById('np');
      if (np && np.classList.contains('open') && !e.target.closest('#np') && !e.target.closest('[data-act="notif"]')) np.classList.remove('open');
      const mw = e.target.classList && e.target.classList.contains('mw') ? e.target : null; if (mw) { closeModal(); return; }
      const el = e.target.closest('[data-act]'); if (!el) return;
      const f = Actions[el.dataset.act]; if (!f) return;
      if (el.tagName === 'BUTTON') e.preventDefault();
      f(el, e);
    });
    document.addEventListener('input', (e) => { const el = e.target.closest('[data-in]'); if (el && Inputs[el.dataset.in]) Inputs[el.dataset.in](el, e); });
    document.addEventListener('change', (e) => { const el = e.target.closest('[data-ch]'); if (el && Changes[el.dataset.ch]) Changes[el.dataset.ch](el, e); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); const np = document.getElementById('np'); if (np) np.classList.remove('open'); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act]:not(button):not(a)')) { e.preventDefault(); e.target.click(); }
    });
    window.addEventListener('hashchange', () => { closeModal(true); render(); });
  }

  /* ---------------- таймер ---------------- */
  function tick() {
    const t = now();
    const n = settleAll(t);
    if (S.settings.autoAI && t - (S.ai.lastScan || 0) > 30 * 60000) aiScan(false);
    scanNotifs(); save();
    const busy = rendering.busy || document.querySelector('.mw') || document.querySelector('#np.open') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    if (!busy && (['', 'live', 'match', 'matches', 'ai'].includes(route().name) || n)) render({ quiet: true });
  }

  /* ---------------- запуск ---------------- */
  function progressModal(title) {
    openModal(title, '<div class="boot"><p>Модель проганяється по матчах за останні ' + HISTORY_DAYS + ' днів, щоб створити історію паперових ставок AI. Це відбувається один раз.</p><div class="bar"><i id="boot-bar"></i></div></div>');
  }
  async function buildHistory(title) {
    rendering.busy = true; progressModal(title);
    await bootstrap((p) => { const b = document.getElementById('boot-bar'); if (b) b.style.width = Math.round(p * 100) + '%'; });
    rendering.busy = false; closeModal(true); save();
  }
  async function start() {
    load(); SIT.clock.offset = S.settings.clock || 0;
    bind();
    if (!location.hash) history.replaceState(null, '', '#/');
    render();
    if (!S.profile.ready) { Views._onboarding(); }
    else if (!S.bets.ai.length) { await buildHistory('Готуємо історію AI'); render(); }
    setInterval(tick, 15000);
    setTimeout(tick, 1500);
  }
  async function finishOnboarding(withExamples) {
    S.profile.ready = true; S.profile.since = Date.now(); save();
    await buildHistory('Готуємо ваш кабінет');
    if (withExamples) seedUserBets();
    notify('ai', 'Вітаємо в SIT', 'AI-аналітик уже має ' + S.bets.ai.length + ' паперових ставок за ' + HISTORY_DAYS + ' днів. Усі дані демонстраційні.', '#/ai');
    save(); render();
  }
  async function rebuildAI() { S.bets.ai = []; S.seq.ai = 0; await buildHistory('Перебудовуємо історію AI'); notify('ai', 'Історію AI перебудовано', 'Нова історія: ' + S.bets.ai.length + ' ставок.', '#/ai'); save(); render({ keepScroll: true }); }

  SIT.App = {
    S, KEY, HISTORY_DAYS, defaults, save, now, getPath, setPath,
    esc, money, num, pct, pp, odds, time, dayLabel, dateTime, ago, plural, plCls, initials, icon,
    sportIc, confB, riskB, impB, valB, resB, demoB, statusLine, empty, note, tile, plSpan, chips, select, sw, CONF, RISK, RES,
    lineChart, hbars, momBars, openModal, closeModal, toast,
    prefSport, makeBet, settleBet, settleAll, stats, group, bankroll, exposure, oddsBand, inRange, aiScan, rebuildAI, finishOnboarding,
    notify, route, render, rerender, rendering, on, onInput, onChange, start
  };
})();
