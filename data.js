/* =====================================================================
   Sports Intelligence Terminal - data.js
   DATA PROVIDER LAYER + DETERMINISTIC DEMO DATA

   Everything here is DEMO data produced by a seeded generator, so the
   same match id always produces the same teams, odds, context and
   result. The UI never talks to generators directly: it goes through
   SIT.Data, which routes calls to SIT.providers.{sports, odds, news}.

   To connect real data later, write a provider object with the same
   method names (see the "PROVIDER CONTRACT" section at the bottom) and
   assign it in SIT.providers. Nothing in app.js needs to change.
   ===================================================================== */
(function () {
  'use strict';
  const SIT = (window.SIT = window.SIT || {});

  /* ---------------- deterministic helpers ---------------- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function normal(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function poisson(r, l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  function poisPmf(k, l) { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }
  function dateStr(d) { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
  function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toOdds(x) { x = Math.max(1.01, x); if (x < 2) return Math.round(x * 100) / 100; if (x < 4) return Math.round(x * 50) / 50; return Math.round(x * 10) / 10; }
  SIT.util = { hashStr, rng, pick, clamp, normal, poisson, Phi, dateStr, parseDate, addDays, shuffle, toOdds };

  /* ---------------- demo clock (can be fast-forwarded in Settings) ---------------- */
  SIT.clock = { offset: 0, now() { return Date.now() + this.offset; } };

  /* ---------------- reference data ---------------- */
  const SPORTS = {
    football: { id: 'football', name: 'Football', code: 'FTB', dur: 112, homeAdv: 3, unit: 'goals' },
    basketball: { id: 'basketball', name: 'Basketball', code: 'BSK', dur: 135, homeAdv: 2.5, unit: 'points' },
    tennis: { id: 'tennis', name: 'Tennis', code: 'TEN', dur: 115, homeAdv: 0, unit: 'games' },
    hockey: { id: 'hockey', name: 'Hockey', code: 'HKY', dur: 150, homeAdv: 2, unit: 'goals' },
    baseball: { id: 'baseball', name: 'Baseball', code: 'BSB', dur: 180, homeAdv: 1.5, unit: 'runs' },
    americanfootball: { id: 'americanfootball', name: 'American Football', code: 'AMF', dur: 195, homeAdv: 1.8, unit: 'points' },
    mma: { id: 'mma', name: 'MMA', code: 'MMA', dur: 24, homeAdv: 0, unit: 'rounds' }
  };

  const T = (s) => s.split(',').map((x) => { const [n, r] = x.split(':'); return { n: n.trim(), r: +r }; });
  const LEAGUES = [
    { id: 'eng-pl', name: 'Premier League', country: 'England', sport: 'football', hours: [13.5, 16, 18.5, 21], perDay: 3, teams: T('Arsenal:91,Manchester City:92,Liverpool:93,Chelsea:86,Tottenham:83,Newcastle:84,Aston Villa:84,Manchester United:81,Brighton:80,West Ham:77,Brentford:77,Crystal Palace:78') },
    { id: 'esp-ll', name: 'LaLiga', country: 'Spain', sport: 'football', hours: [14, 18.25, 20.5, 22], perDay: 3, teams: T('Real Madrid:93,Barcelona:92,Atletico Madrid:87,Athletic Club:83,Real Sociedad:80,Villarreal:82,Real Betis:80,Sevilla:77,Valencia:76,Girona:78') },
    { id: 'ita-sa', name: 'Serie A', country: 'Italy', sport: 'football', hours: [15, 18, 20.75], perDay: 3, teams: T('Inter:91,Napoli:88,Juventus:86,AC Milan:85,Atalanta:86,Roma:82,Lazio:81,Fiorentina:80,Bologna:80,Torino:76') },
    { id: 'ger-bl', name: 'Bundesliga', country: 'Germany', sport: 'football', hours: [15.5, 18.5, 20.5], perDay: 2, teams: T('Bayern Munich:93,Bayer Leverkusen:88,Borussia Dortmund:86,RB Leipzig:85,VfB Stuttgart:83,Eintracht Frankfurt:82,SC Freiburg:79,VfL Wolfsburg:77') },
    { id: 'ukr-upl', name: 'Premier League', country: 'Ukraine', sport: 'football', hours: [12, 14.5, 17], perDay: 2, teams: T('Shakhtar Donetsk:82,Dynamo Kyiv:81,Polissya Zhytomyr:74,Kryvbas:73,Oleksandriya:72,Zorya Luhansk:71,LNZ Cherkasy:70,Karpaty Lviv:70,Rukh Lviv:69,Obolon Kyiv:67') },
    { id: 'usa-mls', name: 'MLS', country: 'USA', sport: 'football', hours: [1.5, 3.5], perDay: 2, teams: T('Inter Miami:80,LAFC:80,LA Galaxy:79,Columbus Crew:79,FC Cincinnati:78,Seattle Sounders:77,Philadelphia Union:77,Orlando City:76') },
    { id: 'bra-sa', name: 'Serie A', country: 'Brazil', sport: 'football', hours: [0, 23], perDay: 2, teams: T('Flamengo:83,Palmeiras:83,Botafogo:81,Sao Paulo:79,Fluminense:78,Internacional:78,Atletico Mineiro:79,Corinthians:77') },
    { id: 'jpn-j1', name: 'J1 League', country: 'Japan', sport: 'football', hours: [7, 9.5, 11], perDay: 2, teams: T('Vissel Kobe:78,Sanfrecce Hiroshima:78,Kashima Antlers:77,Machida Zelvia:76,Urawa Reds:76,Kawasaki Frontale:76,Gamba Osaka:75,Yokohama F. Marinos:75') },
    { id: 'nba', name: 'NBA', country: 'USA', sport: 'basketball', hours: [1, 2, 3.5, 4.5], perDay: 4, teams: T('Boston Celtics:91,Oklahoma City Thunder:92,Denver Nuggets:88,New York Knicks:87,Cleveland Cavaliers:89,Minnesota Timberwolves:86,Milwaukee Bucks:84,Los Angeles Lakers:84,Golden State Warriors:84,Dallas Mavericks:84,Philadelphia 76ers:80,Phoenix Suns:81') },
    { id: 'euroleague', name: 'EuroLeague', country: 'Europe', sport: 'basketball', hours: [18, 19.5, 20.75], perDay: 3, teams: T('Real Madrid:86,Panathinaikos:86,Fenerbahce:87,Olympiacos:86,AS Monaco:84,Barcelona:83,Partizan:80,Zalgiris:79,Anadolu Efes:81,Maccabi Tel Aviv:79') },
    { id: 'atp', name: 'ATP 500 (demo event)', country: 'World', sport: 'tennis', hours: [5, 7, 9, 11, 13, 15, 17, 19], perDay: 6, teams: T('Andriy Kovalenko:88,Mateo Rinaldi:86,Lukas Brandt:85,Hugo Lemaire:84,Kenji Arata:82,Tomas Hruska:81,Diego Ferraz:83,Oliver Grant:80,Nikolai Petrov:84,Rafael Ortega:79,Jonas Lindqvist:78,Emil Novak:80,Sam Whitaker:77,Pablo Duarte:78,Felix Kramer:79,Marco Bellini:76') },
    { id: 'wta', name: 'WTA 1000 (demo event)', country: 'World', sport: 'tennis', hours: [6, 10, 14, 18], perDay: 4, teams: T('Elena Moroz:87,Sofia Reyes:85,Hana Sato:83,Clara Dubois:84,Maja Kowalska:82,Lena Hartmann:81,Iris van Dijk:80,Ana Petric:79,Yulia Bondar:82,Chloe Martin:78,Nina Svoboda:80,Grace Holloway:77') },
    { id: 'nhl', name: 'NHL', country: 'USA', sport: 'hockey', hours: [0.5, 1, 2, 3.5], perDay: 3, teams: T('Florida Panthers:88,Edmonton Oilers:88,Dallas Stars:87,Colorado Avalanche:87,Carolina Hurricanes:86,Winnipeg Jets:86,Vegas Golden Knights:85,New York Rangers:83,Toronto Maple Leafs:85,Tampa Bay Lightning:84') },
    { id: 'mlb', name: 'MLB Postseason', country: 'USA', sport: 'baseball', hours: [19, 22.5, 1.5], perDay: 2, teams: T('Los Angeles Dodgers:89,New York Yankees:87,Philadelphia Phillies:86,Atlanta Braves:84,Houston Astros:84,Baltimore Orioles:83,Cleveland Guardians:83,San Diego Padres:84') },
    { id: 'nfl', name: 'NFL', country: 'USA', sport: 'americanfootball', hours: [2.25, 19, 22.5], perDay: 2, teams: T('Kansas City Chiefs:90,Philadelphia Eagles:90,Baltimore Ravens:89,Detroit Lions:88,Buffalo Bills:88,San Francisco 49ers:85,Green Bay Packers:84,Dallas Cowboys:82,Houston Texans:83,Cincinnati Bengals:83') },
    { id: 'ufc', name: 'UFC Fight Night (demo card)', country: 'USA', sport: 'mma', hours: [2, 2.5, 3, 3.5, 4], perDay: 4, teams: T('Ruslan Tagirov:86,Marcus Bell:82,Joao Pereira:84,Kai Mitchell:80,Arman Sadykov:85,Tyler Brooks:79,Mateus Lima:83,Viktor Hrynko:81,Dmitri Volkov:84,Carlos Mendez:80,Ben Archer:78,Aslan Kuramov:83') }
  ];
  const LEAGUE_BY_ID = Object.fromEntries(LEAGUES.map((l) => [l.id, l]));

  const SURNAMES = 'Mensah,Varga,Okafor,Lindqvist,Moreau,Oliveira,Kovac,Novak,Duarte,Brandt,Ferreira,Nakamura,Schulz,Petrenko,Romero,Carvalho,Ivanov,Laurent,Bakker,Jensen,Rossi,Conti,Marino,Gallagher,Whitfield,Ortiz,Sandoval,Dumont,Tkachenko,Bondarenko,Sato,Kimura,Hughes,Barnes,Fontaine,Valdez,Kaya,Demir,Nilsen,Holm,Pereira,Soto,Varela,Kruger,Lehmann,Bianchi,Ricci,Moretti,Coleman,Brooks,Jenkins,Price,Ward,Adeyemi,Haddad,Sorensen'.split(',');
  const INITIALS = 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,R,S,T,V,Y'.split(',');
  const ROLES = {
    football: [['Goalkeeper', 0], ['Centre-Back', 3], ['Centre-Back', 2], ['Full-Back', 4], ['Full-Back', 4], ['Defensive Midfielder', 4], ['Central Midfielder', 8], ['Attacking Midfielder', 14], ['Winger', 16], ['Winger', 13], ['Striker', 24], ['Striker', 10], ['Central Midfielder', 5], ['Centre-Back', 2], ['Winger', 7]],
    basketball: [['Point Guard', 18], ['Shooting Guard', 16], ['Small Forward', 15], ['Power Forward', 13], ['Center', 14], ['Guard', 8], ['Forward', 7], ['Center', 5], ['Guard', 4]],
    hockey: [['Center', 14], ['Left Wing', 12], ['Right Wing', 12], ['Center', 9], ['Defenseman', 7], ['Defenseman', 6], ['Goaltender', 0], ['Winger', 8], ['Defenseman', 4]],
    baseball: [['Starting Pitcher', 0], ['Shortstop', 12], ['Center Fielder', 14], ['First Baseman', 15], ['Catcher', 8], ['Designated Hitter', 16], ['Closer', 0], ['Third Baseman', 11]],
    americanfootball: [['Quarterback', 30], ['Wide Receiver', 16], ['Running Back', 14], ['Tight End', 9], ['Wide Receiver', 10], ['Left Tackle', 0], ['Edge Rusher', 0], ['Cornerback', 0]]
  };
  const INJURY_TYPES = ['hamstring strain', 'ankle sprain', 'knee injury', 'calf problem', 'groin strain', 'muscle fatigue', 'illness', 'shoulder injury', 'back spasms', 'foot injury'];

  const rosterCache = {};
  function roster(team, sport) {
    const key = sport + '|' + team;
    if (rosterCache[key]) return rosterCache[key];
    const r = rng('roster|' + key);
    const roles = ROLES[sport] || [];
    const used = new Set();
    const list = roles.map(([role, w]) => {
      let name;
      do { name = pick(r, INITIALS) + '. ' + pick(r, SURNAMES); } while (used.has(name));
      used.add(name);
      return { name, role, weight: w * (0.7 + r() * 0.6) };
    });
    const tot = list.reduce((a, p) => a + p.weight, 0) || 1;
    list.forEach((p) => { p.contrib = Math.round((p.weight / tot) * 100); });
    return (rosterCache[key] = list);
  }

  /* ---------------- truth model (hidden: used only to generate odds + results) ---------------- */
  function grid(lh, la, N) {
    const ph = [], pa = [];
    for (let i = 0; i <= N; i++) { ph.push(poisPmf(i, lh)); pa.push(poisPmf(i, la)); }
    return {
      ph, pa,
      outcome() { let H = 0, D = 0, A = 0; for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const p = ph[i] * pa[j]; if (i > j) H += p; else if (i === j) D += p; else A += p; } return { H, D, A }; },
      over(line) { let o = 0; for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) if (i + j > line) o += ph[i] * pa[j]; return o; }
    };
  }
  function truthModel(m) {
    const sp = SPORTS[m.sport];
    const diff = m.homeR - m.awayR + sp.homeAdv;
    const r = rng(m.id + '|truth');
    const t = { diff };
    if (m.sport === 'football') {
      t.lamH = clamp(1.32 * Math.exp(diff / 30), 0.35, 3.6); t.lamA = clamp(1.18 * Math.exp(-diff / 30), 0.25, 3.2);
      const g = grid(t.lamH, t.lamA, 10); const o = g.outcome();
      t.pH = o.H; t.pD = o.D; t.pA = o.A; t.line = 2.5; t.pOver = g.over(2.5);
      t.pBtts = (1 - Math.exp(-t.lamH)) * (1 - Math.exp(-t.lamA));
    } else if (m.sport === 'hockey' || m.sport === 'baseball') {
      const base = m.sport === 'hockey' ? [3.05, 2.85, 45, 12] : [4.5, 4.3, 45, 22];
      t.lamH = base[0] * Math.exp(diff / base[2]); t.lamA = base[1] * Math.exp(-diff / base[2]);
      const g = grid(t.lamH, t.lamA, base[3]); const o = g.outcome();
      t.otH = clamp(0.5 + diff / 120, 0.3, 0.7);
      t.pH = o.H + o.D * t.otH; t.pA = 1 - t.pH;
      t.line = Math.round(t.lamH + t.lamA - 0.5) + 0.5; t.pOver = g.over(t.line);
    } else if (m.sport === 'basketball' || m.sport === 'americanfootball') {
      const nba = m.leagueId === 'nba';
      t.d = m.sport === 'basketball' ? diff * 0.85 : diff * 0.65;
      t.sd = m.sport === 'basketball' ? 12 : 13.5;
      t.mean = (m.sport === 'americanfootball' ? 45 : nba ? 227 : 165) + normal(r) * (m.sport === 'americanfootball' ? 3 : 5);
      t.sdT = m.sport === 'americanfootball' ? 13 : nba ? 17 : 14;
      t.pH = Phi(t.d / t.sd); t.pA = 1 - t.pH;
      t.line = Math.floor(t.mean + normal(r) * 1.5) + 0.5; t.pOver = 1 - Phi((t.line - t.mean) / t.sdT);
    } else if (m.sport === 'tennis') {
      t.pH = 1 / (1 + Math.exp(-diff / 7)); t.pA = 1 - t.pH;
      t.mean = 23.2 - Math.abs(diff) * 0.07; t.line = Math.round(t.mean - 0.5) + 0.5; t.pOver = 1 - Phi((t.line - t.mean) / 4.2);
    } else if (m.sport === 'mma') {
      t.pH = 1 / (1 + Math.exp(-diff / 7)); t.pA = 1 - t.pH;
      t.line = 2.5; t.pOver = clamp(0.55 - Math.abs(diff) * 0.006, 0.3, 0.7);
    }
    return t;
  }

  const ML_NAMES = { basketball: 'Moneyline', hockey: 'Moneyline (incl. OT)', baseball: 'Moneyline', americanfootball: 'Moneyline', tennis: 'Match Winner', mma: 'Fight Winner' };
  const TOT_NAMES = { football: 'Total Goals', basketball: 'Total Points', hockey: 'Total Goals', baseball: 'Total Runs', americanfootball: 'Total Points', tennis: 'Total Games', mma: 'Total Rounds' };

  function buildMarkets(m) {
    const r = rng(m.id + '|markets'); const t = m.truth; const out = [];
    const add = (key, name, line, sels) => {
      const noisy = sels.map((s) => Math.max(0.02, s.p + normal(r) * 0.03));
      const sum = noisy.reduce((a, b) => a + b, 0);
      const margin = 1.045 + r() * 0.025;
      out.push({ key, name, line, sels: sels.map((s, i) => { const close = toOdds(1 / ((noisy[i] / sum) * margin)); return { key: s.key, label: s.label, close, open: toOdds(close * Math.exp(normal(r) * 0.06)) }; }) });
    };
    if (m.sport === 'football') {
      add('1X2', 'Match Result', null, [{ key: 'home', label: m.home, p: t.pH }, { key: 'draw', label: 'Draw', p: t.pD }, { key: 'away', label: m.away, p: t.pA }]);
    } else {
      add('ML', ML_NAMES[m.sport], null, [{ key: 'home', label: m.home, p: t.pH }, { key: 'away', label: m.away, p: t.pA }]);
    }
    add('OU', TOT_NAMES[m.sport], t.line, [{ key: 'over', label: 'Over ' + t.line, p: t.pOver }, { key: 'under', label: 'Under ' + t.line, p: 1 - t.pOver }]);
    if (m.sport === 'football') add('BTTS', 'Both Teams To Score', null, [{ key: 'yes', label: 'Yes', p: t.pBtts }, { key: 'no', label: 'No', p: 1 - t.pBtts }]);
    return out;
  }

  /* ---------------- results (deterministic per match) ---------------- */
  function genResult(m) {
    const r = rng(m.id + '|result'); const t = m.truth; const R = { events: [] };
    if (m.sport === 'football' || m.sport === 'hockey' || m.sport === 'baseball') {
      const maxMin = m.sport === 'football' ? 90 : m.sport === 'hockey' ? 60 : 9;
      let h = poisson(r, t.lamH), a = poisson(r, t.lamA);
      for (let i = 0; i < h; i++) R.events.push({ t: 1 + Math.floor(r() * maxMin), side: 'home' });
      for (let i = 0; i < a; i++) R.events.push({ t: 1 + Math.floor(r() * maxMin), side: 'away' });
      if (m.sport !== 'football' && h === a) {
        const side = r() < t.otH ? 'home' : 'away';
        R.events.push({ t: maxMin + 1, side, extra: true }); if (side === 'home') h++; else a++;
        R.extra = m.sport === 'hockey' ? 'OT' : 'Extra innings';
      }
      R.events.sort((x, y) => x.t - y.t);
      R.h = h; R.a = a;
    } else if (m.sport === 'basketball' || m.sport === 'americanfootball') {
      let margin = t.d + t.sd * normal(r);
      if (Math.abs(margin) < 1) margin = (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 3));
      const total = Math.max(m.sport === 'americanfootball' ? 13 : 120, t.mean + t.sdT * normal(r));
      R.h = Math.max(0, Math.round((total + margin) / 2)); R.a = Math.max(0, Math.round((total - margin) / 2));
      if (R.h === R.a) R.h += m.sport === 'americanfootball' ? 3 : 1;
    } else if (m.sport === 'tennis') {
      const homeWins = r() < t.pH; const loserSet = r() < 0.38;
      const order = loserSet ? (r() < 0.5 ? ['W', 'L', 'W'] : ['L', 'W', 'W']) : ['W', 'W'];
      R.sets = order.map((o) => {
        const lg = pick(r, [0, 1, 2, 3, 3, 4, 4, 5, 6]); const set = lg === 5 ? [7, 5] : lg === 6 ? [7, 6] : [6, lg];
        const winnerIsHome = (o === 'W') === homeWins;
        return winnerIsHome ? set : [set[1], set[0]];
      });
      R.h = R.sets.filter((s) => s[0] > s[1]).length; R.a = R.sets.length - R.h;
      R.totalGames = R.sets.reduce((a, s) => a + s[0] + s[1], 0);
    } else if (m.sport === 'mma') {
      const homeWins = r() < t.pH; const x = r();
      R.method = x < 0.42 ? 'KO/TKO' : x < 0.62 ? 'Submission' : 'Decision';
      R.round = R.method === 'Decision' ? 3 : 1 + Math.floor(r() * 3);
      R.h = homeWins ? 1 : 0; R.a = homeWins ? 0 : 1;
      R.totalRounds = R.method === 'Decision' ? 3 : R.round - 0.5;
    }
    R.winner = R.h > R.a ? 'home' : R.h < R.a ? 'away' : 'draw';
    R.total = m.sport === 'tennis' ? R.totalGames : m.sport === 'mma' ? R.totalRounds : R.h + R.a;
    return R;
  }

  /* quick score simulation used for form, H2H and splits */
  function simScore(sport, leagueId, ra, rb, homeA, r) {
    const diff = ra - rb + (homeA ? SPORTS[sport].homeAdv : -SPORTS[sport].homeAdv);
    switch (sport) {
      case 'football': return [poisson(r, clamp(1.32 * Math.exp(diff / 30), 0.3, 3.6)), poisson(r, clamp(1.18 * Math.exp(-diff / 30), 0.25, 3.2))];
      case 'hockey': { let a = poisson(r, 3 * Math.exp(diff / 45)), b = poisson(r, 2.9 * Math.exp(-diff / 45)); if (a === b) r() < 0.5 + diff / 120 ? a++ : b++; return [a, b]; }
      case 'baseball': { let a = poisson(r, 4.5 * Math.exp(diff / 45)), b = poisson(r, 4.3 * Math.exp(-diff / 45)); if (a === b) r() < 0.5 ? a++ : b++; return [a, b]; }
      case 'basketball': { const base = leagueId === 'nba' ? 113 : 82; let a = Math.round(base + diff * 0.45 + normal(r) * 10), b = Math.round(base - diff * 0.45 + normal(r) * 10); if (a === b) a += 2; return [a, b]; }
      case 'americanfootball': { let a = Math.max(0, Math.round(22.5 + diff * 0.33 + normal(r) * 9)), b = Math.max(0, Math.round(22.5 - diff * 0.33 + normal(r) * 9)); if (a === b) a += 3; return [a, b]; }
      case 'tennis': { const w = r() < 1 / (1 + Math.exp(-diff / 7)); const three = r() < 0.38; return w ? [2, three ? 1 : 0] : [three ? 1 : 0, 2]; }
      case 'mma': return r() < 1 / (1 + Math.exp(-diff / 7)) ? [1, 0] : [0, 1];
    }
    return [0, 0];
  }

  /* ---------------- context: form, H2H, splits, injuries, schedule ---------------- */
  const formCache = {};
  function teamForm(L, team, ds) {
    const key = L.id + '|' + team.n + '|' + ds;
    if (formCache[key]) return formCache[key];
    const r = rng('form|' + key);
    const opps = L.teams.filter((x) => x.n !== team.n);
    const gap = L.sport === 'tennis' ? 2 : L.sport === 'mma' ? 70 : L.sport === 'baseball' ? 1 : L.sport === 'americanfootball' ? 7 : 3;
    let day = -(L.sport === 'mma' ? 60 + Math.floor(r() * 90) : 1 + Math.floor(r() * (gap + 3)));
    const games = [];
    for (let i = 0; i < 10; i++) {
      const opp = pick(r, opps); const home = r() < 0.5;
      const [f, a] = simScore(L.sport, L.id, team.r, opp.r, home, r);
      games.push({ date: addDays(ds, day), opp: opp.n, home, f, a, res: f > a ? 'W' : f < a ? 'L' : 'D' });
      day -= gap + Math.floor(r() * (gap + 1));
    }
    return (formCache[key] = games);
  }
  function splits(L, team, ds, home) {
    const r = rng('split|' + L.id + team.n + ds + home);
    const opps = L.teams.filter((x) => x.n !== team.n);
    const s = { n: 10, w: 0, d: 0, l: 0, f: 0, a: 0 };
    for (let i = 0; i < 10; i++) { const o = pick(r, opps); const [f, a] = simScore(L.sport, L.id, team.r, o.r, home, r); s.f += f; s.a += a; if (f > a) s.w++; else if (f < a) s.l++; else s.d++; }
    s.avgF = s.f / s.n; s.avgA = s.a / s.n;
    return s;
  }
  function h2h(L, A, B, ds) {
    const pair = [A.n, B.n].sort().join('|');
    const r = rng('h2h|' + pair);
    const max = L.sport === 'tennis' || L.sport === 'mma' ? 3 : 7;
    const n = Math.floor(r() * (max + 1));
    const list = [];
    let day = -40 - Math.floor(r() * 60);
    for (let i = 0; i < n; i++) {
      const aHome = r() < 0.5; const [x, y] = simScore(L.sport, L.id, A.r, B.r, aHome, r);
      list.push({ date: addDays(ds, day), home: aHome ? A.n : B.n, away: aHome ? B.n : A.n, hs: aHome ? x : y, as: aHome ? y : x, aScore: x, bScore: y });
      day -= 90 + Math.floor(r() * 200);
    }
    return list;
  }
  const tableCache = {};
  function leagueTable(L, ds) {
    if (!['football', 'americanfootball', 'basketball', 'hockey'].includes(L.sport)) return null;
    const d = parseDate(ds); const seasonStart = new Date(d.getFullYear() - (d.getMonth() < 7 ? 1 : 0), 7, 15);
    const weeks = Math.max(1, Math.floor((d - seasonStart) / (7 * 864e5)));
    const played = L.sport === 'football' ? Math.min(38, weeks) : L.sport === 'americanfootball' ? Math.min(17, Math.max(1, weeks - 3)) : Math.max(1, weeks - 8);
    const key = L.id + '|' + played; if (tableCache[key]) return tableCache[key];
    if ((L.sport === 'basketball' || L.sport === 'hockey') && weeks < 10) return (tableCache[key] = null);
    const r = rng('table|' + key); const avg = L.teams.reduce((a, t) => a + t.r, 0) / L.teams.length;
    const rows = L.teams.map((t) => {
      const strength = clamp(0.5 + (t.r - avg) / 22 + normal(r) * 0.12, 0.05, 0.95);
      if (L.sport === 'football') { const w = Math.round(played * strength * 0.75), dr = Math.round((played - w) * 0.35); return { team: t.n, p: played, w, d: dr, l: played - w - dr, pts: w * 3 + dr }; }
      const w = Math.round(played * strength); return { team: t.n, p: played, w, d: 0, l: played - w, pts: w };
    }).sort((a, b) => b.pts - a.pts);
    rows.forEach((x, i) => (x.pos = i + 1));
    return (tableCache[key] = { played, rows });
  }

  function genContext(m, L, H, A) {
    const r = rng(m.id + '|ctx'); const ds = m.date; const sp = m.sport;
    const ctx = {};
    ctx.formH = teamForm(L, H, ds); ctx.formA = teamForm(L, A, ds);
    ctx.splitH = splits(L, H, ds, true); ctx.splitA = splits(L, A, ds, false);
    ctx.h2h = h2h(L, H, A, ds);
    ctx.restH = Math.round((parseDate(ds) - parseDate(ctx.formH[0].date)) / 864e5);
    ctx.restA = Math.round((parseDate(ds) - parseDate(ctx.formA[0].date)) / 864e5);
    const team = ['football', 'basketball', 'hockey', 'baseball', 'americanfootball'].includes(sp);
    ctx.injuries = { home: [], away: [] }; ctx.suspensions = { home: [], away: [] };
    if (team) {
      ['home', 'away'].forEach((side) => {
        const name = side === 'home' ? m.home : m.away; const ros = roster(name, sp);
        const cnt = pick(r, [0, 0, 1, 1, 1, 2, 2, 3]);
        const pool = shuffle(r, ros);
        for (let i = 0; i < cnt; i++) {
          const p = pool[i]; const out = r() < 0.62;
          ctx.injuries[side].push({ name: p.name, role: p.role, contrib: p.contrib, status: out ? 'Out' : 'Doubtful', reason: pick(r, INJURY_TYPES), back: out ? addDays(ds, 7 + Math.floor(r() * 35)) : null });
        }
        if (['football', 'hockey', 'americanfootball'].includes(sp) && r() < 0.18) {
          const p = pool[cnt]; ctx.suspensions[side].push({ name: p.name, role: p.role, contrib: p.contrib, reason: sp === 'football' ? pick(r, ['Yellow card accumulation', 'Red card (straight)', 'Two yellow cards']) : 'League suspension' });
        }
      });
    }
    // lineups (football only), with a chance the feed has none
    ctx.lineups = null;
    if (sp === 'football' && r() > 0.25) {
      ctx.lineups = {};
      ['home', 'away'].forEach((side) => {
        const name = side === 'home' ? m.home : m.away; const ros = roster(name, sp);
        const unavailable = new Set([...ctx.injuries[side], ...ctx.suspensions[side]].filter((x) => x.status !== 'Doubtful').map((x) => x.name));
        const xi = ros.filter((p) => !unavailable.has(p.name)).slice(0, 11);
        ctx.lineups[side] = { formation: pick(r, ['4-3-3', '4-2-3-1', '3-4-2-1', '4-4-2', '3-5-2']), players: xi.map((p) => ({ name: p.name, role: p.role, doubt: ctx.injuries[side].some((x) => x.name === p.name) })) };
      });
    }
    // schedule
    const nextFor = (team, opps, side) => {
      const rr = rng(m.id + '|next|' + side);
      const days = sp === 'tennis' ? 1 : sp === 'mma' ? 90 : sp === 'americanfootball' ? 7 : 3 + Math.floor(rr() * 2);
      if (sp === 'football' && team.r >= 84 && rr() < 0.6) return { date: addDays(ds, days), comp: pick(rr, ['UEFA Champions League', 'UEFA Europa League']), opp: pick(rr, ['Benfica', 'Ajax', 'Celtic', 'Sporting CP', 'PSV Eindhoven', 'Club Brugge', 'Galatasaray', 'Feyenoord']), days, european: true };
      return { date: addDays(ds, days), comp: L.name, opp: pick(rr, opps.filter((x) => x.n !== team.n)).n, days };
    };
    ctx.nextH = sp === 'tennis' ? null : nextFor(H, L.teams.filter((x) => x.n !== A.n), 'h');
    ctx.nextA = sp === 'tennis' ? null : nextFor(A, L.teams.filter((x) => x.n !== H.n), 'a');
    ctx.table = leagueTable(L, ds);
    if (sp === 'baseball') { const rr = rng(m.id + '|series'); const g = 1 + Math.floor(rr() * 4); const hw = Math.floor(rr() * g); ctx.series = { game: g + 1, h: Math.min(2, hw), a: Math.min(2, g - hw), bestOf: 5 }; }
    // tennis/MMA specific notes
    if (sp === 'tennis') { ctx.lastMatchMins = { home: 70 + Math.floor(r() * 120), away: 70 + Math.floor(r() * 120) }; }
    return ctx;
  }

  /* ---------------- match + day slate ---------------- */
  const matchCache = {};
  function genMatch(L, H, A, start, id) {
    if (matchCache[id]) return matchCache[id];
    const sp = SPORTS[L.sport];
    const m = { id, sport: L.sport, leagueId: L.id, league: L.name, country: L.country, home: H.n, away: A.n, homeR: H.r, awayR: A.r, start: +start, date: dateStr(start), dur: sp.dur, demo: true };
    m.truth = truthModel(m); // hidden, never read by the engine
    m.markets = buildMarkets(m);
    m.result = genResult(m);
    if (m.sport === 'mma') m.dur = 6 + m.result.round * 6;
    m.ctx = genContext(m, L, H, A);
    const r = rng(id + '|live');
    if (m.sport === 'football') {
      const tilt = clamp((m.homeR - m.awayR + 3) * 0.7, -15, 15);
      m.liveTotals = { shots: [Math.round(m.truth.lamH * 5 + 5 + r() * 4), Math.round(m.truth.lamA * 5 + 4 + r() * 4)], poss: Math.round(clamp(50 + tilt + normal(r) * 4, 30, 72)), corners: [2 + Math.floor(r() * 8), 1 + Math.floor(r() * 7)], cards: [Math.floor(r() * 4), Math.floor(r() * 4)] };
      m.liveTotals.sot = [Math.round(m.liveTotals.shots[0] * (0.3 + r() * 0.15)), Math.round(m.liveTotals.shots[1] * (0.3 + r() * 0.15))];
    }
    m.momentumSeed = Array.from({ length: 24 }, () => normal(r));
    return (matchCache[id] = m);
  }

  const dayCache = {};
  function getDay(ds) {
    if (dayCache[ds]) return dayCache[ds];
    const base = parseDate(ds); const out = [];
    LEAGUES.forEach((L) => {
      const r = rng('slate|' + L.id + '|' + ds);
      const teams = shuffle(r, L.teams);
      const n = Math.min(L.perDay, Math.floor(teams.length / 2));
      for (let i = 0; i < n; i++) {
        const hr = L.hours[i % L.hours.length] + (i >= L.hours.length ? 0.25 : 0);
        const start = new Date(base); start.setHours(Math.floor(hr), Math.round((hr % 1) * 60), 0, 0);
        out.push(genMatch(L, teams[2 * i], teams[2 * i + 1], start, L.id + '~' + ds + '~' + i));
      }
    });
    out.sort((a, b) => a.start - b.start);
    return (dayCache[ds] = out);
  }
  function getMatchById(id) {
    if (matchCache[id]) return matchCache[id];
    const parts = String(id).split('~'); if (parts.length !== 3) return null;
    getDay(parts[1]);
    return matchCache[id] || null;
  }

  /* ---------------- status + live state ---------------- */
  function statusOf(m, now) {
    now = now == null ? SIT.clock.now() : now;
    if (now < m.start) return 'upcoming';
    if (now < m.start + m.dur * 60000) return 'live';
    return 'finished';
  }

  function remainingOutcome(lh, la, curH, curA) {
    const g = grid(lh, la, 8); let H = 0, D = 0, A = 0;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const p = g.ph[i] * g.pa[j]; const x = curH + i, y = curA + j; if (x > y) H += p; else if (x === y) D += p; else A += p; }
    return { H, D, A };
  }

  function liveState(m, now) {
    now = now == null ? SIT.clock.now() : now;
    const st = statusOf(m, now); const R = m.result; const sp = m.sport;
    const out = { status: st, h: null, a: null, label: '', progress: 0, stats: null, momentum: [], oddsPath: [], events: [] };
    if (st === 'upcoming') return out;
    if (st === 'finished') {
      out.h = R.h; out.a = R.a; out.progress = 1;
      out.label = sp === 'mma' ? R.method + ' R' + R.round : R.extra ? 'FT (' + R.extra + ')' : 'FT';
      if (sp === 'football') fillFootball(m, out, 90);
      return out;
    }
    const e = (now - m.start) / 60000;
    const p = clamp(e / m.dur, 0, 0.999);
    out.progress = p;
    if (sp === 'football') {
      let gm, label;
      if (e < 47) { gm = Math.floor(e) + 1; label = Math.min(gm, 45) + (gm > 45 ? '+' : '') + "'"; }
      else if (e < 62) { gm = 45; label = 'HT'; }
      else { gm = Math.min(90, 45 + Math.floor(e - 62) + 1); label = gm >= 90 ? "90+'" : gm + "'"; }
      out.label = label; out.progress = gm / 90;
      fillFootball(m, out, gm);
    } else if (sp === 'hockey' || sp === 'baseball') {
      const max = sp === 'hockey' ? 60 : 9; const gm = Math.min(max, Math.floor(p * (max + 0.5)) + (sp === 'baseball' ? 1 : 0));
      const done = R.events.filter((x) => (sp === 'baseball' ? x.t < gm : x.t <= gm) && !x.extra);
      out.h = done.filter((x) => x.side === 'home').length; out.a = done.filter((x) => x.side === 'away').length;
      out.label = sp === 'hockey' ? 'P' + Math.min(3, Math.floor(gm / 20) + 1) + ' ' + (gm % 20) + "'" : (p * 18 % 2 < 1 ? 'Top ' : 'Bot ') + gm;
      const rem = 1 - gm / max; const ro = remainingOutcome(m.truth.lamH * rem, m.truth.lamA * rem, out.h, out.a);
      out.pHome = ro.H + ro.D * 0.5;
      out.events = done.map((x) => ({ t: x.t, side: x.side, type: sp === 'hockey' ? 'Goal' : 'Run' }));
    } else if (sp === 'basketball' || sp === 'americanfootball') {
      const q = Math.min(4, Math.floor(p * 4) + 1); const qlen = sp === 'basketball' ? (m.leagueId === 'nba' ? 12 : 10) : 15;
      const left = Math.max(0, Math.round((1 - ((p * 4) % 1)) * qlen));
      out.label = 'Q' + q + ' ' + left + ':00';
      const wobble = (k) => Math.sin(p * 9 + k) * (1 - p) * p * (sp === 'basketball' ? 10 : 6);
      out.h = Math.max(0, Math.round(R.h * p + wobble(1))); out.a = Math.max(0, Math.round(R.a * p + wobble(2)));
      const remSd = m.truth.sd * Math.sqrt(1 - p) + 0.5;
      out.pHome = Phi((out.h - out.a + m.truth.d * (1 - p)) / remSd);
    } else if (sp === 'tennis') {
      const n = R.sets.length; const done = Math.floor(p * n); const cur = R.sets[done] || [0, 0]; const f = (p * n) % 1;
      out.h = R.sets.slice(0, done).filter((s) => s[0] > s[1]).length; out.a = done - out.h;
      out.label = 'Set ' + (done + 1) + ' (' + Math.floor(cur[0] * f) + '-' + Math.floor(cur[1] * f) + ')';
      out.sets = R.sets.slice(0, done);
      out.pHome = clamp(m.truth.pH + (out.h - out.a) * 0.25, 0.03, 0.97);
    } else if (sp === 'mma') {
      const rd = Math.min(R.round, Math.floor(p * R.round) + 1);
      out.label = 'R' + rd; out.h = null; out.a = null; out.pHome = m.truth.pH;
    }
    // generic momentum for non football sports
    if (sp !== 'football') {
      const steps = Math.max(1, Math.floor(p * 18));
      out.momentum = m.momentumSeed.slice(0, steps).map((v, i) => clamp(Math.tanh((m.homeR - m.awayR) / 25 + v * 0.6 + Math.sin(i) * 0.2), -1, 1));
      if (out.pHome != null) {
        const pre = 1 / m.markets[0].sels[0].close;
        out.oddsPath = Array.from({ length: steps + 1 }, (_, i) => { const w = i / (steps || 1); return toOdds(1 / ((pre * (1 - w) + out.pHome * w) * 1.06)); });
      }
    }
    return out;
  }

  function fillFootball(m, out, gm) {
    const R = m.result; const done = R.events.filter((x) => x.t <= gm);
    out.h = done.filter((x) => x.side === 'home').length; out.a = done.filter((x) => x.side === 'away').length;
    out.events = done.map((x) => ({ t: x.t, side: x.side, type: 'Goal' }));
    const f = gm / 90; const L = m.liveTotals;
    const sc = (v) => Math.round(v * f);
    out.stats = {
      shots: [sc(L.shots[0]) + out.h, sc(L.shots[1]) + out.a],
      sot: [Math.max(out.h, sc(L.sot[0])), Math.max(out.a, sc(L.sot[1]))],
      poss: [L.poss + Math.round(Math.sin(gm / 7) * 3), 100 - L.poss - Math.round(Math.sin(gm / 7) * 3)],
      corners: [sc(L.corners[0]), sc(L.corners[1])],
      cards: [sc(L.cards[0]), sc(L.cards[1])]
    };
    const steps = Math.max(1, Math.floor(gm / 5));
    out.momentum = m.momentumSeed.slice(0, Math.min(18, steps)).map((v, i) => {
      const t0 = i * 5, t1 = t0 + 5; const boost = R.events.filter((x) => x.t > t0 - 3 && x.t <= t1).reduce((a, x) => a + (x.side === 'home' ? 0.6 : -0.6), 0);
      return clamp(Math.tanh((m.homeR - m.awayR) / 30 + v * 0.55 + boost), -1, 1);
    });
    const path = [];
    for (let i = 0; i <= steps; i++) {
      const g = Math.min(gm, i * 5); const rem = 1 - g / 90;
      const ch = R.events.filter((x) => x.t <= g && x.side === 'home').length, ca = R.events.filter((x) => x.t <= g && x.side === 'away').length;
      const o = remainingOutcome(m.truth.lamH * rem, m.truth.lamA * rem, ch, ca);
      path.push(toOdds(1 / (Math.max(0.01, o.H) * 1.06)));
      if (i === steps) { out.pHome = o.H; out.pDraw = o.D; out.pAway = o.A; }
    }
    out.oddsPath = path;
  }

  /* ---------------- odds over time (pre-match) ---------------- */
  const ohCache = {};
  function oddsHistory(m, mk, selKey) {
    const ck = m.id + '|' + mk + '|' + selKey;
    if (ohCache[ck]) return ohCache[ck];
    return (ohCache[ck] = oddsHistoryRaw(m, mk, selKey));
  }
  function oddsHistoryRaw(m, mk, selKey) {
    const market = m.markets.find((x) => x.key === mk); if (!market) return [];
    const sel = market.sels.find((s) => s.key === selKey); if (!sel) return [];
    const r = rng(m.id + '|oh|' + mk + selKey); const pts = [];
    for (let i = 0; i <= 12; i++) {
      const w = i / 12; const base = sel.open + (sel.close - sel.open) * (w * w * (3 - 2 * w));
      const noise = i === 0 || i === 12 ? 0 : normal(r) * 0.018 * base;
      pts.push({ t: m.start - (12 - i) * 6 * 3600e3, o: toOdds(base + noise) });
    }
    return pts;
  }
  function oddsAt(m, mk, selKey, now) {
    now = now == null ? SIT.clock.now() : now;
    const h = oddsHistory(m, mk, selKey); if (!h.length) return null;
    if (now >= m.start) return h[h.length - 1].o;
    if (now <= h[0].t) return h[0].o;
    for (let i = 1; i < h.length; i++) if (now <= h[i].t) return h[i - 1].o;
    return h[h.length - 1].o;
  }
  function marketsAt(m, now) {
    return m.markets.map((mk) => ({ key: mk.key, name: mk.name, line: mk.line, sels: mk.sels.map((s) => ({ key: s.key, label: s.label, open: s.open, odds: oddsAt(m, mk.key, s.key, now) })) }));
  }

  function evalSelection(m, mk, sel, line) {
    const R = m.result;
    if (mk === '1X2' || mk === 'ML') return R.winner === sel;
    if (mk === 'OU') { if (R.total === line) return null; return sel === 'over' ? R.total > line : R.total < line; }
    if (mk === 'BTTS') { const b = R.h > 0 && R.a > 0; return sel === 'yes' ? b : !b; }
    return null;
  }
  function scoreText(m) {
    const R = m.result;
    if (m.sport === 'mma') return (R.winner === 'home' ? m.home : m.away) + ' by ' + R.method + ' (R' + R.round + ')';
    if (m.sport === 'tennis') return R.h + '-' + R.a + ' (' + R.sets.map((s) => s[0] + '-' + s[1]).join(', ') + ')';
    return R.h + '-' + R.a + (R.extra ? ' (' + R.extra + ')' : '');
  }

  /* ---------------- news (deterministic per day) ---------------- */
  const SOURCES = { official: 'Official club statement', presser: 'Pre-match press conference', league: 'League disciplinary update', report: 'Team injury report', local: 'Local press report', wire: 'Sports wire (demo)', weather: 'Weather service (demo)', event: 'Event organiser' };
  const newsCache = {};
  function getNews(ds) {
    if (newsCache[ds]) return newsCache[ds];
    const r = rng('news|' + ds);
    const pool = getDay(ds).concat(getDay(addDays(ds, 1)).filter((m) => m.start < parseDate(ds).getTime() + 36 * 3600e3));
    const items = [];
    const push = (m, o) => {
      const t = m ? m.start - (5 + r() * 20) * 3600e3 : parseDate(ds).getTime() + (7 + r() * 12) * 3600e3;
      items.push(Object.assign({ id: 'n~' + ds + '~' + items.length, time: Math.round(t), sport: m ? m.sport : o.sport, league: m ? m.league : o.league || '', matchIds: m ? [m.id] : [], demo: true }, o));
    };
    shuffle(r, pool).forEach((m) => {
      const c = m.ctx;
      ['home', 'away'].forEach((side) => {
        const team = side === 'home' ? m.home : m.away; const opp = side === 'home' ? m.away : m.home;
        c.injuries[side].forEach((p) => {
          if (p.status === 'Out' && p.contrib >= 9 && r() < 0.7) {
            const unit = SPORTS[m.sport].unit;
            push(m, { type: 'injury', team, side, entity: p.name, impact: p.contrib >= 20 ? 'HIGH' : 'MEDIUM', source: pick(r, [SOURCES.official, SOURCES.report, SOURCES.presser]),
              headline: team + ' confirm ' + p.name + ' will miss ' + opp + ' game',
              fact: team + ' confirmed that ' + p.role.toLowerCase() + ' ' + p.name + ' is ruled out with a ' + p.reason + '. Expected return: ' + p.back + '.',
              why: 'Potential impact: ' + team + ' scoring output may decrease because ' + p.name + ' has been involved in ' + p.contrib + '% of the team\'s ' + unit + ' this season (demo stat).',
              basis: ['Player contribution share: ' + p.contrib + '%', 'Status: Out', 'Opponent: ' + opp],
              effect: { side, pts: -Math.round(p.contrib / 5), totals: -Math.round(p.contrib / 8) } });
          } else if (p.status === 'Doubtful' && p.contrib >= 7 && r() < 0.5) {
            push(m, { type: 'doubt', team, side, entity: p.name, impact: p.contrib >= 15 ? 'MEDIUM' : 'LOW', source: SOURCES.presser,
              headline: p.name + ' faces late fitness test before ' + team + ' vs ' + opp,
              fact: 'The head coach said ' + p.name + ' (' + p.reason + ') will be assessed on matchday. No final decision has been announced.',
              why: 'Potential impact: lineup uncertainty. If ' + p.name + ' does not start, ' + team + ' lose a player involved in ' + p.contrib + '% of output. The model treats this as a risk, not as a confirmed absence.',
              basis: ['Status: Doubtful', 'Contribution share: ' + p.contrib + '%'], effect: { side, pts: -1, totals: 0 } });
          }
        });
        c.suspensions[side].forEach((p) => {
          if (r() < 0.6) push(m, { type: 'suspension', team, side, entity: p.name, impact: p.contrib >= 12 ? 'MEDIUM' : 'LOW', source: SOURCES.league,
            headline: p.name + ' suspended for ' + team + '\'s next game',
            fact: p.name + ' (' + p.role + ') serves a one-match ban: ' + p.reason.toLowerCase() + '.',
            why: p.contrib >= 5 ? 'Potential impact: ' + team + ' lose a regular ' + p.role.toLowerCase() + ' with a ' + p.contrib + '% contribution share. Effect on result is likely limited.' : 'Insufficient data to estimate a measurable match impact.',
            basis: ['Suspension confirmed by league'], effect: { side, pts: -Math.max(1, Math.round(p.contrib / 6)), totals: 0 } });
        });
        const nx = side === 'home' ? c.nextH : c.nextA;
        if (nx && nx.european && nx.days <= 4 && r() < 0.55) {
          push(m, { type: 'rotation', team, side, entity: team, impact: 'MEDIUM', source: SOURCES.presser,
            headline: team + ' coach hints at squad changes ahead of ' + nx.comp + ' trip',
            fact: 'Asked about fixture congestion, the coach said "some changes" are planned. ' + team + ' play ' + nx.opp + ' in the ' + nx.comp + ' in ' + nx.days + ' days.',
            why: 'Potential impact: ' + team + ' may rotate players because of the upcoming ' + nx.comp + ' fixture. Starting XI strength and lineup certainty are both lower.',
            basis: ['Next fixture in ' + nx.days + ' days', 'Competition: ' + nx.comp], effect: { side, pts: -3, totals: 0 } });
        }
      });
      if (m.sport === 'tennis' && c.lastMatchMins) {
        ['home', 'away'].forEach((side) => {
          const mins = c.lastMatchMins[side]; const pl = side === 'home' ? m.home : m.away;
          if (mins > 160 && r() < 0.8) push(m, { type: 'fatigue', team: pl, side, entity: pl, impact: 'MEDIUM', source: SOURCES.event,
            headline: pl + ' comes through ' + Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm battle to reach next round',
            fact: pl + ' spent ' + mins + ' minutes on court in the previous round, the longest match of the day.',
            why: 'Potential impact: fatigue risk is elevated after ' + mins + ' minutes on court with ' + c.restH + ' day(s) of recovery. Historical effect size in the demo model is moderate.',
            basis: ['Previous match duration: ' + mins + ' min'], effect: { side, pts: -2, totals: 0 } });
        });
      }
      if (m.sport === 'mma' && r() < 0.18) {
        const side = r() < 0.5 ? 'home' : 'away'; const f = side === 'home' ? m.home : m.away;
        push(m, { type: 'weight', team: f, side, entity: f, impact: 'HIGH', source: SOURCES.event,
          headline: f + ' misses weight by 1.5 lbs, bout proceeds at catchweight',
          fact: f + ' weighed in 1.5 lbs over the limit. The bout goes ahead and ' + f + ' forfeits 20% of the purse.',
          why: 'Potential impact: a difficult weight cut can reduce cardio in later rounds. Evidence across fighters is mixed, so the model applies only a small adjustment.',
          basis: ['Official weigh-in result'], effect: { side, pts: -2, totals: -1 } });
      }
      if (m.sport === 'football' && r() < 0.07) {
        push(m, { type: 'weather', team: m.home, side: null, entity: m.home + ' vs ' + m.away, impact: 'LOW', source: SOURCES.weather,
          headline: 'Heavy rain and strong wind forecast for ' + m.home + ' vs ' + m.away,
          fact: 'Forecast for kick-off: persistent rain, wind gusts up to 50 km/h.',
          why: 'Potential impact: poor conditions may slightly reduce scoring and passing accuracy. The effect in the demo model is small.',
          basis: ['Forecast at kick-off time'], effect: { side: null, pts: 0, totals: -2 } });
      }
    });
    // general items with no measurable match impact
    const gen = [
      { sport: 'football', league: 'Premier League', headline: 'League confirms trial of in-stadium VAR announcements', fact: 'Referees will explain overturned decisions over the stadium PA for the rest of the season.', team: 'League', entity: 'Premier League' },
      { sport: 'basketball', league: 'NBA', headline: 'NBA publishes updated player participation policy', fact: 'The league updated rules about resting healthy players in nationally televised games.', team: 'League', entity: 'NBA' },
      { sport: 'tennis', league: 'ATP', headline: 'Tour announces revised calendar for next season', fact: 'Two events move dates to reduce back-to-back travel across continents.', team: 'Tour', entity: 'ATP' },
      { sport: 'hockey', league: 'NHL', headline: 'NHL confirms new faceoff violation enforcement', fact: 'Officials will enforce stricter rules at faceoffs starting this week.', team: 'League', entity: 'NHL' }
    ];
    shuffle(r, gen).slice(0, 2).forEach((g) => push(null, Object.assign({ type: 'general', impact: 'LOW', source: SOURCES.wire, why: 'Insufficient data. No measurable impact on specific matches can be estimated.', basis: [], effect: null }, g)));
    const sorted = shuffle(r, items).slice(0, 18).sort((a, b) => b.time - a.time);
    return (newsCache[ds] = sorted);
  }

  /* =====================================================================
     PROVIDER CONTRACT
     A provider is any object with these methods. Real implementations
     can fetch data in init()/refresh() and keep an internal cache so the
     synchronous getters stay fast for the UI.

     sports: { id, name, isDemo, init(), getMatchesForDate(ds), getMatch(id),
               getStatus(match, now), getLiveState(match, now), getResult(match) }
     odds:   { id, name, isDemo, getMarkets(match, now), getHistory(match, mk, sel) }
     news:   { id, name, isDemo, getNewsForDate(ds) }
     ===================================================================== */
  const MockSportsProvider = {
    id: 'mock-sports', name: 'Demo sports feed', isDemo: true,
    async init() { /* real provider: fetch fixtures here */ },
    getMatchesForDate: getDay,
    getMatch: getMatchById,
    getStatus: statusOf,
    getLiveState: liveState,
    getResult: (m) => (statusOf(m) === 'finished' ? m.result : null)
  };
  const MockOddsProvider = {
    id: 'mock-odds', name: 'Demo odds feed', isDemo: true,
    getMarkets: marketsAt,
    getHistory: oddsHistory
  };
  const MockNewsProvider = {
    id: 'mock-news', name: 'Demo news feed', isDemo: true,
    getNewsForDate: getNews
  };
  SIT.providers = { sports: MockSportsProvider, odds: MockOddsProvider, news: MockNewsProvider };

  /* Data facade used by the app. Swap providers above, keep this API. */
  SIT.Data = {
    SPORTS, LEAGUES, LEAGUE_BY_ID,
    matchesForDate: (ds) => SIT.providers.sports.getMatchesForDate(ds),
    matchesInRange(fromDs, days) { let out = []; for (let i = 0; i < days; i++) out = out.concat(this.matchesForDate(addDays(fromDs, i))); return out; },
    match: (id) => SIT.providers.sports.getMatch(id),
    status: (m, now) => SIT.providers.sports.getStatus(m, now),
    live: (m, now) => SIT.providers.sports.getLiveState(m, now),
    result: (m) => SIT.providers.sports.getResult(m),
    markets: (m, now) => SIT.providers.odds.getMarkets(m, now),
    oddsHistory: (m, mk, sel) => SIT.providers.odds.getHistory(m, mk, sel),
    news: (ds) => SIT.providers.news.getNewsForDate(ds),
    _nfm: {},
    newsForMatch(m, now) {
      now = now == null ? SIT.clock.now() : now;
      let linked = this._nfm[m.id];
      if (!linked) {
        const seen = new Set();
        linked = this._nfm[m.id] = this.news(addDays(m.date, -1)).concat(this.news(m.date)).filter((n) => n.matchIds.includes(m.id) && !seen.has(n.id) && seen.add(n.id));
      }
      return linked.filter((n) => n.time <= now);
    },
    evalSelection, scoreText, roster
  };
})();
