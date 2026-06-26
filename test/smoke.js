/* Smoke test: load the app in a real DOM (jsdom), render every route,
 * and simulate answering a question. Run: npm test  */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };

// ---- Build a DOM and load the app the way index.html does ----
const errors = [];
const { window } = new JSDOM(
  '<!DOCTYPE html><html data-theme="dark"><head></head><body><div id="app"></div></body></html>',
  { url: 'file://' + ROOT + '/index.html', pretendToBeVisual: true, runScripts: 'outside-only' }
);
window.onerror = (m) => errors.push(m);
window.scrollTo = () => {};
if (!window.performance) window.performance = {};
if (!window.performance.now) window.performance.now = () => Date.now();
if (window.performance.timeOrigin == null) window.performance.timeOrigin = Date.now();
// In-memory localStorage so persistence works during the test
let mem = {};
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
    clear: () => { mem = {}; },
  },
});
if (window.URL) window.URL.createObjectURL = () => 'blob:stub';

const FILES = [
  'data/questions.js', 'data/lessons.js',
  'js/config.js', 'js/store.js', 'js/scoring.js', 'js/ui.js', 'js/engine.js',
  'js/practice.js', 'js/mock.js', 'js/lessons.js', 'js/streak.js', 'js/dashboard.js', 'js/app.js',
];
for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  try { window.eval(code); }
  catch (e) { fail++; console.error('  ✗ load ' + f + ': ' + e.message); }
}
// app.js boots on DOMContentLoaded; (re)fire it now that scripts are loaded.
try { window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true })); } catch (e) {}

const { document } = window;
const SAT = window.SAT;
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
function go(hash) { window.location.hash = hash; window.dispatchEvent(new window.Event('hashchange')); }

// ---- Core objects ----
ok(SAT && SAT.config, 'SAT.config loaded');
ok(Array.isArray(window.SAT_QUESTIONS) && window.SAT_QUESTIONS.length >= 16, 'question bank loaded (' + (window.SAT_QUESTIONS || []).length + ')');
ok(Array.isArray(window.SAT_LESSONS) && window.SAT_LESSONS.length >= 4, 'lessons loaded (' + (window.SAT_LESSONS || []).length + ')');

// ---- Data integrity: every question is well-formed ----
let bad = 0;
for (const q of window.SAT_QUESTIONS) {
  const baseOk = q.id && q.section && q.domain && q.type && q.difficulty && q.prompt && q.explanation;
  const fmtOk = q.format === 'mc'
    ? (Array.isArray(q.choices) && q.choices.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length)
    : q.format === 'grid' ? (Array.isArray(q.accept) && q.accept.length > 0) : false;
  const domOk = SAT.config.allDomains(q.section).includes(q.domain);
  if (!(baseOk && fmtOk && domOk)) { bad++; if (bad <= 3) console.error('    bad q: ' + q.id); }
}
ok(bad === 0, bad + ' malformed questions');

// unique ids
const ids = window.SAT_QUESTIONS.map(q => q.id);
ok(new Set(ids).size === ids.length, 'question ids unique');

// ---- Shell rendered ----
ok($('.sidebar'), 'sidebar rendered');
ok($$('.nav-link').length === 7, 'seven nav links');
ok($('.hero'), 'home hero rendered');

// ---- Scoring sanity ----
ok(SAT.scoring.sectionScore('math', 1, 'hard') === 800, 'perfect math -> 800');
ok(SAT.scoring.sectionScore('rw', 1, 'hard') === 800, 'perfect rw -> 800');
ok(SAT.scoring.sectionScore('math', 1, 'easy') < 700, 'easy-path math capped < 700');
ok(SAT.scoring.sectionScore('rw', 0, 'hard') === 200, 'zero -> 200 floor');
ok(SAT.scoring.routeFor('math', 0.9) === 'hard' && SAT.scoring.routeFor('math', 0.2) === 'easy', 'routing thresholds');
const ms = SAT.scoring.mockSection('math', 20, 22, 20, 22);
ok(ms.scaled >= 750 && ms.route === 'hard', 'near-perfect mock section scores high (' + ms.scaled + ')');
ok(SAT.scoring.missesAllowed('math', 800) <= 3, 'few misses allowed for 800 math');

// ---- Engine ----
ok(SAT.engine.filter({ section: 'rw' }).length >= 8, 'engine filters rw');
ok(SAT.engine.sample({ section: 'math' }, 4).length === 4, 'engine samples 4 math');
ok(SAT.engine.gridCorrect({ accept: ['54'] }, '54') === true, 'grid exact match');
ok(SAT.engine.gridCorrect({ accept: ['3/2', '1.5'] }, '1.50') === true, 'grid numeric-equivalent match');
ok(SAT.engine.gridCorrect({ accept: ['54'] }, '53') === false, 'grid wrong rejected');
ok(SAT.engine.isCorrect({ format: 'mc', answer: 1 }, 1) === true, 'mc correct');

// ---- Routes render ----
go('#/practice'); ok($('.setup-grid'), 'practice setup renders');
{
  const btn40 = $$('.seg-btn').find(b => b.textContent === '40');
  ok(btn40, 'practice: count "40" button present');
  if (btn40) { btn40.click(); ok(/40/.test($('.avail').textContent), 'practice: changing the question count updates the availability text'); }
}
go('#/lessons'); ok($$('.lesson-card').length >= 4, 'lessons list renders');
go('#/lessons/adaptive'); ok($('.article') && /Module 1/.test($('.article').textContent), 'lesson detail renders');
go('#/progress'); ok($('.page'), 'progress renders (empty state)');
go('#/plan'); ok($('.plan-table'), 'study plan renders schedule');
go('#/mock'); ok($('.mock-cards'), 'mock intro renders');

// ---- Live practice interaction ----
const sampleQs = SAT.engine.sample({ section: 'rw', difficulties: ['easy', 'medium', 'hard'] }, 3);
SAT.views.practice._pending = { title: 'Test drill', section: 'rw', mode: 'drill', questions: sampleQs };
go('#/practice/run');
ok($('.question'), 'practice run shows a question');
const choices = $$('.choice');
ok(choices.length >= 2, 'question shows choices');
const before = SAT.store.totalAnswered();
if (choices.length) choices[0].click();
ok(SAT.store.totalAnswered() === before + 1, 'answering records an attempt');
ok($('.explanation'), 'explanation revealed after answering');
ok($('.run-foot .btn-primary'), 'next button appears');

// ---- Analytics after the attempt ----
go('#/progress');
ok($('.big-acc') || $('.dbar'), 'progress shows analytics after attempts');

// ---- Streak ladder ----
ok(SAT.engine.streakDifficulty(0) === 'easy' && SAT.engine.streakDifficulty(5) === 'medium' && SAT.engine.streakDifficulty(9) === 'hard', 'streak difficulty ramps');
ok(SAT.engine.streakPick(0, new Set()), 'streak picks a question');
go('#/streak');
ok($('.streak-board'), 'streak board renders');
ok($('.streak-slot .question'), 'streak shows a question');
function curStreakQ() { const n = $('.streak-slot .question'); return n ? SAT.engine.byId(n.dataset.qid) : null; }
function answerStreak(correct) {
  const q = curStreakQ(); if (!q) return;
  if (q.format === 'mc') {
    const idx = correct ? q.answer : (q.answer + 1) % q.choices.length;
    $$('.streak-slot .choice')[idx].click();
  } else {
    const inp = $('.streak-slot .grid-input');
    inp.value = correct ? q.accept[0] : '___wrong___';
    $('.streak-slot .grid-row button').click();
  }
}
answerStreak(true);
ok($('.run-foot .verdict-ok'), 'streak: correct answer keeps the run going');
ok(/^[1-9]/.test($('.streak-cur').textContent), 'streak: counter incremented to ' + $('.streak-cur').textContent);
$('.run-foot .btn-primary').click();           // Continue
ok($('.streak-slot .question'), 'streak: next question served');
const runsBefore = SAT.store.state.streak.runs;
answerStreak(false);
ok($('.streak-over'), 'streak: wrong answer ends the run');
ok(SAT.store.state.streak.runs === runsBefore + 1, 'streak: run recorded');
ok($('.run-foot .btn-primary'), 'streak: try-again offered');

// ---- Mock assembly logic (bank-size independent) ----
const msec = SAT.engine.buildMockSection('math', 123);
ok(Array.isArray(msec.module1) && msec.module1.length > 0, 'mock module 1 assembled');
const m2 = SAT.engine.buildModule2('math', 'hard', msec.module1, 123);
ok(Array.isArray(m2), 'mock module 2 assembled');
const ov = new Set(msec.module1.map(q => q.id));
ok(m2.length === 0 || m2.every(q => !ov.has(q.id)), 'module 2 avoids module 1 repeats');
const cov = SAT.engine.coverage();
ok(cov && cov.rw && cov.math, 'coverage report builds');

// ---- Live full mock: start it and render module 1 (UI path) ----
go('#/mock');
const beginBtn = $$('.mock-card .btn').find(b => !b.disabled);
ok(beginBtn, 'a mock can be started (enough questions in bank)');
if (beginBtn) {
  beginBtn.click();
  window.dispatchEvent(new window.Event('hashchange'));   // run via router (single render)
  ok($('.mock-top'), 'mock module renders the top bar');
  ok($('#mock-clock') && /^\d+:\d\d$/.test($('#mock-clock').textContent), 'mock clock renders mm:ss');
  ok($('.mock-slot .question'), 'mock shows a question (no difficulty hint)');
  ok(!$('.mock-slot .q-meta'), 'mock hides difficulty meta during the test');
  const navBtn = $$('.mock-top .btn').find(b => /navigator/i.test(b.textContent));
  ok(navBtn, 'navigator button present');
  if (navBtn) { navBtn.click(); ok($('.navgrid'), 'question navigator opens'); const x = $('.modal-x'); if (x) x.click(); }
  go('#/'); // leave the mock; lingering timer is guarded + killed on exit
}

// ---- No uncaught errors ----
ok(errors.length === 0, 'no uncaught window errors (' + errors.join('; ') + ')');

// ---- Report ----
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
