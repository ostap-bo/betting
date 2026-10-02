/* =====================================================================
   SIT - model.js
   Демо-модель: фактори, ймовірності, впевненість, ризики, рішення AI
   і розбір після матчу. Усі функції можна замінити реальною моделлю
   або LLM (див. SIT.Model.llm).
   ===================================================================== */
(function () {
  'use strict';
  const SIT = window.SIT, D = SIT.Data, U = SIT.U;
  const K = 0.0065; // 1 пункт фактора = 0,65 п.п. ймовірності
  const H = 3600e3;

  const PROFILES = {
    conservative: { name: 'Обережний', minEdge: 4, minConf: 60, maxOdds: 2.6, kelly: 0.15, cap: 0.02, maxPerScan: 2, allowHigh: false },
    balanced: { name: 'Збалансований', minEdge: 3, minConf: 55, maxOdds: 3.2, kelly: 0.25, cap: 0.03, maxPerScan: 3, allowHigh: false },
    aggressive: { name: 'Сміливий', minEdge: 2, minConf: 48, maxOdds: 4.5, kelly: 0.35, cap: 0.05, maxPerScan: 4, allowHigh: true }
  };

  const fmtP = (p) => (p * 100).toFixed(1).replace('.', ',') + '%';
  const fmtO = (o) => o.toFixed(2).replace('.', ',');
  const ppg = (games, sport) => games.length ? games.reduce((s, g) => s + (sport === 'football' ? (g.res === 'В' ? 3 : g.res === 'Н' ? 1 : 0) : g.res === 'В' ? 1 : 0), 0) / games.length : 0;
  const formStr = (games, n) => games.slice(0, n).map((g) => g.res).join('');
  const norm = (arr) => { const s = arr.reduce((a, b) => a + b, 0); return arr.map((x) => x / s); };
  const f = (key, label, value, detail, missing) => ({ key, label, value: missing ? 0 : Math.round(value), detail, missing: !!missing });

  /* ---------- фактори на користь господарів / першого гравця ---------- */
  function sideFactors(m, fairH, fairA, t) {
    const c = m.ctx, sp = m.sport, out = [];
    const n = sp === 'football' ? 5 : 8;
    const obs = ppg(c.formH, sp) - ppg(c.formA, sp);
    const exp = (fairH - fairA) * (sp === 'football' ? 2.6 : 0.9);
    out.push(f('form', 'Форма', U.clamp((obs - exp) * (sp === 'football' ? 3 : 9), -7, 7),
      m.home + ' ' + formStr(c.formH, n) + ', ' + m.away + ' ' + formStr(c.formA, n) + ' (останні ' + n + ')'));
    if (c.h2h.length >= 2) {
      const w = c.h2h.filter((g) => g.hs > g.as).length, d = c.h2h.filter((g) => g.hs === g.as).length;
      const share = (w + d / 2) / c.h2h.length; const ex = sp === 'football' ? fairH + (1 - fairH - fairA) / 2 : fairH;
      out.push(f('h2h', 'Очні зустрічі', U.clamp((share - ex) * 8 * (c.h2h.length >= 4 ? 1 : 0.6), -5, 5), m.home + ' виграв ' + w + ' з ' + c.h2h.length + ' останніх зустрічей' + (c.h2h.length < 4 ? ' (мала вибірка)' : '')));
    } else out.push(f('h2h', 'Очні зустрічі', 0, c.h2h.length ? 'Лише одна зустріч, не враховано' : 'Раніше не зустрічалися', true));
    if (sp === 'football') {
      const hh = c.formH.filter((g) => g.home), aa = c.formA.filter((g) => !g.home);
      if (hh.length && aa.length) out.push(f('venue', 'Вдома і в гостях', U.clamp((ppg(hh, sp) - ppg(aa, sp) - exp - 0.4) * 1.5, -4, 4), m.home + ' вдома ' + ppg(hh, sp).toFixed(1).replace('.', ',') + ' оч/гру, ' + m.away + ' у гостях ' + ppg(aa, sp).toFixed(1).replace('.', ',') + ' оч/гру'));
      const lost = (side) => c.inj[side].filter((p) => p.reported <= t).reduce((s, p) => s + (p.status === 'out' ? p.contrib : p.contrib * 0.4), 0);
      const lh = lost('home'), la = lost('away');
      out.push(f('injuries', 'Травми', U.clamp((la - lh) / 4, -8, 8), lh || la ? 'Втрата внеску: ' + m.home + ' ' + Math.round(lh) + '%, ' + m.away + ' ' + Math.round(la) + '%' : 'Важливих втрат немає'));
      const rd = c.restH - c.restA;
      out.push(f('rest', 'Відпочинок', Math.min(c.restH, c.restA) <= 3 ? U.clamp(rd, -2, 2) : 0, m.home + ' ' + c.restH + ' дн., ' + m.away + ' ' + c.restA + ' дн. між іграми'));
      const rotN = m.news.find((x) => x.kind === 'rotation' && x.time <= t);
      out.push(f('news', 'Новини', rotN ? (rotN.side === 'home' ? -3 : 3) : 0, rotN ? rotN.title : 'Немає новин про ротацію'));
    } else if (sp === 'tennis') {
      const F = c.fatigue; const fat = (mins, rest) => (mins > 150 && rest <= 1 ? 1 : 0);
      out.push(f('fatigue', 'Втома', (fat(F.lastA, F.restA) - fat(F.lastH, F.restH)) * 4, 'Попередній матч: ' + m.home + ' ' + F.lastH + ' хв, ' + m.away + ' ' + F.lastA + ' хв'));
      out.push(f('surface', 'Покриття', 0, 'Даних про результати на покритті немає в демо-фіді', true));
    } else {
      const E = c.esp;
      const si = E.standIn && m.news.some((x) => x.kind === 'standin' && x.time <= t) ? E.standIn : null;
      out.push(f('roster', 'Склад', si === 'home' ? -7 : si === 'away' ? 7 : 0, si ? (si === 'home' ? m.home : m.away) + ' грає із замінним гравцем' : 'Обидва склади основні'));
      if (E.pool) out.push(f('maps', 'Пул карт', E.mapAdv * 1.2, E.mapAdv ? (E.mapAdv > 0 ? m.home : m.away) + ' сильніші на ймовірних картах' : 'Пули карт приблизно рівні'));
      else out.push(f('patch', 'Патч', 0, 'Вплив свіжого патча оцінити неможливо', true));
      out.push(f('schedule', 'Розклад', (E.yA ? 1 : 0) - (E.yH ? 1 : 0), (E.yH || E.yA ? 'Грали вчора: ' + [E.yH ? m.home : null, E.yA ? m.away : null].filter(Boolean).join(', ') : 'Обидві команди відпочили')));
    }
    return out;
  }

  /* ---------- фактори для тоталів (на користь «Більше») ---------- */
  function totalFactors(m, fairOver, sideModelH, t) {
    const c = m.ctx, out = [];
    if (m.sport === 'football') {
      const avg = (g) => g.reduce((s, x) => s + x.f + x.a, 0) / g.length;
      const a = (avg(c.formH) + avg(c.formA)) / 2; const expT = 2.5 + (fairOver - 0.5) * 2.4;
      out.push(f('scoring', 'Результативність', U.clamp((a - expT) * 3, -6, 6), 'У середньому ' + a.toFixed(1).replace('.', ',') + ' голу за матч в останніх іграх обох команд'));
      const att = ['home', 'away'].reduce((s, side) => s + c.inj[side].filter((p) => p.reported <= t && p.status === 'out' && /нападник|вінгер|атакувальний/.test(p.role)).reduce((x, p) => x + p.contrib, 0), 0);
      out.push(f('attack', 'Втрати в атаці', -U.clamp(att / 8, 0, 5), att ? 'Без гравців атаки з часткою внеску ' + att + '%' : 'Атака в повному складі'));
      const w = m.news.find((x) => x.kind === 'weather' && x.time <= t);
      out.push(f('weather', 'Погода', w ? -3 : 0, w ? 'Дощ і сильний вітер' : 'Без погодних ризиків'));
    } else if (m.sport === 'tennis') {
      const g = (arr) => arr.reduce((s, x) => s + x.games, 0) / arr.length;
      const a = (g(c.formH) + g(c.formA)) / 2; const line = m.markets.find((x) => x.key === 'OU').line;
      out.push(f('games', 'Тривалість матчів', U.clamp((a - line) / 1.5, -5, 5), 'У середньому ' + a.toFixed(1).replace('.', ',') + ' гейму в останніх матчах обох'));
      out.push(f('balance', 'Рівність сил', U.clamp((0.5 - Math.abs(sideModelH - 0.5)) * 10 - 2.5, -4, 4), 'Модель оцінює шанси як ' + fmtP(sideModelH) + ' на ' + fmtP(1 - sideModelH)));
    } else {
      const three = c.formH.concat(c.formA).filter((g) => g.f + g.a === 3).length / (c.formH.length + c.formA.length);
      out.push(f('history', 'Історія карт', U.clamp((three - fairOver) * 10, -4, 4), Math.round(three * 100) + '% останніх матчів обох команд тривали 3 карти'));
    }
    return out;
  }

  /* ---------- впевненість і ризики ---------- */
  function confidence(factors) {
    const act = factors.filter((x) => !x.missing); const tot = act.reduce((s, x) => s + x.value, 0);
    const abs = act.reduce((s, x) => s + Math.abs(x.value), 0) || 1;
    const agree = act.filter((x) => Math.sign(x.value) === Math.sign(tot)).reduce((s, x) => s + Math.abs(x.value), 0) / abs;
    const comp = act.length / (factors.length || 1);
    const v = Math.round(U.clamp(25 + 15 * comp + 20 * agree * Math.min(1, act.length / 3) + Math.min(20, Math.abs(tot) * 1.5), 15, 92));
    return { value: v, level: v >= 68 ? 'high' : v >= 50 ? 'medium' : 'low', completeness: comp, agreement: agree };
  }
  function risks(m, sel, factors, t) {
    const out = []; const c = m.ctx;
    if (c.h2h.length < 3) out.push({ label: 'Мала вибірка очних', w: 0.5, detail: c.h2h.length ? 'Очних зустрічей у даних: ' + c.h2h.length + '.' : 'Команди раніше не зустрічалися.' });
    if (m.sport === 'football') {
      if (!c.lineups && m.start - t > 0) out.push({ label: 'Склади ще не підтверджені', w: 1, detail: 'Склади оголошують приблизно за годину до початку.' });
      if (c.inj.home.concat(c.inj.away).some((p) => p.status === 'doubt')) out.push({ label: 'Гравці під питанням', w: 0.7, detail: 'Є гравці, чия участь не вирішена.' });
      if (m.news.some((n) => n.kind === 'injury' && n.time <= t && t - n.time < 48 * H)) out.push({ label: 'Свіжі новини про травми', w: 0.7, detail: 'Ринок може ще підлаштовуватися.' });
    }
    if (m.sport === 'esports' && c.esp.standIn) out.push({ label: 'Заміна в складі', w: 1, detail: 'Злагодженість із замінним гравцем важко оцінити.' });
    if (m.sport === 'tennis' && (c.fatigue.lastH > 150 || c.fatigue.lastA > 150)) out.push({ label: 'Можлива втома', w: 0.6, detail: 'Хтось із гравців мав довгий попередній матч.' });
    const mv = sel.odds / sel.open - 1;
    if (Math.abs(mv) > 0.08) out.push({ label: 'Нестабільний ринок', w: 0.7, detail: 'Коефіцієнт змінився на ' + (mv > 0 ? '+' : '') + Math.round(mv * 100) + '% від відкриття.' });
    const act = factors.filter((x) => !x.missing);
    if (act.some((x) => x.value >= 5) && act.some((x) => x.value <= -5)) out.push({ label: 'Суперечливі сигнали', w: 1, detail: 'Сильні фактори вказують у різні боки.' });
    if (sel.odds >= 3) out.push({ label: 'Високий коефіцієнт', w: 1, detail: 'Навіть при правильній оцінці більшість таких ставок програють.' });
    if (sel.model - sel.implied > 0.1) out.push({ label: 'Великий розрив з ринком', w: 1, detail: 'Розрив понад 10 п.п. частіше означає помилку моделі, ніж ринку.' });
    if (D.status(m, t) === 'live') out.push({ label: 'Матч уже йде', w: 1, detail: 'Модель не враховує події матчу, а коефіцієнти наживо змінюються швидко.' });
    const score = out.reduce((s, x) => s + x.w, 0);
    return { list: out, score, level: score >= 2.5 ? 'high' : score >= 1.2 ? 'medium' : 'low' };
  }

  function invertBo3(p) { let lo = 0.01, hi = 0.99; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (mid * mid * (3 - 2 * mid) < p) lo = mid; else hi = mid; } return (lo + hi) / 2; }

  /* ---------- аналіз матчу ---------- */
  const cache = new Map();
  function analyze(m, t) {
    t = t == null ? SIT.clock.now() : t;
    const st = D.status(m, t);
    const at = st === 'finished' ? m.start - 60000 : t;
    const ck = m.id + '|' + Math.floor(at / 600000) + '|' + st;
    if (cache.has(ck)) return cache.get(ck);
    const mks = D.markets(m, at);
    const side = mks[0]; const fairS = norm(side.sels.map((s) => 1 / s.odds));
    const fairH = fairS[0], fairA = fairS[fairS.length - 1];
    const SF = sideFactors(m, fairH, fairA, at); const S = SF.reduce((s, x) => s + x.value, 0);
    const modelH = U.clamp(fairH + K * S, 0.03, 0.95), modelA = U.clamp(fairA - K * S, 0.03, 0.95);
    const res = { m, at, markets: [], status: st };
    mks.forEach((mk) => {
      const fair = norm(mk.sels.map((s) => 1 / s.odds));
      let TF = null, overModel = null;
      if (mk.key === 'OU') {
        TF = totalFactors(m, fair[0], m.sport === 'tennis' || m.sport === 'esports' ? modelH : 0.5, at);
        const T = TF.reduce((s, x) => s + x.value, 0);
        if (m.sport === 'esports') {
          const pm = invertBo3(modelH); const base = 2 * pm * (1 - pm);
          TF.unshift(f('balance', 'Рівність сил', (base - fair[0]) / K, 'За оцінкою моделі шанс на 3 карти ' + fmtP(base)));
          overModel = U.clamp(base + K * T, 0.05, 0.9);
        } else overModel = U.clamp(fair[0] + K * T, 0.05, 0.92);
      }
      let BF = null, bttsModel = null;
      if (mk.key === 'BTTS') {
        const sc = (g) => g.filter((x) => x.f > 0 && x.a > 0).length / g.length;
        const share = (sc(m.ctx.formH) + sc(m.ctx.formA)) / 2;
        BF = [f('both', 'Голи обох команд', U.clamp((share - fair[0]) * 12, -6, 6), 'Обидві команди забивали в ' + Math.round(share * 100) + '% останніх матчів')];
        bttsModel = U.clamp(fair[0] + K * BF[0].value, 0.05, 0.92);
      }
      const sels = mk.sels.map((s, i) => {
        let model, factors;
        if (mk.key === '1X2' || mk.key === 'ML') {
          if (s.key === 'home') { model = modelH; factors = SF; }
          else if (s.key === 'away') { model = modelA; factors = SF.map((x) => Object.assign({}, x, { value: -x.value })); }
          else { model = 1 - modelH - modelA; factors = [f('balance', 'Рівність сил', 0, 'Нічия оцінюється на рівні ринку')]; }
        } else if (mk.key === 'OU') { model = s.key === 'over' ? overModel : 1 - overModel; factors = s.key === 'over' ? TF : TF.map((x) => Object.assign({}, x, { value: -x.value })); }
        else { model = s.key === 'yes' ? bttsModel : 1 - bttsModel; factors = s.key === 'yes' ? BF : BF.map((x) => Object.assign({}, x, { value: -x.value })); }
        const sel = { mk: mk.key, mkName: mk.name, key: s.key, label: s.label, odds: s.odds, open: s.open, implied: 1 / s.odds, fair: fair[i], model, factors };
        sel.value = model - sel.implied; sel.ev = model * s.odds - 1;
        sel.conf = confidence(factors); sel.risk = risks(m, sel, factors, at);
        sel.score = Math.round(U.clamp(50 + factors.reduce((a, x) => a + x.value, 0) * 2.2, 1, 99));
        sel.pos = factors.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
        sel.neg = factors.filter((x) => x.value < 0).sort((a, b) => a.value - b.value);
        return sel;
      });
      res.markets.push({ key: mk.key, name: mk.name, line: mk.line, sels });
    });
    const all = res.markets.flatMap((x) => x.sels).filter((s) => s.key !== 'draw');
    res.best = all.slice().sort((a, b) => b.value - a.value)[0];
    const b = res.best; const cats = [];
    if (b.value >= 0.03) cats.push('edge');
    if (b.value > 0 && b.conf.value >= 66) cats.push('confident');
    if (b.value > 0 && b.factors.some((x) => x.value >= 5)) cats.push('signal');
    if (b.value > 0.01 && (b.odds >= 2.8 || b.risk.level === 'high')) cats.push('risky');
    if (st === 'live' && b.value > 0.02) cats.push('live');
    res.cats = cats;
    const hot = m.news.some((n) => n.impact === 'high' && n.time <= t);
    res.interest = Math.round(U.clamp(35 + b.value * 420 + b.conf.value * 0.25 + (hot ? 8 : 0) + (st === 'live' ? 6 : 0), 1, 99));
    if (cache.size > 4000) cache.clear();
    cache.set(ck, res);
    return res;
  }

  function reasoning(s) {
    const pos = s.pos.slice(0, 2).map((x) => x.label.toLowerCase() + ' (+' + x.value + ')').join(', ');
    const neg = s.neg.slice(0, 2).map((x) => x.label.toLowerCase() + ' (' + x.value + ')').join(', ');
    return 'Модель оцінює «' + s.label + '» у ' + fmtP(s.model) + ', а коефіцієнт ' + fmtO(s.odds) + ' означає ' + fmtP(s.implied) + '. ' +
      (pos ? 'Головні аргументи за: ' + pos + '. ' : 'Жоден фактор помітно не виділяється, тому оцінка близька до ринкової. ') +
      (neg ? 'Проти: ' + neg + '. ' : '') + 'Це внутрішня оцінка моделі, а не гарантія.';
  }
  function against(s) {
    const out = s.neg.map((x) => x.label + ': ' + x.detail);
    s.risk.list.forEach((r) => out.push(r.label + ': ' + r.detail));
    out.push('Букмекери оцінюють цей результат у ' + fmtP(s.fair) + ' і можуть знати те, чого не бачить модель.');
    if (s.conf.agreement < 0.7) out.push('Фактори узгоджені лише на ' + Math.round(s.conf.agreement * 100) + '%, тож висновок тримається на меншості сигналів.');
    return out;
  }

  /* ---------- рішення AI ---------- */
  function aiPick(analyses, bankroll, profileKey, openExposure) {
    const P = PROFILES[profileKey] || PROFILES.balanced;
    const cands = [];
    analyses.forEach((a) => a.markets.forEach((mk) => mk.sels.forEach((s) => {
      if (s.key === 'draw') return;
      if (s.value * 100 < P.minEdge || s.conf.value < P.minConf || s.odds < 1.35 || s.odds > P.maxOdds) return;
      if (!P.allowHigh && s.risk.level === 'high') return;
      cands.push({ a, s });
    })));
    cands.sort((x, y) => y.s.value * y.s.conf.value - x.s.value * x.s.conf.value);
    const used = new Set(); const out = []; let exp = openExposure || 0;
    for (const c of cands) {
      if (out.length >= P.maxPerScan) break;
      if (used.has(c.a.m.id)) continue;
      const kelly = Math.max(0, (c.s.model * c.s.odds - 1) / (c.s.odds - 1)) * P.kelly;
      const stake = Math.max(5, Math.round(bankroll * Math.min(P.cap, kelly)));
      if (exp + stake > bankroll * 0.15) continue;
      used.add(c.a.m.id); exp += stake; out.push({ a: c.a, s: c.s, stake });
    }
    return out;
  }

  /* ---------- розбір після матчу ---------- */
  function review(bet, m) {
    const won = bet.status === 'won';
    const before = 'До матчу модель оцінювала «' + bet.selection + '» у ' + fmtP(bet.model) + ' проти ' + fmtP(bet.implied) + ' у коефіцієнті ' + fmtO(bet.odds) + '.';
    let after = 'Підсумок: ' + m.home + ' ' + D.scoreText(m) + ' ' + m.away + '. Ставка ' + (won ? 'зіграла' : bet.status === 'void' ? 'повернена' : 'не зіграла') + '.';
    if (m.sport === 'football') { const S = m.result.stats; after += ' Удари ' + S.shots[0] + ':' + S.shots[1] + ', володіння ' + S.poss[0] + '% на ' + S.poss[1] + '%.'; }
    const correct = [], wrong = [];
    (bet.factors || []).forEach((x) => { if (!x.value) return; ((x.value > 0) === won ? correct : wrong).push(x.label + ' (' + (x.value > 0 ? '+' : '') + x.value + ')'); });
    const err = (won ? 1 : 0) - bet.model;
    let lesson;
    if (won && bet.model < 0.5) lesson = 'Зіграла оцінка нижче 50%. Це радше дисперсія, ніж підтвердження моделі. Висновки можна робити лише на десятках схожих ставок.';
    else if (won) lesson = 'Результат збігся з оцінкою, але один результат не доводить перевагу. Варто стежити за статистикою на дистанції.';
    else if ((bet.risks || []).some((r) => /склад/i.test(r))) lesson = 'Перед матчем були ризики щодо складу. У схожих ситуаціях краще чекати підтверджених складів.';
    else if (bet.model >= 0.6) lesson = 'Висока ймовірність не захищає від дисперсії. Якщо такі програші повторюються на цьому ринку, модель може бути надто впевненою.';
    else lesson = 'Програш у межах очікуваного для такої ймовірності. Через один результат модель не змінюємо.';
    return { before, after, correct: correct.length ? correct : ['Жоден фактор чітко не збігся з результатом.'], wrong: wrong.length ? wrong : ['Жоден фактор чітко не суперечив результату.'], error: 'Помилка ймовірності: ' + (err > 0 ? '+' : '') + Math.round(err * 100) + ' п.п. (Brier ' + (err * err).toFixed(3).replace('.', ',') + '; 0 ідеально, 0,25 як підкидання монети).', lesson };
  }

  SIT.Model = {
    PROFILES, analyze, reasoning, against, aiPick, review, clearCache: () => cache.clear(),
    // Місце для LLM: якщо enabled, explain() може повертати текст пояснення.
    // Ключі API не можна зберігати у фронтенді, запит має йти через ваш сервер.
    llm: { enabled: false, explain: null }
  };
})();
