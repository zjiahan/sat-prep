/* =====================================================================
 * dashboard.js — Home, Progress (analytics), and Study Plan views.
 * ===================================================================== */
window.SAT = window.SAT || {};
SAT.views = SAT.views || {};

/* ---------------- HOME ---------------- */
SAT.views.home = function (root) {
  const { el, clearNode, pct } = SAT.ui;
  clearNode(root);
  const t = SAT.config.targets;
  const page = el('div', { class: 'page' });

  const latest = SAT.store.latestMock();
  const best = SAT.store.bestMock();

  page.appendChild(el('div', { class: 'hero' },
    el('h1', null, 'Your road to ', el('span', { class: 'accent' }, '1500+')),
    el('p', { class: 'subtle' }, 'Target: ', el('strong', null, '700+'), ' Reading & Writing and a perfect ',
      el('strong', null, '800'), ' Math. This trainer is built around the digital SAT’s adaptive format — the only way to the top is clearing Module 1 to unlock the hard Module 2.'),
  ));

  // Target tracker
  const tcard = el('div', { class: 'card target-card' });
  tcard.appendChild(el('h3', null, 'Where you stand'));
  if (best) {
    tcard.appendChild(targetRow('Total', best.total, t.total, 400, 1600));
    if (best.rw) tcard.appendChild(targetRow('Reading & Writing', best.rw.scaled, t.rw, 200, 800));
    if (best.math) tcard.appendChild(targetRow('Math', best.math.scaled, t.math, 200, 800));
    tcard.appendChild(el('p', { class: 'subtle small' }, 'Best mock so far. ' + (latest && latest !== best ? 'Most recent: ' + latest.total + '.' : '')));
  } else {
    tcard.appendChild(el('p', { class: 'subtle' }, 'Take a full mock to get a baseline score. Until then, here’s what your targets require:'));
    tcard.appendChild(needRow('Reading & Writing', 'rw', t.rw));
    tcard.appendChild(needRow('Math', 'math', t.math));
  }
  page.appendChild(tcard);

  // Quick actions
  const qa = el('div', { class: 'quick-actions' });
  qa.appendChild(action('Adaptive practice', 'Drill your weak spots, 10 questions', '#/practice', 'primary'));
  qa.appendChild(action('Streak ladder 🔥', 'Endless mixed drill — beat your best of ' + SAT.store.bestStreak(), '#/streak'));
  qa.appendChild(action('Full mock test', 'Timed, adaptive, scored', '#/mock'));
  qa.appendChild(action('Lessons', 'Strategy + question-type playbooks', '#/lessons'));
  page.appendChild(qa);

  // Stats strip
  const strip = el('div', { class: 'stat-strip' },
    stat(SAT.store.totalAnswered(), 'questions answered'),
    stat(SAT.store.bestStreak(), 'best streak 🔥'),
    stat(SAT.store.dayStreak() + 'd', 'day streak'),
    stat(SAT.store.state.errorLog.length, 'in error log'),
    stat(SAT.store.state.mocks.length, 'mocks taken'),
  );
  page.appendChild(strip);

  // Weak areas snapshot + coaching
  const cols = el('div', { class: 'two-col' });
  cols.appendChild(weakCard('rw'));
  cols.appendChild(weakCard('math'));
  page.appendChild(cols);

  // Error log nudge
  if (SAT.store.state.errorLog.length >= 3) {
    page.appendChild(el('div', { class: 'card nudge' },
      el('div', null, `You have ${SAT.store.state.errorLog.length} questions in your error log. Re-doing missed questions is the single highest-ROI study habit.`),
      el('a', { class: 'btn btn-primary', href: '#/practice' }, 'Review them')));
  }

  root.appendChild(page);

  function targetRow(label, score, target, min, max) {
    const hit = score >= target;
    const frac = Math.max(0, Math.min(1, (score - min) / (max - min)));
    const tfrac = (target - min) / (max - min);
    return el('div', { class: 'trow' },
      el('div', { class: 'trow-top' },
        el('span', null, label),
        el('span', { class: hit ? 'good' : '' }, `${score} / ${target}` + (hit ? ' ✓' : ''))),
      el('div', { class: 'sh-bar' },
        el('div', { class: 'sh-bar-fill', style: `width:${frac * 100}%` }),
        el('div', { class: 'sh-bar-target', style: `left:${tfrac * 100}%`, title: 'target' })));
  }
  function needRow(label, section, target) {
    const miss = SAT.scoring.missesAllowed(section, target);
    return el('div', { class: 'trow' },
      el('div', { class: 'trow-top' }, el('span', null, label),
        el('span', { class: 'subtle' }, `${target} target`)),
      el('div', { class: 'subtle small' },
        `Roughly ${pct(SAT.scoring.fractionForTarget(section, target))} accuracy on the hard path — you can miss about ${miss} of ${section === 'rw' ? SAT.config.scoring.rwScored : SAT.config.scoring.mathScored}.`));
  }
  function action(title, desc, href, kind) {
    return el('a', { class: 'qa-card' + (kind === 'primary' ? ' qa-primary' : ''), href },
      el('div', { class: 'qa-title' }, title), el('div', { class: 'qa-desc' }, desc));
  }
  function stat(v, label) {
    return el('div', { class: 'stat' }, el('div', { class: 'stat-v' }, String(v)), el('div', { class: 'stat-l' }, label));
  }
  function weakCard(section) {
    const name = SAT.config.sections[section].name;
    const weak = SAT.store.weakestDomains(section, 3);
    const card = el('div', { class: 'card' }, el('h3', null, name + ' — focus areas'));
    if (!weak.length) {
      card.appendChild(el('p', { class: 'subtle' }, 'Answer a few ' + name + ' questions to see your weak spots here.'));
    } else {
      weak.slice(0, 4).forEach(w => card.appendChild(domainBar(w.domain, w.acc, w.total)));
    }
    card.appendChild(el('a', { class: 'btn btn-sm', href: '#/practice' }, 'Drill ' + (section === 'rw' ? 'R&W' : 'Math')));
    return card;
  }
  function domainBar(name, acc, n) {
    const color = acc >= 0.85 ? 'good' : acc >= 0.65 ? 'mid' : 'bad';
    return el('div', { class: 'dbar' },
      el('div', { class: 'dbar-top' }, el('span', null, name), el('span', { class: 'subtle' }, pct(acc) + ` (${n})`)),
      el('div', { class: 'dbar-track' }, el('div', { class: 'dbar-fill ' + color, style: `width:${acc * 100}%` })));
  }
};

/* ---------------- PROGRESS ---------------- */
SAT.views.progress = function (root) {
  const { el, clearNode, pct } = SAT.ui;
  clearNode(root);
  const page = el('div', { class: 'page' });
  page.appendChild(el('h1', null, 'Progress & analytics'));

  if (SAT.store.totalAnswered() === 0) {
    page.appendChild(el('p', { class: 'subtle' }, 'No data yet — do some practice and your accuracy by domain, difficulty, and question type will appear here.'));
    page.appendChild(el('a', { class: 'btn btn-primary', href: '#/practice' }, 'Start practicing'));
    root.appendChild(page); return;
  }

  // Section overview
  const overview = el('div', { class: 'two-col' });
  ['rw', 'math'].forEach(sec => {
    const s = SAT.store.sectionAccuracy(sec);
    const card = el('div', { class: 'card' },
      el('h3', null, SAT.config.sections[sec].name),
      el('div', { class: 'big-acc' }, s.total ? pct(s.acc) : '—'),
      el('div', { class: 'subtle' }, `${s.correct}/${s.total} correct · est. ${s.total ? SAT.scoring.sectionScore(sec, s.acc, 'hard') : '—'} on hard path`));
    overview.appendChild(card);
  });
  page.appendChild(overview);

  // Accuracy by domain
  ['rw', 'math'].forEach(sec => {
    const by = SAT.store.statsBy('domain', a => a.section === sec);
    const entries = SAT.config.domains[sec].map(d => [d.name, by[d.name]]).filter(([, v]) => v);
    if (!entries.length) return;
    const card = el('div', { class: 'card' }, el('h3', null, SAT.config.sections[sec].name + ' — by domain'));
    entries.forEach(([name, v]) => card.appendChild(accBar(name, v.acc, v.total)));
    page.appendChild(card);
  });

  // By difficulty
  const diffCard = el('div', { class: 'card' }, el('h3', null, 'By difficulty'));
  ['easy', 'medium', 'hard'].forEach(d => {
    const by = SAT.store.statsBy('difficulty');
    if (by[d]) diffCard.appendChild(accBar(d[0].toUpperCase() + d.slice(1), by[d].acc, by[d].total));
  });
  page.appendChild(diffCard);

  // By question type (top + bottom)
  const typeBy = SAT.store.statsBy('type');
  const typeEntries = Object.entries(typeBy).filter(([, v]) => v.total >= 3).sort((a, b) => a[1].acc - b[1].acc);
  if (typeEntries.length) {
    const card = el('div', { class: 'card' }, el('h3', null, 'Question types that cost you the most'));
    typeEntries.slice(0, 6).forEach(([name, v]) => card.appendChild(accBar(name, v.acc, v.total)));
    page.appendChild(card);
  }

  // Mock history
  if (SAT.store.state.mocks.length) {
    const card = el('div', { class: 'card' }, el('h3', null, 'Mock score history'));
    card.appendChild(mockSpark(SAT.store.state.mocks));
    page.appendChild(card);
  }

  // Error log
  const elog = SAT.store.state.errorLog;
  const ecard = el('div', { class: 'card' },
    el('h3', null, `Error log (${elog.length})`),
    el('p', { class: 'subtle' }, 'Questions you’ve missed and not yet re-answered correctly.'));
  if (elog.length) {
    const review = el('button', { class: 'btn btn-primary' }, 'Review error log');
    review.addEventListener('click', () => {
      const qs = SAT.engine.filter({ ids: elog });
      SAT.views.practice._pending = { title: 'Error-log review', section: qs[0] ? qs[0].section : 'rw', mode: 'errorlog', questions: SAT.engine.shuffle(qs) };
      location.hash = '#/practice/run';
    });
    ecard.appendChild(review);
  } else {
    ecard.appendChild(el('p', { class: 'subtle' }, 'Empty — nice. Keep it that way.'));
  }
  page.appendChild(ecard);

  // Data controls
  page.appendChild(el('div', { class: 'actions' },
    el('button', { class: 'btn btn-sm', onclick: () => exportData() }, 'Export my data'),
    el('button', { class: 'btn btn-sm btn-danger', onclick: () => resetData() }, 'Reset all data')));

  root.appendChild(page);

  function accBar(name, acc, n) {
    const color = acc >= 0.85 ? 'good' : acc >= 0.65 ? 'mid' : 'bad';
    return el('div', { class: 'dbar' },
      el('div', { class: 'dbar-top' }, el('span', null, name), el('span', { class: 'subtle' }, pct(acc) + ` · ${n}`)),
      el('div', { class: 'dbar-track' }, el('div', { class: 'dbar-fill ' + color, style: `width:${acc * 100}%` })));
  }
  function exportData() {
    const blob = new Blob([SAT.store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'sat-prep-data.json'; a.click();
  }
  function resetData() {
    SAT.ui.modal('Reset everything?', 'This permanently clears all your attempts, mocks, and error log.', [
      { label: 'Cancel' },
      { label: 'Reset', primary: true, onClick: () => { SAT.store.resetAll(); SAT.ui.toast('Data cleared'); location.hash = '#/'; } },
    ]);
  }
};

function mockSpark(mocks) {
  const { el } = SAT.ui;
  const w = 560, h = 160, pad = 30;
  const xs = mocks.map((m, i) => i), ys = mocks.map(m => m.total || 0);
  const maxY = 1600, minY = 600;
  const X = i => pad + (xs.length <= 1 ? 0 : (i / (xs.length - 1)) * (w - pad * 2));
  const Y = v => h - pad - ((v - minY) / (maxY - minY)) * (h - pad * 2);
  let path = '';
  mocks.forEach((m, i) => { path += (i ? 'L' : 'M') + X(i) + ',' + Y(m.total || 0) + ' '; });
  const dots = mocks.map((m, i) => `<circle cx="${X(i)}" cy="${Y(m.total || 0)}" r="4" class="spark-dot"/>`).join('');
  const tline = Y(1500);
  const svg = `<svg viewBox="0 0 ${w} ${h}" class="spark">
    <line x1="${pad}" y1="${tline}" x2="${w - pad}" y2="${tline}" class="spark-target"/>
    <text x="${w - pad}" y="${tline - 6}" class="spark-tlabel" text-anchor="end">1500 target</text>
    <path d="${path}" class="spark-line"/>${dots}
  </svg>`;
  return el('div', { html: svg });
}

/* ---------------- STUDY PLAN ---------------- */
SAT.views.plan = function (root) {
  const { el, clearNode, pct } = SAT.ui;
  clearNode(root);
  const page = el('div', { class: 'page' });
  page.appendChild(el('h1', null, 'Your study plan'));
  page.appendChild(el('p', { class: 'subtle' }, 'A plan built on the evidence: a diagnostic baseline, targeted work on weak domains, full-length timed practice, and a disciplined review-your-mistakes loop.'));

  // Exam date
  const saved = SAT.store.getSetting('examDate');
  const dateWrap = el('div', { class: 'field' },
    el('label', null, 'Your test date (optional)'));
  const dateInput = el('input', { type: 'date', class: 'date-input', value: saved || '' });
  dateInput.addEventListener('change', () => { SAT.store.setSetting('examDate', dateInput.value); render(); });
  dateWrap.appendChild(dateInput);
  page.appendChild(dateWrap);

  const out = el('div', { id: 'plan-out' });
  page.appendChild(out);
  root.appendChild(page);

  render();

  function render() {
    clearNode(out);
    const examDate = SAT.store.getSetting('examDate');
    let weeks = 10;
    if (examDate) {
      const days = Math.ceil((new Date(examDate) - new Date()) / 86400000);
      weeks = Math.max(1, Math.ceil(days / 7));
      out.appendChild(el('div', { class: 'card' },
        el('h3', null, days > 0 ? `${days} days to test day (${weeks} weeks)` : 'Test date is in the past — set a new one'),
      ));
    }

    // Diagnosis-driven priorities
    const rwWeak = SAT.store.weakestDomains('rw', 3);
    const mathWeak = SAT.store.weakestDomains('math', 3);
    const haveData = SAT.store.totalAnswered() >= 15;

    const diag = el('div', { class: 'card' }, el('h3', null, 'Step 1 — Diagnose'));
    if (!haveData) {
      diag.appendChild(el('p', null, 'Take a full mock (or at least 20 practice questions per section) so the plan can target your real weak spots.'));
      diag.appendChild(el('a', { class: 'btn btn-primary', href: '#/mock' }, 'Take a baseline mock'));
    } else {
      diag.appendChild(el('p', { class: 'subtle' }, 'Based on your data so far, prioritize:'));
      const ul = el('ul', { class: 'plan-list' });
      [['R&W', rwWeak], ['Math', mathWeak]].forEach(([lab, weak]) => {
        weak.slice(0, 2).forEach(w => ul.appendChild(el('li', null,
          `${lab}: `, el('strong', null, w.domain), ` — currently ${pct(w.acc)}. Drill until you’re consistently 85%+.`)));
      });
      diag.appendChild(ul);
    }
    out.appendChild(diag);

    // The goal math
    const goal = el('div', { class: 'card' }, el('h3', null, 'Your target, in raw terms'));
    goal.appendChild(el('p', null,
      `For ${SAT.config.targets.rw} R&W you need ~${pct(SAT.scoring.fractionForTarget('rw', SAT.config.targets.rw))} accuracy on the hard path — you can miss about `,
      el('strong', null, String(SAT.scoring.missesAllowed('rw', SAT.config.targets.rw))),
      ` of ${SAT.config.scoring.rwScored}.`));
    goal.appendChild(el('p', null,
      `For a perfect ${SAT.config.targets.math} Math you can typically miss only `,
      el('strong', null, String(SAT.scoring.missesAllowed('math', SAT.config.targets.math))),
      ` — sometimes zero. That means eliminating careless errors entirely, not just knowing the math.`));
    out.appendChild(goal);

    // Weekly schedule
    const sched = el('div', { class: 'card' }, el('h3', null, `Step 2 — A ${weeks}-week rhythm`));
    sched.appendChild(buildSchedule(weeks));
    out.appendChild(sched);

    // The review loop
    const loop = el('div', { class: 'card' }, el('h3', null, 'Step 3 — The review loop (do not skip)'));
    loop.appendChild(el('div', { class: 'article', html: SAT.ui.fmt(
      'After every set or mock, review **every** question you missed or guessed. For each one write, in a sentence: *what the question tested*, *why your answer was wrong*, and *the rule/step you’ll use next time*. Re-do it from your error log 2–3 days later. This spaced, active review is what converts practice into points.') }));
    const eb = el('button', { class: 'btn btn-primary' }, 'Open my error log');
    eb.addEventListener('click', () => location.hash = '#/progress');
    loop.appendChild(eb);
    out.appendChild(loop);

    // Resources
    const res = el('div', { class: 'card' }, el('h3', null, 'Official & free resources'));
    const ul = el('ul', { class: 'res-list' });
    SAT.config.resources.forEach(r => ul.appendChild(el('li', null,
      el('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.name),
      r.free ? el('span', { class: 'pill pill-good' }, 'free') : null,
      el('div', { class: 'subtle small' }, r.note))));
    res.appendChild(ul);
    out.appendChild(res);
  }

  function buildSchedule(weeks) {
    const { el } = SAT.ui;
    const rows = [];
    const phase = weeks <= 3 ? 'sprint' : weeks <= 6 ? 'mid' : 'full';
    const plan = [
      ['Mon', 'Adaptive R&W set (15–20q) + review every miss'],
      ['Tue', 'Math weak-domain drill (15–20q) + Desmos practice'],
      ['Wed', 'Lessons: 1 R&W + 1 Math question type, then a 10q mini-set'],
      ['Thu', 'Error-log review (re-do past misses) + timed R&W module'],
      ['Fri', 'Math hard-only set (train the Module-2 path)'],
      ['Sat', weeks >= 4 ? 'Full timed mock (every 1–2 weeks)' : 'Single-section timed mock'],
      ['Sun', 'Review the mock thoroughly — no new questions, just analysis'],
    ];
    const tbl = el('table', { class: 'plan-table' },
      el('thead', null, el('tr', null, el('th', null, 'Day'), el('th', null, 'Focus'))),
      el('tbody', null, ...plan.map(([d, f]) => el('tr', null, el('td', null, d), el('td', null, f)))));
    const note = el('p', { class: 'subtle small' },
      phase === 'sprint'
        ? 'Sprint mode: prioritize full mocks + relentless error review over new content.'
        : phase === 'mid'
          ? 'Balanced mode: alternate concept-building with timed practice; one full mock per week.'
          : 'Full runway: build fundamentals first, ramp timed mocks in the final 4 weeks.');
    return el('div', null, tbl, note);
  }
};
