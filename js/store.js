/* =====================================================================
 * store.js — localStorage-backed persistence + analytics aggregation.
 * Holds: per-question attempts (the source of truth), an error log,
 * mock-test results, and user settings. Everything stays on-device.
 * ===================================================================== */
window.SAT = window.SAT || {};

SAT.store = (function () {
  const KEY = 'satprep.v1';

  const blank = () => ({
    createdAt: Date.now(),
    attempts: [],     // {id, qid, section, domain, type, difficulty, correct, choice, ts, mode, elapsedMs}
    errorLog: [],     // qids the user has missed and not yet "cleared"
    mocks: [],        // {id, ts, rw:{raw,scaled,route}, math:{raw,scaled,route}, total, detail}
    streak: { best: 0, runs: 0, lastLen: 0, bestTs: 0 },  // endless-ladder records
    settings: { theme: 'dark', timer: true, examDate: null },
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw);
      return Object.assign(blank(), parsed);
    } catch (e) {
      console.warn('store: load failed, starting fresh', e);
      return blank();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('store: save failed', e);
    }
  }

  /* ---- Attempts -------------------------------------------------- */
  function recordAttempt(a) {
    const entry = Object.assign({ id: uid(), ts: Date.now() }, a);
    state.attempts.push(entry);
    // Maintain the error log: add on miss, remove on a later correct.
    if (a.correct === false) {
      if (!state.errorLog.includes(a.qid)) state.errorLog.push(a.qid);
    } else if (a.correct === true) {
      state.errorLog = state.errorLog.filter(q => q !== a.qid);
    }
    save();
    return entry;
  }

  function recordMock(result) {
    const entry = Object.assign({ id: uid(), ts: Date.now() }, result);
    state.mocks.push(entry);
    save();
    return entry;
  }

  /* ---- Streak (endless ladder) ---------------------------------- */
  function recordStreakRun(len) {
    if (!state.streak) state.streak = { best: 0, runs: 0, lastLen: 0, bestTs: 0 };
    state.streak.runs++;
    state.streak.lastLen = len;
    const isRecord = len > state.streak.best;
    if (isRecord) { state.streak.best = len; state.streak.bestTs = Date.now(); }
    save();
    return { best: state.streak.best, isRecord };
  }
  function bestStreak() { return state.streak ? state.streak.best : 0; }

  /* ---- Settings -------------------------------------------------- */
  function setSetting(k, v) { state.settings[k] = v; save(); }
  function getSetting(k) { return state.settings[k]; }

  /* ---- Derived analytics ---------------------------------------- */
  // Accuracy + volume grouped by an attribute (e.g. 'domain','type','difficulty').
  function statsBy(attr, filter) {
    const out = {};
    for (const a of state.attempts) {
      if (filter && !filter(a)) continue;
      const k = a[attr];
      if (k == null) continue;
      out[k] = out[k] || { total: 0, correct: 0 };
      out[k].total++;
      if (a.correct) out[k].correct++;
    }
    for (const k in out) out[k].acc = out[k].total ? out[k].correct / out[k].total : 0;
    return out;
  }

  function sectionAccuracy(section) {
    const f = a => a.section === section;
    const total = state.attempts.filter(f).length;
    const correct = state.attempts.filter(a => f(a) && a.correct).length;
    return { total, correct, acc: total ? correct / total : 0 };
  }

  // Weakest domains by accuracy (minimum sample size to count).
  function weakestDomains(section, minN = 4) {
    const by = statsBy('domain', a => a.section === section);
    return Object.entries(by)
      .filter(([, v]) => v.total >= minN)
      .sort((a, b) => a[1].acc - b[1].acc)
      .map(([k, v]) => ({ domain: k, ...v }));
  }

  function totalAnswered() { return state.attempts.length; }

  // Recent activity for streaks / dashboard. Returns Map(dateStr -> count).
  function activityByDay() {
    const m = {};
    for (const a of state.attempts) {
      const d = new Date(a.ts);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      m[key] = (m[key] || 0) + 1;
    }
    return m;
  }

  function dayStreak() {
    const days = activityByDay();
    let streak = 0;
    const d = new Date();
    for (;;) {
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (days[key]) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function bestMock() {
    if (!state.mocks.length) return null;
    return state.mocks.reduce((a, b) => (b.total > a.total ? b : a));
  }

  function latestMock() {
    return state.mocks.length ? state.mocks[state.mocks.length - 1] : null;
  }

  /* ---- Maintenance ---------------------------------------------- */
  function clearErrorLogEntry(qid) {
    state.errorLog = state.errorLog.filter(q => q !== qid);
    save();
  }
  function resetAll() { state = blank(); save(); }
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(str) {
    const parsed = JSON.parse(str);
    state = Object.assign(blank(), parsed);
    save();
  }

  function uid() {
    return 'a' + Math.floor(performance.now() * 1000).toString(36) + Math.floor(performance.timeOrigin).toString(36).slice(-4);
  }

  return {
    get state() { return state; },
    recordAttempt, recordMock, recordStreakRun, bestStreak,
    setSetting, getSetting,
    statsBy, sectionAccuracy, weakestDomains, totalAnswered,
    activityByDay, dayStreak, bestMock, latestMock,
    clearErrorLogEntry, resetAll, exportJSON, importJSON,
  };
})();
