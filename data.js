/* =====================================================================
   SIT - data.js
   Демо-дані: каталог турнірів, генерація матчів, результатів,
   live-стану, коефіцієнтів і новин. Усе детерміноване (seeded RNG),
   тому однакове при кожному відкритті.
   Реальні API підключаються через SIT.providers (див. внизу).
   ===================================================================== */
(function () {
  'use strict';
  const SIT = (window.SIT = window.SIT || {});

  /* ---------------- утиліти ---------------- */
  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) {
    let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
    return function () { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const U = {
    hash, rng,
    pick: (r, a) => a[Math.floor(r() * a.length)],
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    shuffle: (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    normal: (r) => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); },
    poisson: (r, l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 20); return k - 1; },
    ds: (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    dayStart: (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d).getTime(); },
    addDays: (ds, n) => { const [y, m, d] = ds.split('-').map(Number); return U.ds(new Date(y, m - 1, d + n, 12).getTime()); },
    round2: (v) => Math.round(v * 100) / 100,
    weighted: (r, ws) => { const s = ws.reduce((a, b) => a + b, 0); let x = r() * s; for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; } return ws.length - 1; }
  };
  SIT.U = U;
  SIT.clock = { offset: 0, now() { return Date.now() + this.offset; } };
  const H = 3600e3, MIN = 60e3;

  /* ---------------- каталог ---------------- */
  const SPORTS = {
    football: { id: 'football', name: 'Футбол' },
    tennis: { id: 'tennis', name: 'Теніс' },
    esports: { id: 'esports', name: 'Кіберспорт' }
  };
  const T = (s) => s.split(',').map((x) => { const i = x.lastIndexOf(':'); return { n: x.slice(0, i).trim(), r: +x.slice(i + 1) }; });
  const TOURS = [
    { id: 'epl', sport: 'football', name: 'Прем’єр-ліга', region: 'Англія', per: 3, hours: [14, 16.5, 19, 21], teams: T('Арсенал:91,Манчестер Сіті:92,Ліверпуль:93,Челсі:86,Тоттенгем:83,Ньюкасл:84,Астон Вілла:84,Манчестер Юнайтед:81,Брайтон:80,Вест Гем:77') },
    { id: 'laliga', sport: 'football', name: 'Ла Ліга', region: 'Іспанія', per: 2, hours: [18, 20.5, 22], teams: T('Реал Мадрид:93,Барселона:92,Атлетіко:87,Атлетік:83,Реал Сосьєдад:80,Вільярреал:82,Бетіс:80,Севілья:77') },
    { id: 'seriea', sport: 'football', name: 'Серія A', region: 'Італія', per: 2, hours: [15, 18, 20.75], teams: T('Інтер:91,Наполі:88,Ювентус:86,Мілан:85,Аталанта:86,Рома:82,Лаціо:81,Фіорентина:80') },
    { id: 'bundes', sport: 'football', name: 'Бундесліга', region: 'Німеччина', per: 2, hours: [15.5, 18.5, 20.5], teams: T('Баварія:93,Баєр:88,Боруссія Д:86,РБ Лейпциг:85,Штутгарт:83,Айнтрахт:82,Фрайбург:79,Вольфсбург:77') },
    { id: 'upl', sport: 'football', name: 'УПЛ', region: 'Україна', per: 2, hours: [13, 15.5, 18], teams: T('Шахтар:82,Динамо Київ:81,Полісся:74,Кривбас:73,Олександрія:72,Зоря:71,ЛНЗ:70,Карпати:70,Рух:69,Оболонь:67') },
    { id: 'atp', sport: 'tennis', name: 'ATP 500', region: 'Демо-турнір', per: 4, hours: [10, 11.5, 13, 14.5, 16, 17.5, 19], teams: T('Андрій Коваленко:88,Матео Рінальді:86,Лукас Брандт:85,Юго Лемер:84,Кендзі Арата:82,Томаш Груска:81,Дієго Ферас:83,Олівер Грант:80,Микола Петров:84,Рафаель Ортега:79,Джон Келлі:81,Ігор Сидоренко:80') },
    { id: 'wta', sport: 'tennis', name: 'WTA 1000', region: 'Демо-турнір', per: 3, hours: [11, 12.5, 14, 15.5, 18], teams: T('Олена Мороз:87,Софія Рейес:85,Хана Сато:83,Клара Дюбуа:84,Майя Ковальська:82,Лена Гартманн:81,Айріс ван Дейк:80,Ана Петрич:79,Юлія Бондар:82,Хлоя Мартен:78') },
    { id: 'cs2', sport: 'esports', game: 'CS2', name: 'CS2', region: 'Демо-ліга', per: 3, hours: [13, 15.5, 18, 20.5, 22], teams: T('NAVI:90,Vitality:91,MOUZ:87,FaZe:86,Spirit:88,G2:86,The MongolZ:85,Falcons:84,Aurora:82,Virtus.pro:81') },
    { id: 'dota', sport: 'esports', game: 'Dota 2', name: 'Dota 2', region: 'Демо-ліга', per: 2, hours: [12, 15, 18, 21], teams: T('Team Spirit:88,Tundra:87,Gaimin Gladiators:87,Team Liquid:88,BetBoom:85,Team Falcons:89,Xtreme Gaming:84,PARIVISION:83') },
    { id: 'lol', sport: 'esports', game: 'LoL', name: 'League of Legends', region: 'Демо-ліга', per: 2, hours: [11, 14, 17, 19.5], teams: T('T1:92,Gen.G:93,Hanwha Life:89,G2 Esports:87,Fnatic:84,BLG:90,Top Esports:87,Karmine Corp:82') },
    { id: 'val', sport: 'esports', game: 'Valorant', name: 'Valorant', region: 'Демо-ліга', per: 2, hours: [16, 18.5, 21, 23], teams: T('Fnatic:88,Sentinels:86,Team Heretics:87,EDward Gaming:86,Paper Rex:85,G2:86,Team Liquid:83,DRX:84') }
  ];
  const TOUR = {}; TOURS.forEach((t) => (TOUR[t.id] = t));

  const FIRST = ['Марко', 'Лукас', 'Даніель', 'Томас', 'Андреас', 'Матеус', 'Ніколас', 'Йонас', 'Оскар', 'Ілля', 'Максим', 'Артем', 'Кайл', 'Енцо', 'Тео', 'Віктор', 'Емре', 'Сандро', 'Пабло', 'Нуну'];
  const LAST = ['Менса', 'Варга', 'Окафор', 'Ліндквіст', 'Моро', 'Олівейра', 'Ковач', 'Новак', 'Дуарте', 'Феррейра', 'Накамура', 'Шульц', 'Петренко', 'Ромеро', 'Карвальо', 'Лоран', 'Баккер', 'Єнсен', 'Россі', 'Конті', 'Марино', 'Гарсія', 'Сілва', 'Мюллер'];
  const ROLES = [['нападник', 24], ['нападник', 12], ['вінгер', 16], ['вінгер', 11], ['атакувальний півзахисник', 14], ['центральний півзахисник', 7], ['опорний півзахисник', 4], ['центральний захисник', 3], ['крайній захисник', 4], ['воротар', 1]];
  const INJ = ['пошкодження задньої поверхні стегна', 'розтягнення гомілкостопа', 'травма коліна', 'проблема з литковим м’язом', 'м’язова втома', 'хвороба', 'травма плеча'];
  const NICKS = ['s1lent', 'kRaze', 'Vexo', 'm0rph', 'Zayn', 'Kuro', 'Lynx', 'Tempo', 'Rhyme', 'Nova', 'Blitz', 'Echo', 'Frost', 'Pulse', 'Raven', 'Sly', 'Torque', 'Wisp', 'Yuki', 'Zest'];
  const MAPS = { CS2: ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2', 'Train'], Valorant: ['Ascent', 'Bind', 'Haven', 'Lotus', 'Sunset', 'Icebox', 'Split'] };
  const player = (seed, i) => { const r = rng(seed + '#' + i); return U.pick(r, FIRST) + ' ' + U.pick(r, LAST); };
  const roster = (team) => { const r = rng('roster|' + team); return U.shuffle(r, NICKS).slice(0, 5); };

  /* ---------------- ймовірності ---------------- */
  const FACT = [1]; for (let i = 1; i < 16; i++) FACT[i] = FACT[i - 1] * i;
  function fbProbs(lh, la) {
    let h = 0, d = 0, a = 0, over = 0;
    for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) {
      const p = Math.exp(-lh) * Math.pow(lh, i) / FACT[i] * Math.exp(-la) * Math.pow(la, j) / FACT[j];
      if (i > j) h += p; else if (i === j) d += p; else a += p;
      if (i + j > 2) over += p;
    }
    const s = h + d + a;
    return { '1X2': [h / s, d / s, a / s], OU: [over, 1 - over], BTTS: [(1 - Math.exp(-lh)) * (1 - Math.exp(-la)), 1 - (1 - Math.exp(-lh)) * (1 - Math.exp(-la))] };
  }
  function simTennisSet(r, ps) {
    const homeWins = r() < ps; const c = 1 - Math.abs(ps - 0.5) * 2;
    const w = [1, 2, 4, 6, 7, 5, 4].map((x, k) => x * (k >= 3 ? 0.5 + c : 1.5 - c));
    const lg = U.weighted(r, w);
    const g = lg === 5 ? [7, 5] : lg === 6 ? [7, 6] : [6, lg];
    return homeWins ? g : [g[1], g[0]];
  }
  function simTennis(r, ps) {
    const sets = []; let a = 0, b = 0;
    while (a < 2 && b < 2) { const s = simTennisSet(r, ps); sets.push(s); if (s[0] > s[1]) a++; else b++; }
    return { sets, h: a, a: b, games: sets.reduce((x, s) => x + s[0] + s[1], 0) };
  }
  function tennisProbs(seed, ps, line) {
    const r = rng(seed); let hw = 0; const gs = [];
    for (let i = 0; i < 400; i++) { const s = simTennis(r, ps); if (s.h > s.a) hw++; gs.push(s.games); }
    gs.sort((x, y) => x - y);
    if (line == null) line = Math.floor(gs[200]) + 0.5;
    const over = gs.filter((g) => g > line).length / gs.length;
    return { probs: { ML: [hw / 400, 1 - hw / 400], OU: [over, 1 - over] }, line };
  }
  const bo3 = (pm) => ({ ML: [pm * pm * (3 - 2 * pm), 1 - pm * pm * (3 - 2 * pm)], OU: [2 * pm * (1 - pm), 1 - 2 * pm * (1 - pm)] });

  function prices(probs, r, noise, margin) {
    let q = probs.map((p) => Math.max(0.03, p * Math.exp(U.normal(r) * noise)));
    const s = q.reduce((a, b) => a + b, 0); q = q.map((x) => x / s);
    return q.map((x) => Math.max(1.03, U.round2(1 / (x * (1 + margin)))));
  }

  /* ---------------- форма, очні ---------------- */
  function formFor(r, tour, team, n, sport) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const opp = U.pick(r, tour.teams.filter((t) => t.n !== team.n));
      const home = r() < 0.5; const d = team.r - opp.r + (sport === 'football' ? (home ? 3 : -3) : 0);
      let f, a;
      if (sport === 'football') { f = U.poisson(r, 1.35 * Math.exp(0.045 * d)); a = U.poisson(r, 1.2 * Math.exp(-0.045 * d)); }
      else { const p = 1 / (1 + Math.exp(-d * 0.09)); const won = r() < p; const l = r() < 0.45 ? 1 : 0; f = won ? 2 : l; a = won ? l : 2; }
      out.push({ opp: opp.n, home, f, a, res: f > a ? 'В' : f === a ? 'Н' : 'П', daysAgo: (i + 1) * (sport === 'football' ? 7 : 3) + Math.floor(r() * 3) });
    }
    if (sport === 'tennis') out.forEach((g) => { g.games = 14 + Math.floor(r() * 16) + (g.f + g.a === 3 ? 8 : 0); });
    return out;
  }
  function h2hFor(r, hT, aT, sport) {
    const n = Math.floor(r() * 6); const out = [];
    for (let i = 0; i < n; i++) {
      const d = hT.r - aT.r; let hs, as;
      if (sport === 'football') { const swap = r() < 0.5; hs = U.poisson(r, 1.35 * Math.exp(0.045 * d)); as = U.poisson(r, 1.2 * Math.exp(-0.045 * d)); if (swap) out.push({ y: 2025 - i, hs, as, venue: 'away' }); else out.push({ y: 2025 - i, hs, as, venue: 'home' }); }
      else { const p = 1 / (1 + Math.exp(-d * 0.09)); const w = r() < p; const l = r() < 0.4 ? 1 : 0; hs = w ? 2 : l; as = w ? l : 2; out.push({ y: 2025 - i, hs, as }); }
    }
    return out;
  }

  /* ---------------- матчі ---------------- */
  const cache = new Map(); const dayCache = new Map();
  function matchesForDate(ds) {
    if (dayCache.has(ds)) return dayCache.get(ds);
    const list = [];
    TOURS.forEach((t) => {
      const r = rng(t.id + '|' + ds);
      const pool = U.shuffle(r, t.teams);
      let n = t.per + (r() < 0.35 ? 1 : 0) - (r() < 0.25 ? 1 : 0); n = U.clamp(n, 1, Math.min(t.hours.length, Math.floor(pool.length / 2)));
      const hours = U.shuffle(r, t.hours).slice(0, n).sort((a, b) => a - b);
      for (let i = 0; i < n; i++) list.push(build(t, ds, i, pool[2 * i], pool[2 * i + 1], U.dayStart(ds) + hours[i] * H));
    });
    list.sort((a, b) => a.start - b.start);
    dayCache.set(ds, list);
    return list;
  }
  function match(id) {
    if (cache.has(id)) return cache.get(id);
    const ds = id.split('~')[1]; if (!ds) return null;
    matchesForDate(ds); return cache.get(id) || null;
  }
  function matchesInRange(fromDs, days) { let out = []; for (let i = 0; i < days; i++) out = out.concat(matchesForDate(U.addDays(fromDs, i))); return out; }

  function build(t, ds, i, hT, aT, start) {
    const id = t.id + '~' + ds + '~' + i;
    const r = rng(id);
    const m = { id, tour: t.id, tourName: t.name, region: t.region, game: t.game || null, sport: t.sport, home: hT.n, away: aT.n, start, news: [] };
    m.ctx = { formH: formFor(r, t, hT, t.sport === 'football' ? 5 : 8, t.sport), formA: formFor(r, t, aT, t.sport === 'football' ? 5 : 8, t.sport), h2h: h2hFor(r, hT, aT, t.sport) };
    if (t.sport === 'football') buildFootball(m, r, hT, aT);
    else if (t.sport === 'tennis') buildTennis(m, r, hT, aT);
    else buildEsports(m, r, hT, aT, t);
    // історія коефіцієнтів
    const newsT = m.news.length ? Math.min(...m.news.map((n) => n.time)) : start - 30 * H;
    m.markets.forEach((mk) => mk.sels.forEach((s) => {
      const rr = rng(id + mk.key + s.key);
      s.hist = [];
      for (let k = 0; k <= 12; k++) {
        const tt = start - 72 * H + k * 6 * H;
        const w = 1 / (1 + Math.exp(-(tt - newsT) / (4 * H)));
        let o = s.open + (s.close - s.open) * w + (k > 0 && k < 12 ? U.normal(rr) * 0.012 * s.open : 0);
        if (k === 0) o = s.open; if (k === 12) o = s.close;
        s.hist.push({ t: tt, o: Math.max(1.02, U.round2(o)) });
      }
    }));
    cache.set(id, m);
    return m;
  }

  function mkMarkets(defs, probsOpen, probsCur, r, margin) {
    return defs.map((d) => {
      const o = prices(probsOpen[d.key], r, 0.085, margin), c = prices(probsCur[d.key], r, 0.055, margin);
      return { key: d.key, name: d.name, line: d.line, sels: d.sels.map((s, i) => ({ key: s[0], label: s[1], open: o[i], close: c[i] })) };
    });
  }

  function buildFootball(m, r, hT, aT) {
    const inj = { home: [], away: [] };
    ['home', 'away'].forEach((side) => {
      const team = side === 'home' ? m.home : m.away;
      const n = U.weighted(r, [50, 28, 15, 7]);
      const roles = U.shuffle(r, ROLES).slice(0, n);
      roles.forEach((ro, k) => {
        const out = r() < 0.68;
        inj[side].push({ name: player(m.id + side, k), role: ro[0], contrib: Math.round(ro[1] * (0.7 + r() * 0.6)), status: out ? 'out' : 'doubt', reason: U.pick(r, INJ), reported: m.start - (4 + r() * 70) * H, back: out ? Math.round(5 + r() * 25) : null });
      });
      inj[side].team = team;
    });
    const lost = (side) => inj[side].reduce((s, p) => s + (p.status === 'out' ? p.contrib : p.contrib * 0.4), 0);
    const rot = r() < 0.1 ? (r() < 0.5 ? 'home' : 'away') : null;
    const weather = r() < 0.07;
    const restH = 2 + Math.floor(r() * 6), restA = 2 + Math.floor(r() * 6);
    const dR = hT.r - aT.r + 3;
    const lam = (eff) => {
      let lh = 1.38 * Math.exp(0.045 * dR), la = 1.12 * Math.exp(-0.045 * dR);
      lh *= 1 - eff * lost('home') * 0.005; la *= 1 - eff * lost('away') * 0.005;
      if (rot === 'home') lh *= 1 - eff * 0.08; if (rot === 'away') la *= 1 - eff * 0.08;
      if (weather) { lh *= 1 - eff * 0.12; la *= 1 - eff * 0.12; }
      lh *= 1 + (restH - restA) * 0.01 * eff; return [lh, la];
    };
    const truth = lam(1);
    m.truth = fbProbs(truth[0], truth[1]);
    m.markets = mkMarkets([
      { key: '1X2', name: 'Результат матчу', sels: [['home', m.home], ['draw', 'Нічия'], ['away', m.away]] },
      { key: 'OU', name: 'Тотал голів 2.5', line: 2.5, sels: [['over', 'Більше 2.5'], ['under', 'Менше 2.5']] },
      { key: 'BTTS', name: 'Обидві заб’ють', sels: [['yes', 'Так'], ['no', 'Ні']] }
    ], fbProbs(...lam(0)), fbProbs(...lam(0.5)), r, 0.055);
    // результат
    const gh = U.poisson(r, truth[0]), ga = U.poisson(r, truth[1]);
    const events = [];
    for (let i = 0; i < gh; i++) events.push({ min: 1 + Math.floor(r() * 90), side: 'home', type: 'Гол' });
    for (let i = 0; i < ga; i++) events.push({ min: 1 + Math.floor(r() * 90), side: 'away', type: 'Гол' });
    const cards = U.poisson(r, 3.2); for (let i = 0; i < cards; i++) events.push({ min: 5 + Math.floor(r() * 85), side: r() < 0.5 ? 'home' : 'away', type: 'Жовта картка' });
    events.sort((a, b) => a.min - b.min);
    const shH = Math.max(gh + 2, Math.round(truth[0] * 6 + U.normal(r) * 2 + 3)), shA = Math.max(ga + 2, Math.round(truth[1] * 6 + U.normal(r) * 2 + 3));
    const poss = Math.round(U.clamp(50 + dR * 0.7 + U.normal(r) * 4, 28, 72));
    const base = (truth[0] - truth[1]) / (truth[0] + truth[1]) * 0.45;
    const mom = []; for (let k = 0; k < 18; k++) { let v = base + U.normal(r) * 0.3; events.forEach((e) => { if (e.type === 'Гол' && Math.floor((e.min - 1) / 5) === k) v += e.side === 'home' ? 0.55 : -0.55; }); mom.push(U.round2(U.clamp(v, -1, 1))); }
    m.result = { h: gh, a: ga, events, stats: { shots: [shH, shA], sot: [Math.min(shH, gh + Math.round(shH * 0.25)), Math.min(shA, ga + Math.round(shA * 0.25))], poss: [poss, 100 - poss], corners: [U.poisson(r, 2 + truth[0] * 2), U.poisson(r, 2 + truth[1] * 2)], cards: [events.filter((e) => e.type === 'Жовта картка' && e.side === 'home').length, events.filter((e) => e.type === 'Жовта картка' && e.side === 'away').length] }, mom };
    m.dur = 110;
    m.ctx.inj = inj; m.ctx.restH = restH; m.ctx.restA = restA; m.ctx.rot = rot; m.ctx.weather = weather;
    m.ctx.lineups = r() < 0.6 ? { home: Array.from({ length: 11 }, (_, k) => player(m.id + 'Lh', k + 10)), away: Array.from({ length: 11 }, (_, k) => player(m.id + 'La', k + 10)) } : null;
    // новини
    ['home', 'away'].forEach((side) => {
      const team = side === 'home' ? m.home : m.away, opp = side === 'home' ? m.away : m.home;
      inj[side].forEach((p) => {
        if (p.contrib < 6) return;
        if (p.status === 'out') m.news.push({ kind: 'injury', side, time: p.reported, impact: p.contrib >= 15 ? 'high' : 'medium', team, source: 'Офіційна заява клубу',
          title: team + ': ' + p.name + ' пропустить матч з ' + opp,
          fact: 'Клуб підтвердив, що ' + p.role + ' ' + p.name + ' не зіграє через травму (' + p.reason + '). Очікуване повернення приблизно через ' + p.back + ' дн.',
          why: 'Можливий вплив: ' + p.name + ' причетний до ' + p.contrib + '% голів і гольових передач команди (демо-статистика). Без нього ' + team + ' можуть створювати менше моментів.' });
        else m.news.push({ kind: 'doubt', side, time: p.reported, impact: 'medium', team, source: 'Передматчева пресконференція',
          title: p.name + ' під питанням перед матчем ' + m.home + ' проти ' + m.away,
          fact: 'Тренер сказав, що стан гравця (' + p.reason + ') оцінять у день гри. Остаточного рішення поки немає.',
          why: 'Можливий вплив: невизначеність зі складом. Якщо ' + p.name + ' не вийде, ' + team + ' втратять гравця з часткою внеску ' + p.contrib + '%. Модель рахує це як ризик, а не як підтверджену відсутність.' });
      });
    });
    if (rot) { const team = rot === 'home' ? m.home : m.away; m.news.push({ kind: 'rotation', side: rot, time: m.start - (20 + r() * 20) * H, impact: 'medium', team, source: 'Передматчева пресконференція', title: team + ': тренер натякнув на ротацію', fact: 'Через щільний графік тренер сказав, що планує «деякі зміни» в стартовому складі.', why: 'Можливий вплив: слабший стартовий склад і менша визначеність щодо нього. Модель трохи знижує оцінку ' + team + '.' }); }
    if (weather) m.news.push({ kind: 'weather', side: null, time: m.start - (10 + r() * 14) * H, impact: 'low', team: m.home, source: 'Метеослужба (демо)', title: 'Сильний дощ і вітер на матчі ' + m.home + ' проти ' + m.away, fact: 'Прогноз на час гри: тривалий дощ, пориви вітру до 50 км/год.', why: 'Можливий вплив: погана погода може трохи знизити кількість голів. У демо-моделі ефект невеликий.' });
  }

  function buildTennis(m, r, hT, aT) {
    const lastH = 70 + Math.floor(r() * 130), lastA = 70 + Math.floor(r() * 130);
    const restH = Math.floor(r() * 3), restA = Math.floor(r() * 3);
    const fat = (mins, rest) => (mins > 150 && rest <= 1 ? -4 : 0);
    const dR = hT.r - aT.r;
    const ps = (eff) => 1 / (1 + Math.exp(-(dR + eff * (fat(lastH, restH) - fat(lastA, restA))) * 0.085));
    const tr = tennisProbs(m.id + 'mc1', ps(1));
    const line = tr.line;
    m.truth = tr.probs;
    m.markets = mkMarkets([
      { key: 'ML', name: 'Переможець матчу', sels: [['home', m.home], ['away', m.away]] },
      { key: 'OU', name: 'Тотал геймів ' + String(line).replace('.', ','), line, sels: [['over', 'Більше ' + String(line).replace('.', ',')], ['under', 'Менше ' + String(line).replace('.', ',')]] }
    ], tennisProbs(m.id + 'mc0', ps(0), line).probs, tennisProbs(m.id + 'mc2', ps(0.5), line).probs, r, 0.05);
    const res = simTennis(r, ps(1));
    // послідовність геймів
    const seq = [];
    res.sets.forEach((s, si) => {
      const winner = s[0] > s[1] ? 'home' : 'away'; const tot = s[0] + s[1];
      let games = U.shuffle(r, Array(s[0]).fill('home').concat(Array(s[1]).fill('away')));
      const li = games.lastIndexOf(winner); [games[li], games[tot - 1]] = [games[tot - 1], games[li]];
      games.forEach((g) => seq.push({ set: si, w: g }));
    });
    m.result = { h: res.h, a: res.a, sets: res.sets, seq, mom: [] };
    m.dur = Math.round(res.games * 4.3 + res.sets.length * 3 + 6);
    m.ctx.fatigue = { lastH, lastA, restH, restA };
    [['home', lastH, restH, m.home], ['away', lastA, restA, m.away]].forEach(([side, mins, rest, nm]) => {
      if (fat(mins, rest)) m.news.push({ kind: 'fatigue', side, time: m.start - (12 + r() * 10) * H, impact: 'medium', team: nm, source: 'Організатор турніру', title: nm + ' пройшов далі після матчу на ' + Math.floor(mins / 60) + ' год ' + (mins % 60) + ' хв', fact: nm + ' провів на корті ' + mins + ' хв у попередньому колі. Відпочинок перед цим матчем: ' + rest + ' дн.', why: 'Можливий вплив: підвищений ризик втоми, особливо в довгих розіграшах і третьому сеті. Ефект у демо-моделі помірний.' });
    });
  }

  function buildEsports(m, r, hT, aT, t) {
    const standIn = r() < 0.12 ? (r() < 0.5 ? 'home' : 'away') : null;
    const mapAdv = t.game === 'CS2' || t.game === 'Valorant' ? Math.round(U.normal(r) * 3) : 0;
    const yH = r() < 0.25, yA = r() < 0.25;
    const dR = hT.r - aT.r;
    const pm = (eff) => 1 / (1 + Math.exp(-(dR + eff * ((standIn === 'home' ? -6 : standIn === 'away' ? 6 : 0) + mapAdv + (yA ? 1 : 0) - (yH ? 1 : 0))) * 0.09));
    m.truth = bo3(pm(1));
    m.markets = mkMarkets([
      { key: 'ML', name: 'Переможець матчу', sels: [['home', m.home], ['away', m.away]] },
      { key: 'OU', name: 'Тотал карт 2.5', line: 2.5, sels: [['over', 'Більше 2.5 (3 карти)'], ['under', 'Менше 2.5 (2 карти)']] }
    ], bo3(pm(0)), bo3(pm(0.5)), r, 0.05);
    const p = pm(1); const maps = []; let a = 0, b = 0;
    const pool = t.game && MAPS[t.game] ? U.shuffle(r, MAPS[t.game]) : null;
    while (a < 2 && b < 2) {
      const hw = r() < p; let s, dur;
      if (pool) { const ot = r() < 0.12; const l = ot ? 14 : Math.floor(r() * 12); const w = ot ? 16 : 13; s = hw ? [w, l] : [l, w]; dur = Math.round((s[0] + s[1]) * 1.9 + 6); }
      else { const moba = t.game === 'Dota 2'; const w = moba ? 25 + Math.floor(r() * 20) : 15 + Math.floor(r() * 15); const l = moba ? 8 + Math.floor(r() * 25) : 3 + Math.floor(r() * 16); s = hw ? [w, l] : [l, w]; dur = moba ? 28 + Math.floor(r() * 26) : 25 + Math.floor(r() * 16); }
      maps.push({ name: pool ? pool[maps.length] : 'Карта ' + (maps.length + 1), s, dur, w: hw ? 'home' : 'away' });
      if (hw) a++; else b++;
    }
    m.result = { h: a, a: b, maps, mom: [] };
    m.dur = maps.reduce((x, mp) => x + mp.dur + 8, 0);
    m.ctx.esp = { standIn, mapAdv, yH, yA, rosterH: roster(m.home), rosterA: roster(m.away), pool: pool ? pool.slice(0, 5) : null };
    if (standIn) {
      const team = standIn === 'home' ? m.home : m.away; const ro = standIn === 'home' ? m.ctx.esp.rosterH : m.ctx.esp.rosterA;
      m.news.push({ kind: 'standin', side: standIn, time: m.start - (6 + r() * 30) * H, impact: 'high', team, source: 'Офіційний акаунт команди', title: team + ' зіграє із замінним гравцем', fact: team + ' підтвердили, що ' + ro[0] + ' пропустить матч проти ' + (standIn === 'home' ? m.away : m.home) + ' через візові проблеми. Його замінить гравець академії.', why: 'Можливий вплив: заміна в складі зазвичай знижує злагодженість, особливо в тактичних іграх. Модель помітно знижує оцінку ' + team + '.' });
    }
  }

  /* ---------------- стан матчу ---------------- */
  const endOf = (m) => m.start + m.dur * MIN;
  function status(m, t) { t = t == null ? SIT.clock.now() : t; return t < m.start ? 'upcoming' : t < endOf(m) ? 'live' : 'finished'; }
  function live(m, t) {
    t = t == null ? SIT.clock.now() : t;
    const st = status(m, t); const R = m.result;
    const out = { status: st, h: null, a: null, label: '', progress: 0, detail: '', stats: null, mom: [], events: [] };
    if (st === 'upcoming') return out;
    const e = st === 'finished' ? m.dur : (t - m.start) / MIN;
    out.progress = U.clamp(e / m.dur, 0, 1);
    if (m.sport === 'football') {
      let min;
      if (e < 47) { min = Math.min(45, Math.floor(e) + 1); out.label = (e >= 45 ? '45+' : min) + '’'; }
      else if (e < 62) { min = 45; out.label = 'Перерва'; }
      else { min = Math.min(90, 45 + Math.floor(e - 62) + 1); out.label = (e - 62 >= 45 ? '90+' : min) + '’'; }
      if (st === 'finished') { min = 91; out.label = 'Завершено'; }
      const evs = R.events.filter((x) => x.min <= min);
      out.events = evs;
      out.h = evs.filter((x) => x.type === 'Гол' && x.side === 'home').length; out.a = evs.filter((x) => x.type === 'Гол' && x.side === 'away').length;
      const f = Math.min(1, min / 90); const S = R.stats;
      out.stats = { shots: S.shots.map((v) => Math.round(v * f)), sot: S.sot.map((v) => Math.round(v * f)), poss: S.poss, corners: S.corners.map((v) => Math.round(v * f)), cards: [evs.filter((x) => x.type === 'Жовта картка' && x.side === 'home').length, evs.filter((x) => x.type === 'Жовта картка' && x.side === 'away').length] };
      out.stats.sot = out.stats.sot.map((v, i) => Math.max(v, i ? out.a : out.h));
      out.stats.shots = out.stats.shots.map((v, i) => Math.max(v, out.stats.sot[i]));
      out.mom = R.mom.slice(0, Math.max(1, Math.ceil(min / 5)));
    } else if (m.sport === 'tennis') {
      const total = R.seq.length; const played = st === 'finished' ? total : Math.min(total - 1, Math.floor(out.progress * total));
      const sets = []; let cur = [0, 0], si = 0;
      R.seq.slice(0, played).forEach((g) => { if (g.set !== si) { sets.push(cur); cur = [0, 0]; si = g.set; } cur[g.w === 'home' ? 0 : 1]++; });
      const done = R.sets.slice(0, si); out.h = done.filter((s) => s[0] > s[1]).length; out.a = done.filter((s) => s[1] > s[0]).length;
      if (st === 'finished') { out.h = R.h; out.a = R.a; out.label = 'Завершено'; out.detail = R.sets.map((s) => s[0] + ':' + s[1]).join(', '); }
      else { out.label = 'Сет ' + (si + 1); out.detail = 'Гейми в сеті ' + cur[0] + ':' + cur[1] + (done.length ? ', попередні: ' + done.map((s) => s[0] + ':' + s[1]).join(', ') : ''); }
      out.mom = R.seq.slice(Math.max(0, played - 12), played).map((g) => (g.w === 'home' ? 0.7 : -0.7));
    } else {
      let acc = 0, idx = 0, inMap = 0;
      for (idx = 0; idx < R.maps.length; idx++) { const d = R.maps[idx].dur + 8; if (e < acc + d) { inMap = (e - acc) / R.maps[idx].dur; break; } acc += d; }
      if (st === 'finished') idx = R.maps.length;
      const done = R.maps.slice(0, idx);
      out.h = done.filter((x) => x.w === 'home').length; out.a = done.filter((x) => x.w === 'away').length;
      out.mom = done.map((x) => (x.w === 'home' ? 0.8 : -0.8));
      if (st === 'finished') { out.label = 'Завершено'; out.detail = R.maps.map((x) => x.name + ' ' + x.s[0] + ':' + x.s[1]).join(', '); }
      else {
        const mp = R.maps[idx]; const f = U.clamp(inMap, 0, 1);
        if (f >= 1) { out.label = 'Пауза між картами'; out.detail = 'Наступна карта скоро'; }
        else {
          const sh = Math.floor(mp.s[0] * f), sa = Math.floor(mp.s[1] * f);
          out.label = 'Карта ' + (idx + 1);
          out.detail = mp.name + ': ' + sh + ':' + sa + (m.game === 'Dota 2' || m.game === 'LoL' ? ' (вбивства), ' + Math.floor(mp.dur * f) + ' хв гри' : ' (раунди)');
          out.mom.push(U.clamp((sh - sa) / 6, -1, 1));
        }
      }
    }
    return out;
  }
  function scoreText(m) {
    const R = m.result;
    if (m.sport === 'football') return R.h + ':' + R.a;
    if (m.sport === 'tennis') return R.h + ':' + R.a + ' (' + R.sets.map((s) => s[0] + ':' + s[1]).join(', ') + ')';
    return R.h + ':' + R.a + ' (' + R.maps.map((x) => x.s[0] + ':' + x.s[1]).join(', ') + ')';
  }
  function markets(m, t) {
    t = t == null ? SIT.clock.now() : t;
    return m.markets.map((mk) => ({ key: mk.key, name: mk.name, line: mk.line, sels: mk.sels.map((s) => ({ key: s.key, label: s.label, open: s.open, odds: oddsAt(s, m, t) })) }));
  }
  function oddsAt(s, m, t) {
    if (t >= m.start) return s.close;
    const h = s.hist; if (t <= h[0].t) return h[0].o;
    for (let i = 1; i < h.length; i++) if (t <= h[i].t) { const w = (t - h[i - 1].t) / (h[i].t - h[i - 1].t); return U.round2(h[i - 1].o + (h[i].o - h[i - 1].o) * w); }
    return s.close;
  }
  // Чи зіграв вибір: 'won' | 'lost' | 'void'
  function settle(m, mk, key) {
    const R = m.result;
    if (mk === '1X2' || mk === 'ML') { const w = R.h > R.a ? 'home' : R.h < R.a ? 'away' : 'draw'; return w === key ? 'won' : 'lost'; }
    if (mk === 'OU') {
      const line = m.markets.find((x) => x.key === 'OU').line;
      const tot = m.sport === 'football' ? R.h + R.a : m.sport === 'tennis' ? R.sets.reduce((x, s) => x + s[0] + s[1], 0) : R.maps.length;
      return (tot > line) === (key === 'over') ? 'won' : 'lost';
    }
    if (mk === 'BTTS') return (R.h > 0 && R.a > 0) === (key === 'yes') ? 'won' : 'lost';
    return 'void';
  }

  /* ---------------- новини ---------------- */
  const GENERAL = [
    ['football', 'УЄФА оновила календар єврокубків', 'Кілька матчів групового етапу перенесено на інші дні через конфлікт розкладу.'],
    ['football', 'УПЛ запроваджує оголошення рішень VAR на стадіонах', 'До кінця сезону арбітри пояснюватимуть скасовані рішення через гучномовці.'],
    ['tennis', 'Тур оголосив оновлений календар на наступний сезон', 'Два турніри переносять дати, щоб зменшити кількість перельотів між континентами.'],
    ['esports', 'Вийшло велике оновлення Dota 2', 'Розробники змінили баланс кількох героїв і предметів. Команди мають кілька днів на адаптацію.'],
    ['esports', 'Valve оновила пул карт CS2', 'Одна з карт тимчасово виходить з турнірного пулу, на її місце повертається інша.'],
    ['esports', 'Riot анонсувала зміни формату міжнародних турнірів', 'Зміни стосуються наступного сезону і не впливають на поточні матчі.']
  ];
  const newsCache = new Map();
  function newsForDay(ds) {
    if (newsCache.has(ds)) return newsCache.get(ds);
    const items = [];
    [U.addDays(ds, -1), ds, U.addDays(ds, 1), U.addDays(ds, 2)].forEach((d) => matchesForDate(d).forEach((m) => m.news.forEach((n, k) => {
      if (U.ds(n.time) === ds) items.push(Object.assign({ id: m.id + '#' + k, sport: m.sport, tourName: m.tourName, matchIds: [m.id] }, n));
    })));
    const r = rng('news|' + ds); const g = U.pick(r, GENERAL);
    items.push({ id: 'gen|' + ds, kind: 'general', sport: g[0], tourName: '', team: '', time: U.dayStart(ds) + (8 + r() * 10) * H, impact: 'low', source: 'Спортивна стрічка (демо)', title: g[1], fact: g[2], why: 'Недостатньо даних. Вплив на конкретні матчі оцінити неможливо.', matchIds: [] });
    items.sort((a, b) => b.time - a.time);
    newsCache.set(ds, items);
    return items;
  }
  function news(t, days) {
    t = t == null ? SIT.clock.now() : t; let out = [];
    for (let i = 0; i < (days || 2); i++) out = out.concat(newsForDay(U.addDays(U.ds(t), -i)));
    return out.filter((n) => n.time <= t).sort((a, b) => b.time - a.time);
  }
  const newsForMatch = (m, t) => m.news.map((n, k) => Object.assign({ id: m.id + '#' + k, sport: m.sport, tourName: m.tourName, matchIds: [m.id] }, n)).filter((n) => n.time <= (t == null ? SIT.clock.now() : t)).sort((a, b) => b.time - a.time);

  /* ---------------- провайдери ----------------
     Щоб підключити реальні дані, замініть ці об’єкти реалізаціями,
     що повертають ті самі структури (див. README.md). */
  SIT.providers = {
    sports: { name: 'Демо-фід матчів', demo: true },
    odds: { name: 'Демо-фід коефіцієнтів', demo: true },
    news: { name: 'Демо-фід новин', demo: true },
    ai: { name: 'Вбудована демо-модель', demo: true }
  };
  SIT.Data = { SPORTS, TOURS, TOUR, matchesForDate, matchesInRange, match, status, live, endOf, scoreText, markets, settle, news, newsForMatch };
})();
