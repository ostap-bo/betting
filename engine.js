/* =====================================================================
   Sports Intelligence Terminal - engine.js
   DETERMINISTIC ANALYTICAL ENGINE (demo model)

   Each calculate*() function returns { value, detail, missing }.
   value is a signed integer in "model points" from the HOME side's
   perspective (or OVER perspective for totals). Positive = supports.

   The engine only reads public-style inputs: context (form, H2H,
   injuries...), current odds and news. It never reads match.truth.

   To plug in a real model or an LLM later, replace analyzeMatch() or
   individual calculate*() functions. Keep the return shapes the same.
   LLM hook: SIT.Engine.llm.explain(analysis) (see bottom).
   ===================================================================== */
(function () {
  'use strict';
  const SIT = window.SIT; const D = SIT.Data; const { clamp } = SIT.util;

  const CONFIG = {
    sideK: 0.0062,   // probability shift per model point (side markets)
    totalK: 0.007,   // probability shift per model point (totals)
    maxShift: 0.12,  // cap on model adjustment vs market
    profiles: {
      conservative: { label: 'Conservative', minEdge: 4, minConf: 60, kelly: 0.2, cap: 0.015, maxOdds: 3.2, maxPerScan: 2 },
      balanced: { label: 'Balanced', minEdge: 3, minConf: 52, kelly: 0.25, cap: 0.025, maxOdds: 4, maxPerScan: 3 },
      aggressive: { label: 'Aggressive', minEdge: 2, minConf: 45, kelly: 0.33, cap: 0.04, maxOdds: 5.5, maxPerScan: 5 }
    }
  };
  const TEAM_SPORTS = ['football', 'basketball', 'hockey', 'baseball', 'americanfootball'];
  const r0 = (x) => Math.round(x);
  const formStr = (g) => g.slice(0, 5).map((x) => x.res).join('');
  function ppg(games) { let s = 0, w = 0; games.slice(0, 5).forEach((x, i) => { const wt = 1 - i * 0.12; s += wt * (x.res === 'W' ? 3 : x.res === 'D' ? 1 : 0); w += wt; }); return s / w; }

  /* ---------------- side factors (home perspective) ---------------- */
  function calculateFormScore(m) {
    const a = ppg(m.ctx.formH), b = ppg(m.ctx.formA);
    return { key: 'form', label: 'Form', value: r0(clamp((a - b) * 2.6, -8, 8)), detail: m.home + ' ' + formStr(m.ctx.formH) + ' (' + a.toFixed(2) + ' pts/g) vs ' + m.away + ' ' + formStr(m.ctx.formA) + ' (' + b.toFixed(2) + ' pts/g), last 5, recency weighted' };
  }
  function calculateHomeAwayScore(m) {
    if (!TEAM_SPORTS.includes(m.sport)) return { key: 'homeaway', label: 'Home / Away', value: 0, missing: true, detail: 'Neutral venue. Not applicable.' };
    const H = m.ctx.splitH, A = m.ctx.splitA;
    const hw = (H.w + 0.5 * H.d) / H.n, aw = (A.w + 0.5 * A.d) / A.n;
    return { key: 'homeaway', label: 'Home advantage', value: r0(clamp((hw - aw) * 9, -6, 6)), detail: m.home + ' at home ' + H.w + '-' + H.d + '-' + H.l + ', ' + m.away + ' away ' + A.w + '-' + A.d + '-' + A.l + ' (last 10)' };
  }
  function calculateH2HScore(m) {
    const h = m.ctx.h2h; const n = h.length;
    if (!n) return { key: 'h2h', label: 'Head to head', value: 0, missing: true, detail: 'No previous meetings in the data set.' };
    const hw = h.filter((x) => x.aScore > x.bScore).length, aw = h.filter((x) => x.aScore < x.bScore).length;
    return { key: 'h2h', label: 'Head to head', value: r0(clamp(((hw - aw) / n) * 5 * Math.min(1, n / 5), -4, 4)), detail: m.home + ' ' + hw + 'W, ' + (n - hw - aw) + 'D, ' + aw + 'L in last ' + n + ' meetings' + (n < 3 ? ' (small sample)' : '') };
  }
  function lossShare(list, susp) { return list.reduce((a, p) => a + p.contrib * (p.status === 'Out' ? 1 : 0.4), 0) + susp.reduce((a, p) => a + p.contrib, 0); }
  function calculateInjuryImpact(m) {
    if (!TEAM_SPORTS.includes(m.sport)) return { key: 'injuries', label: 'Injuries', value: 0, missing: true, detail: 'No injury feed for individual sports in the demo provider.' };
    const c = m.ctx; const lh = lossShare(c.injuries.home, c.suspensions.home), la = lossShare(c.injuries.away, c.suspensions.away);
    return { key: 'injuries', label: 'Injuries & suspensions', value: r0(clamp((la - lh) / 6, -7, 7)), detail: 'Contribution unavailable: ' + m.home + ' ' + r0(lh) + '%, ' + m.away + ' ' + r0(la) + '% (doubtful weighted 40%)' };
  }
  function calculateRestScore(m) {
    if (m.sport === 'mma') return { key: 'rest', label: 'Rest', value: 0, missing: true, detail: 'Camp length unknown. Not applicable.' };
    const a = m.ctx.restH, b = m.ctx.restA;
    return { key: 'rest', label: 'Rest', value: r0(clamp(Math.min(a, 4) - Math.min(b, 4), -3, 3)), detail: m.home + ' ' + a + ' day(s) rest, ' + m.away + ' ' + b + ' day(s)' };
  }
  function calculateNewsImpact(m, now) {
    const items = D.newsForMatch(m, now).filter((n) => n.effect && ['rotation', 'fatigue', 'weight'].includes(n.type));
    let v = 0; items.forEach((n) => { if (n.effect.side === 'home') v += n.effect.pts; else if (n.effect.side === 'away') v -= n.effect.pts; });
    return { key: 'news', label: 'News', value: r0(clamp(v, -6, 6)), detail: items.length ? items.map((n) => n.headline).join('; ') : 'No rotation, fatigue or weigh-in news. Injury news is counted under Injuries.', missing: !items.length };
  }

  /* ---------------- totals factors (over perspective) ---------------- */
  const TOT_SCALE = { football: 0.6, hockey: 0.8, baseball: 1.3, basketball: 6, americanfootball: 5, tennis: 2.5, mma: 1 };
  function totalsFactors(m, line, now) {
    const c = m.ctx; const sc = TOT_SCALE[m.sport]; const out = [];
    if (m.sport === 'tennis') {
      const gap = Math.abs(ppg(c.formH) - ppg(c.formA));
      out.push({ key: 'balance', label: 'Competitive balance', value: r0(clamp((1.2 - gap) * 3, -5, 5)), detail: 'Form gap ' + gap.toFixed(2) + ' pts/g. Close matchups tend to produce more games.' });
      return out;
    }
    if (m.sport === 'mma') { out.push({ key: 'finish', label: 'Finish rates', value: 0, missing: true, detail: 'Insufficient data: finish-rate history not in demo feed.' }); return out; }
    const exp = (c.splitH.avgF + c.splitA.avgA) / 2 + (c.splitA.avgF + c.splitH.avgA) / 2;
    out.push({ key: 'scoring', label: 'Scoring profile', value: r0(clamp(((exp - line) / sc) * 3, -7, 7)), detail: 'Expected total from home/away splits: ' + exp.toFixed(1) + ' vs line ' + line });
    const rec = (c.formH.slice(0, 5).reduce((a, g) => a + g.f + g.a, 0) + c.formA.slice(0, 5).reduce((a, g) => a + g.f + g.a, 0)) / 10;
    out.push({ key: 'recent', label: 'Recent totals', value: r0(clamp(((rec - line) / sc) * 2, -5, 5)), detail: 'Average total in last 5 games of both sides: ' + rec.toFixed(1) });
    if (c.h2h.length >= 2) { const ht = c.h2h.reduce((a, g) => a + g.hs + g.as, 0) / c.h2h.length; out.push({ key: 'h2htot', label: 'H2H totals', value: r0(clamp(((ht - line) / sc) * 1.5, -3, 3)), detail: 'Average total in ' + c.h2h.length + ' meetings: ' + ht.toFixed(1) }); }
    else out.push({ key: 'h2htot', label: 'H2H totals', value: 0, missing: true, detail: 'Fewer than 2 meetings. Not used.' });
    const outs = [...c.injuries.home, ...c.injuries.away].filter((p) => p.status === 'Out').reduce((a, p) => a + p.contrib, 0);
    out.push({ key: 'absent', label: 'Absent scorers', value: -r0(clamp(outs / 10, 0, 5)), detail: 'Combined contribution of players ruled out: ' + outs + '%' });
    const wx = D.newsForMatch(m, now).filter((n) => n.effect && n.effect.totals && n.type !== 'injury');
    if (wx.length) out.push({ key: 'newstot', label: 'News (totals)', value: wx.reduce((a, n) => a + n.effect.totals, 0), detail: wx.map((n) => n.headline).join('; ') });
    return out;
  }

  function calculateMarketDiscrepancy(model, implied) {
    return { key: 'market', label: 'Market discrepancy', value: r0(clamp(((model - implied) * 100) / 2, -8, 8)), detail: 'Model ' + (model * 100).toFixed(1) + '% vs implied ' + (implied * 100).toFixed(1) + '% (with margin)' };
  }

  function calculateConfidence(m, factors, edge, extra) {
    const used = factors.filter((f) => !f.missing && f.key !== 'market');
    const completeness = used.length / Math.max(1, factors.filter((f) => f.key !== 'market').length);
    const strong = used.filter((f) => Math.abs(f.value) >= 1);
    const dir = Math.sign(edge) || 1;
    const agreement = strong.length ? strong.filter((f) => Math.sign(f.value) === dir).length / strong.length : 0.4;
    let c = 28 + completeness * 22 + agreement * 30 + Math.min(10, Math.abs(edge * 100)) * 1.2;
    c -= (extra.doubtful || 0) * 3; if (extra.noLineup) c -= 4; if (m.ctx.h2h.length < 3) c -= 3;
    c = r0(clamp(c, 18, 88));
    return { value: c, level: c >= 66 ? 'High' : c >= 50 ? 'Medium' : 'Low', agreement, completeness };
  }

  /* ---------------- risk engine ---------------- */
  function riskEngine(m, sel, factors, ctxInfo, now) {
    const risks = []; const c = m.ctx;
    const add = (key, label, detail, sev) => risks.push({ key, label, detail, sev });
    if (c.h2h.length < 3) add('sample', 'Small sample', 'Only ' + c.h2h.length + ' head-to-head meeting(s) available.', 1);
    const doubt = [...c.injuries.home, ...c.injuries.away].filter((p) => p.status === 'Doubtful');
    if (doubt.length) add('lineup', 'Uncertain lineup', doubt.map((p) => p.name + ' (' + p.reason + ')').join(', ') + ' doubtful.', 2);
    if (m.sport === 'football' && !c.lineups) add('lineup2', 'No projected lineup', 'Lineup feed has no data for this match yet.', 1);
    const news = D.newsForMatch(m, now);
    const recentInj = news.filter((n) => n.type === 'injury' && (now - n.time) < 48 * 3600e3);
    if (recentInj.length) add('injury', 'Recent injury news', recentInj.map((n) => n.entity).join(', ') + ' ruled out within the last 48h. Market may still be adjusting.', 2);
    if (news.some((n) => n.type === 'rotation')) add('rotation', 'Rotation risk', 'Coach signalled squad changes before a European fixture.', 2);
    if (news.some((n) => n.type === 'weight' || n.type === 'fatigue')) add('fitness', 'Fitness question', 'Weigh-in or fatigue news adds uncertainty to performance.', 2);
    const move = Math.abs(sel.odds - sel.open) / sel.open;
    if (move > 0.08) add('volatile', 'Volatile market', 'Price moved ' + (move * 100).toFixed(0) + '% from opening (' + sel.open.toFixed(2) + ' to ' + sel.odds.toFixed(2) + ').', 2);
    const pos = factors.filter((f) => f.key !== 'market' && f.value >= 3), neg = factors.filter((f) => f.key !== 'market' && f.value <= -3);
    if (pos.length && neg.length) add('conflict', 'Conflicting signals', 'Strong factors point both ways: ' + pos.map((f) => f.label).join(', ') + ' vs ' + neg.map((f) => f.label).join(', ') + '.', 2);
    if (sel.odds >= 3) add('variance', 'High variance price', 'At odds of ' + sel.odds.toFixed(2) + ' most outcomes lose even when the estimate is right.', 2);
    if (ctxInfo.edge > 0.1) add('gap', 'Large model-market gap', 'A gap above 10 points is more often a model blind spot than a market error.', 2);
    if (c.table && c.table.played <= 8 && m.sport === 'football') add('early', 'Early season', 'Only ' + c.table.played + ' rounds played. Standings and form are noisy.', 1);
    if (D.status(m, now) === 'live') add('live', 'In-play', 'Live prices move fast and the demo feed is delayed.', 2);
    const score = risks.reduce((a, r) => a + r.sev, 0);
    return { risks, level: score <= 2 ? 'Low' : score <= 6 ? 'Medium' : 'High', score };
  }

  /* ---------------- main analysis ---------------- */
  const cache = {};
  function analyzeMatch(m, now) {
    now = now == null ? SIT.clock.now() : now;
    const key = m.id + '|' + Math.floor(now / 600000);
    if (cache[key]) return cache[key];
    const side = [calculateFormScore(m), calculateHomeAwayScore(m), calculateH2HScore(m), calculateInjuryImpact(m), calculateRestScore(m), calculateNewsImpact(m, now)];
    const S = side.reduce((a, f) => a + f.value, 0);
    const mkts = D.markets(m, now);
    const doubtful = [...m.ctx.injuries.home, ...m.ctx.injuries.away].filter((p) => p.status === 'Doubtful').length;
    const extra = { doubtful, noLineup: m.sport === 'football' && !m.ctx.lineups };
    const out = { matchId: m.id, at: now, sideFactors: side, sideScore: S, markets: [] };

    mkts.forEach((mk) => {
      const inv = mk.sels.map((s) => 1 / s.odds); const over = inv.reduce((a, b) => a + b, 0);
      const fair = inv.map((x) => x / over);
      let model = fair.slice(); let facs = [];
      if (mk.key === '1X2' || mk.key === 'ML') {
        const shift = clamp(S * CONFIG.sideK, -CONFIG.maxShift, CONFIG.maxShift);
        model = mk.sels.map((s, i) => s.key === 'home' ? fair[i] + shift : s.key === 'away' ? fair[i] - shift : fair[i] - Math.abs(shift) * 0.4);
        facs = mk.sels.map((s) => s.key === 'home' ? side : s.key === 'away' ? side.map((f) => Object.assign({}, f, { value: -f.value })) : [{ key: 'closeness', label: 'Closeness', value: r0(clamp(3 - Math.abs(S) / 2, -4, 3)), detail: 'Combined side score ' + S + '. Draws are more likely when signals are balanced.' }]);
      } else if (mk.key === 'OU' || mk.key === 'BTTS') {
        const tf = totalsFactors(m, mk.key === 'OU' ? mk.line : (m.sport === 'football' ? 2.5 : mk.line), now);
        const So = tf.reduce((a, f) => a + f.value, 0) * (mk.key === 'BTTS' ? 0.6 : 1);
        const shift = clamp(So * CONFIG.totalK, -CONFIG.maxShift, CONFIG.maxShift);
        model = mk.sels.map((s, i) => (s.key === 'over' || s.key === 'yes') ? fair[i] + shift : fair[i] - shift);
        facs = mk.sels.map((s) => (s.key === 'over' || s.key === 'yes') ? tf : tf.map((f) => Object.assign({}, f, { value: -f.value })));
        out.totalFactors = out.totalFactors || tf;
      }
      model = model.map((p) => clamp(p, 0.02, 0.97)); const ms = model.reduce((a, b) => a + b, 0); model = model.map((p) => p / ms);
      const sels = mk.sels.map((s, i) => {
        const implied = 1 / s.odds; const edge = model[i] - implied;
        const factors = facs[i].concat([calculateMarketDiscrepancy(model[i], implied)]);
        const conf = calculateConfidence(m, factors, edge, extra);
        const sel = { mk: mk.key, mkName: mk.name, line: mk.line, key: s.key, label: s.label, odds: s.odds, open: s.open, implied, fair: fair[i], model: model[i], value: edge, ev: model[i] * s.odds - 1, factors, conf };
        sel.score = r0(clamp(50 + factors.reduce((a, f) => a + f.value, 0) * 2.2, 1, 99));
        sel.risk = riskEngine(m, sel, factors, { edge }, now);
        sel.positives = factors.filter((f) => f.value > 0 && f.key !== 'market').sort((a, b) => b.value - a.value);
        sel.negatives = factors.filter((f) => f.value < 0).sort((a, b) => a.value - b.value);
        let rs, ag; // lazy: only built when displayed
        Object.defineProperty(sel, 'reasoning', { enumerable: true, get() { return rs || (rs = reasoningText(m, sel)); } });
        Object.defineProperty(sel, 'against', { enumerable: true, get() { return ag || (ag = againstArgs(m, sel)); } });
        return sel;
      });
      out.markets.push({ key: mk.key, name: mk.name, line: mk.line, sels });
    });
    const all = out.markets.flatMap((x) => x.sels).filter((s) => s.key !== 'draw');
    out.best = all.slice().sort((a, b) => (b.value * (0.5 + b.conf.value / 100)) - (a.value * (0.5 + a.conf.value / 100)))[0];
    out.categories = categorize(m, out.best, now);
    out.interest = r0(clamp(40 + out.best.value * 400 + (out.best.conf.value - 50) * 0.6 + (out.categories.length * 4), 1, 99));
    return (cache[key] = out);
  }

  function selName(m, sel) { return sel.mk === 'BTTS' ? 'Both teams to score: ' + sel.label : sel.label; }
  function reasoningText(m, sel) {
    const p = (x) => (x * 100).toFixed(0) + '%';
    const top = sel.positives.slice(0, 2).map((f) => f.label.toLowerCase() + ' (+' + f.value + ')').join(' and ');
    const bad = sel.negatives.filter((f) => f.key !== 'market').slice(0, 2).map((f) => f.label.toLowerCase() + ' (' + f.value + ')').join(' and ');
    let s = 'Model rates ' + selName(m, sel) + ' at ' + p(sel.model) + ' against ' + p(sel.implied) + ' implied by odds of ' + sel.odds.toFixed(2) + '. ';
    s += top ? 'Main drivers: ' + top + '. ' : 'No single factor stands out; the estimate stays close to the market. ';
    if (bad) s += 'Counterweights: ' + bad + '. ';
    s += 'This is an internal model estimate, not a certainty.';
    return s;
  }
  function againstArgs(m, sel) {
    const a = sel.negatives.filter((f) => f.key !== 'market').map((f) => f.label + ': ' + f.detail);
    sel.risk.risks.forEach((r) => a.push(r.label + ': ' + r.detail));
    a.push('Market consensus: bookmakers price this at ' + (sel.implied * 100).toFixed(0) + '% using the same public information, plus information the model does not see.');
    if (sel.conf.agreement < 0.6) a.push('Signal agreement is only ' + r0(sel.conf.agreement * 100) + '%, so the edge depends on a minority of factors.');
    return a;
  }
  function categorize(m, best, now) {
    const cats = []; const st = D.status(m, now);
    if (best.value >= 0.03) cats.push('discrepancy');
    if (best.conf.value >= 66) cats.push('confidence');
    if (best.factors.some((f) => (f.key === 'form' || f.key === 'h2h' || f.key === 'scoring') && Math.abs(f.value) >= 5)) cats.push('signal');
    if (best.odds >= 2.8 || best.risk.level === 'High') cats.push('variance');
    if (D.newsForMatch(m, now).some((n) => n.impact !== 'LOW') || Math.abs(best.odds - best.open) / best.open > 0.08) cats.push('interesting');
    if (st === 'live') cats.push('live');
    return cats;
  }

  /* ---------------- AI staking policy ---------------- */
  function aiDecision(analysis, bankroll, profileKey) {
    const P = CONFIG.profiles[profileKey] || CONFIG.profiles.balanced; const s = analysis.best;
    if (!s) return { bet: false, why: 'No selection' };
    if (s.value * 100 < P.minEdge) return { bet: false, why: 'Edge ' + (s.value * 100).toFixed(1) + 'pp below ' + P.minEdge + 'pp threshold' };
    if (s.conf.value < P.minConf) return { bet: false, why: 'Confidence ' + s.conf.value + ' below ' + P.minConf };
    if (s.odds > P.maxOdds || s.odds < 1.3) return { bet: false, why: 'Odds outside allowed range' };
    if (s.risk.level === 'High' && profileKey !== 'aggressive') return { bet: false, why: 'Risk level High' };
    const kelly = (s.model * s.odds - 1) / (s.odds - 1);
    const frac = Math.min(P.cap, Math.max(0, kelly * P.kelly));
    const stake = Math.max(2, Math.round(bankroll * frac * 2) / 2);
    return { bet: true, stake, kelly, frac, sel: s };
  }

  /* ---------------- post-match review ---------------- */
  function review(bet, m) {
    const won = bet.status === 'won'; const p = bet.modelProb; const o = won ? 1 : 0;
    const brier = (p - o) * (p - o); const R = m.result;
    const before = 'Expected ' + bet.selection + ' (' + bet.market + ') with model probability ' + (p * 100).toFixed(0) + '% vs market ' + (bet.impliedProb * 100).toFixed(0) + '%. Drivers: ' + (bet.factors.filter((f) => f.value > 0 && f.key !== 'market').slice(0, 3).map((f) => f.label + ' +' + f.value).join(', ') || 'none dominant') + '.';
    let after = 'Final: ' + m.home + ' vs ' + m.away + ' ' + D.scoreText(m) + '. Selection ' + (won ? 'won' : 'lost') + '.';
    if (m.sport === 'football' && m.liveTotals) after += ' Shots ' + m.liveTotals.shots[0] + '-' + m.liveTotals.shots[1] + ', possession ' + m.liveTotals.poss + '-' + (100 - m.liveTotals.poss) + '.';
    const correct = [], wrong = [];
    const sideBet = bet.marketKey === '1X2' || bet.marketKey === 'ML';
    bet.factors.filter((f) => f.key !== 'market' && Math.abs(f.value) >= 2).forEach((f) => {
      const supported = f.value > 0;
      (supported === won ? correct : wrong).push(f.label + ' (' + (f.value > 0 ? '+' : '') + f.value + ') ' + (supported === won ? 'pointed the right way.' : 'pointed the wrong way.'));
    });
    if (!sideBet && bet.line != null) {
      const diff = R.total - bet.line;
      (won ? correct : wrong).push('Final total ' + R.total + ' vs line ' + bet.line + ' (' + (diff > 0 ? '+' : '') + diff.toFixed(1) + ').');
    }
    if (bet.risks && bet.risks.length && !won) wrong.push('Pre-match risks flagged: ' + bet.risks.map((r) => r.label).join(', ') + '.');
    if (!correct.length) correct.push('No individual factor clearly matched the outcome.');
    if (!wrong.length) wrong.push('No factor clearly contradicted the outcome.');
    const err = 'Brier score ' + brier.toFixed(3) + ' (0 = perfect, 0.25 = coin flip baseline at 50%). Probability error: ' + ((o - p) * 100 > 0 ? '+' : '') + ((o - p) * 100).toFixed(0) + ' pts.';
    let lesson;
    if (won && p < 0.5) lesson = 'A sub-50% estimate landed. Treat as variance, not confirmation. Only aggregate calibration over 30+ similar bets says something about the model.';
    else if (won) lesson = 'Outcome matched the estimate. One result does not validate the edge; track closing-line value and calibration by market.';
    else if (bet.risks && bet.risks.some((r) => r.key === 'lineup' || r.key === 'rotation')) lesson = 'Lineup uncertainty was flagged before kick-off. Consider requiring confirmed lineups before staking in similar spots.';
    else if (p >= 0.6) lesson = 'High model probability did not protect against variance. Check whether this market is over-confident in the calibration table before adjusting weights.';
    else lesson = 'Loss within expected range for this probability. No weight change suggested from a single result.';
    return { before, after, correct, wrong, modelError: err, brier, lesson };
  }

  SIT.Engine = {
    CONFIG, analyzeMatch, aiDecision, review,
    clearCache() { Object.keys(cache).forEach((k) => delete cache[k]); },
    calculateFormScore, calculateHomeAwayScore, calculateH2HScore, calculateInjuryImpact, calculateRestScore, calculateNewsImpact, calculateMarketDiscrepancy, calculateConfidence, riskEngine,
    /* LLM hook: replace with a real call (e.g. fetch to your backend that calls an LLM).
       Must resolve to { summary, bullets[] }. Keep facts and interpretation separate. */
    llm: {
      enabled: false,
      async explain(match, analysis) { return { summary: analysis.best.reasoning, bullets: analysis.best.against.slice(0, 3) }; }
    }
  };
})();
