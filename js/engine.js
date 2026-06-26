/* =====================================================================
 * engine.js — question bank access: filtering, sampling, adaptive
 * selection, grid-answer checking, and full mock-test assembly.
 * ===================================================================== */
window.SAT = window.SAT || {};

SAT.engine = (function () {
  const bank = () => (window.SAT_QUESTIONS || []);

  /* ---- Filtering ------------------------------------------------- */
  function filter({ section, domains, types, difficulties, ids } = {}) {
    return bank().filter(q => {
      if (section && q.section !== section) return false;
      if (domains && domains.length && !domains.includes(q.domain)) return false;
      if (types && types.length && !types.includes(q.type)) return false;
      if (difficulties && difficulties.length && !difficulties.includes(q.difficulty)) return false;
      if (ids && ids.length && !ids.includes(q.id)) return false;
      return true;
    });
  }

  function byId(id) { return bank().find(q => q.id === id); }
  function count(crit) { return filter(crit).length; }

  /* Deterministic-ish shuffle (Fisher–Yates with a seeded PRNG so a
   * given session is stable but sessions differ). */
  function shuffle(arr, seed) {
    const a = arr.slice();
    let s = (seed == null ? Math.floor(performance.now()) : seed) >>> 0 || 1;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sample(crit, n, seed) {
    return shuffle(filter(crit), seed).slice(0, n);
  }

  /* ---- Adaptive practice selection ------------------------------
   * Builds a set that over-weights the user's weak domains and nudges
   * difficulty toward where they are losing points. */
  function adaptiveSet(section, n) {
    const weak = SAT.store.weakestDomains(section, 3);
    const all = filter({ section });
    if (!all.length) return [];
    const weakNames = new Set(weak.slice(0, 2).map(w => w.domain));
    // Score each candidate: weak domain + unseen recently + difficulty bias.
    const seen = new Set(SAT.store.state.attempts.slice(-60).map(a => a.qid));
    const scored = all.map(q => {
      let w = 1;
      if (weakNames.has(q.domain)) w += 2.2;
      if (!seen.has(q.id)) w += 1.2;
      if (q.difficulty === 'medium') w += 0.4;
      if (q.difficulty === 'hard') w += 0.6;        // push toward the hard path
      return { q, w: w * (0.6 + 0.8 * pseudo(q.id)) };
    });
    scored.sort((a, b) => b.w - a.w);
    return scored.slice(0, n).map(s => s.q);
  }

  function pseudo(id) { // stable [0,1) from an id string
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000;
  }

  /* ---- Endless ladder (streak mode) -----------------------------
   * Difficulty ramps with the current streak length, mixing sections
   * randomly. Picks a question not already seen this run; falls back to
   * adjacent difficulties / the other section when a pool is exhausted. */
  function streakDifficulty(n) {
    return n < 3 ? 'easy' : n < 7 ? 'medium' : 'hard';
  }
  function streakPick(n, excludeSet) {
    const ex = excludeSet || new Set();
    const diff = streakDifficulty(n);
    const diffOrder = diff === 'hard' ? ['hard', 'medium', 'easy']
      : diff === 'medium' ? ['medium', 'hard', 'easy']
        : ['easy', 'medium', 'hard'];
    const secs = Math.random() < 0.5 ? ['rw', 'math'] : ['math', 'rw'];
    for (const d of diffOrder) {
      for (const s of secs) {
        const pool = filter({ section: s, difficulties: [d] }).filter(q => !ex.has(q.id));
        if (pool.length) return shuffle(pool)[Math.floor(Math.random() * pool.length) % pool.length];
      }
    }
    // total exhaustion: any unseen question at all
    const any = bank().filter(q => !ex.has(q.id));
    return any.length ? shuffle(any)[0] : null;
  }

  /* ---- Grid (student-produced response) checking ----------------
   * Accepts the marked strings, plus tolerant numeric matching for
   * fractions/decimals. */
  function gridCorrect(q, value) {
    if (value == null) return false;
    const v = String(value).trim();
    const accept = q.accept || (q.answer != null ? [String(q.answer)] : []);
    if (accept.some(a => norm(a) === norm(v))) return true;
    const target = toNum(v);
    if (target == null) return false;
    return accept.some(a => {
      const t = toNum(a);
      return t != null && Math.abs(t - target) < 1e-6;
    });
  }
  function norm(s) { return String(s).replace(/\s+/g, '').toLowerCase(); }
  function toNum(s) {
    s = String(s).trim();
    if (/^-?\d+\/\d+$/.test(s)) { const [a, b] = s.split('/').map(Number); return b ? a / b : null; }
    if (/^-?\d*\.?\d+%?$/.test(s)) return parseFloat(s);
    return null;
  }

  function isCorrect(q, choice) {
    return q.format === 'grid' ? gridCorrect(q, choice) : choice === q.answer;
  }

  /* ---- Full mock assembly ---------------------------------------
   * Returns a structure the mock runner drives. Module 1 is a balanced
   * mix; module 2 is assembled at runtime once we know the route. */
  function buildMockSection(section, seed) {
    const cfg = SAT.config.sections[section];
    const per = cfg.questionsPerModule;
    // Module 1: balanced easy/medium (a few hard), domain-proportional.
    const m1 = pickBalanced(section, per, ['easy', 'easy', 'medium', 'medium', 'hard'], seed);
    return { section, per, module1: m1, _seed: seed };
  }

  // Assemble module 2 given the route, avoiding module-1 repeats.
  function buildModule2(section, route, exclude, seed) {
    const per = SAT.config.sections[section].questionsPerModule;
    const ex = new Set(exclude.map(q => q.id));
    const mix = route === 'hard'
      ? ['hard', 'hard', 'hard', 'medium']        // hard path: mostly hard
      : ['easy', 'easy', 'medium'];               // easy path: easier ceiling
    return pickBalanced(section, per, mix, seed + 7, ex);
  }

  // Pick `n` questions roughly proportional to domain weights, cycling
  // through a difficulty pattern, skipping excluded ids, with fallback.
  function pickBalanced(section, n, diffPattern, seed, exclude) {
    const ex = exclude || new Set();
    const domains = SAT.config.domains[section];
    const out = [];
    const used = new Set();
    // Build per-domain quotas.
    const quotas = domains.map(d => ({ d, q: Math.max(1, Math.round(d.weight * n)) }));
    let di = 0, pi = 0, guard = 0;
    while (out.length < n && guard++ < n * 40) {
      const slot = quotas[di % quotas.length];
      const diff = diffPattern[pi % diffPattern.length];
      const pool = filter({ section, domains: [slot.d.name], difficulties: [diff] })
        .filter(q => !ex.has(q.id) && !used.has(q.id));
      const cand = pool.length ? shuffle(pool, seed + di * 13 + pi)[0]
        : firstAvailable(section, ex, used, seed + di);
      if (cand) { out.push(cand); used.add(cand.id); }
      di++; if (di % quotas.length === 0) pi++;
    }
    return out.slice(0, n);
  }

  function firstAvailable(section, ex, used, seed) {
    const pool = filter({ section }).filter(q => !ex.has(q.id) && !used.has(q.id));
    return pool.length ? shuffle(pool, seed)[0] : null;
  }

  /* ---- Coverage report (for the dashboard) ---------------------- */
  function coverage() {
    const out = { rw: {}, math: {} };
    for (const sec of ['rw', 'math']) {
      for (const d of SAT.config.domains[sec]) {
        out[sec][d.name] = {
          easy: count({ section: sec, domains: [d.name], difficulties: ['easy'] }),
          medium: count({ section: sec, domains: [d.name], difficulties: ['medium'] }),
          hard: count({ section: sec, domains: [d.name], difficulties: ['hard'] }),
        };
      }
    }
    out.total = bank().length;
    return out;
  }

  return {
    bank, filter, byId, count, sample, shuffle, adaptiveSet,
    streakDifficulty, streakPick,
    gridCorrect, isCorrect,
    buildMockSection, buildModule2, pickBalanced, coverage,
  };
})();
