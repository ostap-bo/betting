/* =====================================================================
   SIT - app.js
   Показує матчі дня з matches.js і аналітику AI по кожному.
   ===================================================================== */
(function () {
  'use strict';
  const DATA = window.SIT_DATA;
  const VERD = { consider: 'Варто розглянути', neutral: 'Нейтрально', avoid: 'Краще оминути' };
  let filter = 'all';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => Number(v).toFixed(2).replace('.', ',');
  const pct = (p) => Math.round(p * 100) + '%';
  const vb = (v) => '<span class="vb v-' + v + '">' + VERD[v] + '</span>';
  const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dateLabel = () => new Date(DATA.date + 'T12:00:00').toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  // ймовірності з коефіцієнтів (без маржі букмекера)
  function probs(o) {
    if (!o) return null;
    const ks = ['home', 'draw', 'away'].filter((k) => o[k]);
    const inv = ks.map((k) => 1 / o[k]); const s = inv.reduce((a, b) => a + b, 0);
    const out = {}; ks.forEach((k, i) => (out[k] = ks.length === 3 ? inv[i] / s : inv[i]));
    out.margin = ks.length === 3 ? s - 1 : null;
    return out;
  }

  function header(active) {
    return '<header class="top"><div class="top-in"><a class="logo" href="#/"><span class="logo-m" aria-hidden="true"><i></i><i></i><i></i></span><span class="logo-t">SIT<small>футбольна аналітика</small></span></a>' +
      '<nav class="nav"><a href="#/" class="' + (active === 'home' ? 'on' : '') + '">Матчі дня</a><a href="#/about" class="' + (active === 'about' ? 'on' : '') + '">Як це працює</a></nav></div></header>';
  }
  const footer = '<footer class="foot"><div class="wrap-f">Аналітика зібрана AI з відкритих джерел і може містити помилки. Це не порада робити ставки і не гарантія результату.</div></footer>';

  /* ---------- список матчів ---------- */
  function card(m) {
    const p = probs(m.odds);
    const oddsRow = m.odds ? '<div class="odds">' + [['home', 'П1'], ['draw', 'Х'], ['away', 'П2']].map(([k, l]) => '<span><small>' + l + '</small><b>' + (m.odds[k] ? num(m.odds[k]) : '-') + '</b>' + (p && p[k] ? '<em>' + pct(p[k]) + '</em>' : '') + '</span>').join('') + '</div>' : '<div class="odds none">Коефіцієнтів у відкритих джерелах немає</div>';
    return '<a class="card c-' + m.verdict + '" href="#/m/' + m.id + '">' +
      '<div class="card-top"><b class="time">' + esc(m.time) + '</b><span>' + esc(m.comp) + '</span>' + vb(m.verdict) + '</div>' +
      '<div class="teams"><span>' + esc(m.home) + '</span><span class="vs">проти</span><span>' + esc(m.away) + '</span></div>' +
      '<p class="head">' + esc(m.headline) + '</p>' + oddsRow + '</a>';
  }
  function home() {
    const stale = DATA.date !== todayStr();
    const cnt = (v) => DATA.matches.filter((m) => m.verdict === v).length;
    const order = { consider: 0, neutral: 1, avoid: 2 };
    const list = DATA.matches.filter((m) => filter === 'all' || m.verdict === filter).slice().sort((a, b) => a.time.localeCompare(b.time) || order[a.verdict] - order[b.verdict]);
    return (stale ? '<div class="note warn">Це матчі на ' + esc(dateLabel()) + '. Щоб побачити сьогоднішні, попросіть Claude оновити файл matches.js.</div>' : '') +
      '<section class="hero"><p class="kicker">' + esc(dateLabel()) + '</p><h1>Матчі на вечір</h1><p>' + esc(DATA.title) + '. ' + esc(DATA.note) + '</p></section>' +
      '<div class="sum"><div class="s-c"><b>' + cnt('consider') + '</b><span>варто розглянути</span></div><div class="s-n"><b>' + cnt('neutral') + '</b><span>нейтрально</span></div><div class="s-a"><b>' + cnt('avoid') + '</b><span>краще оминути</span></div></div>' +
      '<div class="chips">' + [['all', 'Усі', DATA.matches.length], ['consider', 'Варто розглянути', cnt('consider')], ['neutral', 'Нейтрально', cnt('neutral')], ['avoid', 'Краще оминути', cnt('avoid')]].map(([v, l, n]) => '<button type="button" class="chip' + (filter === v ? ' on' : '') + '" data-f="' + v + '">' + l + '<em>' + n + '</em></button>').join('') + '</div>' +
      (list.length ? '<div class="cards">' + list.map(card).join('') + '</div>' : '<p class="muted">Немає матчів із такою оцінкою.</p>') +
      '<p class="fine">Дані оновлено: ' + esc(DATA.updated) + '. Час указано за Варшавою.</p>';
  }

  /* ---------- сторінка матчу ---------- */
  function match(id) {
    const m = DATA.matches.find((x) => x.id === id);
    if (!m) return '<p>Матч не знайдено. <a class="lnk" href="#/">До списку</a></p>';
    const p = probs(m.odds); const ai = m.ai; const g = DATA.groups[m.group];
    const oddsBlock = m.odds ? '<div class="bars">' + [['home', m.home], ['draw', 'Нічия'], ['away', m.away]].filter(([k]) => m.odds[k]).map(([k, l]) => '<div class="bar-r"><span>' + esc(l) + '</span><span class="bar-t"><i style="width:' + Math.round(p[k] * 100) + '%"></i></span><b>' + pct(p[k]) + '</b><em>' + num(m.odds[k]) + '</em></div>').join('') + '</div>' +
      '<p class="fine">' + esc(m.odds.source) + (m.odds.approx ? '. Значення приблизні.' : '') + (p.margin != null ? '. Ймовірності очищені від маржі букмекера (' + Math.round(p.margin * 100) + '%).' : '') + '</p>' +
      (m.odds.open ? '<div class="move"><b>Рух коефіцієнтів.</b> Було: ' + [['home', 'П1'], ['draw', 'Х'], ['away', 'П2']].map(([k, l]) => l + ' ' + num(m.odds.open[k])).join(', ') + ' (' + esc(m.odds.open.source) + '). Стало: ' + [['home', 'П1'], ['draw', 'Х'], ['away', 'П2']].map(([k, l]) => l + ' ' + num(m.odds[k])).join(', ') + '.</div>' : '')
      : '<p class="muted">Актуальних коефіцієнтів у відкритих джерелах не знайдено.</p>';
    const formCol = (team, rows) => '<div><h4>' + esc(team) + '</h4><ul class="form">' + rows.map((r) => '<li><i class="r r-' + ({ 'В': 'w', 'Н': 'd', 'П': 'l' }[r[2]]) + '">' + r[2] + '</i><span>' + esc(r[0]) + ', ' + esc(r[3]) + '</span><b>' + esc(r[1]) + '</b></li>').join('') + '</ul></div>';
    const table = g ? '<table class="tbl"><thead><tr><th>' + esc(g.name) + '</th><th>І</th><th>В</th><th>Н</th><th>П</th><th>М</th><th>О</th></tr></thead><tbody>' + g.rows.map((r) => '<tr class="' + (r[0] === m.home || r[0] === m.away ? 'hl' : '') + '"><td>' + esc(r[0]) + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td><td>' + r[5] + ':' + r[6] + '</td><td><b>' + r[7] + '</b></td></tr>').join('') + '</tbody></table>' : '';
    const list = (arr) => '<ul class="plain">' + arr.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    return '<a class="back" href="#/">‹ Усі матчі</a>' +
      '<section class="mhead"><p class="kicker">' + esc(m.comp) + ', ' + esc(m.venue) + '</p>' +
      '<div class="mteams"><div><span class="crest">' + esc(initials(m.home)) + '</span><b>' + esc(m.home) + '</b></div><div class="mtime">' + esc(m.time) + '<small>' + esc(dateLabel()) + '</small></div><div class="r"><span class="crest">' + esc(initials(m.away)) + '</span><b>' + esc(m.away) + '</b></div></div></section>' +
      '<section class="verdict v-box-' + m.verdict + '"><div class="v-top">' + vb(m.verdict) + '<h2>Що думає AI</h2></div><p class="lead">' + esc(ai.summary) + '</p>' +
      '<div class="two">' +
      '<div class="col-c"><h3>Можна розглянути</h3>' + (ai.consider.length ? ai.consider.map((x) => '<div class="opt"><b>' + esc(x.market) + '</b><span class="conf">Впевненість: ' + esc(x.conf).toLowerCase() + '</span><p>' + esc(x.why) + '</p></div>').join('') : '<p class="muted">Нічого. У цьому матчі AI не бачить варіантів із перевагою.</p>') + '</div>' +
      '<div class="col-a"><h3>Краще оминути</h3>' + ai.avoid.map((x) => '<div class="opt"><b>' + esc(x.market) + '</b><p>' + esc(x.why) + '</p></div>').join('') + '</div></div></section>' +
      '<div class="grid">' +
      '<section class="sec"><h2>Шанси за букмекерами</h2>' + oddsBlock + '</section>' +
      '<section class="sec"><h2>Турнірна таблиця</h2>' + table + '</section>' +
      '<section class="sec"><h2>Форма в турнірі</h2><div class="two">' + formCol(m.home, m.form.home) + formCol(m.away, m.form.away) + '</div></section>' +
      '<section class="sec"><h2>Склади і новини</h2><div class="two"><div><h4>' + esc(m.home) + '</h4>' + list(m.news.home) + '</div><div><h4>' + esc(m.away) + '</h4>' + list(m.news.away) + '</div></div><p class="fine">Офіційні склади оголошують приблизно за годину до початку.</p></section>' +
      '<section class="sec"><h2>Ключові факти</h2>' + list(m.stats) + '</section>' +
      '<section class="sec"><h2>Аргументи</h2><div class="two"><div class="pc pro"><h4>За фаворита</h4>' + (ai.pros.length ? list(ai.pros) : '<p class="muted">Немає даних.</p>') + '</div><div class="pc con"><h4>Ризики</h4>' + list(ai.cons) + '</div></div></section>' +
      '</div>' +
      '<section class="sec src"><h2>Джерела</h2><ul class="plain">' + m.sources.map(([n, u]) => '<li><a class="lnk" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(n) + '</a></li>').join('') + '</ul></section>';
  }

  /* ---------- як це працює ---------- */
  function about() {
    return '<section class="hero"><h1>Як це працює</h1></section><div class="prose">' +
      '<h2>Звідки дані</h2><p>AI (Claude) збирає матчі дня, результати, турнірні таблиці, новини про склади й коефіцієнти з відкритих джерел: сайту УЄФА, превʼю спортивних видань і сайтів зі статистикою. Усе це записується у файл matches.js, і платформа його показує.</p>' +
      '<h2>Що означають оцінки</h2><p><b>Варто розглянути.</b> Дані досить узгоджені, і є варіант, який з ними добре сходиться. Це не гарантія.</p><p><b>Нейтрально.</b> Ціна букмекерів чесна, переваги немає.</p><p><b>Краще оминути.</b> Дані суперечливі, ринок нестабільний або даних замало.</p>' +
      '<h2>Шанси за букмекерами</h2><p>Коефіцієнт перераховується у ймовірність. Букмекер закладає маржу, тому суми ймовірностей більші за 100%; платформа її прибирає, щоб показати чисту оцінку ринку.</p>' +
      '<h2>Як оновити матчі</h2><p>Напишіть Claude: «онови матчі на сьогодні». Він збере дані й дасть новий файл matches.js. Замініть ним старий у репозиторії GitHub, і за хвилину сайт оновиться.</p>' +
      '<h2>Важливо</h2><p>Букмекери зазвичай оцінюють матчі точно, тому найчастіше правильне рішення це не ставити. Якщо ставите, то фіксованою невеликою сумою, без спроб відігратися після програшу і без експресів.</p></div>';
  }

  function render(keep) {
    const h = location.hash.replace(/^#\/?/, ''); const [name, id] = h.split('/');
    const body = name === 'm' ? match(id) : name === 'about' ? about() : home();
    document.getElementById('app').innerHTML = header(name === 'about' ? 'about' : name === 'm' ? '' : 'home') + '<main class="wrap">' + body + '</main>' + footer;
    if (keep !== true) window.scrollTo(0, 0);
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(true); } });
  window.addEventListener('hashchange', () => render());
  render();
})();
