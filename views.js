/* =====================================================================
   Sports Intelligence Terminal - views.js
   Page views (pure functions returning HTML) and their actions.
   Each view reads from SIT.appState (SIT.App.S), SIT.Data and
   SIT.Engine. Actions are registered with SIT.App.on(name, fn) and
   triggered by data-act / data-input / data-change attributes.
   ===================================================================== */
(function () {
  'use strict';
  const SIT = window.SIT, D = SIT.Data, E = SIT.Engine, U = SIT.util, A = SIT.App;
  const S = A.S;
  const { esc, money, pct, pp, signed, odds, time, dayLabel, dateTime, ago, plClass, round2, icon, todayStr, sportTag, demoTag, confTag, confTagRaw, riskTag, impactTag, valTag, statusTag, scoreHtml, empty, kpi, dd, datePicker, openModal, closeModal, toast, chart, spark, momentumBar, donut, hbars, stats, groupStats, ODDS_BUCKETS, oddsBucket, rangeFilter, bankroll, render, save, on } = A;
  const V = {};
  const now = () => SIT.clock.now();
  const enc = encodeURIComponent;
  const mlink = (m) => '#/match/' + enc(m.id);
  const DAY = 864e5;
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const fmtD = (ts) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(ts);
  const rerender = () => render({ keepScroll: true });

  /* ---------------- layout helpers ---------------- */
  function panel(title, body, o) {
    o = o || {};
    return '<section class="panel ' + (o.cls || '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
      (title != null ? '<header class="ph"><h2>' + title + '</h2>' + (o.right ? '<div class="ph-r">' + o.right + '</div>' : '') + '</header>' : '') +
      '<div class="pb ' + (o.flush ? 'flush' : '') + '">' + body + '</div></section>';
  }
  const pageHead = (title, sub, right) => '<div class="pg-h"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (right ? '<div class="pg-r">' + right + '</div>' : '') + '</div>';
  function tabs(act, items, cur, cls) {
    return '<div class="tabs ' + (cls || '') + '" role="tablist">' + items.filter(Boolean).map(([v, l, n]) => '<button type="button" role="tab" aria-selected="' + (v === cur) + '" tabindex="' + (v === cur ? 0 : -1) + '" class="tab ' + (v === cur ? 'on' : '') + '" data-act="' + act + '" data-v="' + esc(v) + '">' + esc(l) + (n != null ? '<em>' + n + '</em>' : '') + '</button>').join('') + '</div>';
  }
  const seg = (act, items, cur) => '<div class="seg" role="group">' + items.map(([v, l]) => '<button type="button" class="' + (v === cur ? 'on' : '') + '" aria-pressed="' + (v === cur) + '" data-act="' + act + '" data-v="' + esc(v) + '">' + esc(l) + '</button>').join('') + '</div>';
  const RANGES = [['7D', '7D'], ['30D', '30D'], ['90D', '90D'], ['ALL', 'All']];
  const chip = (act, v, l, isOn, attrs) => '<button type="button" class="chip ' + (isOn ? 'on' : '') + '" aria-pressed="' + !!isOn + '" data-act="' + act + '" data-v="' + esc(v) + '"' + (attrs || '') + '>' + l + '</button>';
  const toggle = (act, isOn, label, attrs) => '<button type="button" class="tg ' + (isOn ? 'on' : '') + '" role="switch" aria-checked="' + !!isOn + '" data-act="' + act + '"' + (attrs || '') + '><span class="tg-t"><i></i></span><span class="tg-l">' + label + '</span></button>';
  const legend = (items) => '<div class="lgd">' + items.map(([l, c]) => '<span><i style="background:' + c + '"></i>' + esc(l) + '</span>').join('') + '</div>';
  const note = (txt, kind) => '<div class="note ' + (kind || '') + '">' + icon(kind === 'warn' ? 'alert' : 'info') + '<span>' + txt + '</span></div>';

  /* sortable table: cols [{k, l, f(row) html, v(row) sort value, num, cls}] */
  function table(id, cols, rows, o) {
    o = o || {};
    const s = S.ui.sorts[id] || o.sort || {};
    let list = rows.slice();
    const col = cols.find((c) => c.k === s.col);
    if (col && col.v) { const d = s.dir === 'asc' ? 1 : -1; list.sort((a, b) => { const x = col.v(a), y = col.v(b); return (x > y ? 1 : x < y ? -1 : 0) * d; }); }
    if (o.limit) list = list.slice(0, o.limit);
    const th = cols.map((c) => '<th class="' + (c.num ? 'num ' : '') + (c.cls || '') + '"' + (c.v ? ' aria-sort="' + (s.col === c.k ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '"' : '') + '>' +
      (c.v ? '<button type="button" class="th-s ' + (s.col === c.k ? 'on ' + s.dir : '') + '" data-act="sort" data-table="' + id + '" data-col="' + c.k + '">' + esc(c.l) + icon('sort', 'th-ic') + '</button>' : esc(c.l)) + '</th>').join('');
    const body = list.length ? list.map((r) => '<tr' + (o.rowAttr ? o.rowAttr(r) : '') + '>' + cols.map((c) => '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '">' + c.f(r) + '</td>').join('') + '</tr>').join('')
      : '<tr><td colspan="' + cols.length + '" class="td-empty">' + esc(o.empty || 'No data for this selection.') + '</td></tr>';
    return '<div class="tw"><table class="tbl ' + (o.cls || '') + '"><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  /* ---------------- analysis helpers ---------------- */
  const an = (m) => E.analyzeMatch(m, now());
  const selText = (s) => (s.mk === 'BTTS' ? 'BTTS ' + s.label : s.label);
  const shortSel = (s) => ({ home: '1', draw: 'X', away: '2', over: 'O', under: 'U', yes: 'Y', no: 'N' }[s.key] || s.label);
  const CAT = {
    interesting: ['Interesting', 'Linked news or a notable price move makes this worth a look.'],
    signal: ['Statistical signal', 'One statistical factor (form, head to head or scoring profile) is unusually strong.'],
    discrepancy: ['Model-market discrepancy', 'Model probability is at least 3 pp above the probability implied by the odds.'],
    confidence: ['High confidence', 'Data is complete and most factors agree (model confidence 66+).'],
    variance: ['High variance', 'Odds of 2.80+ or a high risk score. Outcomes will swing even if the estimate is right.'],
    live: ['Live opportunity', 'Match is in play. Prices and probabilities move quickly.']
  };
  function windowMatches() {
    const t = now();
    return D.matchesInRange(U.addDays(todayStr(), -1), 3).filter((m) => A.prefSport(m)).filter((m) => { const st = D.status(m, t); return st === 'live' || (st === 'upcoming' && m.start - t < 36 * 3600e3); });
  }
  function opportunities() { return windowMatches().map((m) => ({ m, a: an(m) })).filter((x) => x.a.best && x.a.best.value > 0); }
  function shortEx(s) {
    const f = s.positives[0];
    return f ? f.label + ' ' + signed(f.value, 0) + ': ' + f.detail : 'No single factor dominates. The estimate stays close to the market price.';
  }
  function oppCard(x, o) {
    o = o || {}; const m = x.m, a = x.a, s = a.best;
    return '<article class="opp">' +
      '<a class="opp-main" href="' + mlink(m) + '">' +
      '<div class="opp-top">' + sportTag(m.sport) + '<span class="opp-lg">' + esc(m.league) + '</span>' + statusTag(m) + '</div>' +
      '<div class="opp-teams"><span><b>' + esc(m.home) + '</b><b>' + esc(m.away) + '</b></span>' + scoreHtml(m) + '</div>' +
      '<div class="opp-pick"><span class="opp-mk">' + esc(s.mkName) + '</span><span class="opp-sel">' + esc(selText(s)) + '</span><span class="opp-odds">' + odds(s.odds) + '</span></div>' +
      '<div class="opp-nums"><span><i>Model</i>' + pct(s.model) + '</span><span><i>Implied</i>' + pct(s.implied) + '</span><span><i>Value</i>' + valTag(s.value) + '</span><span><i>Conf.</i>' + confTag(s.conf) + '</span></div>' +
      '<p class="opp-ex">' + esc(shortEx(s)) + '</p></a>' +
      '<div class="opp-cats">' + a.categories.map((c) => '<span class="cat cat-' + c + '">' + CAT[c][0] + '</span>').join('') + riskTag(s.risk.level) + '</div>' +
      (o.why ? '<details class="why"><summary>Why this appeared</summary><ul>' + a.categories.map((c) => '<li><b>' + CAT[c][0] + '.</b> ' + esc(CAT[c][1]) + '</li>').join('') +
        '<li><b>Numbers.</b> Model ' + pct(s.model) + ' vs implied ' + pct(s.implied) + ', difference ' + pp(s.value) + ', expected value ' + signed(s.ev * 100) + '% per unit (internal estimate).</li></ul></details>' : '') +
      '</article>';
  }
  function matchRow(m, o) {
    o = o || {};
    const t = now(); const st = D.status(m, t); const mk = D.markets(m, t)[0];
    const b = st !== 'finished' && !o.noAn ? an(m).best : null;
    return '<a class="mr ' + (st === 'live' ? 'is-live' : '') + '" href="' + mlink(m) + '">' +
      '<span class="mr-st">' + statusTag(m) + '</span><span class="mr-sp">' + sportTag(m.sport) + '</span>' +
      '<span class="mr-t"><span>' + esc(m.home) + '</span><span>' + esc(m.away) + '</span>' + (o.league ? '<small>' + esc(m.league) + '</small>' : '') + '</span>' +
      '<span class="mr-sc">' + scoreHtml(m) + '</span>' +
      '<span class="mr-o">' + mk.sels.map((s) => '<span><i>' + shortSel(s) + '</i>' + odds(s.odds) + '</span>').join('') + '</span>' +
      '<span class="mr-v">' + (b ? (b.value > 0 ? valTag(b.value) : '<span class="dim" data-tip="No positive model-market difference">-</span>') + confTag(b.conf) : '') + '</span></a>';
  }
  function newsCard(n, o) {
    o = o || {};
    const ms = n.matchIds.map((id) => D.match(id)).filter(Boolean);
    const isInsuff = /^Insufficient data/.test(n.why);
    return '<article class="news ' + (o.compact ? 'compact' : '') + '">' +
      '<div class="nw-top">' + (n.sport ? sportTag(n.sport) : '') + impactTag(n.impact) + '<span class="nw-src">' + esc(n.source) + '</span><time>' + ago(n.time) + '</time>' + demoTag() + '</div>' +
      '<h3>' + esc(n.headline) + '</h3>' +
      '<div class="nw-ent">' + esc(n.team || '') + (n.entity && n.entity !== n.team ? ' · ' + esc(n.entity) : '') + (n.league ? ' · ' + esc(n.league) : '') + '</div>' +
      (o.compact ? '' : '<div class="nw-fact"><span class="lbl">Fact</span><p>' + esc(n.fact) + '</p></div>') +
      '<div class="nw-why ' + (isInsuff ? 'insuff' : '') + '"><span class="lbl">Why it matters <em>AI interpretation</em></span><p>' + esc(n.why) + '</p>' +
      (!o.compact && n.basis && n.basis.length ? '<ul>' + n.basis.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>' +
      (ms.length ? '<div class="nw-ms"><span class="lbl">Impacted</span>' + ms.map((m) => '<a href="' + mlink(m) + '">' + esc(m.home) + ' vs ' + esc(m.away) + ' <small>' + dateTime(m.start) + '</small></a>').join('') + '</div>' : '') +
      '</article>';
  }
  const resTag = (b) => '<span class="res res-' + b.status + '">' + ({ pending: 'Pending', won: 'Won', lost: 'Lost', void: 'Void' }[b.status] || b.status) + '</span>';
  const plCell = (b) => (b.status === 'pending' ? '<span class="dim">' + money(b.potential, true) + ' pot.</span>' : '<b class="' + plClass(b.pl) + '">' + money(b.pl, true) + '</b>');

  /* ---------------- DASHBOARD ---------------- */
  let marketScan = null;
  const SCAN_STEPS = ['Scanning matches…', 'Analyzing form…', 'Checking news…', 'Comparing market…', 'Calculating model…'];
  function plSince(bets, from) { return bets.filter((b) => b.status !== 'pending' && (b.settledAt || 0) >= from).reduce((a, b) => a + b.pl, 0); }
  function scanBox() {
    if (!marketScan) {
      return '<div class="scan-intro"><p>Runs the model over every upcoming and live match in the next 36 hours for your preferred sports, checks linked news and compares model probabilities with the market. It surfaces things worth reading, not bets to place.</p>' +
        '<button type="button" class="btn btn-sig btn-lg" data-act="scan-market">' + icon('scanner') + 'Scan the market</button></div>';
    }
    const list = marketScan.ids.map((id) => D.match(id)).filter(Boolean).map((m) => ({ m, a: an(m) })).filter((x) => x.a.best);
    return '<div class="scan-res"><div class="scan-n"><b>' + marketScan.ids.length + '</b> opportunities found</div>' +
      '<div class="scan-meta">' + marketScan.scanned + ' matches scanned ' + ago(marketScan.at) + '. Thresholds: difference 2+ pp, confidence 50+. Statistical estimates, not predictions.</div>' +
      (list.length ? '<div class="scan-list">' + list.slice(0, 5).map((x) => '<a class="scan-i" href="' + mlink(x.m) + '">' + sportTag(x.m.sport) + '<span class="si-t"><b>' + esc(x.m.home) + ' vs ' + esc(x.m.away) + '</b><small>' + esc(selText(x.a.best)) + ' @ ' + odds(x.a.best.odds) + ' · ' + esc(x.m.league) + '</small></span>' + valTag(x.a.best.value) + confTag(x.a.best.conf) + '</a>').join('') + '</div>' : '<p class="dim">Nothing passed the thresholds. That is a normal outcome.</p>') +
      '<div class="scan-act"><button type="button" class="btn" data-act="scan-market">' + icon('refresh') + 'Scan again</button><a class="btn btn-ghost" href="#/opportunities">All opportunities' + icon('chevR') + '</a></div></div>';
  }
  on('scan-market', () => {
    const box = document.getElementById('scan-box'); if (!box || A.renderMeta.busy) return;
    A.renderMeta.busy = true;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = windowMatches(); const t = now();
    const res = ms.map((m) => ({ m, a: an(m) })).filter((x) => x.a.best && x.a.best.value >= 0.02 && x.a.best.conf.value >= 50).sort((x, y) => y.a.interest - x.a.interest);
    const newsN = ms.reduce((a, m) => a + D.newsForMatch(m, t).length, 0);
    const details = [ms.length + ' matches in window', 'last 10 results per side', newsN + ' linked news items', 'odds from demo feed', res.length + ' passed thresholds'];
    box.innerHTML = '<ol class="scan-steps">' + SCAN_STEPS.map((s) => '<li><span class="ss-ic"></span><span>' + s + '</span><em></em></li>').join('') + '</ol><div class="bar"><i id="scan-bar"></i></div>';
    let i = 0;
    const step = () => {
      if (!document.body.contains(box)) { finish(); return; }
      const li = box.querySelectorAll('li');
      if (i > 0) { li[i - 1].classList.remove('run'); li[i - 1].classList.add('done'); li[i - 1].querySelector('em').textContent = details[i - 1]; }
      const bar = document.getElementById('scan-bar'); if (bar) bar.style.width = Math.round((i / li.length) * 100) + '%';
      if (i < li.length) { li[i].classList.add('run'); i++; setTimeout(step, reduce ? 80 : 560); }
      else setTimeout(finish, reduce ? 50 : 350);
    };
    const finish = () => {
      marketScan = { at: now(), ids: res.map((x) => x.m.id), scanned: ms.length };
      A.renderMeta.busy = false;
      if (document.body.contains(box)) { box.innerHTML = scanBox(); const n = box.querySelector('.scan-n'); if (n) n.classList.add('pop'); }
    };
    step();
  });

  V.dashboard = () => {
    const t = now(), td = todayStr(); const dayStart = U.parseDate(td).getTime();
    const ub = bankroll('user'), us = stats(S.bets.user, S.user.startingBankroll);
    const ab = bankroll('ai'), as = stats(S.bets.ai, S.ai.startingBankroll);
    const ubP = S.bets.user.filter((b) => b.status === 'pending');
    const aiToday = S.bets.ai.filter((b) => U.dateStr(b.placedAt) === td);
    const port = '<div class="bal"><div class="bal-v">' + money(ub) + '</div><div class="bal-s">Balance · start ' + money(S.user.startingBankroll) + ' · <span class="' + plClass(ub - S.user.startingBankroll) + '">' + money(ub - S.user.startingBankroll, true) + '</span></div></div>' +
      '<div class="kg k5">' + kpi('Today', money(plSince(S.bets.user, dayStart), true), '', plClass(plSince(S.bets.user, dayStart))) +
      kpi('This week', money(plSince(S.bets.user, t - 7 * DAY), true), '', plClass(plSince(S.bets.user, t - 7 * DAY))) +
      kpi('This month', money(plSince(S.bets.user, t - 30 * DAY), true), '', plClass(plSince(S.bets.user, t - 30 * DAY))) +
      kpi('ROI', pct(us.roi), us.decided + ' settled', plClass(us.roi || 0)) +
      kpi('Active bets', String(ubP.length), money(ubP.reduce((a, b) => a + b.stake, 0)) + ' staked') + '</div>';
    const aiSeries = as.series.slice(-60).map((p) => p.bank);
    const aiP = '<div class="bal"><div class="bal-v">' + money(ab) + spark(aiSeries, 120, 34, ab >= S.ai.startingBankroll ? 'var(--pos)' : 'var(--neg)') + '</div><div class="bal-s">Virtual bankroll · start ' + money(S.ai.startingBankroll) + ' · ' + E.CONFIG.profiles[S.settings.risk].label + ' profile</div></div>' +
      '<div class="kg k5">' + kpi("Today's bets", String(aiToday.length), aiToday.filter((b) => b.status === 'pending').length + ' pending') +
      kpi('Today P/L', money(plSince(S.bets.ai, dayStart), true), '', plClass(plSince(S.bets.ai, dayStart))) +
      kpi('ROI', pct(as.roi), as.decided + ' settled', plClass(as.roi || 0)) +
      kpi('Win rate', pct(as.winRate), as.wins + 'W ' + as.losses + 'L') +
      kpi('Streak', '<span class="' + (as.streakType === 'won' ? 'pos' : as.streakType === 'lost' ? 'neg' : '') + '">' + as.streak + '</span>', 'best W' + as.maxWin) + '</div>';
    const opps = opportunities().sort((x, y) => y.a.interest - x.a.interest).slice(0, 6);
    const today = D.matchesInRange(U.addDays(td, -1), 3);
    const live = today.filter((m) => D.status(m, t) === 'live');
    const up = today.filter((m) => D.status(m, t) === 'upcoming').slice(0, 8);
    let news = D.news(td).filter((n) => n.time <= t);
    if (news.length < 5) news = news.concat(D.news(U.addDays(td, -1)).filter((n) => n.time <= t));
    news = news.sort((a, b) => (b.impact === 'HIGH') - (a.impact === 'HIGH') || b.time - a.time).slice(0, 5);
    return pageHead('Dashboard', dayLabel(t) + ', ' + new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(t) + ' ' + demoTag('Demo data'), '<button type="button" class="btn" data-act="ai-run">' + icon('zap') + 'Run AI scan</button>') +
      '<div class="grid g-dash">' +
      panel('Portfolio <small>You</small>', port, { cls: 'c6', right: '<a class="lnk" href="#/journal">Journal</a>' }) +
      panel('AI Analyst <small>paper account</small>', aiP, { cls: 'c6', right: '<a class="lnk" href="#/ai">Performance</a>' }) +
      panel('Find something interesting', '<div id="scan-box">' + scanBox() + '</div>', { cls: 'c5 scan-panel' }) +
      panel("Today's opportunities", opps.length ? '<div class="opp-grid">' + opps.map((x) => oppCard(x)).join('') + '</div>' : empty('No positive model-market differences right now', 'Check back later or widen your preferred sports in Settings.'), { cls: 'c7', right: '<a class="lnk" href="#/opportunities">View all</a>' }) +
      panel('Live now <em class="cnt">' + live.length + '</em>', live.length ? '<div class="mlist">' + live.slice(0, 7).map((m) => matchRow(m, { league: true })).join('') + '</div>' : empty('No live events', 'Nothing is in play at the current demo time.'), { cls: 'c6', right: '<a class="lnk" href="#/live">Live radar</a>', flush: true }) +
      panel('Upcoming', up.length ? '<div class="mlist">' + up.map((m) => matchRow(m, { league: true })).join('') + '</div>' : empty('No upcoming events', 'The schedule is empty for this window.'), { cls: 'c6', right: '<a class="lnk" href="#/scanner">Scanner</a>', flush: true }) +
      panel('Top sports news', news.length ? '<div class="news-l">' + news.map((n) => newsCard(n, { compact: true })).join('') + '</div>' : empty('No news yet', 'News items appear as the demo day progresses.'), { cls: 'c12', right: '<a class="lnk" href="#/news">All news</a>' }) +
      '</div>';
  };

  /* ---------------- SCANNER ---------------- */
  const WINDOWS = [['all', 'Any time'], ['next1', 'Next 1 hour'], ['next3', 'Next 3 hours'], ['next6', 'Next 6 hours'], ['night', 'Night 00-06'], ['morning', 'Morning 06-12'], ['afternoon', 'Afternoon 12-18'], ['evening', 'Evening 18-24']];
  function scannerBase() {
    const f = S.ui.scanner, td = todayStr();
    if (f.date === 'today') return D.matchesForDate(td);
    if (f.date === 'tomorrow') return D.matchesForDate(U.addDays(td, 1));
    if (f.date === 'all') return D.matchesInRange(td, 3);
    return D.matchesForDate(f.date);
  }
  function scannerRows() {
    const f = S.ui.scanner, t = now();
    let list = scannerBase().filter((m) => (f.sport === 'all' || m.sport === f.sport) && (f.league === 'all' || m.leagueId === f.league) && (f.country === 'all' || m.country === f.country));
    if (f.status !== 'all') list = list.filter((m) => D.status(m, t) === f.status);
    if (f.window !== 'all') {
      const hrs = { next1: 1, next3: 3, next6: 6 }[f.window];
      if (hrs) list = list.filter((m) => m.start > t && m.start - t <= hrs * 3600e3);
      else { const [a, b] = { night: [0, 6], morning: [6, 12], afternoon: [12, 18], evening: [18, 24] }[f.window]; list = list.filter((m) => { const h = new Date(m.start).getHours(); return h >= a && h < b; }); }
    }
    const q = f.q.trim().toLowerCase();
    if (q) list = list.filter((m) => (m.home + ' ' + m.away + ' ' + m.league + ' ' + m.country).toLowerCase().includes(q));
    let rows = list.map((m) => ({ m, a: an(m) }));
    if (+f.conf) rows = rows.filter((r) => r.a.best.conf.value >= +f.conf);
    if (+f.interest) rows = rows.filter((r) => r.a.interest >= +f.interest);
    if (f.market !== 'all') rows = rows.filter((r) => (f.market === 'side' ? ['1X2', 'ML'].includes(r.a.best.mk) : r.a.best.mk === f.market));
    const sorters = { time: (x, y) => x.m.start - y.m.start, interest: (x, y) => y.a.interest - x.a.interest, value: (x, y) => y.a.best.value - x.a.best.value, conf: (x, y) => y.a.best.conf.value - x.a.best.conf.value };
    return rows.sort(sorters[f.sort] || sorters.time);
  }
  function scannerResults() {
    const rows = scannerRows(); const f = S.ui.scanner;
    if (!rows.length) return empty('No matches for these filters', 'Try another date, clear the search or reset filters.', '<button type="button" class="btn" data-act="scan-reset">Reset filters</button>');
    let html = '<div class="res-n">' + rows.length + ' match' + (rows.length === 1 ? '' : 'es') + (f.sort !== 'time' ? ', sorted by ' + { interest: 'interest', value: 'model-market difference', conf: 'confidence' }[f.sort] : '') + '</div>';
    if (f.sort === 'time') {
      const groups = {}; const order = [];
      rows.forEach((r) => { const k = r.m.leagueId; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(r); });
      order.sort((a, b) => groups[a][0].m.start - groups[b][0].m.start);
      html += order.map((k) => { const L = D.LEAGUE_BY_ID[k]; return '<div class="lg-grp"><div class="lg-h">' + sportTag(L.sport) + '<b>' + esc(L.name) + '</b><span>' + esc(L.country) + '</span><em>' + groups[k].length + '</em></div><div class="mlist">' + groups[k].map((r) => matchRow(r.m, { date: f.date === 'all' })).join('') + '</div></div>'; }).join('');
    } else html += '<div class="mlist">' + rows.map((r) => matchRow(r.m, { league: true })).join('') + '</div>';
    return html;
  }
  V.scanner = () => {
    const f = S.ui.scanner; const base = scannerBase();
    const set = (k) => (v) => { f[k] = v; if (k === 'sport' && f.league !== 'all' && D.LEAGUE_BY_ID[f.league].sport !== v && v !== 'all') f.league = 'all'; save(); rerender(); };
    const sportsCnt = {}; base.forEach((m) => (sportsCnt[m.sport] = (sportsCnt[m.sport] || 0) + 1));
    const leagues = D.LEAGUES.filter((L) => f.sport === 'all' || L.sport === f.sport);
    const countries = [...new Set(D.LEAGUES.map((L) => L.country))].sort();
    const lsel = [{ v: 'all', l: 'All leagues' }].concat(leagues.map((L) => ({ v: L.id, l: L.name + (L.name === 'Premier League' || L.name === 'Serie A' ? ' (' + L.country + ')' : ''), n: base.filter((m) => m.leagueId === L.id).length })));
    const bar = '<div class="filters">' +
      '<div class="fsearch">' + icon('search') + '<input type="search" id="scan-q" placeholder="Search team, player, league, country" value="' + esc(f.q) + '" data-input="scan-q" aria-label="Search matches" autocomplete="off"></div>' +
      datePicker('scan-date', f.date, set('date')) +
      dd('scan-league', lsel, f.league, set('league'), { label: 'League' }) +
      dd('scan-country', [{ v: 'all', l: 'All countries' }].concat(countries.map((c) => ({ v: c, l: c }))), f.country, set('country'), { label: 'Country' }) +
      dd('scan-status', [{ v: 'all', l: 'Live + upcoming + finished' }, { v: 'live', l: 'Live only' }, { v: 'upcoming', l: 'Upcoming only' }, { v: 'finished', l: 'Finished only' }], f.status, set('status'), { label: 'Status' }) +
      dd('scan-window', WINDOWS.map(([v, l]) => ({ v, l })), f.window, set('window'), { label: 'Start time' }) +
      dd('scan-market', [{ v: 'all', l: 'Any market' }, { v: 'side', l: 'Result / winner' }, { v: 'OU', l: 'Totals' }, { v: 'BTTS', l: 'Both teams to score' }], f.market, set('market'), { label: 'Best market' }) +
      dd('scan-interest', [['0', 'Any interest'], ['40', 'Interest 40+'], ['55', 'Interest 55+'], ['70', 'Interest 70+']].map(([v, l]) => ({ v, l })), f.interest, set('interest'), { label: 'Interest' }) +
      dd('scan-conf', [['0', 'Any confidence'], ['50', 'Confidence 50+'], ['60', 'Confidence 60+'], ['66', 'High (66+)']].map(([v, l]) => ({ v, l })), f.conf, set('conf'), { label: 'Confidence' }) +
      dd('scan-sort', [['time', 'Sort: start time'], ['interest', 'Sort: interest'], ['value', 'Sort: difference'], ['conf', 'Sort: confidence']].map(([v, l]) => ({ v, l })), f.sort, set('sort'), { label: 'Sort' }) +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="scan-reset">Reset</button></div>';
    const chips = '<div class="chips hscroll" role="group" aria-label="Sport">' + chip('scan-sport', 'all', 'All <em>' + base.length + '</em>', f.sport === 'all') + Object.values(D.SPORTS).map((sp) => chip('scan-sport', sp.id, esc(sp.name) + ' <em>' + (sportsCnt[sp.id] || 0) + '</em>', f.sport === sp.id)).join('') + '</div>';
    return pageHead('Match scanner', 'All sports, one compact list. Value and confidence columns are internal model estimates. ' + demoTag()) +
      chips + bar + '<div id="scan-results" class="scan-results">' + scannerResults() + '</div>';
  };
  on('input:scan-q', (el) => { S.ui.scanner.q = el.value; save(); const r = document.getElementById('scan-results'); if (r) { r.innerHTML = scannerResults(); A.mountCharts(); } });
  on('scan-sport', (el) => { S.ui.scanner.sport = el.dataset.v; if (S.ui.scanner.league !== 'all' && el.dataset.v !== 'all' && D.LEAGUE_BY_ID[S.ui.scanner.league].sport !== el.dataset.v) S.ui.scanner.league = 'all'; save(); rerender(); });
  on('scan-reset', () => { S.ui.scanner = A.defaultState().ui.scanner; save(); rerender(); });

  /* ---------------- shared: live radar ---------------- */
  function liveFlags(m, l) {
    const flags = []; const mo = l.momentum || [];
    if (mo.length >= 6) {
      const r = avg(mo.slice(-3)), p = avg(mo.slice(-6, -3));
      if (Math.sign(r) !== Math.sign(p) && Math.abs(r - p) > 0.5) flags.push(['Momentum shift', (r > 0 ? m.home : m.away) + ' have controlled the most recent phase after being second best before it.']);
    }
    if (l.h != null && l.h !== l.a && m.sport !== 'mma') {
      const lead = l.h > l.a ? 'home' : 'away'; const pre = m.markets[0].sels.find((s) => s.key === lead).close;
      if (pre >= 2.6) flags.push(['Unexpected performance', (lead === 'home' ? m.home : m.away) + ' lead despite pre-match odds of ' + odds(pre) + '.']);
    }
    const op = l.oddsPath || [];
    if (op.length >= 3) {
      const mv = (op[op.length - 1] - op[0]) / op[0];
      if (Math.abs(mv) > 0.25) {
        const why = (l.events || []).length ? 'score changes (' + l.events.slice(-2).map((e) => (e.side === 'home' ? m.home : m.away) + (e.t ? ' ' + e.t + (m.sport === 'football' ? "'" : '') : '')).join(', ') + ')' : 'time decay with the current score';
        flags.push(['Market movement', m.home + ' win odds moved ' + odds(op[0]) + ' to ' + odds(op[op.length - 1]) + '. Possible explanation: ' + why + '.']);
      }
    }
    return flags;
  }
  function statBar(label, h, a, suffix) {
    const tot = (h || 0) + (a || 0) || 1;
    return '<div class="stb"><span class="stb-v">' + h + (suffix || '') + '</span><div class="stb-m"><span class="stb-l">' + label + '</span><div class="stb-t"><i class="stb-h" style="width:' + ((h / tot) * 100).toFixed(1) + '%"></i><i class="stb-a" style="width:' + ((a / tot) * 100).toFixed(1) + '%"></i></div></div><span class="stb-v">' + a + (suffix || '') + '</span></div>';
  }
  const pctB = (x) => (x > 0.995 ? '>99%' : x < 0.005 ? '<1%' : pct(x, 0));
  function radar(m, big) {
    const t = now(); const l = D.live(m, t); const flags = liveFlags(m, l);
    const head = '<a class="rd-h" href="' + mlink(m) + '"><div class="rd-meta">' + sportTag(m.sport) + '<span>' + esc(m.league) + '</span>' + statusTag(m) + '</div>' +
      '<div class="rd-sc"><span class="rd-t">' + esc(m.home) + '</span><span class="rd-n">' + (l.h == null ? '<em>vs</em>' : l.h + '<i>:</i>' + l.a) + '</span><span class="rd-t r">' + esc(m.away) + '</span></div>' +
      (l.sets && l.sets.length ? '<div class="rd-sets">Sets: ' + l.sets.map((s) => s[0] + '-' + s[1]).join(', ') + '</div>' : '') +
      '<div class="rd-prog"><i style="width:' + Math.round(l.progress * 100) + '%"></i></div></a>';
    let body = '';
    if (l.stats) body += '<div class="stbs">' + statBar('Shots', l.stats.shots[0], l.stats.shots[1]) + statBar('On target', l.stats.sot[0], l.stats.sot[1]) + statBar('Possession', l.stats.poss[0], l.stats.poss[1], '%') + statBar('Corners', l.stats.corners[0], l.stats.corners[1]) + statBar('Cards', l.stats.cards[0], l.stats.cards[1]) + '</div>';
    else body += '<div class="insuff-b">' + icon('info') + '<span>Shots, possession and similar stats: <b>Insufficient data.</b> The demo feed only provides score, clock and an in-play win estimate for ' + esc(D.SPORTS[m.sport].name.toLowerCase()) + '.</span></div>';
    body += '<div class="rd-row"><div class="rd-mom"><span class="lbl">Momentum <em>' + esc(m.home) + ' up, ' + esc(m.away) + ' down</em></span>' + momentumBar(l.momentum) + '</div>';
    if (l.pHome != null) body += '<div class="rd-wp"><span class="lbl">In-play estimate</span><b>' + pctB(l.pHome) + '</b><small>' + esc(m.home) + (m.sport === 'football' && l.pDraw != null ? ' · draw ' + pctB(l.pDraw) : '') + '</small></div>';
    body += '</div>';
    if (l.oddsPath && l.oddsPath.length >= 2) body += '<div class="rd-odds"><span class="lbl">Odds movement <em>' + esc(m.home) + ' win, demo in-play feed</em></span>' + (big ? chart('line', { series: [{ name: m.home + ' win', values: l.oddsPath, color: 'var(--info)' }], labels: l.oddsPath.map((_, i) => (m.sport === 'football' ? Math.min(i * 5, 90) + "'" : 'T' + i)), yFmt: (v) => v.toFixed(2), height: 150 }) : spark(l.oddsPath, 260, 34, 'var(--info)')) + '</div>';
    else body += '<div class="rd-odds dim">Odds movement: insufficient in-play price data yet.</div>';
    if (l.events && l.events.length && big) body += '<div class="rd-ev"><span class="lbl">Scoring events</span>' + l.events.map((e) => '<span class="ev ev-' + e.side + '">' + (e.t ? e.t + (m.sport === 'football' ? "'" : '') + ' ' : '') + esc(e.type) + ' · ' + esc(e.side === 'home' ? m.home : m.away) + '</span>').join('') + '</div>';
    body += flags.length ? '<div class="flags">' + flags.map((f) => '<div class="flag"><b>' + icon('zap') + f[0] + '</b><span>' + esc(f[1]) + '</span></div>').join('') + '</div>' : '<div class="flags none">No flags. Nothing unusual in score, momentum or price.</div>';
    return '<article class="radar ' + (big ? 'big' : '') + '">' + head + '<div class="rd-b">' + body + '</div></article>';
  }

  /* ---------------- MATCH ANALYSIS ---------------- */
  const initials = (n) => n.split(/\s+/).filter((w) => /^[A-Z0-9]/.test(w)).slice(0, 3).map((w) => w[0]).join('') || n.slice(0, 2).toUpperCase();
  const formPills = (games) => '<span class="fp">' + games.map((g) => '<i class="fp-' + g.res.toLowerCase() + '" data-tip="' + esc(g.date + ' ' + (g.home ? 'vs ' : 'at ') + g.opp + ' ' + g.f + '-' + g.a) + '">' + g.res + '</i>').join('') + '</span>';
  function factorRows(factors) {
    return '<div class="fct">' + factors.map((f) => '<div class="fct-r ' + (f.missing ? 'miss' : '') + '"><span class="fct-k">' + esc(f.label.toUpperCase()) + '</span><span class="fct-b"><i class="' + (f.value >= 0 ? 'pos' : 'neg') + '" style="width:' + Math.min(50, Math.abs(f.value) * 6) + '%;' + (f.value >= 0 ? 'left:50%' : 'right:50%') + '"></i></span><b class="fct-v ' + plClass(f.value) + '">' + (f.missing ? 'n/a' : signed(f.value, 0)) + '</b><span class="fct-d">' + esc(f.detail) + '</span></div>').join('') + '</div>';
  }
  function bulletList(items, cls) { return '<ul class="bl ' + (cls || '') + '">' + items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'; }

  function matchAnalysisTab(m, a) {
    const sels = a.markets.flatMap((x) => x.sels);
    const s = sels.find((x) => x.mk + '|' + x.key === S.ui.matchSel[m.id]) || a.best;
    const selTable = '<div class="tw"><table class="tbl tbl-sel"><thead><tr><th>Market</th><th>Selection</th><th class="num">Odds</th><th class="num">Model</th><th class="num">Implied</th><th class="num">Diff.</th><th class="num">Conf.</th></tr></thead><tbody>' +
      sels.map((x) => '<tr class="clk ' + (x === s ? 'on' : '') + '" data-act="msel" data-id="' + esc(m.id) + '" data-v="' + x.mk + '|' + x.key + '" tabindex="0"><td>' + esc(x.mkName) + '</td><td><b>' + esc(selText(x)) + '</b>' + (x === a.best ? ' <span class="best">best</span>' : '') + '</td><td class="num">' + odds(x.odds) + '</td><td class="num">' + pct(x.model) + '</td><td class="num">' + pct(x.implied) + '</td><td class="num">' + valTag(x.value) + '</td><td class="num">' + confTag(x.conf) + '</td></tr>').join('') + '</tbody></table></div>';
    const model = '<div class="mdl">' +
      '<div class="mdl-sel"><span>' + esc(s.mkName) + '</span><b>' + esc(selText(s)) + '</b><em>@ ' + odds(s.odds) + '</em></div>' +
      '<div class="kg k3">' + kpi('Model probability', pct(s.model), 'internal estimate') + kpi('Implied probability', pct(s.implied), 'from odds, incl. margin') + kpi('Difference', pp(s.value), 'model minus implied', s.value > 0 ? 'pos' : 'neg') +
      kpi('Potential value', signed(s.ev * 100) + '%', 'expected return per unit', s.ev > 0 ? 'pos' : 'neg', 'Model probability x odds - 1. Only as good as the model estimate.') + kpi('Confidence', confTag(s.conf), s.conf.level + ' · agreement ' + Math.round(s.conf.agreement * 100) + '%') + kpi('Model score', s.score + '<small>/100</small>', 'internal estimate', '', 'Sum of factor points mapped to 1-99. Not a probability.') + '</div>' +
      '<div class="sub-h">Model transparency <small>factor points from this selection\'s perspective</small></div>' + factorRows(s.factors) + '</div>';
    const ai = '<p class="reason">' + esc(s.reasoning) + '</p>' +
      (s.positives.length ? '<div class="sub-h pos">Arguments for</div>' + bulletList(s.positives.map((f) => f.label + ' (' + signed(f.value, 0) + '): ' + f.detail)) : '<div class="sub-h">Arguments for</div><p class="dim">No supporting factor of note.</p>') +
      '<div class="llm-note">' + icon('info') + 'Text produced by the deterministic demo engine. ' + (E.llm.enabled ? 'LLM explanations enabled.' : 'An LLM can be connected in engine.js (SIT.Engine.llm).') + '</div>';
    const risks = '<div class="risk-h">' + riskTag(s.risk.level) + '<span>' + s.risk.risks.length + ' flagged risk(s) · arguments against are always shown</span></div>' + bulletList(s.against, 'against');
    return '<div class="grid">' +
      panel('AI analysis', ai, { cls: 'c7' }) +
      panel('Risks <small>arguments against</small>', risks, { cls: 'c5 risk-panel' }) +
      panel('Model', model, { cls: 'c7', right: D.status(m) === 'finished' ? '' : '<button type="button" class="btn btn-sm" data-act="track" data-id="' + esc(m.id) + '" data-v="' + s.mk + '|' + s.key + '">' + icon('plus') + 'Track in journal</button>' }) +
      panel('All selections', selTable, { cls: 'c5', flush: true }) + '</div>';
  }
  function statsTab(m) {
    const c = m.ctx; const sp = m.sport; const team = !['tennis', 'mma'].includes(sp); const unit = D.SPORTS[sp].unit;
    const ppg = (g) => (g.slice(0, 5).reduce((a, x) => a + (x.res === 'W' ? 3 : x.res === 'D' ? 1 : 0), 0) / 5).toFixed(2);
    const formRow = (name, g) => '<div class="form-r"><b>' + esc(name) + '</b>' + formPills(g) + '<span class="dim">' + ppg(g) + ' pts/g last 5 · ' + g.reduce((a, x) => a + x.f, 0) + '-' + g.reduce((a, x) => a + x.a, 0) + ' ' + unit + ' last 10</span></div>';
    const lastList = (name, g) => '<div class="last"><div class="sub-h">' + esc(name) + '</div>' + g.slice(0, 6).map((x) => '<div class="last-r"><span class="dim">' + fmtD(U.parseDate(x.date).getTime()) + '</span><span>' + (x.home ? 'vs ' : '@ ') + esc(x.opp) + '</span><b class="fp-' + x.res.toLowerCase() + '">' + x.f + '-' + x.a + '</b></div>').join('') + '</div>';
    const form = formRow(m.home, c.formH) + formRow(m.away, c.formA) + '<div class="two">' + lastList(m.home, c.formH) + lastList(m.away, c.formA) + '</div>';
    const h2h = c.h2h.length ? '<div class="h2h-s">' + (() => { const hw = c.h2h.filter((x) => x.aScore > x.bScore).length, aw = c.h2h.filter((x) => x.aScore < x.bScore).length; return '<span><b>' + hw + '</b>' + esc(m.home) + '</span><span><b>' + (c.h2h.length - hw - aw) + '</b>Draws</span><span><b>' + aw + '</b>' + esc(m.away) + '</span>'; })() + '</div>' +
      c.h2h.map((x) => '<div class="last-r"><span class="dim">' + fmtD(U.parseDate(x.date).getTime()) + '</span><span>' + esc(x.home) + ' vs ' + esc(x.away) + '</span><b>' + x.hs + '-' + x.as + '</b></div>').join('') + (c.h2h.length < 3 ? note('Small sample: ' + c.h2h.length + ' meeting(s). Treat head to head as weak evidence.', 'warn') : '')
      : '<p class="insuff">Insufficient data. No previous meetings in the data set.</p>';
    const split = (name, s, where) => '<div class="split"><b>' + esc(name) + ' <small>' + where + ', last 10</small></b><div class="split-n"><span><i>W-D-L</i>' + s.w + '-' + s.d + '-' + s.l + '</span><span><i>Scored</i>' + s.avgF.toFixed(1) + '</span><span><i>Conceded</i>' + s.avgA.toFixed(1) + '</span></div></div>';
    const ha = team ? split(m.home, c.splitH, 'at home') + split(m.away, c.splitA, 'away') : '<p class="insuff">Not applicable. ' + esc(D.SPORTS[sp].name) + ' events are on neutral ground.</p>';
    const tf = (E.analyzeMatch(m, now()).totalFactors) || [];
    const scoring = tf.length ? factorRows(tf) + '<p class="dim small">Points are from the Over perspective for the main total line (' + m.markets.find((x) => x.key === 'OU').line + ').</p>' : '<p class="insuff">Insufficient data.</p>';
    const nx = (name, n) => (n ? '<div class="last-r"><span>' + esc(name) + '</span><span>' + (n.european ? '<span class="cat cat-variance">' + esc(n.comp) + '</span> ' : esc(n.comp) + ' ') + 'vs ' + esc(n.opp) + '</span><b>in ' + n.days + 'd</b></div>' : '');
    const sched = '<div class="kg k2">' + (sp === 'mma' ? kpi('Rest', 'n/a', 'camp length unknown') + kpi('', '', '') : kpi(m.home + ' rest', c.restH + ' days', 'since last game') + kpi(m.away + ' rest', c.restA + ' days', 'since last game')) + '</div>' +
      (c.nextH || c.nextA ? '<div class="sub-h">Next fixtures</div>' + nx(m.home, c.nextH) + nx(m.away, c.nextA) : '') +
      (c.lastMatchMins ? '<div class="sub-h">Previous match duration</div><div class="last-r"><span>' + esc(m.home) + '</span><b>' + c.lastMatchMins.home + ' min</b></div><div class="last-r"><span>' + esc(m.away) + '</span><b>' + c.lastMatchMins.away + ' min</b></div>' : '');
    let motiv = '';
    if (c.table) {
      const rows = c.table.rows; const rh = rows.find((x) => x.team === m.home), ra = rows.find((x) => x.team === m.away); const top = rows[0];
      motiv = '<p class="dim small">Objective standings only. No assumptions about attitude or desire.</p><div class="tw"><table class="tbl tbl-mini"><thead><tr><th>#</th><th>Team</th><th class="num">P</th><th class="num">W</th>' + (sp === 'football' ? '<th class="num">D</th>' : '') + '<th class="num">L</th><th class="num">Pts</th><th class="num">Gap to 1st</th></tr></thead><tbody>' +
        rows.map((x) => '<tr class="' + (x === rh || x === ra ? 'hl' : '') + '"><td>' + x.pos + '</td><td>' + esc(x.team) + '</td><td class="num">' + x.p + '</td><td class="num">' + x.w + '</td>' + (sp === 'football' ? '<td class="num">' + x.d + '</td>' : '') + '<td class="num">' + x.l + '</td><td class="num"><b>' + x.pts + '</b></td><td class="num">' + (x === top ? '-' : top.pts - x.pts) + '</td></tr>').join('') + '</tbody></table></div>';
    } else if (c.series) motiv = '<div class="kg k3">' + kpi('Series', c.series.h + '-' + c.series.a, 'best of ' + c.series.bestOf) + kpi('Game', String(c.series.game), 'in series') + kpi('Elimination game', c.series.h === 2 || c.series.a === 2 ? 'Yes' : 'No', 'objective') + '</div>';
    else motiv = '<p class="insuff">Insufficient data. No standings for this competition in the demo feed' + (['basketball', 'hockey'].includes(sp) ? ' this early in the season' : '') + '.</p>';
    return '<div class="grid">' + panel('Form <small>last 10, newest first</small>', form, { cls: 'c7' }) + panel('Head to head', h2h, { cls: 'c5' }) +
      panel('Home / away', ha, { cls: 'c4' }) + panel('Scoring profile', scoring, { cls: 'c4' }) + panel('Schedule & rest', sched, { cls: 'c4' }) +
      panel('Motivation & standings', motiv, { cls: 'c12', flush: !!c.table }) + '</div>';
  }
  function teamTab(m) {
    const c = m.ctx; const team = !['tennis', 'mma'].includes(m.sport);
    const injT = (side) => { const inj = c.injuries[side], sus = c.suspensions[side]; if (!inj.length && !sus.length) return '<p class="dim">No reported absences.</p>';
      return inj.map((p) => '<div class="pl-r"><span class="pl-s ' + (p.status === 'Out' ? 'out' : 'doubt') + '">' + p.status + '</span><b>' + esc(p.name) + '</b><span class="dim">' + esc(p.role) + ' · ' + esc(p.reason) + (p.back ? ' · back ~' + fmtD(U.parseDate(p.back).getTime()) : '') + '</span><em data-tip="Share of team output (demo stat)">' + p.contrib + '%</em></div>').join('') +
        sus.map((p) => '<div class="pl-r"><span class="pl-s out">Susp.</span><b>' + esc(p.name) + '</b><span class="dim">' + esc(p.role) + ' · ' + esc(p.reason) + '</span><em>' + p.contrib + '%</em></div>').join(''); };
    const abs = team ? '<div class="two"><div><div class="sub-h">' + esc(m.home) + '</div>' + injT('home') + '</div><div><div class="sub-h">' + esc(m.away) + '</div>' + injT('away') + '</div></div>' : '<p class="insuff">Insufficient data. No injury feed for individual sports in the demo provider.</p>';
    let lu;
    if (m.sport !== 'football') lu = '<p class="insuff">Insufficient data. Expected lineups are only available for football in the demo feed.</p>';
    else if (!c.lineups) lu = '<p class="insuff">Insufficient data. The lineup feed has nothing for this match yet. The model lowers confidence accordingly.</p>';
    else lu = '<div class="two">' + ['home', 'away'].map((sd) => '<div><div class="sub-h">' + esc(sd === 'home' ? m.home : m.away) + ' <small>' + c.lineups[sd].formation + ', expected</small></div><ol class="xi">' + c.lineups[sd].players.map((p) => '<li class="' + (p.doubt ? 'doubt' : '') + '"><span>' + esc(p.name) + '</span><small>' + esc(p.role) + (p.doubt ? ' · doubtful' : '') + '</small></li>').join('') + '</ol></div>').join('') + '</div>';
    const news = D.newsForMatch(m, now());
    return '<div class="grid">' + panel('Injuries & suspensions', abs, { cls: 'c6' }) + panel('Expected lineups', lu, { cls: 'c6' }) +
      panel('Match news <em class="cnt">' + news.length + '</em>', news.length ? '<div class="news-l">' + news.map((n) => newsCard(n)).join('') + '</div>' : empty('No linked news', 'No news items mention this match in the demo feed.'), { cls: 'c12' }) + '</div>';
  }
  function oddsTab(m) {
    const t = now(); const mks = D.markets(m, t);
    const curSel = (S.ui.matchSel[m.id] || '').split('|')[0];
    const mkKey = mks.some((x) => x.key === curSel) ? curSel : mks[0].key; const mk = mks.find((x) => x.key === mkKey);
    const COLORS = ['var(--signal)', 'var(--info)', 'var(--muted)'];
    const tbl = '<div class="tw"><table class="tbl"><thead><tr><th>Market</th><th>Selection</th><th class="num">Opening</th><th class="num">Current</th><th class="num">Move</th><th class="num">Implied</th></tr></thead><tbody>' +
      mks.map((x) => { const over = x.sels.reduce((a, s) => a + 1 / s.odds, 0); return x.sels.map((s, i) => { const mv = (s.odds - s.open) / s.open; return '<tr>' + (i === 0 ? '<td rowspan="' + x.sels.length + '">' + esc(x.name) + '<br><small class="dim">margin ' + ((over - 1) * 100).toFixed(1) + '%</small></td>' : '') + '<td><b>' + esc(x.key === 'BTTS' ? 'BTTS ' + s.label : s.label) + '</b></td><td class="num">' + odds(s.open) + '</td><td class="num"><b>' + odds(s.odds) + '</b></td><td class="num ' + (Math.abs(mv) < 0.005 ? '' : mv < 0 ? 'neg' : 'pos') + '">' + (mv > 0 ? '+' : '') + (mv * 100).toFixed(1) + '%</td><td class="num">' + pct(1 / s.odds) + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div>';
    const hist = mk.sels.map((s) => D.oddsHistory(m, mk.key, s.key));
    const visible = hist.map((h) => h.filter((p) => p.t <= t));
    const n = Math.max(...visible.map((h) => h.length));
    const ch = n >= 2 ? chart('line', { series: mk.sels.map((s, i) => ({ name: s.label, values: visible[i].map((p) => p.o), color: COLORS[i] })), labels: visible[0].map((p) => dayLabel(p.t) + ' ' + time(p.t)), yFmt: (v) => v.toFixed(2), height: 220 }) + legend(mk.sels.map((s, i) => [s.label, COLORS[i]])) : '<div class="chart-empty">Not enough price history yet. The demo feed opens markets 72 hours before start.</div>';
    const moves = mk.sels.map((s) => ({ s, mv: (s.odds - s.open) / s.open })).sort((a, b) => Math.abs(b.mv) - Math.abs(a.mv));
    const big = moves[0];
    const news = D.newsForMatch(m, t).filter((x) => x.effect);
    let expl;
    if (Math.abs(big.mv) < 0.05) expl = 'Prices are broadly stable (largest move ' + (big.mv * 100).toFixed(1) + '%). No explanation needed.';
    else {
      const side = big.s.key; const shortening = big.mv < 0;
      const linked = news.filter((x) => (side === 'home' || side === 'away') && x.effect.side && ((x.effect.side === side) !== shortening));
      expl = big.s.label + ' moved ' + odds(big.s.open) + ' to ' + odds(big.s.odds) + ' (' + signed(big.mv * 100) + '%). ' +
        (linked.length ? 'Linked news that is consistent with this move: ' + linked.map((x) => x.headline).join('; ') + '.' : 'No linked news found in the demo feed. The move may reflect betting volume or information the model does not see.');
    }
    return '<div class="grid">' + panel('Market odds', tbl, { cls: 'c6', flush: true }) +
      panel('Odds movement', '<div class="mk-pick">' + mks.map((x) => chip('mk-pick', m.id + '|' + x.key, esc(x.name), x.key === mkKey)).join('') + '</div>' + ch + '<div class="expl"><span class="lbl">Possible explanation <em>AI interpretation, not confirmed</em></span><p>' + esc(expl) + '</p></div>', { cls: 'c6' }) + '</div>';
  }
  function reviewHtml(b) {
    const r = b.review; if (!r) return '<p class="insuff">Post-match analysis is available after settlement.</p>';
    return '<div class="rv">' +
      '<div class="rv-b"><span class="lbl">Before match</span><p>' + esc(r.before) + '</p></div>' +
      '<div class="rv-b"><span class="lbl">After match</span><p>' + esc(r.after) + '</p></div>' +
      '<div class="two"><div class="rv-b"><span class="lbl pos">What was correct</span>' + bulletList(r.correct) + '</div><div class="rv-b"><span class="lbl neg">What was wrong</span>' + bulletList(r.wrong) + '</div></div>' +
      '<div class="rv-b"><span class="lbl">Model error</span><p>' + esc(r.modelError) + '</p></div>' +
      '<div class="rv-b lesson"><span class="lbl">Lesson</span><p>' + esc(r.lesson) + '</p></div></div>';
  }
  V.match = (p) => {
    const m = p[0] && D.match(p[0]);
    if (!m) return empty('Match not found', 'This match id is not in the demo feed.', '<a class="btn" href="#/scanner">Open scanner</a>');
    const t = now(), st = D.status(m, t), a = an(m), l = D.live(m, t);
    const aiBet = S.bets.ai.find((b) => b.matchId === m.id); const uBets = S.bets.user.filter((b) => b.matchId === m.id);
    const tabList = [['analysis', 'AI analysis'], ['stats', 'Form & stats'], ['team', 'Team news'], ['odds', 'Odds'], st !== 'upcoming' ? ['live', st === 'live' ? 'Live radar' : 'Match stats'] : null, aiBet && aiBet.review ? ['review', 'Post-match'] : null].filter(Boolean);
    let tab = S.ui.matchTab[m.id] || (st === 'live' ? 'live' : 'analysis'); if (!tabList.some((x) => x[0] === tab)) tab = 'analysis';
    const tb = m.ctx.table; const pos = (n) => { if (!tb) return ''; const r = tb.rows.find((x) => x.team === n); return r ? r.pos + ordinal(r.pos) + ' · ' + r.pts + ' pts' : ''; };
    const side = (n, sub) => '<div class="mh-side"><span class="crest">' + esc(initials(n)) + '</span><b>' + esc(n) + '</b><small>' + esc(sub) + '</small></div>';
    const head = '<div class="mh">' +
      '<div class="mh-meta"><a href="#/scanner" class="back" aria-label="Back to scanner">' + icon('chevL') + '</a>' + sportTag(m.sport) + '<span>' + esc(m.league) + ' · ' + esc(m.country) + '</span><span class="dim">' + dateTime(m.start) + '</span>' + statusTag(m) + demoTag() + '</div>' +
      '<div class="mh-teams">' + side(m.home, pos(m.home) || (['tennis', 'mma'].includes(m.sport) ? 'Rating ' + m.homeR : 'Home')) +
      '<div class="mh-mid">' + (st === 'upcoming' ? '<span class="mh-time">' + time(m.start) + '</span><small>' + dayLabel(m.start) + '</small>' : '<span class="mh-score ' + (st === 'live' ? 'live' : '') + '">' + (l.h == null ? 'vs' : l.h + '<i>:</i>' + l.a) + '</span><small>' + esc(st === 'finished' ? D.scoreText(m) : l.label) + '</small>') + '</div>' +
      side(m.away, pos(m.away) || (['tennis', 'mma'].includes(m.sport) ? 'Rating ' + m.awayR : 'Away')) + '</div>' +
      '<div class="mh-sum">' + (st !== 'finished' ? '<span><i>Best estimate</i><b>' + esc(selText(a.best)) + ' @ ' + odds(a.best.odds) + '</b></span><span><i>Difference</i>' + valTag(a.best.value) + '</span><span><i>Confidence</i>' + confTag(a.best.conf) + '</span><span><i>Interest</i><b>' + a.interest + '</b></span>' : '') +
      (aiBet ? '<button type="button" class="aib" data-act="ai-bet" data-id="' + aiBet.id + '">AI bet #' + aiBet.no + ': ' + esc(aiBet.selection) + ' ' + resTag(aiBet) + '</button>' : '') +
      (uBets.length ? '<a class="aib" href="#/journal">Your bets: ' + uBets.length + '</a>' : '') + '</div></div>';
    let body;
    if (tab === 'stats') body = statsTab(m);
    else if (tab === 'team') body = teamTab(m);
    else if (tab === 'odds') body = oddsTab(m);
    else if (tab === 'live') body = '<div class="grid">' + panel(null, radar(m, true), { cls: 'c12', flush: true }) + '</div>';
    else if (tab === 'review') body = '<div class="grid">' + panel('Post-match analysis <small>AI bet #' + aiBet.no + '</small>', reviewHtml(aiBet), { cls: 'c12' }) + '</div>';
    else body = matchAnalysisTab(m, a);
    return head + tabs('mtab', tabList, tab, 'mtabs') + '<div class="mt-body" data-mid="' + esc(m.id) + '">' + body + '</div>';
  };
  const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  on('mtab', (el) => { const id = document.querySelector('.mt-body').dataset.mid; S.ui.matchTab[id] = el.dataset.v; save(); rerender(); });
  on('msel', (el) => { S.ui.matchSel[el.dataset.id] = el.dataset.v; save(); rerender(); });
  on('mk-pick', (el) => { const [id, k] = el.dataset.v.split('|'); S.ui.matchSel[id] = k + '|'; save(); rerender(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr.clk')) e.target.click(); });

  /* ---------------- OPPORTUNITIES + VALUE FINDER ---------------- */
  V.opportunities = () => {
    const all = opportunities(); const tab = S.ui.oppTab;
    const cnt = (c) => all.filter((x) => x.a.categories.includes(c)).length;
    const tabList = [['all', 'All', all.length], ['interesting', 'Interesting', cnt('interesting')], ['signal', 'Statistical signal', cnt('signal')], ['discrepancy', 'Model-market discrepancy', cnt('discrepancy')], ['confidence', 'High confidence', cnt('confidence')], ['variance', 'High variance', cnt('variance')], ['live', 'Live', cnt('live')], ['value', 'Value finder', null]];
    let body;
    if (tab === 'value') {
      const min = +S.ui.vfMin / 100;
      const rows = windowMatches().flatMap((m) => an(m).markets.flatMap((mk) => mk.sels.map((s) => ({ m, s })))).filter((x) => x.s.value >= min);
      body = note('Potential statistical value: selections where the model probability exceeds the implied probability. A positive difference is an internal estimate and is never guaranteed. Most rows will still lose.', 'warn') +
        '<div class="toolbar">' + seg('vf-min', [['1', '1+ pp'], ['2', '2+ pp'], ['3', '3+ pp'], ['5', '5+ pp']], S.ui.vfMin) + '<span class="dim">' + rows.length + ' selection(s) in the next 36h</span></div>' +
        panel(null, table('vf', [
          { k: 'match', l: 'Match', f: (r) => '<a href="' + mlink(r.m) + '" class="tl">' + sportTag(r.m.sport) + '<span><b>' + esc(r.m.home) + ' vs ' + esc(r.m.away) + '</b><small>' + esc(r.m.league) + ' · ' + dateTime(r.m.start) + '</small></span></a>', v: (r) => r.m.start },
          { k: 'sel', l: 'Selection', f: (r) => esc(selText(r.s)) + '<br><small class="dim">' + esc(r.s.mkName) + '</small>' },
          { k: 'odds', l: 'Odds', num: true, f: (r) => odds(r.s.odds), v: (r) => r.s.odds },
          { k: 'model', l: 'Model', num: true, f: (r) => pct(r.s.model), v: (r) => r.s.model },
          { k: 'imp', l: 'Implied', num: true, f: (r) => pct(r.s.implied), v: (r) => r.s.implied },
          { k: 'val', l: 'Diff.', num: true, f: (r) => valTag(r.s.value), v: (r) => r.s.value },
          { k: 'ev', l: 'EV', num: true, f: (r) => signed(r.s.ev * 100) + '%', v: (r) => r.s.ev },
          { k: 'conf', l: 'Conf.', num: true, f: (r) => confTag(r.s.conf), v: (r) => r.s.conf.value },
          { k: 'risk', l: 'Risk', f: (r) => riskTag(r.s.risk.level), v: (r) => r.s.risk.score }
        ], rows, { sort: { col: 'val', dir: 'desc' }, empty: 'No selection reaches this threshold.' }), { flush: true });
    } else {
      const list = (tab === 'all' ? all : all.filter((x) => x.a.categories.includes(tab))).sort((x, y) => y.a.interest - x.a.interest);
      body = (tab !== 'all' ? note('<b>' + CAT[tab][0] + ':</b> ' + esc(CAT[tab][1])) : '') +
        (list.length ? '<div class="opp-grid wide">' + list.map((x) => oppCard(x, { why: true })).join('') + '</div>' : empty('Nothing in this category right now', 'Categories update as prices, news and match states change.'));
    }
    return pageHead('Opportunities', 'Model-market discrepancies and statistical signals for the next 36 hours. Not tips, not guarantees. ' + demoTag()) + tabs('opp-tab', tabList, tab, 'hscroll') + body;
  };
  on('opp-tab', (el) => { S.ui.oppTab = el.dataset.v; save(); rerender(); });
  on('vf-min', (el) => { S.ui.vfMin = el.dataset.v; save(); rerender(); });

  /* ---------------- LIVE RADAR ---------------- */
  const clockBtns = () => '<div class="clock-ctl"><span class="dim">Demo clock</span>' + [['15', '+15m'], ['60', '+1h'], ['360', '+6h']].map(([v, l]) => '<button type="button" class="btn btn-sm" data-act="clock" data-v="' + v + '">' + icon('ff') + l + '</button>').join('') + (SIT.clock.offset ? '<button type="button" class="btn btn-sm btn-ghost" data-act="clock" data-v="reset">Reset</button>' : '') + '</div>';
  V.live = () => {
    const t = now(); const td = todayStr(); const sp = S.ui.liveSport || 'all';
    const all = D.matchesInRange(U.addDays(td, -1), 2);
    const live = all.filter((m) => D.status(m, t) === 'live');
    const shown = live.filter((m) => sp === 'all' || m.sport === sp);
    const recent = all.filter((m) => D.status(m, t) === 'finished' && t - (m.start + m.dur * 60000) < 3 * 3600e3).slice(-8).reverse();
    const next = all.filter((m) => D.status(m, t) === 'upcoming').slice(0, 5);
    const cnt = {}; live.forEach((m) => (cnt[m.sport] = (cnt[m.sport] || 0) + 1));
    return pageHead('Live radar', 'In-play scores, stats, momentum and price movement. Updates every 20 seconds. ' + demoTag(), clockBtns()) +
      '<div class="chips hscroll">' + chip('live-sport', 'all', 'All <em>' + live.length + '</em>', sp === 'all') + Object.values(D.SPORTS).filter((x) => cnt[x.id]).map((x) => chip('live-sport', x.id, esc(x.name) + ' <em>' + cnt[x.id] + '</em>', sp === x.id)).join('') + '</div>' +
      (shown.length ? '<div class="radar-grid">' + shown.map((m) => radar(m, false)).join('') + '</div>' : empty('Nothing live right now', 'Fast-forward the demo clock or check upcoming events below.')) +
      '<div class="grid mt">' + panel('Recently finished', recent.length ? '<div class="mlist">' + recent.map((m) => matchRow(m, { league: true, noAn: true })).join('') + '</div>' : empty('Nothing finished in the last 3 hours', ''), { cls: 'c6', flush: true }) +
      panel('Starting next', next.length ? '<div class="mlist">' + next.map((m) => matchRow(m, { league: true })).join('') + '</div>' : empty('No upcoming events', ''), { cls: 'c6', flush: true }) + '</div>';
  };
  on('live-sport', (el) => { S.ui.liveSport = el.dataset.v; save(); rerender(); });
  on('clock', (el) => {
    const v = el.dataset.v;
    S.settings.clockOffset = v === 'reset' ? 0 : (S.settings.clockOffset || 0) + Number(v) * 60000;
    SIT.clock.offset = S.settings.clockOffset; E.clearCache();
    const n = A.settleAll(false); save();
    toast(v === 'reset' ? 'Demo clock reset to real time.' : 'Demo clock moved forward ' + (v >= 60 ? v / 60 + 'h' : v + 'm') + (n ? '. ' + n + ' bet(s) settled.' : '.'));
    rerender();
  });

  /* ---------------- NEWS ---------------- */
  V.news = () => {
    const t = now(), td = todayStr(); const fs = S.ui.newsSport, fi = S.ui.newsImpact;
    const seen = new Set();
    let list = D.news(td).concat(D.news(U.addDays(td, -1)), D.news(U.addDays(td, -2))).filter((n) => n.time <= t && !seen.has(n.id) && seen.add(n.id));
    const total = list.length;
    if (fs !== 'all') list = list.filter((n) => n.sport === fs);
    if (fi !== 'all') list = list.filter((n) => n.impact === fi);
    list.sort((a, b) => b.time - a.time);
    const upd = (k) => (v) => { S.ui[k] = v; save(); rerender(); };
    return pageHead('Sports news', 'Facts and interpretation are kept apart. "Why it matters" is an AI interpretation labelled as such. ' + demoTag()) +
      '<div class="filters">' + dd('news-sport', [{ v: 'all', l: 'All sports' }].concat(Object.values(D.SPORTS).map((s) => ({ v: s.id, l: s.name }))), fs, upd('newsSport'), { label: 'Sport' }) +
      dd('news-impact', [['all', 'Any impact'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']].map(([v, l]) => ({ v, l })), fi, upd('newsImpact'), { label: 'Impact' }) +
      '<span class="dim">' + list.length + ' of ' + total + ' items, last 3 days</span></div>' +
      (list.length ? '<div class="news-l cols">' + list.map((n) => newsCard(n)).join('') + '</div>' : empty('No news for these filters', 'Try another sport or impact level.'));
  };

  /* ---------------- ANALYTICS (global + You vs AI) ---------------- */
  const mGroup = (b) => (['1X2', 'ML'].includes(b.marketKey) ? 'Result / winner' : b.marketKey === 'OU' ? 'Totals' : b.marketKey === 'BTTS' ? 'BTTS' : 'Other');
  function filterBets(f) {
    let bets = f.src === 'ai' ? S.bets.ai : f.src === 'user' ? S.bets.user : S.bets.ai.concat(S.bets.user);
    bets = rangeFilter(bets, f.range);
    if (f.sport !== 'all') bets = bets.filter((b) => b.sport === f.sport);
    if (f.league !== 'all') bets = bets.filter((b) => b.league === f.league);
    if (f.market !== 'all') bets = bets.filter((b) => mGroup(b) === f.market);
    if (f.odds !== 'all') bets = bets.filter((b) => oddsBucket(b.odds) === f.odds);
    if (f.result !== 'all') bets = bets.filter((b) => b.status === f.result);
    return bets;
  }
  function sampleNote(n) {
    if (n < 30) return note('Small sample: ' + n + ' settled bet(s). At this size results are dominated by variance. Do not draw conclusions.', 'warn');
    if (n < 100) return note('Moderate sample: ' + n + ' settled bets. ROI can still swing by several points either way.', '');
    return '';
  }
  const grpCols = (label) => [
    { k: 'key', l: label, f: (r) => '<b>' + esc(r.key) + '</b>' + (r.decided < 10 ? ' <span class="lown-t" data-tip="Fewer than 10 settled bets">low n</span>' : ''), v: (r) => r.key },
    { k: 'n', l: 'Bets', num: true, f: (r) => r.n, v: (r) => r.n },
    { k: 'wl', l: 'W-L', num: true, f: (r) => r.wins + '-' + r.losses },
    { k: 'wr', l: 'Win %', num: true, f: (r) => pct(r.winRate), v: (r) => r.winRate || 0 },
    { k: 'ao', l: 'Avg odds', num: true, f: (r) => odds(r.avgOdds), v: (r) => r.avgOdds || 0 },
    { k: 'pl', l: 'P/L', num: true, f: (r) => '<span class="' + plClass(r.pl) + '">' + money(r.pl, true) + '</span>', v: (r) => r.pl },
    { k: 'roi', l: 'ROI', num: true, f: (r) => '<span class="' + plClass(r.roi || 0) + '">' + pct(r.roi) + '</span>', v: (r) => r.roi || 0 }
  ];
  function dailyGrowth(owner, days) {
    const start = owner === 'ai' ? S.ai.startingBankroll : S.user.startingBankroll; const td = todayStr();
    const settled = S.bets[owner].filter((b) => b.status !== 'pending' && b.settledAt).sort((a, b) => a.settledAt - b.settledAt);
    const out = []; let i = 0, cum = 0;
    const from = U.addDays(td, -days);
    settled.forEach((b) => { if (b.settledAt < U.parseDate(from).getTime()) cum += b.pl; });
    const base = start + cum;
    while (i < settled.length && settled[i].settledAt < U.parseDate(from).getTime()) i++;
    let c2 = 0;
    for (let d = days; d >= 0; d--) {
      const end = U.parseDate(U.addDays(td, -d + 1)).getTime();
      while (i < settled.length && settled[i].settledAt < end) { c2 += settled[i].pl; i++; }
      out.push({ label: fmtD(end - 1), v: base ? (c2 / base) * 100 : 0 });
    }
    return out;
  }
  V.analytics = () => {
    const f = S.analytics; const tab = f.tab || 'global';
    const head = pageHead('Analytics', 'Performance of your bets and the AI paper account. Every view states its sample size. ' + demoTag()) + tabs('an-tab', [['global', 'Global analytics'], ['compare', 'You vs AI']], tab);
    if (tab === 'compare') return head + compareView();
    const upd = (k) => (v) => { f[k] = v; save(); rerender(); };
    const allB = S.bets.ai.concat(S.bets.user);
    const leagues = [...new Set(allB.map((b) => b.league))].sort();
    const bets = filterBets(f);
    const start = f.src === 'ai' ? S.ai.startingBankroll : f.src === 'user' ? S.user.startingBankroll : S.ai.startingBankroll + S.user.startingBankroll;
    const st = stats(bets, start);
    const lastRoll = st.rolling.length >= 20 ? st.rolling[st.rolling.length - 1] : null;
    const trend = lastRoll == null ? '<span class="dim">n/a</span>' : '<span class="' + plClass(lastRoll - (st.roi || 0)) + '">' + (lastRoll > (st.roi || 0) + 0.01 ? 'Improving' : lastRoll < (st.roi || 0) - 0.01 ? 'Declining' : 'Flat') + '</span>';
    const filters = '<div class="filters">' + seg('an-range', RANGES, f.range) +
      dd('an-src', [['all', 'You + AI'], ['ai', 'AI only'], ['user', 'You only']].map(([v, l]) => ({ v, l })), f.src, upd('src'), { label: 'Account' }) +
      dd('an-sport', [{ v: 'all', l: 'All sports' }].concat(Object.values(D.SPORTS).map((s) => ({ v: s.id, l: s.name, n: allB.filter((b) => b.sport === s.id).length }))), f.sport, upd('sport'), { label: 'Sport' }) +
      dd('an-league', [{ v: 'all', l: 'All leagues' }].concat(leagues.map((l) => ({ v: l, l }))), f.league, upd('league'), { label: 'League' }) +
      dd('an-market', ['all', 'Result / winner', 'Totals', 'BTTS', 'Other'].map((v) => ({ v, l: v === 'all' ? 'All markets' : v })), f.market, upd('market'), { label: 'Market' }) +
      dd('an-odds', [{ v: 'all', l: 'Any odds' }].concat(ODDS_BUCKETS.map((b) => ({ v: b[0], l: 'Odds ' + b[0] }))), f.odds, upd('odds'), { label: 'Odds range' }) +
      dd('an-result', [['all', 'Any result'], ['won', 'Won'], ['lost', 'Lost'], ['void', 'Void'], ['pending', 'Pending']].map(([v, l]) => ({ v, l })), f.result, upd('result'), { label: 'Result' }) +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="an-reset">Reset</button></div>';
    const kp = '<div class="kg k8">' + kpi('ROI', '<span class="' + plClass(st.roi || 0) + '">' + pct(st.roi) + '</span>', money(st.staked) + ' staked') + kpi('Win rate', pct(st.winRate), st.wins + 'W ' + st.losses + 'L') + kpi('P/L', '<span class="' + plClass(st.pl) + '">' + money(st.pl, true) + '</span>', '') + kpi('Avg odds', odds(st.avgOdds), '') +
      kpi('Sample size', String(st.decided), st.n + ' total · ' + st.pending + ' pending') + kpi('Max drawdown', money(st.maxDD), pct(st.maxDDPct) + ' of peak') + kpi('Trend', trend, lastRoll == null ? 'needs 20+ bets' : 'last 20: ' + pct(lastRoll), '', 'Rolling ROI of the last 20 settled bets compared with the overall ROI.') + kpi('Avg stake', st.avgStake ? money(st.avgStake) : '-', '') + '</div>';
    const cum = st.series;
    const ch = chart('line', { series: [{ name: 'Cumulative P/L', values: cum.map((p) => p.cum), color: 'var(--signal)' }], labels: cum.map((p) => fmtD(p.t)), yFmt: (v) => money(v), zero: true, area: true, height: 220 });
    const roll = chart('line', { series: [{ name: 'Rolling ROI (20)', values: st.rolling.map((v) => v * 100), color: 'var(--info)' }], labels: st.rolling.map((_, i) => '#' + (i + 1)), yFmt: (v) => v.toFixed(0) + '%', zero: true, height: 220 });
    const g = (fn, label, id) => panel('By ' + label.toLowerCase(), table(id, grpCols(label), groupStats(bets, fn), { sort: { col: 'n', dir: 'desc' } }), { cls: 'c6', flush: true });
    return head + filters + sampleNote(st.decided) + kp +
      '<div class="grid mt">' + panel('Cumulative P/L', ch, { cls: 'c7' }) + panel('Rolling ROI <small>last 20 settled bets</small>', roll, { cls: 'c5' }) +
      g((b) => D.SPORTS[b.sport] ? D.SPORTS[b.sport].name : b.sport, 'Sport', 'an-sp') + g(mGroup, 'Market', 'an-mk') + g((b) => oddsBucket(b.odds), 'Odds range', 'an-od') + g((b) => b.league, 'League', 'an-lg') + '</div>';
  };
  function compareView() {
    const range = S.analytics.range; const days = { '7D': 7, '30D': 30, '90D': 90 }[range] || A.HISTORY_DAYS;
    const ub = rangeFilter(S.bets.user, range), ab = rangeFilter(S.bets.ai, range);
    const us = stats(ub, S.user.startingBankroll), as = stats(ab, S.ai.startingBankroll);
    const perWeek = (bets) => (bets.length / Math.max(1, days / 7)).toFixed(1);
    const row = (l, u, a, tip) => '<tr><td' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + l + '</td><td class="num">' + u + '</td><td class="num">' + a + '</td></tr>';
    const c = (v, f) => '<span class="' + plClass(v || 0) + '">' + f + '</span>';
    const ai = new Map(S.bets.ai.map((b) => [b.matchId, b]));
    const overlap = S.bets.user.filter((b) => b.matchId && ai.has(b.matchId)); const same = overlap.filter((b) => ai.get(b.matchId).selKey === b.selKey && ai.get(b.matchId).marketKey === b.marketKey);
    const tbl = '<div class="tw"><table class="tbl cmp"><thead><tr><th>Metric</th><th class="num">You</th><th class="num">AI Analyst</th></tr></thead><tbody>' +
      row('Starting bankroll', money(S.user.startingBankroll), money(S.ai.startingBankroll)) + row('Current bankroll', money(bankroll('user')), money(bankroll('ai'))) +
      row('Bets in period', ub.length, ab.length) + row('Settled', us.decided, as.decided) + row('Bets per week', perWeek(ub), perWeek(ab)) +
      row('Win rate', pct(us.winRate), pct(as.winRate)) + row('ROI', c(us.roi, pct(us.roi)), c(as.roi, pct(as.roi))) + row('P/L', c(us.pl, money(us.pl, true)), c(as.pl, money(as.pl, true))) +
      row('P/L as % of start', c(us.pl, pct(us.pl / S.user.startingBankroll)), c(as.pl, pct(as.pl / S.ai.startingBankroll)), 'Normalises for different bankroll sizes') +
      row('Average odds', odds(us.avgOdds), odds(as.avgOdds)) + row('Average stake', us.avgStake ? money(us.avgStake) : '-', as.avgStake ? money(as.avgStake) : '-') +
      row('Largest win', money(us.largestWin), money(as.largestWin)) + row('Largest loss', money(us.largestLoss), money(as.largestLoss)) +
      row('Max drawdown', money(us.maxDD) + ' <small>' + pct(us.maxDDPct) + '</small>', money(as.maxDD) + ' <small>' + pct(as.maxDDPct) + '</small>') +
      row('Longest win streak', us.maxWin, as.maxWin) + row('Longest losing streak', us.maxLoss, as.maxLoss) + '</tbody></table></div>';
    const gu = dailyGrowth('user', days), ga = dailyGrowth('ai', days);
    const ch = chart('line', { series: [{ name: 'You', values: gu.map((p) => p.v), color: 'var(--info)' }, { name: 'AI', values: ga.map((p) => p.v), color: 'var(--signal)' }], labels: gu.map((p) => p.label), yFmt: (v) => v.toFixed(1) + '%', zero: true, height: 240 });
    return '<div class="toolbar">' + seg('an-range', RANGES, range) + '</div>' +
      note('Objective comparison only. Different numbers of bets, stake sizes and markets limit how directly these figures compare, and no winner is declared. Samples under 30 settled bets are mostly noise.', '') +
      '<div class="grid mt">' + panel('Side by side', tbl, { cls: 'c6', flush: true }) +
      panel('Bankroll change <small>% of bankroll at period start</small>', ch + legend([['You', 'var(--info)'], ['AI Analyst', 'var(--signal)']]), { cls: 'c6' }) +
      panel('Overlap', '<div class="kg k3">' + kpi('Shared matches', String(overlap.length), 'you and the AI both bet') + kpi('Same selection', String(same.length), 'identical market and pick') + kpi('Different selection', String(overlap.length - same.length), 'opposite or other market') + '</div>', { cls: 'c12' }) + '</div>';
  }
  on('an-tab', (el) => { S.analytics.tab = el.dataset.v; save(); rerender(); });
  on('an-range', (el) => { S.analytics.range = el.dataset.v; save(); rerender(); });
  on('an-reset', () => { const tab = S.analytics.tab; S.analytics = A.defaultState().analytics; S.analytics.tab = tab; save(); rerender(); });

  /* ---------------- AI ANALYST (performance) ---------------- */
  const CAL = [[0, 0.35, '<35%'], [0.35, 0.45, '35-45%'], [0.45, 0.55, '45-55%'], [0.55, 0.65, '55-65%'], [0.65, 1.01, '65%+']];
  V.ai = () => {
    const range = S.ui.aiRange; const bets = rangeFilter(S.bets.ai, range);
    const from = range === 'ALL' ? 0 : now() - ({ '7D': 7, '30D': 30, '90D': 90 }[range]) * DAY;
    const startBank = S.ai.startingBankroll + S.bets.ai.filter((b) => b.status !== 'pending' && b.settledAt < from && b.placedAt < from).reduce((a, b) => a + b.pl, 0);
    const st = stats(bets, startBank); const P = E.CONFIG.profiles[S.settings.risk];
    const bk = bankroll('ai');
    const kp = '<div class="kg k6">' +
      kpi('Starting bankroll', money(S.ai.startingBankroll), range === 'ALL' ? 'virtual' : money(startBank) + ' at period start') + kpi('Current bankroll', '<span class="' + plClass(bk - S.ai.startingBankroll) + '">' + money(bk) + '</span>', money(bk - S.ai.startingBankroll, true) + ' all time') +
      kpi('Total bets', String(st.n), st.pending + ' pending') + kpi('Wins', '<span class="pos">' + st.wins + '</span>', '') + kpi('Losses', '<span class="neg">' + st.losses + '</span>', st.voids ? st.voids + ' void' : '') + kpi('Pending', String(st.pending), '') +
      kpi('Win rate', pct(st.winRate), st.decided + ' settled') + kpi('ROI', '<span class="' + plClass(st.roi || 0) + '">' + pct(st.roi) + '</span>', money(st.staked) + ' staked') + kpi('Profit / loss', '<span class="' + plClass(st.pl) + '">' + money(st.pl, true) + '</span>', '') +
      kpi('Average odds', odds(st.avgOdds), '') + kpi('Average stake', st.avgStake ? money(st.avgStake) : '-', st.avgStake ? pct(st.avgStake / bk) + ' of bankroll' : '') + kpi('Largest win', '<span class="pos">' + money(st.largestWin, true) + '</span>', '') +
      kpi('Largest loss', '<span class="neg">' + money(st.largestLoss) + '</span>', '') + kpi('Current streak', '<span class="' + (st.streakType === 'won' ? 'pos' : st.streakType === 'lost' ? 'neg' : '') + '">' + st.streak + '</span>', '') + kpi('Longest win streak', 'W' + st.maxWin, '') +
      kpi('Longest losing streak', 'L' + st.maxLoss, '') + kpi('Max drawdown', '<span class="neg">' + money(st.maxDD) + '</span>', pct(st.maxDDPct) + ' from peak') + kpi('Current drawdown', money(st.curDD), '') + '</div>';
    const ser = st.series; const labels = ser.map((p) => fmtD(p.t));
    const bankCh = chart('line', { series: [{ name: 'Bankroll', values: ser.map((p) => p.bank), color: 'var(--signal)' }, { name: 'Start', values: ser.map(() => startBank), color: 'var(--dim)', dash: true }], labels, yFmt: (v) => money(v), area: true, height: 240 });
    const cumCh = chart('line', { series: [{ name: 'Cumulative P/L', values: ser.map((p) => p.cum), color: 'var(--pos)' }], labels, yFmt: (v) => money(v), zero: true, height: 200 });
    const roiCh = chart('line', { series: [{ name: 'ROI', values: ser.map((p) => p.roi * 100), color: 'var(--info)' }], labels, yFmt: (v) => v.toFixed(1) + '%', zero: true, height: 200 });
    const dist = '<div class="dn-wrap">' + donut([{ v: st.wins, c: 'var(--pos)' }, { v: st.losses, c: 'var(--neg)' }, { v: st.voids, c: 'var(--dim)' }, { v: st.pending, c: 'var(--signal)' }], 132) +
      '<div class="dn-c"><b>' + pct(st.winRate, 0) + '</b><small>win rate</small></div>' + legend([['Won ' + st.wins, 'var(--pos)'], ['Lost ' + st.losses, 'var(--neg)'], ['Void ' + st.voids, 'var(--dim)'], ['Pending ' + st.pending, 'var(--signal)']]) + '</div>';
    const bySport = groupStats(bets, (b) => D.SPORTS[b.sport].name).map((r) => ({ l: r.key, v: r.pl, n: r.decided }));
    const byMk = groupStats(bets, mGroup).map((r) => ({ l: r.key, v: r.pl, n: r.decided }));
    const decided = bets.filter((b) => b.status === 'won' || b.status === 'lost');
    const cal = CAL.map(([a, b, l]) => { const g = decided.filter((x) => x.modelProb >= a && x.modelProb < b); const w = g.filter((x) => x.status === 'won').length; return { l, n: g.length, model: g.length ? avg(g.map((x) => x.modelProb)) : null, imp: g.length ? avg(g.map((x) => x.impliedProb)) : null, act: g.length ? w / g.length : null }; });
    const calT = '<div class="tw"><table class="tbl"><thead><tr><th>Model prob.</th><th class="num">Bets</th><th class="num">Avg model</th><th class="num">Avg implied</th><th class="num">Actual hit rate</th><th class="num">Gap</th></tr></thead><tbody>' +
      cal.map((r) => '<tr class="' + (r.n < 10 ? 'lown' : '') + '"><td>' + r.l + '</td><td class="num">' + r.n + '</td><td class="num">' + pct(r.model) + '</td><td class="num">' + pct(r.imp) + '</td><td class="num"><b>' + pct(r.act) + '</b></td><td class="num">' + (r.n ? '<span class="' + plClass(r.act - r.model) + '">' + pp(r.act - r.model) + '</span>' : '-') + '</td></tr>').join('') + '</tbody></table></div><p class="dim small pad">A well calibrated model has actual hit rates close to its average estimate. Rows under 10 bets are greyed out.</p>';
    const pend = S.bets.ai.filter((b) => b.status === 'pending').sort((a, b) => a.start - b.start);
    const policy = '<div class="policy"><div class="kg k3">' + kpi('Profile', P.label, 'change in Settings') + kpi('Min. difference', P.minEdge + ' pp', 'model minus implied') + kpi('Min. confidence', String(P.minConf), 'out of 100') + kpi('Staking', Math.round(P.kelly * 100) + '% Kelly', 'cap ' + pct(P.cap) + ' of bankroll') + kpi('Max odds', odds(P.maxOdds), '') + kpi('Per scan', 'max ' + P.maxPerScan, 'exposure cap 15%') + '</div>' +
      '<p class="dim small">Last scan ' + (S.ai.lastScan ? ago(S.ai.lastScan) : 'never') + '. ' + toggle('ai-auto', S.ai.autoScan, 'Auto-scan every 30 minutes') + '</p></div>';
    return pageHead('AI Analyst', 'Virtual paper-trading account. Every bet, win and loss is recorded. No real money. ' + demoTag(), '<button type="button" class="btn btn-sig" data-act="ai-run">' + icon('zap') + 'Run AI scan</button>') +
      '<div class="toolbar">' + seg('ai-range', RANGES, range) + '<a class="lnk" href="#/ai-journal">Open AI journal' + icon('chevR') + '</a></div>' + sampleNote(st.decided) + kp +
      '<div class="grid mt">' + panel('Bankroll over time', bankCh, { cls: 'c8' }) + panel('Win / loss distribution', dist, { cls: 'c4' }) +
      panel('Cumulative P/L', cumCh, { cls: 'c6' }) + panel('ROI over time', roiCh, { cls: 'c6' }) +
      panel('P/L by sport', hbars(bySport, { fmt: (v) => money(v, true) }), { cls: 'c6' }) + panel('P/L by market', hbars(byMk, { fmt: (v) => money(v, true) }), { cls: 'c6' }) +
      panel('By league', table('ai-lg', grpCols('League'), groupStats(bets, (b) => b.league), { sort: { col: 'n', dir: 'desc' } }), { cls: 'c6', flush: true }) +
      panel('By odds range', table('ai-od', grpCols('Odds'), groupStats(bets, (b) => oddsBucket(b.odds)), { sort: { col: 'key', dir: 'asc' } }), { cls: 'c6', flush: true }) +
      panel('Calibration', calT, { cls: 'c7', flush: true }) + panel('Staking policy', policy, { cls: 'c5' }) +
      panel('Open positions <em class="cnt">' + pend.length + '</em>', pend.length ? betList(pend, 'ai') : empty('No open positions', 'Run a scan or wait for the next automatic scan.'), { cls: 'c12', flush: true }) + '</div>';
  };
  on('ai-range', (el) => { S.ui.aiRange = el.dataset.v; save(); rerender(); });
  on('ai-auto', () => { S.ai.autoScan = !S.ai.autoScan; save(); rerender(); });

  /* ---------------- bet lists + AI bet modal ---------------- */
  function betList(bets, owner, o) {
    o = o || {};
    return '<div class="bets">' + bets.map((b) => '<div class="bet ' + b.status + '"' + (owner === 'ai' ? ' data-act="ai-bet" data-id="' + b.id + '" tabindex="0" role="button" aria-label="Open AI bet ' + b.no + '"' : '') + '>' +
      '<span class="bt-no">' + (owner === 'ai' ? '#' + String(b.no).padStart(3, '0') : fmtD(b.placedAt)) + '</span>' +
      '<span class="bt-m">' + (b.sport && D.SPORTS[b.sport] ? sportTag(b.sport) : '') + '<span><b>' + esc(b.match) + '</b><small>' + esc(b.league || '') + (b.league ? ' · ' : '') + (owner === 'ai' ? dateTime(b.placedAt) : esc(b.market || '')) + '</small></span></span>' +
      '<span class="bt-s"><b>' + esc(b.selection) + '</b><small>' + esc(owner === 'ai' ? b.market : (b.matchId ? 'linked' : 'manual')) + '</small></span>' +
      '<span class="bt-n"><i>Odds</i>' + odds(b.odds) + '</span><span class="bt-n"><i>Stake</i>' + money(b.stake) + '</span>' +
      (owner === 'ai' ? '<span class="bt-n hide-s"><i>Diff.</i>' + valTag(b.value) + '</span><span class="bt-n hide-s"><i>Conf.</i>' + confTagRaw(b.confidence, b.confLevel) + '</span>' : '') +
      '<span class="bt-r">' + resTag(b) + plCell(b) + '</span>' +
      (o.actions ? '<span class="bt-a">' + o.actions(b) + '</span>' : '') + '</div>').join('') + '</div>';
  }
  function betModal(id) {
    const b = S.bets.ai.find((x) => x.id === id); if (!b) { toast('AI bet not found. It may have been reset.', 'neg'); return; }
    const m = D.match(b.matchId);
    const row = (l, v) => '<div class="kv"><span>' + l + '</span><b>' + v + '</b></div>';
    const body = '<div class="bm">' +
      '<div class="bm-h">' + sportTag(b.sport) + '<span>' + esc(b.league) + '</span>' + resTag(b) + demoTag('Paper bet') + '</div>' +
      '<div class="bm-m"><a href="#/match/' + enc(b.matchId) + '" data-act="modal-close-go">' + esc(b.match) + '</a><small>' + dateTime(b.start) + (b.score ? ' · Final: ' + esc(b.score) : '') + '</small></div>' +
      '<div class="bm-pick"><span>' + esc(b.market) + '</span><b>' + esc(b.selection) + '</b><em>@ ' + odds(b.odds) + '</em></div>' +
      '<div class="kvs">' + row('Date placed', dateTime(b.placedAt)) + row('Sport', esc(D.SPORTS[b.sport].name)) + row('Tournament', esc(b.league)) + row('Stake', money(b.stake)) + row('Potential profit', money(b.potential, true)) +
      row('Model probability', pct(b.modelProb)) + row('Implied probability', pct(b.impliedProb)) + row('Value (difference)', valTag(b.value)) + row('Expected value', signed(b.ev * 100) + '%') + row('Confidence', confTagRaw(b.confidence, b.confLevel)) + row('Model score', b.modelScore + '/100') + row('Risk', riskTag(b.riskLevel)) +
      row('Result', resTag(b)) + row('Profit / loss', b.status === 'pending' ? '<span class="dim">open</span>' : '<span class="' + plClass(b.pl) + '">' + money(b.pl, true) + '</span>') + row('Settled', b.settledAt ? dateTime(b.settledAt) : '-') + row('Timestamp', new Date(b.placedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC') + '</div>' +
      '<div class="sub-h">Reasoning</div><p class="reason">' + esc(b.reasoning) + '</p>' +
      '<div class="sub-h">Factors</div>' + factorRows(b.factors) +
      '<div class="two"><div><div class="sub-h pos">Positive factors</div>' + (b.positives.length ? bulletList(b.positives) : '<p class="dim">None of note.</p>') + '</div><div><div class="sub-h neg">Negative factors & risks</div>' + bulletList(b.negatives, 'against') + '</div></div>' +
      '<div class="sub-h">Post-match analysis</div>' + reviewHtml(b) + '</div>';
    openModal('AI BET #' + String(b.no).padStart(3, '0'), body, { wide: true, foot: (m ? '<a class="btn" href="#/match/' + enc(b.matchId) + '" data-act="modal-close-go">Open match</a>' : '') + '<button type="button" class="btn btn-sig" data-act="modal-close">Close</button>' });
  }
  on('ai-bet', (el) => betModal(el.dataset.id));
  on('modal-close-go', (el, e) => { e.preventDefault(); closeModal(true); location.hash = el.getAttribute('href'); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.bet[data-act]')) { e.preventDefault(); e.target.click(); } });

  /* ---------------- AI JOURNAL ---------------- */
  V['ai-journal'] = (p) => {
    const f = S.ui.aiJ; const q = f.q.trim().toLowerCase();
    let list = S.bets.ai.filter((b) => (f.status === 'all' || b.status === f.status) && (f.sport === 'all' || b.sport === f.sport) && (f.market === 'all' || mGroup(b) === f.market) && (!q || (b.match + ' ' + b.selection + ' ' + b.league).toLowerCase().includes(q)));
    const key = { date: (b) => b.placedAt, odds: (b) => b.odds, stake: (b) => b.stake, pl: (b) => (b.status === 'pending' ? 0 : b.pl), value: (b) => b.value, conf: (b) => b.confidence }[f.sort] || ((b) => b.placedAt);
    list.sort((a, b) => (key(a) - key(b)) * (f.dir === 'asc' ? 1 : -1));
    const total = list.length; const st = stats(list, 0);
    const upd = (k) => (v) => { f[k] = v; f.limit = 40; save(); rerender(); };
    if (p && p[0]) setTimeout(() => betModal(p[0]), 0);
    const sortBtns = '<div class="sortbar"><span class="dim">Sort</span>' + [['date', 'Date'], ['odds', 'Odds'], ['stake', 'Stake'], ['pl', 'P/L'], ['value', 'Difference'], ['conf', 'Confidence']].map(([k, l]) => '<button type="button" class="th-s ' + (f.sort === k ? 'on ' + f.dir : '') + '" data-act="aij-sort" data-v="' + k + '">' + l + icon('sort', 'th-ic') + '</button>').join('') + '</div>';
    return pageHead('AI journal', 'Complete record of the AI paper account, including every loss. Select a bet for full reasoning and post-match analysis. ' + demoTag()) +
      '<div class="filters"><div class="fsearch">' + icon('search') + '<input type="search" placeholder="Search match, selection, league" value="' + esc(f.q) + '" data-change="aij-q" aria-label="Search AI bets"></div>' +
      dd('aij-status', [['all', 'All results'], ['pending', 'Pending'], ['won', 'Won'], ['lost', 'Lost'], ['void', 'Void']].map(([v, l]) => ({ v, l, n: v === 'all' ? S.bets.ai.length : S.bets.ai.filter((b) => b.status === v).length })), f.status, upd('status'), { label: 'Result' }) +
      dd('aij-sport', [{ v: 'all', l: 'All sports' }].concat(Object.values(D.SPORTS).map((s) => ({ v: s.id, l: s.name, n: S.bets.ai.filter((b) => b.sport === s.id).length }))), f.sport, upd('sport'), { label: 'Sport' }) +
      dd('aij-market', ['all', 'Result / winner', 'Totals', 'BTTS'].map((v) => ({ v, l: v === 'all' ? 'All markets' : v })), f.market, upd('market'), { label: 'Market' }) + '</div>' +
      '<div class="jsum">' + total + ' bets · ' + st.wins + 'W ' + st.losses + 'L ' + st.pending + ' pending · P/L <b class="' + plClass(st.pl) + '">' + money(st.pl, true) + '</b> · ROI <b class="' + plClass(st.roi || 0) + '">' + pct(st.roi) + '</b></div>' +
      panel(null, sortBtns + (list.length ? betList(list.slice(0, f.limit), 'ai') : empty('No AI bets match these filters', 'Clear the search or change filters.')) +
        (total > f.limit ? '<div class="more-row"><button type="button" class="btn" data-act="aij-more">Show more (' + (total - f.limit) + ' left)</button></div>' : ''), { flush: true });
  };
  on('change:aij-q', (el) => { S.ui.aiJ.q = el.value; S.ui.aiJ.limit = 40; save(); rerender(); });
  on('aij-more', () => { S.ui.aiJ.limit += 40; save(); rerender(); });
  on('aij-sort', (el) => { const f = S.ui.aiJ; f.dir = f.sort === el.dataset.v && f.dir === 'desc' ? 'asc' : 'desc'; f.sort = el.dataset.v; save(); rerender(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-change="aij-q"]')) e.target.blur(); });

  /* ---------------- BET JOURNAL (user) ---------------- */
  let form = null;
  const MARKETS = ['Match Result', 'Moneyline', 'Total Goals', 'Total Points', 'Both Teams To Score', 'Handicap', 'Player prop', 'Other'];
  function calcPl(status, stake, o) { return status === 'won' ? round2(stake * (o - 1)) : status === 'lost' ? -stake : 0; }
  function formHtml() {
    const fv = (k) => esc(form[k] == null ? '' : form[k]);
    const o = parseFloat(form.odds), s = parseFloat(form.stake);
    const prev = o > 1 && s > 0 ? 'Potential profit ' + money(round2(s * (o - 1)), true) + ' · implied probability ' + pct(1 / o) : 'Enter odds and stake to see potential profit.';
    return '<div class="form">' + (form.matchId ? note('Linked to a demo match. The result settles automatically when the match ends, unless you set it manually.') : '') +
      '<label class="fl"><span>Match</span><input type="text" data-input="bf" data-k="match" value="' + fv('match') + '" placeholder="e.g. Arsenal vs Chelsea" ' + (form.matchId ? 'readonly' : 'autofocus') + '></label>' +
      '<div class="frow"><div class="fl"><span>Sport</span>' + dd('bf-sport', Object.values(D.SPORTS).map((x) => ({ v: x.id, l: x.name })), form.sport, (v) => { form.sport = v; showForm(); }) + '</div>' +
      '<label class="fl"><span>League / tournament</span><input type="text" data-input="bf" data-k="league" value="' + fv('league') + '" placeholder="optional"></label></div>' +
      '<div class="frow"><div class="fl"><span>Market</span>' + dd('bf-market', MARKETS.concat(MARKETS.includes(form.market) || !form.market ? [] : [form.market]).map((x) => ({ v: x, l: x })), form.market || 'Match Result', (v) => { form.market = v; showForm(); }) + '</div>' +
      '<label class="fl"><span>Selection</span><input type="text" data-input="bf" data-k="selection" value="' + fv('selection') + '" placeholder="e.g. Arsenal, Over 2.5"></label></div>' +
      '<div class="frow f3"><label class="fl"><span>Odds</span><input type="number" inputmode="decimal" step="0.01" min="1.01" data-input="bf" data-k="odds" value="' + fv('odds') + '"></label>' +
      '<label class="fl"><span>Stake (' + esc(S.settings.currency) + ')</span><input type="number" inputmode="decimal" step="0.5" min="0" data-input="bf" data-k="stake" value="' + fv('stake') + '"></label>' +
      '<label class="fl"><span>Date</span><input type="date" data-input="bf" data-k="date" value="' + fv('date') + '"></label></div>' +
      '<div class="fl"><span>Result</span>' + seg('bf-status', [['pending', 'Pending'], ['won', 'Won'], ['lost', 'Lost'], ['void', 'Void']], form.status) + '</div>' +
      '<label class="fl"><span>Reasoning</span><textarea rows="3" data-input="bf" data-k="reasoning" placeholder="Why this bet? What would prove you wrong?">' + fv('reasoning') + '</textarea></label>' +
      '<div class="bf-prev" id="bf-prev">' + prev + '</div><div class="bf-err" id="bf-err" role="alert"></div></div>';
  }
  function showForm() { openModal(form.id ? 'Edit bet' : 'Add bet', formHtml(), { foot: '<button type="button" class="btn" data-act="modal-close">Cancel</button><button type="button" class="btn btn-sig" data-act="bf-save">' + icon('check') + 'Save bet</button>' }); }
  function openBetForm(b, prefill) {
    form = b ? { id: b.id, match: b.match, sport: b.sport || 'football', league: b.league || '', market: b.market || 'Match Result', selection: b.selection, odds: String(b.odds), stake: String(b.stake), date: U.dateStr(b.placedAt), reasoning: b.reasoning || '', status: b.status, matchId: b.matchId || null }
      : Object.assign({ id: null, match: '', sport: 'football', league: '', market: 'Match Result', selection: '', odds: '', stake: '10', date: todayStr(), reasoning: '', status: 'pending', matchId: null }, prefill || {});
    showForm();
  }
  on('input:bf', (el) => {
    form[el.dataset.k] = el.value;
    if (el.dataset.k === 'odds' || el.dataset.k === 'stake') { const o = parseFloat(form.odds), s = parseFloat(form.stake); const pv = document.getElementById('bf-prev'); if (pv) pv.textContent = o > 1 && s > 0 ? 'Potential profit ' + money(round2(s * (o - 1)), true) + ' · implied probability ' + pct(1 / o) : 'Enter odds and stake to see potential profit.'; }
  });
  on('bf-status', (el) => { form.status = el.dataset.v; el.parentElement.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-pressed', String(b === el)); }); });
  on('bf-save', () => {
    const err = document.getElementById('bf-err'); const o = parseFloat(form.odds), s = parseFloat(form.stake);
    if (!form.match.trim()) return (err.textContent = 'Match is required.');
    if (!form.selection.trim()) return (err.textContent = 'Selection is required.');
    if (!(o >= 1.01)) return (err.textContent = 'Odds must be at least 1.01 (decimal format).');
    if (!(s > 0)) return (err.textContent = 'Stake must be greater than zero.');
    const t = now(); const placed = form.date === todayStr() ? t : U.parseDate(form.date || todayStr()).getTime() + 12 * 3600e3;
    let b = form.id ? S.bets.user.find((x) => x.id === form.id) : null;
    const prevStatus = b ? b.status : null;
    if (!b) { const no = ++S.seq.user; b = { id: 'user-' + no + '-' + (t % 1e6), no, owner: 'user' }; S.bets.user.push(b); }
    const linked = form.matchId ? D.match(form.matchId) : null;
    Object.assign(b, { placedAt: b.placedAt && form.id && U.dateStr(b.placedAt) === form.date ? b.placedAt : placed, sport: form.sport, league: form.league.trim(), country: linked ? linked.country : '', match: form.match.trim(), market: form.market, selection: form.selection.trim(), odds: round2(o), stake: round2(s), potential: round2(s * (o - 1)), impliedProb: 1 / o, reasoning: form.reasoning.trim(), status: form.status });
    if (linked) Object.assign(b, { matchId: linked.id, home: linked.home, away: linked.away, start: linked.start, marketKey: form.marketKey || b.marketKey, selKey: form.selKey || b.selKey, line: form.line != null ? form.line : b.line });
    b.pl = calcPl(b.status, b.stake, b.odds);
    if (b.status !== 'pending') b.settledAt = prevStatus === b.status && b.settledAt ? b.settledAt : t; else b.settledAt = null;
    if (linked && b.status === 'pending' && D.status(linked) === 'finished') A.settleBet(b, linked);
    form = null; save(); closeModal(); toast('Bet saved.', 'pos'); rerender();
  });
  on('bj-add', () => openBetForm(null));
  on('bj-edit', (el) => { const b = S.bets.user.find((x) => x.id === el.dataset.id); if (b) openBetForm(b); });
  on('bj-del', (el) => {
    const b = S.bets.user.find((x) => x.id === el.dataset.id); if (!b) return;
    openModal('Delete bet', '<p>Delete <b>' + esc(b.selection) + '</b> on ' + esc(b.match) + ' (' + money(b.stake) + ' @ ' + odds(b.odds) + ')? This cannot be undone.</p>', { foot: '<button type="button" class="btn" data-act="modal-close">Cancel</button><button type="button" class="btn btn-neg" data-act="bj-del-yes" data-id="' + b.id + '">' + icon('trash') + 'Delete</button>' });
  });
  on('bj-del-yes', (el) => { S.bets.user = S.bets.user.filter((x) => x.id !== el.dataset.id); save(); closeModal(); toast('Bet deleted.'); rerender(); });
  on('bj-res', (el) => { const b = S.bets.user.find((x) => x.id === el.dataset.id); if (!b) return; b.status = el.dataset.v; b.pl = calcPl(b.status, b.stake, b.odds); b.settledAt = now(); save(); rerender(); });
  on('bj-tab', (el) => { S.ui.uJ.status = el.dataset.v; save(); rerender(); });
  on('track', (el) => {
    const m = D.match(el.dataset.id); if (!m) return; const [mk, key] = el.dataset.v.split('|');
    const s = an(m).markets.flatMap((x) => x.sels).find((x) => x.mk === mk && x.key === key); if (!s) return;
    openBetForm(null, { match: m.home + ' vs ' + m.away, sport: m.sport, league: m.league, market: s.mkName, selection: selText(s), odds: String(s.odds), matchId: m.id, marketKey: s.mk, selKey: s.key, line: s.line, date: todayStr() });
  });

  V.journal = () => {
    const f = S.ui.uJ; const all = S.bets.user; const st = stats(all, S.user.startingBankroll); const bk = bankroll('user');
    const list = all.filter((b) => f.status === 'all' || b.status === f.status).sort((a, b) => b.placedAt - a.placedAt);
    const actions = (b) => (b.status === 'pending' && !b.matchId ? ['won', 'lost', 'void'].map((r) => '<button type="button" class="mini mini-' + r + '" data-act="bj-res" data-id="' + b.id + '" data-v="' + r + '">' + r[0].toUpperCase() + r.slice(1) + '</button>').join('') : '') +
      '<button type="button" class="ib" data-act="bj-edit" data-id="' + b.id + '" aria-label="Edit bet">' + icon('edit') + '</button><button type="button" class="ib" data-act="bj-del" data-id="' + b.id + '" aria-label="Delete bet">' + icon('trash') + '</button>';
    const cnt = (s) => all.filter((b) => b.status === s).length;
    return pageHead('Bet journal', 'Your own record. Profit, ROI, win rate and bankroll update automatically. ' + demoTag('Demo history'), '<button type="button" class="btn btn-sig" data-act="bj-add">' + icon('plus') + 'Add bet</button>') +
      '<div class="kg k6">' + kpi('Bankroll', money(bk), 'start ' + money(S.user.startingBankroll)) + kpi('Profit / loss', '<span class="' + plClass(st.pl) + '">' + money(st.pl, true) + '</span>', '') + kpi('ROI', '<span class="' + plClass(st.roi || 0) + '">' + pct(st.roi) + '</span>', money(st.staked) + ' staked') +
      kpi('Win rate', pct(st.winRate), st.wins + 'W ' + st.losses + 'L') + kpi('Open', String(st.pending), money(all.filter((b) => b.status === 'pending').reduce((a, b) => a + b.stake, 0)) + ' at stake') + kpi('Streak', st.streak, 'longest L' + st.maxLoss) + '</div>' +
      sampleNote(st.decided) +
      tabs('bj-tab', [['all', 'All', all.length], ['pending', 'Pending', cnt('pending')], ['won', 'Won', cnt('won')], ['lost', 'Lost', cnt('lost')], ['void', 'Void', cnt('void')]], f.status, 'mt') +
      panel(null, list.length ? betList(list, 'user', { actions }) : empty('No bets here yet', 'Add a bet manually or track a selection from any match page.', '<button type="button" class="btn btn-sig" data-act="bj-add">' + icon('plus') + 'Add bet</button>'), { flush: true });
  };

  /* ---------------- SETTINGS ---------------- */
  const CURRENCIES = ['EUR', 'USD', 'GBP', 'PLN', 'UAH'];
  const TIMEZONES = [['local', 'Device time zone'], ['UTC', 'UTC'], ['Europe/Kyiv', 'Kyiv'], ['Europe/Warsaw', 'Warsaw'], ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin'], ['America/New_York', 'New York']];
  V.settings = () => {
    const st = S.settings; const set = (k, after) => (v) => { st[k] = v; save(); if (after) after(); rerender(); };
    const P = E.CONFIG.profiles;
    const ai = '<div class="set-r"><div><b>Starting AI bankroll</b><small>Virtual money. Changing it re-bases the existing record.</small></div><input type="number" class="inp-sm" min="10" step="10" value="' + S.ai.startingBankroll + '" data-change="set-aibank" aria-label="Starting AI bankroll"></div>' +
      '<div class="set-r"><div><b>Risk profile</b><small>' + Object.values(P).map((p) => p.label + ': ' + p.minEdge + 'pp, conf ' + p.minConf + ', cap ' + pct(p.cap)).join(' · ') + '</small></div>' + seg('set-risk', Object.keys(P).map((k) => [k, P[k].label]), st.risk) + '</div>' +
      '<div class="set-r"><div><b>Auto-scan</b><small>The AI re-scans every 30 minutes while the app is open.</small></div>' + toggle('ai-auto', S.ai.autoScan, S.ai.autoScan ? 'On' : 'Off') + '</div>' +
      '<div class="set-r"><div><b>Rebuild AI history</b><small>Deletes all AI bets and regenerates ' + A.HISTORY_DAYS + ' days of paper trading with the current bankroll and risk profile.</small></div><button type="button" class="btn btn-neg btn-sm" data-act="set-ai-reset">' + icon('refresh') + 'Rebuild</button></div>';
    const you = '<div class="set-r"><div><b>Your starting bankroll</b><small>Used for bankroll, drawdown and comparison.</small></div><input type="number" class="inp-sm" min="0" step="10" value="' + S.user.startingBankroll + '" data-change="set-ubank" aria-label="Your starting bankroll"></div>';
    const disp = '<div class="set-r"><div><b>Currency</b><small>Display only. No conversion is applied.</small></div>' + dd('set-cur', CURRENCIES.map((c) => ({ v: c, l: c })), st.currency, set('currency')) + '</div>' +
      '<div class="set-r"><div><b>Time zone</b><small>For kick-off times and the demo clock.</small></div>' + dd('set-tz', TIMEZONES.map(([v, l]) => ({ v, l })), st.timezone, set('timezone')) + '</div>' +
      '<div class="set-r"><div><b>Theme</b><small>Dark is the default terminal look.</small></div>' + seg('set-theme', [['dark', 'Dark'], ['light', 'Light']], st.theme) + '</div>' +
      '<div class="set-r"><div><b>Language</b><small>Interface strings are prepared for translation (I18N in app.js).</small></div>' + dd('set-lang', [{ v: 'en', l: 'English' }, { v: 'uk', l: 'Українська (coming soon)', disabled: true }], st.lang, set('lang')) + '</div>';
    const sports = '<p class="dim small">Used by the AI, opportunities and notifications. The scanner always shows everything.</p><div class="chips wrap">' + Object.values(D.SPORTS).map((s) => chip('set-sport', s.id, esc(s.name), st.sports.includes(s.id))).join('') + '</div>' +
      '<div class="sub-h">Preferred leagues <small>none selected means all leagues</small></div><div class="chips wrap">' + D.LEAGUES.filter((L) => st.sports.includes(L.sport)).map((L) => chip('set-league', L.id, esc(L.name) + ' <em>' + esc(L.country) + '</em>', st.leagues.includes(L.id))).join('') + '</div>';
    const NT = [['news', 'Injury and team news', 'High impact items only'], ['start', 'Match starting soon', 'Your open bets and high-interest matches'], ['aiBet', 'AI bet placed', ''], ['aiSettle', 'Bet settled', 'AI and linked journal bets'], ['odds', 'Odds movement', 'Moves above 10% from opening'], ['model', 'Model update', 'After each AI scan']];
    const notif = NT.map(([k, l, d]) => '<div class="set-r"><div><b>' + l + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</div>' + toggle('set-notif', st.notif[k] !== false, st.notif[k] !== false ? 'On' : 'Off', ' data-v="' + k + '"') + '</div>').join('');
    const clock = '<p class="dim small">Fast-forward time to watch matches go live, finish and settle. Current offset: ' + Math.round((st.clockOffset || 0) / 60000) + ' min.</p>' + clockBtns();
    const prov = Object.entries(SIT.providers).map(([k, p]) => '<div class="set-r"><div><b>' + esc(p.name) + '</b><small>SIT.providers.' + k + ' · id ' + esc(p.id) + '</small></div>' + (p.isDemo ? demoTag('Demo') : '<span class="cat cat-confidence">Live</span>') + '</div>').join('') +
      '<div class="set-r"><div><b>LLM explanations</b><small>SIT.Engine.llm in engine.js</small></div>' + (E.llm.enabled ? '<span class="cat cat-confidence">Enabled</span>' : '<span class="dim">Not connected</span>') + '</div>' +
      note('To connect real data, implement the provider contract documented at the bottom of data.js and assign it to SIT.providers. Use licensed APIs and respect each site\'s terms. Scrapers are not included.');
    const data = '<div class="set-r"><div><b>Export data</b><small>Bets, settings and notifications as JSON.</small></div><button type="button" class="btn btn-sm" data-act="set-export">' + icon('download') + 'Export JSON</button></div>' +
      '<div class="set-r"><div><b>Reset everything</b><small>Clears local storage and rebuilds the demo from scratch.</small></div><button type="button" class="btn btn-neg btn-sm" data-act="set-reset">' + icon('trash') + 'Reset all data</button></div>';
    return pageHead('Settings', 'Stored locally in this browser. ' + demoTag()) +
      '<div class="grid">' + panel('AI Analyst account', ai, { cls: 'c6' }) + panel('Display', disp, { cls: 'c6' }) + panel('Your account', you, { cls: 'c6' }) + panel('Demo clock', clock, { cls: 'c6' }) +
      panel('Preferred sports', sports, { cls: 'c12' }) + panel('Notifications', notif, { cls: 'c6' }) + panel('Data sources', prov, { cls: 'c6' }) + panel('Your data', data, { cls: 'c12' }) + '</div>';
  };
  on('change:set-aibank', (el) => { const v = Math.max(10, Math.round(+el.value || 0)); S.ai.startingBankroll = v; save(); toast('AI starting bankroll set to ' + money(v) + '.'); rerender(); });
  on('change:set-ubank', (el) => { const v = Math.max(0, Math.round(+el.value || 0)); S.user.startingBankroll = v; save(); toast('Your starting bankroll set to ' + money(v) + '.'); rerender(); });
  on('set-risk', (el) => { S.settings.risk = el.dataset.v; save(); toast(E.CONFIG.profiles[el.dataset.v].label + ' profile applies to new AI bets. Rebuild history to apply it retroactively.'); rerender(); });
  on('set-theme', (el) => { S.settings.theme = el.dataset.v; A.setTheme(); save(); rerender(); });
  on('set-sport', (el) => { const s = S.settings.sports; const v = el.dataset.v; if (s.includes(v)) { if (s.length === 1) return toast('Keep at least one sport.', 'neg'); s.splice(s.indexOf(v), 1); S.settings.leagues = S.settings.leagues.filter((l) => D.LEAGUE_BY_ID[l].sport !== v); } else s.push(v); save(); rerender(); });
  on('set-league', (el) => { const l = S.settings.leagues; const v = el.dataset.v; if (l.includes(v)) l.splice(l.indexOf(v), 1); else l.push(v); save(); rerender(); });
  on('set-notif', (el) => { const k = el.dataset.v; S.settings.notif[k] = S.settings.notif[k] === false; save(); rerender(); });
  on('set-export', () => {
    const { matches, news, ...data } = S;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: 'Sports Intelligence Terminal', demo: true, data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sit-export-' + todayStr() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Export started.');
  });
  on('set-ai-reset', () => openModal('Rebuild AI history', '<p>This deletes all ' + S.bets.ai.length + ' AI paper bets and regenerates ' + A.HISTORY_DAYS + ' days with a ' + money(S.ai.startingBankroll) + ' bankroll and the ' + E.CONFIG.profiles[S.settings.risk].label.toLowerCase() + ' profile.</p>', { foot: '<button type="button" class="btn" data-act="modal-close">Cancel</button><button type="button" class="btn btn-neg" data-act="set-ai-reset-yes">Rebuild</button>' }));
  on('set-ai-reset-yes', async () => {
    closeModal(); A.renderMeta.busy = true;
    const view = document.getElementById('view');
    view.innerHTML = '<div class="boot"><div class="boot-t">Rebuilding AI history</div><div class="boot-b">Running the model over ' + A.HISTORY_DAYS + ' days of fixtures.</div><div class="bar"><i id="boot-bar"></i></div></div>';
    S.bets.ai = []; E.clearCache();
    await A.bootstrapHistory((p) => { const b = document.getElementById('boot-bar'); if (b) b.style.width = Math.round(p * 100) + '%'; });
    S.ai.lastScan = 0; A.renderMeta.busy = false; save(); toast('AI history rebuilt: ' + S.bets.ai.length + ' bets.', 'pos'); render();
  });
  on('set-reset', () => openModal('Reset all data', '<p>All bets, settings and notifications stored in this browser will be deleted. The demo will rebuild from scratch.</p>', { foot: '<button type="button" class="btn" data-act="modal-close">Cancel</button><button type="button" class="btn btn-neg" data-act="set-reset-yes">Reset everything</button>' }));
  on('set-reset-yes', () => {
    Object.keys(S).forEach((k) => delete S[k]); Object.assign(S, A.defaultState());
    try { localStorage.removeItem(A.STORE_KEY); } catch (e) { /* ignore */ }
    location.hash = '#/dashboard'; location.reload();
  });

  SIT.Views = V;
  SIT.ViewHelpers = { panel, table, oppCard, matchRow, newsCard, radar, betList, betModal, openBetForm };
  A.start();
})();
