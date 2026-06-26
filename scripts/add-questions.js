/* Append a verified question batch to the existing bank (additive).
 * Unlike scripts/integrate.js (which rebuilds), this PRESERVES every
 * current question, dedupes new items against the bank by content, and
 * assigns fresh sequential g-<section>-NNN ids.
 *
 * Usage: node scripts/add-questions.js <workflow-output.json>
 * Re-runnable: run it again after each new generation batch to keep growing.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const outPath = process.argv[2];
if (!outPath) { console.error('usage: node scripts/add-questions.js <result.json>'); process.exit(1); }

// ---- parse workflow result ----
let top;
try { top = JSON.parse(fs.readFileSync(outPath, 'utf8')); }
catch (e) { console.error('cannot read/parse result:', e.message); process.exit(1); }
let result = top.result != null ? top.result : top;
if (typeof result === 'string') { try { result = JSON.parse(result); } catch (e) {} }
const genQ = Array.isArray(result && result.questions) ? result.questions : [];
console.log(`generated batch: ${genQ.length} questions`);

// ---- load existing bank ----
const sb = { performance: { now: () => 0, timeOrigin: 0 }, console };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/questions.js'), 'utf8'), sb);
const existing = sb.SAT_QUESTIONS || [];
console.log(`existing bank: ${existing.length} questions`);

// ---- dedup signature + next id index ----
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const sig = q => [q.section, norm(q.passage), norm(q.prompt),
  (q.choices ? q.choices.map(norm).join('|') : (q.accept || []).map(norm).join('|'))].join('::');
const seen = new Set(existing.map(sig));

const nextIdx = { rw: 1, math: 1 };
for (const q of existing) {
  const m = String(q.id).match(/^g-(rw|math)-(\d+)$/);
  if (m) { const n = +m[2]; if (n >= nextIdx[m[1]]) nextIdx[m[1]] = n + 1; }
}

// ---- append ----
let added = 0, dups = 0, bad = 0;
const appended = [];
for (const q of genQ) {
  if (!q || !['rw', 'math'].includes(q.section) || !q.prompt || !q.explanation) { bad++; continue; }
  if (q.format === 'mc') {
    if (!Array.isArray(q.choices) || q.choices.length < 2 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) { bad++; continue; }
  } else if (q.format === 'grid') {
    if (!Array.isArray(q.accept) || q.accept.length === 0) { bad++; continue; }
  } else { bad++; continue; }

  const s = sig(q);
  if (seen.has(s)) { dups++; continue; }
  seen.add(s);

  let figure = null;
  if (q.figure && Array.isArray(q.figure.headers) && Array.isArray(q.figure.rows) && q.figure.rows.length) {
    figure = { type: 'table', title: q.figure.title || '', headers: q.figure.headers, rows: q.figure.rows };
  }
  const id = 'g-' + q.section + '-' + String(nextIdx[q.section]++).padStart(3, '0');
  appended.push({
    id, section: q.section, domain: q.domain, type: q.type, difficulty: q.difficulty,
    passage: q.passage && q.passage.trim() ? q.passage.trim() : undefined,
    figure: figure || undefined,
    prompt: q.prompt, format: q.format,
    choices: q.format === 'mc' ? q.choices : undefined,
    answer: q.format === 'mc' ? q.answer : undefined,
    accept: q.format === 'grid' ? q.accept : undefined,
    explanation: q.explanation,
  });
  added++;
}

const all = existing.concat(appended);
const header = `/* =====================================================================
 * questions.js — the question bank (window.SAT_QUESTIONS).
 * Curated seed (s-*) + verified auto-generated items (g-*).
 * Each generated item passed independent adversarial re-solve verification.
 * Loaded as a plain script so the app runs from file:// with no server.
 * ===================================================================== */
window.SAT_QUESTIONS = `;
fs.writeFileSync(path.join(ROOT, 'data/questions.js'), header + JSON.stringify(all, null, 2) + ';\n');

const bySec = s => all.filter(q => q.section === s).length;
console.log(`\nadded ${added}, skipped ${dups} duplicates, ${bad} malformed`);
console.log(`bank now ${all.length} questions (rw ${bySec('rw')}, math ${bySec('math')})`);
