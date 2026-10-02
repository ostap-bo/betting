/* =====================================================================
   SIT - views.js
   Сторінки: Головна, Матчі, Матч, Можливості, Наживо, AI-аналітик,
   Новини, Особистий кабінет. Кожна сторінка повертає HTML.
   ===================================================================== */
(function () {
  'use strict';
  const SIT = window.SIT, D = SIT.Data, M = SIT.Model, U = SIT.U, A = SIT.App;
  const S = A.S;
  const { esc, money, num, pct, pp, odds, time, dayLabel, dateTime, ago, plural, plCls, initials, icon, sportIc, confB, riskB, impB, valB, resB, demoB, statusLine,
    empty, note, tile, plSpan, chips, select, sw, RES, lineChart, hbars, momBars, openModal, closeModal, toast, on, onInput, onChange, rerender, render, save, now } = A;
  const V = SIT.Views;
  const H = 3600e3;

  /* ================= спільне ================= */
  const mLink = (m) => '#/match/' + encodeURIComponent(m.id);
  const an = (m) => M.analyze(m, now());
  const head = (title, sub, right) => '<div class="ph"><div class="ph-l"><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (right ? '<div class="ph-r">' + right + '</div>' : '') + '</div>';
  const sec = (title, body, right, cls) => '<section class="sec ' + (cls || '') + '">' + (title ? '<div class="sec-h"><h2>' + title + '</h2>' + (right || '') + '</div>' : '') + body + '</section>';
  const more = (href, t) => '<a class="lnk" href="' + href + '">' + t + icon('chevR') + '</a>';
  const sportOpts = () => [['all', 'Усі']].concat(Object.values(D.SPORTS).map((s) => [s.id, s.name]));
  const isFav = (m) => S.fav.includes(m.home) || S.fav.includes(m.away);
  function pool(hours) {
    const t = now();
    return D.matchesInRange(U.addDays(U.ds(t), -1), 3).filter((m) => D.status(m, t) !== 'finished' && m.start - t < hours * H && A.prefSport(m)).map(an);
  }
  const CATS = { edge: 'Розбіжність з ринком', confident: 'Висока впевненість', signal: 'Сильний сигнал', risky: 'Ризиковані', live: 'Наживо' };
  function shortWhy(s) {
    const p = s.pos.slice(0, 2).map((x) => x.label.toLowerCase()).join(' і ');
    return (p ? 'На користь: ' + p + '.' : 'Помітних факторів немає, оцінка близька до ринку.') + (s.risk.list[0] ? ' Головний ризик: ' + s.risk.list[0].label.toLowerCase() + '.' : '');
  }
  function whyList(a) {
    const s = a.best, m = a.m, out = [];
    a.cats.forEach((c) => {
      if (c === 'edge') out.push(['Розбіжність з ринком', 'Модель дає ' + pct(s.model) + ', а коефіцієнт ' + odds(s.odds) + ' означає ' + pct(s.implied) + ' (' + pp(s.value) + ').']);
      if (c === 'confident') out.push(['Висока впевненість', 'Впевненість ' + s.conf.value + ' зі 100: дані повні на ' + Math.round(s.conf.completeness * 100) + '%, фактори узгоджені на ' + Math.round(s.conf.agreement * 100) + '%.']);
      if (c === 'signal') s.factors.filter((x) => x.value >= 5).forEach((x) => out.push(['Сильний сигнал', x.label + ' (+' + x.value + '): ' + x.detail]));
      if (c === 'risky') out.push(['Ризикована', s.odds >= 2.8 ? 'Коефіцієнт ' + odds(s.odds) + ': навіть при правильній оцінці частіше програє.' : 'Ризики: ' + s.risk.list.map((r) => r.label.toLowerCase()).join(', ') + '.']);
      if (c === 'live') { const l = D.live(m); out.push(['Наживо', 'Матч іде: ' + l.label + (l.h != null ? ', рахунок ' + l.h + ':' + l.a : '') + '.']); }
    });
    const n = D.newsForMatch(m).find((x) => x.impact !== 'low'); if (n) out.push(['Новини', n.title]);
    if (!out.length) out.push(['Рейтинг', 'Матч потрапив у список за загальною оцінкою цікавості ' + a.interest + ' зі 100.']);
    return out;
  }
  const probBars = (model, implied) => '<div class="pb"><div class="pb-r"><span>Модель</span><span class="pb-t"><i class="pb-m" style="width:' + (model * 100).toFixed(1) + '%"></i></span><b>' + pct(model) + '</b></div><div class="pb-r"><span>Ринок</span><span class="pb-t"><i class="pb-i" style="width:' + (implied * 100).toFixed(1) + '%"></i></span><b>' + pct(implied) + '</b></div></div>';
  function factorRows(fs) {
    return '<div class="fx">' + fs.map((x) => '<div class="fx-r' + (x.missing ? ' miss' : '') + '"><span class="fx-l">' + esc(x.label) + '</span><span class="fx-b"><i class="' + (x.value >= 0 ? 'pos' : 'neg') + '" style="width:' + Math.min(50, Math.abs(x.value) / 8 * 50) + '%;' + (x.value >= 0 ? 'left:50%' : 'right:50%') + '"></i></span><span class="fx-v ' + (x.missing ? 'muted' : plCls(x.value)) + '">' + (x.missing ? 'н/д' : (x.value > 0 ? '+' : '') + x.value) + '</span><span class="fx-d">' + esc(x.detail) + '</span></div>').join('') + '</div>';
  }
  const meta = (m) => sportIc(m.sport) + '<span>' + esc(m.tourName) + '</span>';
  function oppCard(a) {
    const s = a.best, m = a.m, l = D.live(m);
    return '<article class="opp">' +
      '<div class="opp-top">' + meta(m) + '<span class="opp-t">' + (l.status === 'live' ? statusLine(m) : dateTime(m.start)) + '</span></div>' +
      '<a class="opp-m" href="' + mLink(m) + '"><span>' + esc(m.home) + '</span><span class="vs">проти</span><span>' + esc(m.away) + '</span>' + (l.h != null ? '<b class="opp-sc">' + l.h + ':' + l.a + '</b>' : '') + '</a>' +
      '<div class="pick"><div><small>' + esc(s.mkName) + '</small><b>' + esc(s.label) + '</b></div><span class="pick-o" title="Поточний коефіцієнт (демо)">' + odds(s.odds) + '</span></div>' +
      probBars(s.model, s.implied) +
      '<div class="badges">' + valB(s.value) + confB(s.conf) + riskB(s.risk.level) + '</div>' +
      '<p class="opp-x">' + esc(shortWhy(s)) + '</p>' +
      '<details class="why"><summary>Чому це з’явилося</summary><ul>' + whyList(a).map(([k, v]) => '<li><b>' + esc(k) + '.</b> ' + esc(v) + '</li>').join('') + '</ul>' + factorRows(s.factors) + '</details>' +
      '<a class="btn ghost full" href="' + mLink(m) + '">Детальний аналіз</a></article>';
  }
  function oppRow(a) {
    const s = a.best, m = a.m;
    return '<a class="orow" href="' + mLink(m) + '"><span class="orow-m"><small>' + sportIc(m.sport) + esc(m.tourName) + ', ' + dateTime(m.start) + '</small><b>' + esc(m.home) + ' проти ' + esc(m.away) + '</b></span><span class="orow-p"><small>' + esc(s.mkName) + '</small><b>' + esc(s.label) + '</b></span><span class="orow-o">' + odds(s.odds) + '</span>' + valB(s.value) + '</a>';
  }
  function matchRow(m, withSignal) {
    const l = D.live(m); const a = withSignal ? an(m) : null; const s = a && a.best;
    const win = l.status === 'finished' ? (l.h > l.a ? 'h' : l.h < l.a ? 'a' : '') : '';
    return '<a class="mrow ' + l.status + '" href="' + mLink(m) + '"><span class="mrow-t">' + statusLine(m) + '</span>' +
      '<span class="mrow-n"><span class="' + (win === 'h' ? 'w' : '') + '">' + esc(m.home) + (S.fav.includes(m.home) ? icon('star', 'fav-ic') : '') + '</span><span class="' + (win === 'a' ? 'w' : '') + '">' + esc(m.away) + (S.fav.includes(m.away) ? icon('star', 'fav-ic') : '') + '</span></span>' +
      '<span class="mrow-s' + (l.status === 'live' ? ' lv' : '') + '">' + (l.h != null ? '<b>' + l.h + '</b><b>' + l.a + '</b>' : '') + '</span>' +
      (s ? '<span class="mrow-g"><small>' + esc(s.mkName) + '</small><b>' + esc(s.label) + ' <em>' + odds(s.odds) + '</em></b></span><span class="mrow-v">' + valB(s.value) + '</span>' : '') + '</a>';
  }

  /* ================= ГОЛОВНА ================= */
  let scanRes = null;
  function scanBox() {
    if (!scanRes) return '<div class="scan-idle"><div><h2>Знайти цікаве</h2><p>Модель перегляне всі матчі найближчих 36 годин: форму, очні зустрічі, склади, новини та коефіцієнти. Покаже лише ті, де її оцінка помітно відрізняється від ринку.</p></div><button type="button" class="btn primary lg" data-act="scan">Сканувати матчі</button></div>';
    const list = scanRes.ids.map((id) => D.match(id)).filter(Boolean).map(an);
    return '<div class="scan-done"><div class="scan-sum"><h2>' + (list.length ? 'Знайдено ' + list.length + ' ' + plural(list.length, ['можливість', 'можливості', 'можливостей']) : 'Нічого не знайдено') + '</h2><p>Переглянуто ' + scanRes.n + ' ' + plural(scanRes.n, ['матч', 'матчі', 'матчів']) + ' ' + ago(scanRes.t) + '. Пороги: різниця від 3 п.п., впевненість від 50.</p><button type="button" class="btn ghost" data-act="scan">' + icon('refresh') + 'Ще раз</button></div>' +
      (list.length ? '<div class="opp-grid">' + list.map(oppCard).join('') + '</div>' : '<p class="muted">Модель і ринок зараз згодні щодо всіх матчів. Це теж нормальний результат.</p>') + '</div>';
  }
  on('scan', () => {
    const box = document.getElementById('scan'); if (!box) return;
    A.rendering.busy = true;
    const steps = ['Переглядаємо матчі', 'Аналізуємо форму', 'Перевіряємо новини і склади', 'Порівнюємо з ринком', 'Рахуємо модель'];
    box.innerHTML = '<div class="scan-run" aria-live="polite"><div class="radar" aria-hidden="true"><i></i></div><ol class="steps">' + steps.map((x) => '<li><span></span>' + x + '</li>').join('') + '</ol></div>';
    const lis = box.querySelectorAll('.steps li'); let i = 0;
    const step = () => {
      if (i > 0) { lis[i - 1].classList.remove('run'); lis[i - 1].classList.add('ok'); }
      if (i < lis.length) { lis[i].classList.add('run'); i++; setTimeout(step, 480); return; }
      const p = pool(36).filter((a) => a.status === 'upcoming');
      const res = p.filter((a) => a.best.value >= 0.03 && a.best.conf.value >= 50).sort((x, y) => y.best.value * y.best.conf.value - x.best.value * x.best.conf.value).slice(0, 4);
      scanRes = { t: now(), n: p.length, ids: res.map((a) => a.m.id) };
      A.rendering.busy = false; box.innerHTML = scanBox();
    };
    step();
  });

  V[''] = function () {
    const t = now(); const us = A.stats(S.bets.user, S.user.start), as = A.stats(S.bets.ai, S.ai.start);
    const today = D.matchesForDate(U.ds(t)).filter(A.prefSport);
    const lives = D.matchesInRange(U.addDays(U.ds(t), -1), 2).filter((m) => D.status(m) === 'live' && A.prefSport(m));
    const pend = S.bets.user.filter((b) => b.status === 'pending');
    const dayStart = U.dayStart(U.ds(t));
    const aiToday = S.bets.ai.filter((b) => b.status !== 'pending' && b.settledAt >= dayStart).reduce((s, b) => s + b.pl, 0);
    const greet = new Date(t).getHours() < 12 ? 'Доброго ранку' : new Date(t).getHours() < 18 ? 'Доброго дня' : 'Доброго вечора';
    const opps = pool(36).filter((a) => a.status === 'upcoming' && a.best.value > 0.015).sort((x, y) => y.interest - x.interest).slice(0, 4);
    const favUp = S.fav.length ? D.matchesInRange(U.ds(t), 3).filter((m) => isFav(m) && D.status(m) !== 'finished').slice(0, 5) : [];
    const news = D.news(t, 2).filter((n) => n.impact !== 'low').slice(0, 3);
    return '<section class="hero"><div><h1>' + greet + (S.profile.name ? ', ' + esc(S.profile.name.split(' ')[0]) : '') + '</h1><p>' + new Date(t).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }) + '. Сьогодні ' + today.length + ' ' + plural(today.length, ['матч', 'матчі', 'матчів']) + ', зараз наживо ' + lives.length + '.</p></div>' + demoB('Демо-дані') + '</section>' +
      '<div class="tiles">' +
      '<a class="tile link" href="#/me">' + '<span class="tile-l">Мій баланс</span><b class="tile-v">' + money(us.bank) + '</b><span class="tile-s ' + plCls(us.pl) + '">' + money(us.pl, true) + ' від старту</span></a>' +
      '<a class="tile link" href="#/me/bets"><span class="tile-l">Активні ставки</span><b class="tile-v">' + pend.length + '</b><span class="tile-s">' + money(pend.reduce((s, b) => s + b.stake, 0)) + ' у грі</span></a>' +
      '<a class="tile link" href="#/ai"><span class="tile-l">AI-аналітик</span><b class="tile-v">' + money(as.bank) + '</b><span class="tile-s">Сьогодні ' + '<span class="' + plCls(aiToday) + '">' + money(aiToday, true) + '</span></span></a>' +
      '<a class="tile link" href="#/live"><span class="tile-l">Наживо</span><b class="tile-v">' + lives.length + '</b><span class="tile-s">' + plural(lives.length, ['матч зараз', 'матчі зараз', 'матчів зараз']) + '</span></a></div>' +
      '<section class="scan" id="scan">' + scanBox() + '</section>' +
      '<div class="cols">' +
      sec('Найкращі можливості', opps.length ? '<div class="orows">' + opps.map(oppRow).join('') + '</div>' : empty('Поки нічого', 'Немає матчів, де модель помітно розходиться з ринком.'), more('#/opps', 'Усі')) +
      sec('Наживо зараз', lives.length ? '<div class="mlist">' + lives.slice(0, 6).map((m) => matchRow(m)).join('') + '</div>' : empty('Зараз ніхто не грає', 'Перемотайте демо-час у розділі «Наживо», щоб побачити матчі в грі.'), more('#/live', 'Усі')) + '</div>' +
      '<div class="cols">' +
      sec('Ваше обране', favUp.length ? '<div class="mlist">' + favUp.map((m) => matchRow(m)).join('') + '</div>' : empty(S.fav.length ? 'Найближчим часом матчів немає' : 'Обраного поки немає', S.fav.length ? 'Матчі обраних команд з’являться тут.' : 'Відкрийте будь-який матч і натисніть зірочку біля команди чи гравця.'), more('#/me/fav', 'Керувати')) +
      sec('Головні новини', news.length ? '<div class="nlist">' + news.map((n) => newsCard(n, true)).join('') + '</div>' : empty('Важливих новин немає', ''), more('#/news', 'Усі новини')) + '</div>';
  };

  /* ================= МАТЧІ ================= */
  function matchesBase() {
    const t = now(); const ds = U.addDays(U.ds(t), Number(S.ui.mDay));
    let ms = D.matchesForDate(ds);
    const q = (S.ui.q || '').trim().toLowerCase();
    ms = ms.filter((m) => (S.ui.mSport === 'all' || m.sport === S.ui.mSport) && (S.ui.mStatus === 'all' || D.status(m) === S.ui.mStatus) && (!q || (m.home + ' ' + m.away + ' ' + m.tourName).toLowerCase().includes(q)));
    return ms;
  }
  function matchesList() {
    const ms = matchesBase();
    if (!ms.length) return empty('Матчів не знайдено', 'Спробуйте інший день, вид спорту чи пошуковий запит.');
    const groups = {}; const order = [];
    ms.forEach((m) => { if (!groups[m.tour]) { groups[m.tour] = []; order.push(m.tour); } groups[m.tour].push(m); });
    order.sort((a, b) => D.TOURS.findIndex((x) => x.id === a) - D.TOURS.findIndex((x) => x.id === b));
    return order.map((k) => { const T = D.TOUR[k]; return '<div class="grp"><div class="grp-h">' + sportIc(T.sport) + '<b>' + esc(T.name) + '</b><span>' + esc(T.region) + '</span><em>' + groups[k].length + '</em></div>' + groups[k].map((m) => matchRow(m, true)).join('') + '</div>'; }).join('');
  }
  onInput('mq', (el) => { S.ui.q = el.value; save(); const l = document.getElementById('mlist'); if (l) l.innerHTML = matchesList(); });
  V.matches = function () {
    const ds = U.ds(now());
    const days = [['-1', 'Вчора'], ['0', 'Сьогодні'], ['1', 'Завтра'], ['2', new Date(U.dayStart(U.addDays(ds, 2))).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })]];
    const all = D.matchesForDate(U.addDays(ds, Number(S.ui.mDay)));
    const cnt = (sp) => all.filter((m) => sp === 'all' || m.sport === sp).length;
    return head('Матчі', 'Усі матчі з демо-фіду. Праворуч у кожному рядку найпомітніший сигнал моделі.') +
      '<div class="filters">' + chips('ui.mDay', days) + chips('ui.mSport', sportOpts().map(([v, l]) => [v, l, cnt(v)])) +
      '<div class="frow"><label class="search">' + icon('list') + '<input type="search" placeholder="Команда, гравець або турнір" value="' + esc(S.ui.q) + '" data-in="mq" aria-label="Пошук матчів"></label>' +
      select('ui.mStatus', [['all', 'Усі статуси'], ['live', 'Наживо'], ['upcoming', 'Ще не почалися'], ['finished', 'Завершені']]) + '</div></div>' +
      '<div id="mlist">' + matchesList() + '</div>';
  };

  /* ================= МАТЧ ================= */
  function teamBlock(name, form, right) {
    const fav = S.fav.includes(name);
    return '<div class="team' + (right ? ' r' : '') + '"><span class="crest">' + esc(initials(name)) + '</span><b>' + esc(name) + '</b><span class="pills">' + form.slice(0, 5).map((g) => '<i class="pill p' + ({ 'В': 'w', 'Н': 'd', 'П': 'l' }[g.res]) + '" title="' + esc((g.home ? 'вдома з ' : 'у гостях з ') + g.opp + ', ' + g.f + ':' + g.a) + '">' + g.res + '</i>').join('') + '</span>' +
      '<button type="button" class="favb' + (fav ? ' on' : '') + '" data-act="fav" data-team="' + esc(name) + '" aria-pressed="' + fav + '">' + icon('star') + (fav ? 'В обраному' : 'В обране') + '</button></div>';
  }
  function tabAnalysis(m, a) {
    const key = S.ui.mSel[m.id]; let s = a.best;
    if (key) { const [mk, k] = key.split('|'); const MK = a.markets.find((x) => x.key === mk); const f = MK && MK.sels.find((x) => x.key === k); if (f) s = f; }
    const picker = a.markets.map((MK) => '<div class="mk"><span class="mk-n">' + esc(MK.name) + '</span><div class="mk-s">' + MK.sels.map((x) => '<button type="button" class="opt' + (x === s ? ' on' : '') + '" data-act="msel" data-id="' + esc(m.id) + '" data-k="' + MK.key + '|' + x.key + '"><span>' + esc(x.label) + '</span><b>' + odds(x.odds) + '</b>' + valB(x.value) + '</button>').join('') + '</div></div>').join('');
    const aiB = S.bets.ai.filter((b) => b.matchId === m.id);
    return (a.status !== 'upcoming' ? note('Це оцінка моделі до початку матчу. Події самого матчу модель не враховує.') : '') +
      (aiB.length ? '<div class="ai-hold">' + icon('ai') + '<span>AI-аналітик поставив: ' + aiB.map((b) => '<a href="#/ai/' + b.id + '">' + esc(b.selection) + ', коеф. ' + odds(b.odds) + ', ' + money(b.stake) + ' (' + RES[b.status].toLowerCase() + ')</a>').join('; ') + '</span></div>' : '') +
      '<div class="an">' +
      '<div class="an-pick"><h3>Оберіть варіант</h3>' + picker + '</div>' +
      '<div class="an-main">' +
      '<div class="sel-h"><div><small>' + esc(s.mkName) + '</small><h3>' + esc(s.label) + '</h3></div><span class="big-o">' + odds(s.odds) + '</span></div>' +
      '<div class="nums"><div><span>Модель</span><b class="acc">' + pct(s.model) + '</b></div><div><span>Ринок</span><b>' + pct(s.implied) + '</b></div><div><span>Різниця</span><b class="' + plCls(s.value) + '">' + pp(s.value) + '</b></div><div><span>Впевненість</span><b>' + s.conf.value + '<small> / 100</small></b></div></div>' +
      probBars(s.model, s.implied) + '<div class="badges">' + confB(s.conf) + riskB(s.risk.level) + '</div>' +
      '<h4>Пояснення</h4><p class="lead">' + esc(M.reasoning(s)) + '</p>' +
      '<h4>Фактори</h4>' + factorRows(s.factors) +
      '<h4>Аргументи проти</h4><ul class="against">' + M.against(s).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<p class="fine">Модель показує можливу статистичну перевагу, а не гарантований результат. Різниця з ринком частіше означає помилку моделі, ніж помилку букмекерів.</p>' +
      (a.status === 'upcoming' ? '<button type="button" class="btn primary" data-act="bet-new" data-id="' + esc(m.id) + '" data-k="' + s.mk + '|' + s.key + '">' + icon('plus') + 'Додати цю ставку в кабінет</button>' : '') +
      '</div></div>';
  }
  function formTable(games, sport) {
    return '<table class="tbl"><tbody>' + games.map((g) => '<tr><td><i class="pill p' + ({ 'В': 'w', 'Н': 'd', 'П': 'l' }[g.res]) + '">' + g.res + '</i></td><td>' + (sport === 'football' ? (g.home ? 'вдома, ' : 'у гостях, ') : '') + esc(g.opp) + '</td><td class="r b">' + g.f + ':' + g.a + '</td><td class="r muted">' + g.daysAgo + ' дн. тому</td></tr>').join('') + '</tbody></table>';
  }
  function tabStats(m) {
    const c = m.ctx; let out = '';
    out += '<div class="two">' + sec('Форма: ' + esc(m.home), formTable(c.formH, m.sport)) + sec('Форма: ' + esc(m.away), formTable(c.formA, m.sport)) + '</div>';
    out += sec('Очні зустрічі', c.h2h.length ? '<table class="tbl"><tbody>' + c.h2h.map((g) => '<tr><td class="muted">' + g.y + '</td><td>' + esc(m.home) + '</td><td class="c b">' + g.hs + ':' + g.as + '</td><td>' + esc(m.away) + '</td></tr>').join('') + '</tbody></table>' + (c.h2h.length < 3 ? note('Мала вибірка. За ' + c.h2h.length + ' ' + plural(c.h2h.length, ['зустріччю', 'зустрічами', 'зустрічами']) + ' висновків робити не варто.', 'warn') : '') : '<p class="muted">Раніше не зустрічалися, або даних немає.</p>');
    if (m.sport === 'football') {
      const inj = (side) => { const l = c.inj[side]; return l.length ? '<ul class="inj">' + l.map((p) => '<li><span class="b ' + (p.status === 'out' ? 'b-lost' : 'b-medium') + '">' + (p.status === 'out' ? 'Не зіграє' : 'Під питанням') + '</span><div><b>' + esc(p.name) + '</b>, ' + esc(p.role) + '<small>' + esc(p.reason) + '. Частка внеску ' + p.contrib + '% (демо).</small></div></li>').join('') + '</ul>' : '<p class="muted">Втрат немає.</p>'; };
      out += sec('Травми', '<div class="two"><div><h4>' + esc(m.home) + '</h4>' + inj('home') + '</div><div><h4>' + esc(m.away) + '</h4>' + inj('away') + '</div></div>');
      out += sec('Склади', c.lineups ? '<div class="two">' + ['home', 'away'].map((sd) => '<div><h4>' + esc(sd === 'home' ? m.home : m.away) + '</h4><ol class="xi">' + c.lineups[sd].map((p) => '<li>' + esc(p) + '</li>').join('') + '</ol></div>').join('') + '</div><p class="fine">Прогноз складу з демо-фіду, імена гравців вигадані.</p>' : '<p class="muted">Склади ще не оголошені. Зазвичай їх публікують приблизно за годину до початку.</p>');
      out += sec('Відпочинок', '<p>' + esc(m.home) + ': ' + c.restH + ' дн. після попереднього матчу. ' + esc(m.away) + ': ' + c.restA + ' дн.</p>');
    } else if (m.sport === 'tennis') {
      const F = c.fatigue;
      out += sec('Втома', '<p>' + esc(m.home) + ': попередній матч тривав ' + F.lastH + ' хв, відпочинок ' + F.restH + ' дн.<br>' + esc(m.away) + ': ' + F.lastA + ' хв, відпочинок ' + F.restA + ' дн.</p>' + (F.lastH > 150 || F.lastA > 150 ? note('Довгий попередній матч підвищує ризик втоми, особливо в третьому сеті.', 'warn') : ''));
      out += sec('Покриття', '<p class="muted">Недостатньо даних. Результати на різних покриттях не входять у демо-фід.</p>');
    } else {
      const E = c.esp;
      out += sec('Склади', '<div class="two">' + [[m.home, E.rosterH, 'home'], [m.away, E.rosterA, 'away']].map(([n, r, sd]) => '<div><h4>' + esc(n) + '</h4><div class="nicks">' + r.map((x, i) => '<span class="nick' + (E.standIn === sd && i === 0 ? ' out' : '') + '">' + esc(x) + (E.standIn === sd && i === 0 ? ' (не зіграє)' : '') + '</span>').join('') + '</div></div>').join('') + '</div>');
      out += sec('Карти', E.pool ? '<p>Ймовірний пул: ' + E.pool.join(', ') + '.</p><p>' + (E.mapAdv ? esc(E.mapAdv > 0 ? m.home : m.away) + ' мають кращу статистику на цих картах (демо).' : 'Помітної переваги на картах немає.') + '</p>' : '<p class="muted">Для ' + esc(m.game) + ' карти не мають значення. Вплив останнього патча оцінити неможливо.</p>');
    }
    return out;
  }
  function moveExplain(m, s, mv) {
    if (Math.abs(mv) < 0.03) return 'Коефіцієнт майже не змінювався. Пояснювати нічого.';
    const shorten = mv < 0;
    const n = D.newsForMatch(m).find((x) => x.side && (s.key === x.side ? !shorten : (s.key === 'home' || s.key === 'away') && shorten));
    if (n) return 'Можливе пояснення: новина «' + n.title + '» (' + ago(n.time) + '). Час і напрям збігаються, але причинний зв’язок не підтверджений.';
    return 'Можливе пояснення: недостатньо даних. Новин, що пояснюють ' + (shorten ? 'падіння' : 'зростання') + ' коефіцієнта, немає. Це може бути обсяг ставок або інформація, якої немає в демо-фіді.';
  }
  function tabOdds(m, a) {
    const mks = D.markets(m);
    const table = '<div class="tw"><table class="tbl"><thead><tr><th>Варіант</th><th class="r">Відкриття</th><th class="r">Зараз</th><th class="r">Зміна</th><th class="r">Ринок</th><th class="r">Модель</th></tr></thead><tbody>' +
      mks.map((MK) => '<tr class="sub"><td colspan="6">' + esc(MK.name) + '</td></tr>' + MK.sels.map((x) => { const mv = x.odds / x.open - 1; const ms = a.markets.find((y) => y.key === MK.key).sels.find((y) => y.key === x.key); return '<tr><td>' + esc(x.label) + '</td><td class="r">' + odds(x.open) + '</td><td class="r b">' + odds(x.odds) + '</td><td class="r ' + (mv < -0.005 ? 'pos' : mv > 0.005 ? 'neg' : 'muted') + '">' + (mv > 0 ? '+' : '') + num(mv * 100, 1) + '%</td><td class="r">' + pct(1 / x.odds) + '</td><td class="r acc">' + pct(ms.model) + '</td></tr>'; }).join('')).join('') + '</tbody></table></div><p class="fine">Зелений: коефіцієнт упав, ринок став впевненішим. Червоний: зріс.</p>';
    const k = S.ui.oSel[m.id] || (a.best.mk + '|' + a.best.key); const [mk, sk] = k.split('|');
    const MK = m.markets.find((x) => x.key === mk) || m.markets[0]; const sel = MK.sels.find((x) => x.key === sk) || MK.sels[0];
    const t = Math.min(now(), m.start); const hist = sel.hist.filter((p) => p.t <= t);
    const cur = D.markets(m).find((x) => x.key === MK.key).sels.find((x) => x.key === sel.key);
    const mv = cur.odds / sel.open - 1;
    const opts = m.markets.flatMap((X) => X.sels.map((y) => [X.key + '|' + y.key, X.name + ': ' + y.label]));
    return sec('Коефіцієнти', table) +
      sec('Рух коефіцієнта', '<div class="frow">' + '<label class="sel"><select data-ch="osel" data-id="' + esc(m.id) + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (v === MK.key + '|' + sel.key ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label><span class="muted">Відкриття ' + odds(sel.open) + ', зараз ' + odds(cur.odds) + ' (' + (mv > 0 ? '+' : '') + num(mv * 100, 1) + '%)</span></div>' +
        (hist.length >= 2 ? lineChart({ series: [{ name: sel.label, values: hist.map((p) => p.o), color: '#2357e8' }], labels: hist.map((p) => { const d = Math.round((m.start - p.t) / H); return d <= 0 ? 'старт' : 'за ' + d + ' год'; }), fmt: (v) => odds(v), height: 220 }) : '<div class="chart-empty">Історія коефіцієнта з’явиться ближче до матчу.</div>') +
        '<div class="explain"><b>Можливе пояснення</b><p>' + esc(moveExplain(m, sel, mv)) + '</p></div>');
  }
  onChange('osel', (el) => { S.ui.oSel[el.dataset.id] = el.value; rerender(); });
  function liveFlags(m, l) {
    const out = []; const mo = l.mom || [];
    if (mo.length >= 6) { const r = mo.slice(-3).reduce((a, b) => a + b, 0) / 3, b = mo.slice(-6, -3).reduce((a, x) => a + x, 0) / 3; if (Math.sign(r) !== Math.sign(b) && Math.abs(r - b) > 0.45) out.push('Перелом: останнім часом перевага в ' + (r > 0 ? m.home : m.away) + '.'); }
    if (l.h != null && l.h !== l.a) { const mk = m.markets[0]; const fav = mk.sels[0].close <= mk.sels[mk.sels.length - 1].close ? 'home' : 'away'; const lead = l.h > l.a ? 'home' : 'away'; if (lead !== fav) out.push('Несподіванка: веде андердог ' + (lead === 'home' ? m.home : m.away) + '.'); }
    return out;
  }
  function liveBlock(m, full) {
    const l = D.live(m); const flags = liveFlags(m, l);
    let body = '<div class="lv-score"><span>' + esc(m.home) + '</span><b>' + (l.h == null ? '-' : l.h + ':' + l.a) + '</b><span>' + esc(m.away) + '</span></div>' +
      '<div class="lv-label">' + (l.status === 'live' ? '<span class="st-live"><i></i>' + esc(l.label) + '</span>' : esc(l.label || 'Ще не почався')) + (l.detail ? '<span class="muted">' + esc(l.detail) + '</span>' : '') + '</div>' +
      '<div class="prog"><i style="width:' + Math.round(l.progress * 100) + '%"></i></div>';
    if (full) {
      if (l.stats) { const row = (lb, v, suf) => { const t = v[0] + v[1] || 1; return '<div class="sb"><b>' + v[0] + (suf || '') + '</b><span>' + lb + '</span><b>' + v[1] + (suf || '') + '</b><div class="sb-t"><i style="width:' + v[0] / t * 100 + '%"></i><i style="width:' + v[1] / t * 100 + '%"></i></div></div>'; }; body += '<div class="sbars">' + row('Удари', l.stats.shots) + row('У площину', l.stats.sot) + row('Володіння', l.stats.poss, '%') + row('Кутові', l.stats.corners) + row('Картки', l.stats.cards) + '</div>'; }
      else body += '<p class="fine">Детальна статистика (' + (m.sport === 'tennis' ? 'подачі, ейси, брейкпойнти' : 'вбивства, економіка, раунди по гравцях') + ') у демо-фіді недоступна. Показуємо рахунок, хід матчу і перевагу.</p>';
      if (m.sport === 'esports' && m.result.maps && l.status !== 'upcoming') body += '<table class="tbl"><tbody>' + m.result.maps.slice(0, l.h + l.a).map((x, i) => '<tr><td>Карта ' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td class="r b">' + x.s[0] + ':' + x.s[1] + '</td></tr>').join('') + '</tbody></table>';
      if (l.events && l.events.length) body += '<ul class="events">' + l.events.slice(-8).map((e) => '<li class="' + e.side + '"><b>' + e.min + '’</b>' + esc(e.type) + ', ' + esc(e.side === 'home' ? m.home : m.away) + '</li>').join('') + '</ul>';
    }
    body += '<div class="mom-w"><span class="muted small">Перевага: вгору ' + esc(m.home) + ', вниз ' + esc(m.away) + '</span>' + momBars(l.mom) + '</div>';
    if (flags.length) body += '<div class="flags">' + flags.map((f) => '<span class="flag">' + icon('alert') + esc(f) + '</span>').join('') + '</div>';
    return body;
  }
  on('msel', (el) => { S.ui.mSel[el.dataset.id] = el.dataset.k; rerender(); });
  V.match = function (params) {
    const m = D.match(params[0]);
    if (!m) return empty('Матч не знайдено', 'Такого матчу немає в демо-фіді.', '<a class="btn" href="#/matches">До матчів</a>');
    const a = an(m); const l = D.live(m);
    const tabs = [['analysis', 'Аналіз'], ['stats', 'Статистика'], ['odds', 'Коефіцієнти'], ['news', 'Новини']];
    if (l.status !== 'upcoming') tabs.splice(0, 0, ['live', l.status === 'live' ? 'Наживо' : 'Перебіг']);
    let tab = params[1] || S.ui.mTab[m.id] || (l.status === 'live' ? 'live' : 'analysis'); if (!tabs.some((x) => x[0] === tab)) tab = 'analysis';
    S.ui.mTab[m.id] = tab;
    const mid = l.status === 'upcoming' ? '<div class="score up"><b>' + time(m.start) + '</b><span>' + dayLabel(m.start) + '</span></div>' : '<div class="score' + (l.status === 'live' ? ' lv' : '') + '"><b>' + l.h + ':' + l.a + '</b><span>' + esc(l.label) + '</span>' + (l.detail ? '<small>' + esc(l.detail) + '</small>' : '') + '</div>';
    const news = D.newsForMatch(m);
    let body;
    if (tab === 'live') body = '<div class="panel">' + liveBlock(m, true) + '</div>';
    else if (tab === 'stats') body = tabStats(m);
    else if (tab === 'odds') body = tabOdds(m, a);
    else if (tab === 'news') body = news.length ? '<div class="nlist">' + news.map((n) => newsCard(n)).join('') + '</div>' : empty('Новин про цей матч немає', 'Якщо з’являться новини про склади чи травми, вони будуть тут.');
    else body = tabAnalysis(m, a);
    return '<a class="back" href="#/matches">' + icon('chevL') + 'Усі матчі</a>' +
      '<section class="mhead"><div class="mhead-top">' + meta(m) + '<span>' + esc(m.region) + '</span><span>' + dateTime(m.start) + '</span>' + demoB() + '</div>' +
      '<div class="mhead-main">' + teamBlock(m.home, m.ctx.formH) + mid + teamBlock(m.away, m.ctx.formA, true) + '</div></section>' +
      '<nav class="tabs" role="tablist">' + tabs.map(([k, t]) => '<a role="tab" aria-selected="' + (k === tab) + '" class="' + (k === tab ? 'on' : '') + '" href="' + mLink(m) + '/' + k + '">' + t + (k === 'news' && news.length ? '<em>' + news.length + '</em>' : '') + '</a>').join('') + '</nav>' + body;
  };

  /* ================= НОВИНИ (картка використовується і вище) ================= */
  function newsCard(n, compact) {
    const ms = n.matchIds.map((id) => D.match(id)).filter(Boolean);
    return '<article class="news imp-' + n.impact + '"><div class="news-top">' + impB(n.impact) + sportIc(n.sport) + '<span>' + esc(n.source) + '</span><time>' + ago(n.time) + '</time></div>' +
      '<h3>' + esc(n.title) + '</h3>' + (compact ? '' : '<p>' + esc(n.fact) + '</p>') +
      '<div class="why-box"><b>Чому це важливо</b><span class="muted small">інтерпретація AI, а не факт</span><p>' + esc(n.why) + '</p></div>' +
      (ms.length ? '<div class="news-m">' + ms.map((m) => '<a href="' + mLink(m) + '">' + esc(m.home) + ' проти ' + esc(m.away) + ', ' + dateTime(m.start) + '</a>').join('') + '</div>' : '') + '</article>';
  }
  SIT.ViewParts = { mLink, an, head, sec, more, sportOpts, pool, CATS, oppCard, oppRow, matchRow, newsCard, factorRows, probBars, liveBlock, liveFlags, isFav, meta };
})();

/* ================= МОЖЛИВОСТІ, НАЖИВО, AI, НОВИНИ ================= */
(function () {
  'use strict';
  const SIT = window.SIT, D = SIT.Data, M = SIT.Model, U = SIT.U, A = SIT.App, S = A.S;
  const { esc, money, num, pct, pp, odds, time, dayLabel, dateTime, ago, plural, plCls, icon, sportIc, confB, riskB, valB, resB, demoB, statusLine,
    empty, note, tile, plSpan, chips, select, sw, RES, lineChart, hbars, openModal, toast, on, rerender, render, save, now } = A;
  const V = SIT.Views; const P = SIT.ViewParts; const H = 3600e3;

  V.opps = function () {
    const all = P.pool(36).filter((a) => a.best.value > 0 && a.cats.length);
    const cnt = (k) => all.filter((a) => a.cats.includes(k)).length;
    let list = S.ui.oCat === 'all' ? all : all.filter((a) => a.cats.includes(S.ui.oCat));
    const so = { interest: (a) => -a.interest, value: (a) => -a.best.value, conf: (a) => -a.best.conf.value, time: (a) => a.m.start }[S.ui.oSort] || ((a) => -a.interest);
    list = list.slice().sort((x, y) => so(x) - so(y)).slice(0, 24);
    return P.head('Можливості', 'Матчі найближчих 36 годин, де оцінка моделі відрізняється від ринку. Це статистичні сигнали, а не поради і не гарантія.') +
      '<div class="filters">' + chips('ui.oCat', [['all', 'Усі', all.length]].concat(Object.keys(P.CATS).map((k) => [k, P.CATS[k], cnt(k)]))) +
      '<div class="frow">' + select('ui.oSort', [['interest', 'Спершу найцікавіші'], ['value', 'Спершу найбільша різниця'], ['conf', 'Спершу найвпевненіші'], ['time', 'Спершу найближчі']]) + '</div></div>' +
      (list.length ? '<div class="opp-grid">' + list.map(P.oppCard).join('') + '</div>' : empty('У цій категорії порожньо', S.ui.oCat === 'live' ? 'Зараз немає матчів наживо з помітним сигналом.' : 'Спробуйте іншу категорію або зазирніть пізніше.'));
  };

  const clockBtns = () => '<div class="clock-b"><span class="muted">Демо-час</span><button type="button" class="btn ghost sm" data-act="clock" data-m="15">+15 хв</button><button type="button" class="btn ghost sm" data-act="clock" data-m="60">+1 год</button><button type="button" class="btn ghost sm" data-act="clock" data-m="360">+6 год</button>' + (S.settings.clock ? '<button type="button" class="btn ghost sm" data-act="clock" data-m="0">Скинути</button>' : '') + '</div>';
  SIT.ViewParts.clockBtns = clockBtns;
  V.live = function () {
    const t = now();
    const ms = D.matchesInRange(U.addDays(U.ds(t), -1), 3);
    const live = ms.filter((m) => D.status(m) === 'live');
    const cnt = (sp) => live.filter((m) => sp === 'all' || m.sport === sp).length;
    const list = live.filter((m) => S.ui.liveSport === 'all' || m.sport === S.ui.liveSport);
    const soon = ms.filter((m) => D.status(m) === 'upcoming' && m.start - t < 3 * H).slice(0, 6);
    return P.head('Наживо', 'Рахунок, хід матчу та перевага. Демо-час можна перемотати, щоб побачити, як матчі йдуть і завершуються.', clockBtns()) +
      '<div class="filters">' + chips('ui.liveSport', P.sportOpts().map(([v, l]) => [v, l, cnt(v)])) + '</div>' +
      (list.length ? '<div class="live-grid">' + list.map((m) => '<a class="live-card" href="' + P.mLink(m) + '"><div class="opp-top">' + P.meta(m) + '</div>' + P.liveBlock(m, m.sport === 'football') + '</a>').join('') + '</div>'
        : empty('Зараз ніхто не грає', 'Перемотайте час на годину вперед, і перші матчі почнуться.', clockBtns())) +
      P.sec('Скоро почнуться', soon.length ? '<div class="mlist">' + soon.map((m) => P.matchRow(m)).join('') + '</div>' : '<p class="muted">У найближчі 3 години матчів немає.</p>');
  };

  /* ---------- AI-аналітик ---------- */
  function aiBetModal(id) {
    const b = S.bets.ai.find((x) => x.id === id) || S.bets.user.find((x) => x.id === id); if (!b) return;
    const kv = (l, v) => '<div class="kv"><span>' + l + '</span><b>' + v + '</b></div>';
    const r = b.review;
    const body = '<div class="bm"><div class="bm-top">' + sportIc(b.sport) + '<span>' + esc(b.tour) + '</span>' + resB(b.status) + demoB('Паперова ставка') + '</div>' +
      '<a class="bm-m" href="#/match/' + encodeURIComponent(b.matchId) + '">' + esc(b.match) + '</a><p class="muted">' + (b.score ? 'Рахунок ' + esc(b.score) : 'Початок ' + dateTime(b.start)) + '</p>' +
      '<div class="kvs">' + kv('Ринок', esc(b.mkName)) + kv('Вибір', esc(b.selection)) + kv('Коефіцієнт', odds(b.odds)) + kv('Сума', money(b.stake)) + kv('Можливий виграш', money(b.stake * (b.odds - 1))) + kv('Модель', '<span class="acc">' + pct(b.model) + '</span>') + kv('Ринок', pct(b.implied)) + kv('Різниця', valB(b.value)) + kv('Впевненість', b.conf + ' / 100') + kv('Ризик', A.RISK[b.risk]) + kv('Результат', resB(b.status)) + kv('Прибуток', b.status === 'pending' ? '<span class="muted">ще не відомо</span>' : plSpan(b.pl)) + kv('Ставку зроблено', new Date(b.placedAt).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</div>' +
      '<h4>Пояснення</h4><p>' + esc(b.reasoning) + '</p>' +
      '<div class="two"><div class="pc pro"><h4>За</h4><ul>' + (b.pros.length ? b.pros.map((x) => '<li>' + esc(x) + '</li>').join('') : '<li>Помітних факторів не було</li>') + '</ul></div><div class="pc con"><h4>Проти</h4><ul>' + b.cons.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' +
      (b.factors.length ? '<h4>Фактори</h4>' + P.factorRows(b.factors) : '') +
      '<div class="pm"><h4>Розбір після матчу</h4>' + (r ? '<div class="pm-g"><div><b>До матчу</b><p>' + esc(r.before) + '</p></div><div><b>Після матчу</b><p>' + esc(r.after) + '</p></div><div class="pro"><b>Що спрацювало</b><ul>' + r.correct.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div><div class="con"><b>Що не спрацювало</b><ul>' + r.wrong.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div><div><b>Помилка моделі</b><p>' + esc(r.error) + '</p></div><div class="lesson"><b>Висновок</b><p>' + esc(r.lesson) + '</p></div></div>' : '<p class="muted">Розбір з’явиться після завершення матчу.</p>') + '</div></div>';
    openModal((b.owner === 'ai' ? 'Ставка AI №' : 'Ваша ставка №') + String(b.no).padStart(3, '0'), body, '', true);
  }
  SIT.ViewParts.aiBetModal = aiBetModal;
  on('bet-open', (el) => aiBetModal(el.dataset.id));
  function betList(bets, owner) {
    return '<div class="blist">' + bets.map((b) => '<div class="brow" data-act="bet-open" data-id="' + b.id + '" tabindex="0" role="button">' +
      '<span class="brow-d"><b>' + (owner === 'ai' ? '№' + b.no : dayLabel(b.placedAt)) + '</b><small>' + (owner === 'ai' ? dayLabel(b.placedAt) : time(b.placedAt)) + '</small></span>' +
      '<span class="brow-m">' + sportIc(b.sport) + '<span><b>' + esc(b.match) + '</b><small>' + esc(b.mkName || b.market || '') + ': ' + esc(b.selection) + '</small></span></span>' +
      '<span class="brow-o">' + odds(b.odds) + '<small>' + money(b.stake) + '</small></span>' +
      '<span class="brow-r">' + resB(b.status) + '<b class="' + plCls(b.pl) + '">' + (b.status === 'pending' ? '<span class="muted">' + money(b.stake * (b.odds - 1), true) + '</span>' : money(b.pl, true)) + '</b></span>' +
      (owner === 'user' ? '<span class="brow-a"><button type="button" class="ib" data-act="bet-edit" data-id="' + b.id + '" aria-label="Редагувати">' + icon('edit') + '</button><button type="button" class="ib" data-act="bet-del" data-id="' + b.id + '" aria-label="Видалити">' + icon('trash') + '</button></span>' : '') +
      '</div>').join('') + '</div>';
  }
  SIT.ViewParts.betList = betList;
  let opened = null;
  V.ai = function (params) {
    if (params[0] && opened !== params[0]) { opened = params[0]; setTimeout(() => aiBetModal(params[0]), 30); }
    if (!params[0]) opened = null;
    const rng = S.ui.aiRange; const bets = A.inRange(S.bets.ai, rng);
    const st = A.stats(bets, S.ai.start); const all = A.stats(S.bets.ai, S.ai.start);
    const Pf = M.PROFILES[S.settings.risk];
    let jl = S.bets.ai.filter((b) => (S.ui.aiStatus === 'all' || b.status === S.ui.aiStatus) && (S.ui.aiSport === 'all' || b.sport === S.ui.aiSport)).sort((x, y) => y.placedAt - x.placedAt);
    const lim = Number(S.ui.aiLimit) || 25;
    const bySport = A.group(bets, (b) => D.SPORTS[b.sport].name).map((r) => ({ l: r.key, v: r.pl, n: r.n }));
    const byMk = A.group(bets, (b) => b.mkName.replace(/ [\d,.]+$/, ''));
    return P.head('AI-аналітик', 'Віртуальний рахунок. AI сам аналізує матчі, робить паперові ставки за фіксованими правилами і зберігає всю історію, включно з програшами.', '<div class="ph-act">' + sw('settings.autoAI', 'Автоматично') + '<button type="button" class="btn primary" data-act="ai-run">' + icon('ai') + 'Запустити аналіз</button></div>') +
      '<div class="filters">' + chips('ui.aiRange', [['7', '7 днів'], ['30', '30 днів'], ['90', '90 днів'], ['all', 'Увесь час']]) + '</div>' +
      (st.decided < 30 ? A.note('Мала вибірка: ' + st.decided + ' ' + plural(st.decided, ['розрахована ставка', 'розраховані ставки', 'розрахованих ставок']) + '. На такій дистанції результат майже повністю залежить від везіння.', 'warn') : '') +
      '<div class="tiles t4">' + tile('Баланс', money(all.bank), 'старт ' + money(S.ai.start)) + tile('Прибуток', plSpan(st.pl), rng === 'all' ? 'за весь час' : 'за ' + rng + ' днів') + tile('ROI', '<span class="' + plCls(st.roi || 0) + '">' + pct(st.roi) + '</span>', 'прибуток до суми ставок') + tile('Влучність', pct(st.winRate, 0), st.wins + ' виграшів, ' + st.losses + ' програшів') +
      tile('Ставок', String(st.n), st.pending + ' очікують') + tile('Середній коефіцієнт', odds(st.avgOdds)) + tile('Найбільший виграш', plSpan(st.best), 'найбільший програш ' + money(st.worst)) + tile('Макс. просадка', money(st.maxDD), 'поточна серія ' + st.streak) + '</div>' +
      P.sec('Баланс AI', lineChart({ series: [{ name: 'Баланс', values: st.series.map((p) => p.bank), color: '#2357e8' }], labels: st.series.map((p) => dayLabel(p.t)), area: true, fmt: (v) => money(v), title: 'Баланс AI' })) +
      '<div class="cols">' + P.sec('Прибуток за видами спорту', hbars(bySport, (v) => money(v, true))) +
      P.sec('За ринками', '<table class="tbl"><thead><tr><th>Ринок</th><th class="r">Ставок</th><th class="r">Влучність</th><th class="r">ROI</th></tr></thead><tbody>' + byMk.map((r) => '<tr><td>' + esc(r.key) + (r.n < 10 ? ' <span class="lown">мало даних</span>' : '') + '</td><td class="r">' + r.n + '</td><td class="r">' + pct(r.winRate, 0) + '</td><td class="r ' + plCls(r.roi || 0) + '">' + pct(r.roi) + '</td></tr>').join('') + '</tbody></table>') + '</div>' +
      P.sec('Як AI робить ставки', '<ul class="plain"><li>Профіль: <b>' + Pf.name + '</b> (змінюється в кабінеті, у налаштуваннях).</li><li>Ставить, лише якщо модель бачить різницю від ' + Pf.minEdge + ' п.п., впевненість від ' + Pf.minConf + ' і коефіцієнт від 1,35 до ' + num(Pf.maxOdds, 2) + '.</li><li>Сума: частина критерію Келлі, не більше ' + Math.round(Pf.cap * 100) + '% балансу на одну ставку і 15% на всі відкриті.</li><li>Програші не видаляються і не приховуються.</li></ul>') +
      P.sec('Журнал ставок AI', '<div class="frow">' + chips('ui.aiStatus', [['all', 'Усі'], ['pending', 'Очікують'], ['won', 'Виграш'], ['lost', 'Програш']]) + select('ui.aiSport', P.sportOpts().map(([v, l]) => [v, v === 'all' ? 'Усі види спорту' : l])) + '</div>' +
        (jl.length ? betList(jl.slice(0, lim), 'ai') + (jl.length > lim ? '<div class="more-b"><button type="button" class="btn ghost" data-act="set" data-k="ui.aiLimit" data-v="' + (lim + 25) + '">Показати ще (' + (jl.length - lim) + ')</button></div>' : '') : empty('Ставок немає', 'Змініть фільтр або запустіть аналіз.')));
  };

  /* ---------- новини ---------- */
  V.news = function () {
    const all = D.news(now(), 3);
    const list = all.filter((n) => (S.ui.newsSport === 'all' || n.sport === S.ui.newsSport) && (S.ui.newsImp === 'all' || n.impact === S.ui.newsImp));
    return P.head('Новини', 'Кожна новина поділена на факт і пояснення, чому це може бути важливо. Пояснення є інтерпретацією AI, а не фактом.') +
      '<div class="filters">' + chips('ui.newsSport', P.sportOpts()) + chips('ui.newsImp', [['all', 'Будь-який вплив'], ['high', 'Високий'], ['medium', 'Середній'], ['low', 'Низький']]) + '</div>' +
      (list.length ? '<div class="nlist wide">' + list.map((n) => P.newsCard(n)).join('') + '</div>' : empty('Новин немає', 'Спробуйте інший фільтр.'));
  };
})();

/* ================= ОСОБИСТИЙ КАБІНЕТ, ФОРМА СТАВКИ, ЗНАЙОМСТВО ================= */
(function () {
  'use strict';
  const SIT = window.SIT, D = SIT.Data, M = SIT.Model, U = SIT.U, A = SIT.App, S = A.S;
  const { esc, money, num, pct, odds, time, dayLabel, dateTime, plural, plCls, initials, icon, sportIc, resB, demoB, empty, note, tile, plSpan, chips, select, sw, RES,
    lineChart, hbars, openModal, closeModal, toast, on, onInput, onChange, rerender, render, save, now } = A;
  const V = SIT.Views; const P = SIT.ViewParts; const H = 3600e3;
  const COLORS = ['#2357e8', '#0f9d74', '#d9480f', '#7048e8', '#c2255c', '#1c7ed6', '#2b2f36'];
  const mkOf = (b) => (b.mkName || b.market || 'Інше').replace(/ [\d,.]+$/, '');

  /* ---------- форма ставки ---------- */
  let F = null;
  const upcoming = () => D.matchesInRange(U.ds(now()), 3).filter((m) => D.status(m) === 'upcoming' && A.prefSport(m)).slice(0, 80);
  function fillOdds() { const m = F.matchId && D.match(F.matchId); if (!m) return; const mk = D.markets(m).find((x) => x.key === F.mk); const s = mk && mk.sels.find((x) => x.key === F.key); if (s) F.odds = odds(s.odds); }
  function formBody() {
    const m = F.matchId ? D.match(F.matchId) : null;
    const ms = upcoming(); if (m && !ms.includes(m)) ms.unshift(m);
    const fld = (l, c, h) => '<label class="fld"><span>' + l + '</span>' + c + (h ? '<small>' + h + '</small>' : '') + '</label>';
    const inp = (k, ph, mode) => '<input class="inp" data-f="' + k + '" data-in="bf" value="' + esc(F[k]) + '" placeholder="' + esc(ph) + '"' + (mode ? ' inputmode="' + mode + '"' : '') + ' autocomplete="off">';
    const sel = (k, opts) => '<select class="inp" data-f="' + k + '" data-ch="bf">' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(F[k]) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    let h = '<div class="form">' + fld('Матч', sel('matchId', [['', 'Інший матч (ввести вручну)']].concat(ms.map((x) => [x.id, dayLabel(x.start) + ' ' + time(x.start) + ', ' + x.home + ' проти ' + x.away]))), 'Якщо обрати матч зі списку, ставка розрахується автоматично після його завершення.');
    if (m) {
      const mks = D.markets(m); const mk = mks.find((x) => x.key === F.mk) || mks[0];
      h += '<div class="f2">' + fld('Ринок', sel('mk', mks.map((x) => [x.key, x.name]))) + fld('Вибір', sel('key', mk.sels.map((x) => [x.key, x.label + ' (' + odds(x.odds) + ')']))) + '</div>';
    } else {
      h += fld('Назва матчу', inp('match', 'Наприклад, Карпати проти Руху')) + '<div class="f2">' + fld('Вид спорту', sel('sport', Object.values(D.SPORTS).map((s) => [s.id, s.name]))) + fld('Ринок', inp('market', 'Наприклад, Результат матчу')) + '</div>' + fld('Вибір', inp('selection', 'Наприклад, Карпати'));
    }
    h += '<div class="f2">' + fld('Коефіцієнт', inp('odds', '1,85', 'decimal')) + fld('Сума, ' + ({ EUR: '€', USD: '$', UAH: '₴', PLN: 'zł' }[S.settings.currency]), inp('stake', '20', 'decimal')) + '</div>';
    if (!m || F.id) h += fld('Результат', sel('status', [['pending', 'Очікує'], ['won', 'Виграш'], ['lost', 'Програш'], ['void', 'Повернення']]), m ? 'Для матчу зі списку результат проставиться сам.' : '');
    h += fld('Нотатка', '<textarea class="inp" data-f="note" data-in="bf" rows="2" placeholder="Чому ця ставка?">' + esc(F.note) + '</textarea>') + '<div class="prev" id="bf-prev">' + preview() + '</div><div class="err" id="bf-err" role="alert"></div></div>';
    return h;
  }
  const toNum = (v) => parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  function preview() { const o = toNum(F.odds), s = toNum(F.stake); if (!(o > 1) || !(s > 0)) return 'Вкажіть коефіцієнт і суму, щоб побачити можливий виграш.'; return 'Можливий виграш <b>' + money(s * (o - 1)) + '</b>, повернення <b>' + money(s * o) + '</b>, ймовірність у коефіцієнті <b>' + pct(1 / o) + '</b>.'; }
  function sync() { document.querySelectorAll('.modal [data-f]').forEach((i) => (F[i.dataset.f] = i.value)); }
  function refresh() { const b = document.querySelector('.modal .mb'); if (b) b.innerHTML = formBody(); }
  function openForm(init) {
    init = init || {};
    if (init.id) { const b = S.bets.user.find((x) => x.id === init.id); F = { id: b.id, matchId: b.matchId || '', mk: b.mk || '', key: b.key || '', match: b.match, sport: b.sport, market: b.market || b.mkName || '', selection: b.selection, odds: odds(b.odds), stake: String(b.stake), status: b.status, note: b.note || '' }; }
    else {
      F = { id: null, matchId: init.matchId || '', mk: '', key: '', match: '', sport: 'football', market: '', selection: '', odds: '', stake: '20', status: 'pending', note: '' };
      if (F.matchId) { const [mk, k] = (init.k || '').split('|'); const m = D.match(F.matchId); const mks = D.markets(m); F.mk = mk || mks[0].key; F.key = k || mks[0].sels[0].key; fillOdds(); }
    }
    openModal(F.id ? 'Редагувати ставку' : 'Нова ставка', formBody(), '<button type="button" class="btn ghost" data-act="close">Скасувати</button><button type="button" class="btn primary" data-act="bet-save">' + icon('check') + 'Зберегти</button>');
  }
  onInput('bf', (el) => { F[el.dataset.f] = el.value; const p = document.getElementById('bf-prev'); if (p) p.innerHTML = preview(); });
  onChange('bf', (el) => {
    sync(); const k = el.dataset.f;
    if (k === 'matchId' && F.matchId) { const mks = D.markets(D.match(F.matchId)); F.mk = mks[0].key; F.key = mks[0].sels[0].key; fillOdds(); }
    if (k === 'mk') { const mk = D.markets(D.match(F.matchId)).find((x) => x.key === F.mk); F.key = mk.sels[0].key; fillOdds(); }
    if (k === 'key') fillOdds();
    if (['matchId', 'mk', 'key'].includes(k)) refresh();
  });
  on('bet-add', () => openForm({}));
  on('bet-new', (el) => openForm({ matchId: el.dataset.id, k: el.dataset.k }));
  on('bet-edit', (el, e) => { e.stopPropagation(); openForm({ id: el.dataset.id }); });
  on('bet-del', (el, e) => {
    e.stopPropagation(); const b = S.bets.user.find((x) => x.id === el.dataset.id); if (!b) return;
    openModal('Видалити ставку?', '<p>Ставку <b>' + esc(b.match) + ', ' + esc(b.selection) + '</b> буде видалено, статистику перераховано. Скасувати це неможливо.</p>', '<button type="button" class="btn ghost" data-act="close">Скасувати</button><button type="button" class="btn danger" data-act="bet-del-ok" data-id="' + b.id + '">' + icon('trash') + 'Видалити</button>');
  });
  on('bet-del-ok', (el) => { S.bets.user = S.bets.user.filter((x) => x.id !== el.dataset.id); closeModal(); toast('Ставку видалено'); rerender(); });
  on('bet-save', () => {
    sync(); const o = toNum(F.odds), s = toNum(F.stake); const m = F.matchId ? D.match(F.matchId) : null; const errs = [];
    if (!m && !F.match.trim()) errs.push('Вкажіть назву матчу.');
    if (!m && !F.selection.trim()) errs.push('Вкажіть, на що ставка.');
    if (!(o >= 1.01) || o > 500) errs.push('Коефіцієнт має бути числом від 1,01.');
    if (!(s > 0)) errs.push('Сума має бути більшою за нуль.');
    if (errs.length) { document.getElementById('bf-err').innerHTML = errs.join('<br>'); return; }
    let b = F.id ? S.bets.user.find((x) => x.id === F.id) : null;
    if (m) {
      const a = M.analyze(m, now()); const mk = a.markets.find((x) => x.key === F.mk); const sel = Object.assign({}, mk.sels.find((x) => x.key === F.key), { odds: o });
      if (!b) b = A.makeBet('user', m, sel, s, now(), { note: F.note.trim() });
      else Object.assign(b, { matchId: m.id, sport: m.sport, tour: m.tourName, match: m.home + ' проти ' + m.away, start: m.start, mk: sel.mk, mkName: sel.mkName, key: sel.key, selection: sel.label, odds: o, stake: s, note: F.note.trim() });
      if (F.id && F.status !== 'pending') { b.status = F.status; b.pl = F.status === 'won' ? U.round2(s * (o - 1)) : F.status === 'lost' ? -s : 0; b.settledAt = b.settledAt || now(); }
      else if (D.status(m) === 'finished') A.settleBet(b, m); else { b.status = 'pending'; b.pl = 0; b.settledAt = null; }
    } else {
      if (!b) { const no = ++S.seq.user; b = { id: 'user-' + no + '-' + (Date.now() % 100000), no, owner: 'user', placedAt: now() }; S.bets.user.push(b); }
      Object.assign(b, { matchId: null, sport: F.sport, tour: 'Вручну', match: F.match.trim(), start: b.placedAt, mk: null, mkName: F.market.trim() || 'Інше', market: F.market.trim() || 'Інше', key: null, selection: F.selection.trim(), odds: o, stake: s, note: F.note.trim(), model: null, factors: [], pros: [], cons: [], reasoning: '' });
      b.status = F.status; b.pl = F.status === 'won' ? U.round2(s * (o - 1)) : F.status === 'lost' ? -s : 0; b.settledAt = F.status === 'pending' ? null : b.settledAt || now();
    }
    closeModal(); toast(F.id ? 'Зміни збережено' : 'Ставку додано в кабінет', 'ok');
    if (!location.hash.startsWith('#/me')) location.hash = '#/me/bets'; else rerender();
    save();
  });
  // Для ручних ставок без моделі відкриваємо форму замість розбору
  const baseOpen = SIT.ViewParts.aiBetModal;
  on('bet-open', (el) => { const b = S.bets.user.find((x) => x.id === el.dataset.id); if (b && b.model == null) openForm({ id: b.id }); else baseOpen(el.dataset.id); });

  /* ---------- кабінет ---------- */
  function overview() {
    const st = A.stats(S.bets.user, S.user.start);
    const act = S.bets.user.filter((b) => b.status === 'pending').sort((a, b) => a.start - b.start);
    const last = S.bets.user.filter((b) => b.status !== 'pending').sort((a, b) => b.settledAt - a.settledAt).slice(0, 5);
    const u30 = A.stats(A.inRange(S.bets.user, 30), 0), a30 = A.stats(A.inRange(S.bets.ai, 30), 0);
    return '<div class="tiles t4">' + tile('Прибуток', plSpan(st.pl), 'від старту') + tile('ROI', '<span class="' + plCls(st.roi || 0) + '">' + pct(st.roi) + '</span>', st.decided + ' розрахованих') + tile('Влучність', pct(st.winRate, 0), st.wins + ' з ' + st.decided) + tile('Активні', String(st.pending), money(A.exposure('user')) + ' у грі') + '</div>' +
      P.sec('Мій баланс', lineChart({ series: [{ name: 'Баланс', values: st.series.map((p) => p.bank), color: S.profile.color }], labels: st.series.map((p) => dayLabel(p.t)), area: true, fmt: (v) => money(v), title: 'Мій баланс' })) +
      '<div class="cols">' + P.sec('Активні ставки', act.length ? P.betList(act, 'user') : empty('Активних ставок немає', 'Відкрийте матч і натисніть «Додати цю ставку».', '<button type="button" class="btn primary" data-act="bet-add">' + icon('plus') + 'Додати ставку</button>')) +
      P.sec('Останні результати', last.length ? P.betList(last, 'user') : empty('Розрахованих ставок ще немає', '')) + '</div>' +
      P.sec('Ви та AI за 30 днів', '<table class="tbl"><thead><tr><th></th><th class="r">Ви</th><th class="r">AI-аналітик</th></tr></thead><tbody>' +
        [['Ставок', u30.n, a30.n], ['Влучність', pct(u30.winRate, 0), pct(a30.winRate, 0)], ['ROI', pct(u30.roi), pct(a30.roi)], ['Прибуток', money(u30.pl, true), money(a30.pl, true)], ['Середній коефіцієнт', odds(u30.avgOdds), odds(a30.avgOdds)]].map((r) => '<tr><td>' + r[0] + '</td><td class="r">' + r[1] + '</td><td class="r">' + r[2] + '</td></tr>').join('') + '</tbody></table><p class="fine">Це просто порівняння цифр. Переможця не визначаємо: різні суми, ринки й розмір вибірки.</p>');
  }
  function betsTab() {
    const all = S.bets.user; const c = (s) => all.filter((b) => s === 'all' || b.status === s).length;
    const list = all.filter((b) => S.ui.betF === 'all' || b.status === S.ui.betF).sort((a, b) => b.placedAt - a.placedAt);
    return '<div class="frow between">' + chips('ui.betF', [['all', 'Усі', c('all')], ['pending', 'Очікують', c('pending')], ['won', 'Виграш', c('won')], ['lost', 'Програш', c('lost')], ['void', 'Повернення', c('void')]]) + '<button type="button" class="btn primary" data-act="bet-add">' + icon('plus') + 'Додати ставку</button></div>' +
      (list.length ? P.betList(list, 'user') : empty(all.length ? 'Ставок із таким статусом немає' : 'Ставок поки немає', all.length ? '' : 'Додайте першу ставку вручну або з будь-якого матчу.'));
  }
  function favTab() {
    const teams = D.TOURS.flatMap((t) => t.teams.map((x) => [x.n, D.SPORTS[t.sport].name + ', ' + t.name]));
    const seen = new Set(); const opts = teams.filter(([n]) => !S.fav.includes(n) && !seen.has(n) && seen.add(n));
    const up = D.matchesInRange(U.ds(now()), 3).filter((m) => P.isFav(m) && D.status(m) !== 'finished');
    return P.sec('Обрані команди та гравці', (S.fav.length ? '<div class="favs">' + S.fav.map((n) => '<span class="favc">' + icon('star') + esc(n) + '<button type="button" class="ib sm" data-act="fav" data-team="' + esc(n) + '" aria-label="Прибрати ' + esc(n) + '">' + icon('x') + '</button></span>').join('') + '</div>' : '<p class="muted">Поки порожньо. Додайте команду зі списку нижче або зірочкою на сторінці матчу.</p>') +
      '<div class="frow"><label class="sel"><select data-ch="fav-add"><option value="">Додати команду чи гравця</option>' + opts.map(([n, g]) => '<option value="' + esc(n) + '">' + esc(n) + ' (' + esc(g) + ')</option>').join('') + '</select></label></div>') +
      P.sec('Найближчі матчі обраних', up.length ? '<div class="mlist">' + up.map((m) => P.matchRow(m, true)).join('') + '</div>' : '<p class="muted">У найближчі три дні матчів немає.</p>');
  }
  onChange('fav-add', (el) => { if (el.value && !S.fav.includes(el.value)) { S.fav.push(el.value); toast(el.value + ' додано в обране', 'ok'); rerender(); } });
  function statsTab() {
    const bets = A.inRange(S.bets.user, S.ui.stRange); const st = A.stats(bets, 0);
    const tbl = (title, rows) => P.sec(title, '<table class="tbl"><thead><tr><th></th><th class="r">Ставок</th><th class="r">Влучність</th><th class="r">ROI</th><th class="r">Прибуток</th></tr></thead><tbody>' + (rows.length ? rows.map((r) => '<tr><td>' + esc(r.key) + (r.n < 10 ? ' <span class="lown">мало даних</span>' : '') + '</td><td class="r">' + r.n + '</td><td class="r">' + pct(r.winRate, 0) + '</td><td class="r ' + plCls(r.roi || 0) + '">' + pct(r.roi) + '</td><td class="r">' + plSpan(r.pl) + '</td></tr>').join('') : '<tr><td colspan="5" class="muted">Немає даних</td></tr>') + '</tbody></table>');
    const u = A.stats(A.inRange(S.bets.user, S.ui.stRange), 0).series, a = A.stats(A.inRange(S.bets.ai, S.ui.stRange), 0).series;
    return '<div class="filters">' + chips('ui.stRange', [['7', '7 днів'], ['30', '30 днів'], ['all', 'Увесь час']]) + '</div>' +
      (st.decided < 30 ? note('Мала вибірка: ' + st.decided + ' ' + plural(st.decided, ['розрахована ставка', 'розраховані ставки', 'розрахованих ставок']) + '. Висновки про «вдалий» вид спорту чи ринок поки робити рано.', 'warn') : '') +
      '<div class="tiles t4">' + tile('Ставок', String(st.n)) + tile('Влучність', pct(st.winRate, 0)) + tile('ROI', '<span class="' + plCls(st.roi || 0) + '">' + pct(st.roi) + '</span>') + tile('Макс. просадка', money(st.maxDD)) + '</div>' +
      '<div class="cols">' + tbl('За видами спорту', A.group(bets, (b) => D.SPORTS[b.sport].name)) + tbl('За ринками', A.group(bets, mkOf)) + '</div>' +
      tbl('За коефіцієнтом', A.group(bets, (b) => A.oddsBand(b.odds))) +
      P.sec('Ви та AI: прибуток наростаючим підсумком', lineChart({ series: [{ name: 'Ви', values: u.map((p) => p.cum), color: S.profile.color }, { name: 'AI-аналітик', values: a.map((p) => p.cum), color: '#9aa3b2' }], zero: true, fmt: (v) => money(v), title: 'Ви та AI' }) + '<p class="fine">Лінії мають різну кількість ставок, тож їх варто порівнювати як тенденцію, а не точку в точку.</p>');
  }
  function settingsTab() {
    const Pr = M.PROFILES;
    const row = (t, d, c) => '<div class="set"><div><b>' + t + '</b>' + (d ? '<p>' + d + '</p>' : '') + '</div><div class="set-c">' + c + '</div></div>';
    return P.sec('Профіль', row('Ім’я', 'Показується на головній і в кабінеті.', '<div class="inl"><input class="inp" id="pf-name" value="' + esc(S.profile.name) + '" maxlength="40" aria-label="Ім’я"><button type="button" class="btn ghost" data-act="pf-name">Зберегти</button></div>') +
        row('Колір аватара', '', '<div class="swatches">' + COLORS.map((c) => '<button type="button" class="swatch' + (S.profile.color === c ? ' on' : '') + '" style="background:' + c + '" data-act="set" data-k="profile.color" data-v="' + c + '" aria-label="Колір ' + c + '"></button>').join('') + '</div>')) +
      P.sec('Баланс', row('Мій стартовий баланс', 'Від нього рахуються ваш баланс, ROI і просадка. Зараз: ' + money(A.bankroll('user')) + '.', '<div class="inl"><input class="inp sm" id="bank-user" inputmode="decimal" value="' + S.user.start + '" aria-label="Мій стартовий баланс"><button type="button" class="btn ghost" data-act="bank" data-w="user">Застосувати</button></div>') +
        row('Стартовий баланс AI', 'Віртуальні гроші. Щоб AI перерахував історію з новою сумою, натисніть «Перебудувати».', '<div class="inl"><input class="inp sm" id="bank-ai" inputmode="decimal" value="' + S.ai.start + '" aria-label="Стартовий баланс AI"><button type="button" class="btn ghost" data-act="bank" data-w="ai">Застосувати</button><button type="button" class="btn ghost" data-act="ai-rebuild">' + icon('refresh') + 'Перебудувати</button></div>') +
        row('Валюта', 'Лише відображення, без конвертації.', select('settings.currency', [['EUR', 'Євро (€)'], ['UAH', 'Гривня (₴)'], ['USD', 'Долар ($)'], ['PLN', 'Злотий (zł)']]))) +
      P.sec('Що показувати', row('Види спорту', 'Впливають на можливості, сповіщення і ставки AI.', '<div class="chips">' + Object.values(D.SPORTS).map((s) => { const on = S.settings.sports.includes(s.id); return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="sport-t" data-v="' + s.id + '" aria-pressed="' + on + '">' + sportIc(s.id) + s.name + '</button>'; }).join('') + '</div>')) +
      P.sec('AI-аналітик', '<div class="profiles">' + Object.keys(Pr).map((k) => '<button type="button" class="prof' + (S.settings.risk === k ? ' on' : '') + '" data-act="set" data-k="settings.risk" data-v="' + k + '"><b>' + Pr[k].name + '</b><span>Різниця від ' + Pr[k].minEdge + ' п.п., впевненість від ' + Pr[k].minConf + '</span><span>До ' + Math.round(Pr[k].cap * 100) + '% балансу на ставку, коефіцієнт до ' + num(Pr[k].maxOdds, 1) + '</span></button>').join('') + '</div>' + row('Автоматичний аналіз', 'AI переглядає матчі кожні 30 хвилин демо-часу.', sw('settings.autoAI', 'Увімкнено'))) +
      P.sec('Сповіщення', row('Важливі новини', 'Високий вплив або ваші обрані команди.', sw('settings.notif.news', 'Новини')) + row('Скоро початок', 'Матчі з вашими ставками та обраними командами.', sw('settings.notif.start', 'Старт')) + row('Ставки AI', '', sw('settings.notif.ai', 'Ставки AI')) + row('Результати ставок', '', sw('settings.notif.settle', 'Результати'))) +
      P.sec('Демо-час', '<p class="muted">Перемотайте час, щоб матчі почалися, завершилися, а ставки розрахувалися.</p>' + P.clockBtns()) +
      P.sec('Дані', row('Експорт', 'Усі ставки та налаштування одним файлом JSON.', '<button type="button" class="btn ghost" data-act="export">' + icon('download') + 'Завантажити</button>') + row('Скинути все', 'Видалити профіль, ставки й налаштування з цього браузера.', '<button type="button" class="btn danger" data-act="reset">' + icon('trash') + 'Скинути</button>') +
        '<p class="fine">Дані зберігаються лише у вашому браузері. Джерела: ' + Object.values(SIT.providers).map((p) => esc(p.name)).join(', ') + '.</p>');
  }
  on('pf-name', () => { const v = document.getElementById('pf-name').value.trim(); S.profile.name = v; toast('Ім’я збережено', 'ok'); rerender(); });
  on('bank', (el) => { const w = el.dataset.w; const v = parseFloat(document.getElementById('bank-' + w).value.replace(',', '.')); if (!(v >= 10) || v > 1e7) { toast('Вкажіть суму від 10'); return; } S[w].start = Math.round(v); toast('Стартовий баланс оновлено', 'ok'); rerender(); });
  on('ai-rebuild', () => { A.rebuildAI(); });
  on('sport-t', (el) => { const a = S.settings.sports; const i = a.indexOf(el.dataset.v); if (i >= 0) { if (a.length === 1) { toast('Потрібен хоча б один вид спорту'); return; } a.splice(i, 1); } else a.push(el.dataset.v); rerender(); });
  on('export', () => { const blob = new Blob([JSON.stringify(Object.assign({ exported: new Date().toISOString() }, S), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sit-' + U.ds(Date.now()) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400); });
  on('reset', () => openModal('Скинути все?', '<p>Профіль, ставки, обране й налаштування буде видалено з цього браузера. Застосунок почнеться з початку.</p>', '<button type="button" class="btn ghost" data-act="close">Скасувати</button><button type="button" class="btn danger" data-act="reset-ok">Скинути</button>'));
  on('reset-ok', () => { try { localStorage.removeItem(A.KEY); } catch (e) { /* */ } location.hash = '#/'; location.reload(); });

  V.me = function (params) {
    const tab = params[0] || S.ui.meTab || 'overview'; S.ui.meTab = tab;
    const st = A.stats(S.bets.user, S.user.start);
    const tabs = [['overview', 'Огляд'], ['bets', 'Мої ставки'], ['fav', 'Обране'], ['stats', 'Статистика'], ['settings', 'Налаштування']];
    const body = tab === 'bets' ? betsTab() : tab === 'fav' ? favTab() : tab === 'stats' ? statsTab() : tab === 'settings' ? settingsTab() : overview();
    return '<section class="profile"><span class="ava big" style="background:' + esc(S.profile.color) + '">' + esc(initials(S.profile.name)) + '</span>' +
      '<div class="pf"><h1>' + esc(S.profile.name || 'Гість') + '</h1><p>Особистий кабінет. У SIT з ' + new Date(S.profile.since).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) + '. Ставки паперові, баланс віртуальний.</p></div>' +
      '<div class="pf-bal"><span>Баланс</span><b>' + money(st.bank) + '</b><span class="' + plCls(st.pl) + '">' + money(st.pl, true) + ' від старту</span></div>' +
      '<button type="button" class="btn primary" data-act="bet-add">' + icon('plus') + 'Додати ставку</button></section>' +
      '<nav class="tabs" role="tablist">' + tabs.map(([k, t]) => '<a role="tab" aria-selected="' + (k === tab) + '" class="' + (k === tab ? 'on' : '') + '" href="#/me/' + k + '">' + t + (k === 'bets' && st.pending ? '<em>' + st.pending + '</em>' : '') + '</a>').join('') + '</nav>' + body;
  };

  /* ---------- знайомство ---------- */
  V._onboarding = function () {
    openModal('Ласкаво просимо до SIT', '<div class="form onb"><p>SIT допомагає аналізувати футбол, теніс і кіберспорт: показує форму, новини, коефіцієнти та оцінку моделі, а також веде ваш журнал ставок. Усе тут демонстраційне: матчі згенеровані, ставки паперові, гроші віртуальні.</p>' +
      '<label class="fld"><span>Як до вас звертатися?</span><input class="inp" id="ob-name" maxlength="40" placeholder="Ваше ім’я"></label>' +
      '<div class="f2"><label class="fld"><span>Стартовий баланс</span><input class="inp" id="ob-bank" inputmode="decimal" value="1000"></label><label class="fld"><span>Валюта</span><select class="inp" id="ob-cur"><option value="EUR">Євро (€)</option><option value="UAH">Гривня (₴)</option><option value="USD">Долар ($)</option><option value="PLN">Злотий (zł)</option></select></label></div>' +
      '<label class="check"><input type="checkbox" id="ob-ex" checked><span>Додати кілька прикладів ставок, щоб одразу побачити, як працює кабінет</span></label></div>',
      '<button type="button" class="btn primary" data-act="ob-go">Почати</button>');
  };
  on('ob-go', () => {
    const name = document.getElementById('ob-name').value.trim(); const bank = parseFloat(document.getElementById('ob-bank').value.replace(',', '.'));
    S.profile.name = name; S.user.start = bank >= 10 ? Math.round(bank) : 1000; S.settings.currency = document.getElementById('ob-cur').value;
    const ex = document.getElementById('ob-ex').checked; closeModal(true); A.finishOnboarding(ex);
  });

  A.start();
})();
