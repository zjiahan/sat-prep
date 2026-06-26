/* Validates the question bank against the config taxonomy and reports
 * coverage (so you can see if there are enough items for full mocks).
 * Run: node test/verify-bank.js  */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = {};
sandbox.window = sandbox;
sandbox.performance = { now: () => 0, timeOrigin: 0 };
sandbox.console = console;
vm.createContext(sandbox);
for (const f of ['js/config.js', 'data/questions.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}

const Q = sandbox.SAT_QUESTIONS || [];
const cfg = sandbox.SAT.config;
let errors = 0, warns = 0;
const err = m => { errors++; console.error('  ✗ ' + m); };
const warn = m => { warns++; console.warn('  ! ' + m); };

// per-question validation
const seenIds = new Set();
const seenPrompts = new Set();
for (const q of Q) {
  const tag = q.id || '(no id)';
  if (!q.id) err('question missing id');
  else if (seenIds.has(q.id)) err('duplicate id: ' + q.id);
  else seenIds.add(q.id);

  if (!['rw', 'math'].includes(q.section)) { err(tag + ': bad section'); continue; }
  if (!cfg.allDomains(q.section).includes(q.domain)) err(tag + ': domain not in taxonomy: ' + q.domain);
  else if (!cfg.allTypes(q.section).includes(q.type)) warn(tag + ': type not in taxonomy: ' + q.type);
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) err(tag + ': bad difficulty');
  if (!q.prompt) err(tag + ': missing prompt');
  if (!q.explanation) err(tag + ': missing explanation');

  if (q.format === 'mc') {
    if (!Array.isArray(q.choices) || q.choices.length < 2) err(tag + ': mc needs >=2 choices');
    else if (q.choices.length !== 4) warn(tag + ': mc has ' + q.choices.length + ' choices (expected 4)');
    if (!Number.isInteger(q.answer) || q.answer < 0 || (q.choices && q.answer >= q.choices.length)) err(tag + ': mc answer index out of range');
    if (q.choices && new Set(q.choices.map(c => String(c).trim())).size !== q.choices.length) warn(tag + ': duplicate choice text');
  } else if (q.format === 'grid') {
    if (!Array.isArray(q.accept) || q.accept.length === 0) err(tag + ': grid needs accept[]');
  } else err(tag + ': bad format ' + q.format);

  if (q.figure) {
    if (!Array.isArray(q.figure.headers) || !Array.isArray(q.figure.rows)) err(tag + ': malformed figure');
  }
  if (q.prompt) {
    // R&W reuses standard prompt stems by design, so key on the full
    // stimulus too — only flag genuinely identical items.
    const body = (q.passage || '') + '|' + (q.figure ? JSON.stringify(q.figure.rows) : '') +
      '|' + q.prompt + '|' + (q.choices ? q.choices.join('~') : (q.accept || []).join('~'));
    const key = q.section + '|' + body;
    if (seenPrompts.has(key)) warn(tag + ': exact-duplicate question');
    else seenPrompts.add(key);
  }
}

// coverage report
console.log('\nCoverage:');
for (const sec of ['rw', 'math']) {
  console.log('  ' + sec.toUpperCase());
  for (const d of cfg.domains[sec]) {
    const cnt = { easy: 0, medium: 0, hard: 0 };
    Q.filter(q => q.section === sec && q.domain === d.name).forEach(q => cnt[q.difficulty]++);
    console.log(`    ${d.name.padEnd(34)} easy ${cnt.easy}  med ${cnt.medium}  hard ${cnt.hard}`);
  }
  const per = cfg.sections[sec].questionsPerModule;
  const easyMed = Q.filter(q => q.section === sec && q.difficulty !== 'hard').length;
  const hard = Q.filter(q => q.section === sec && q.difficulty === 'hard').length;
  const mockReady = easyMed >= per && (easyMed + hard) >= per * 2 - 4;
  console.log(`    -> ${Q.filter(q => q.section === sec).length} total; full mock ready: ${mockReady ? 'YES' : 'NO (need more)'}`);
}

console.log(`\nTotal questions: ${Q.length}`);
console.log(`${errors} errors, ${warns} warnings`);
process.exit(errors ? 1 : 0);
