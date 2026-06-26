/* Integrate the content-generation workflow output into the app's data
 * files. Merges the curated seed with the verified generated bank/lessons.
 *
 * Usage: node scripts/integrate.js <path-to-workflow-output.json>
 * The output file is the background task's result file (JSON with a
 * `.result` of { questions, lessons, counts }), or a bare result object.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const outPath = process.argv[2];
if (!outPath) { console.error('usage: node scripts/integrate.js <result.json>'); process.exit(1); }

// ---- parse the workflow result (robust to wrapper shapes) ----
let raw = fs.readFileSync(outPath, 'utf8');
let top;
try { top = JSON.parse(raw); } catch (e) { console.error('not JSON:', e.message); process.exit(1); }
let result = top.result != null ? top.result : top;
if (typeof result === 'string') { try { result = JSON.parse(result); } catch (e) {} }
const gen = result || {};
const genQ = Array.isArray(gen.questions) ? gen.questions : [];
const genL = Array.isArray(gen.lessons) ? gen.lessons : [];
console.log(`generated: ${genQ.length} questions, ${genL.length} lessons`);

// ---- load existing seed by evaluating the current data files ----
function evalData() {
  const sandbox = { window: {}, performance: { now: () => 0, timeOrigin: 0 }, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/questions.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/lessons.js'), 'utf8'), sandbox);
  return { q: sandbox.SAT_QUESTIONS || [], l: sandbox.SAT_LESSONS || [] };
}
const seed = evalData();
const seedQ = seed.q.filter(q => String(q.id).startsWith('s-'));   // keep only curated seed
const seedL = seed.l;
console.log(`seed: ${seedQ.length} questions, ${seedL.length} lessons`);

// ---- merge (dedup by id; seed first, then generated) ----
function mergeById(a, b) {
  const out = [], seen = new Set();
  for (const x of [...a, ...b]) {
    if (!x || !x.id || seen.has(x.id)) continue;
    seen.add(x.id); out.push(x);
  }
  return out;
}
// normalize generated questions defensively
const cleanGenQ = genQ.filter(q => {
  if (!q || !q.id || !q.section || !q.prompt || !q.explanation) return false;
  if (q.format === 'mc') return Array.isArray(q.choices) && q.choices.length >= 2 && Number.isInteger(q.answer);
  if (q.format === 'grid') return Array.isArray(q.accept) && q.accept.length > 0;
  return false;
});

const allQ = mergeById(seedQ, cleanGenQ);
const allL = mergeById(seedL, genL);

// ---- write data files ----
const qHeader = `/* =====================================================================
 * questions.js — the question bank (window.SAT_QUESTIONS).
 * Curated seed (s-*) + verified auto-generated items (g-*).
 * Generated items each passed independent adversarial re-solve verification.
 * Loaded as a plain script so the app runs from file:// with no server.
 * ===================================================================== */
window.SAT_QUESTIONS = `;
const lHeader = `/* =====================================================================
 * lessons.js — strategy & concept lessons (window.SAT_LESSONS).
 * Curated seed + auto-generated lessons. Loaded as a plain script.
 * ===================================================================== */
window.SAT_LESSONS = `;

fs.writeFileSync(path.join(ROOT, 'data/questions.js'), qHeader + JSON.stringify(allQ, null, 2) + ';\n');
fs.writeFileSync(path.join(ROOT, 'data/lessons.js'), lHeader + JSON.stringify(allL, null, 2) + ';\n');

const bySec = s => allQ.filter(q => q.section === s).length;
console.log(`\nwrote data/questions.js: ${allQ.length} questions (rw ${bySec('rw')}, math ${bySec('math')})`);
console.log(`wrote data/lessons.js: ${allL.length} lessons`);
