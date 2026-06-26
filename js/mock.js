/* =====================================================================
 * mock.js — full-length, module-adaptive practice test that mirrors the
 * Bluebook flow: Module 1 -> (route by performance) -> Module 2, per
 * section, on a real clock, with a question navigator + flag-for-review,
 * and NO feedback until the end.
 * ===================================================================== */
window.SAT = window.SAT || {};
SAT.views = SAT.views || {};

SAT.views.mock = function (root, params) {
  const { el, clearNode } = SAT.ui;
  clearNode(root);

  if (params && params.run) return runMock(root, params.run);

  const page = el('div', { class: 'page' });
  page.appendChild(el('h1', null, 'Full-length mock test'));
  page.appendChild(el('p', { class: 'subtle' },
    'A timed, adaptive simulation of the real exam. Module 1 is mixed difficulty — do well and you unlock the HARD Module 2, the only path to a top score. Otherwise you route to an easier Module 2 with a capped ceiling, exactly like the real SAT.'));

  const grid = el('div', { class: 'mock-cards' });
  const opts = [
    { key: 'full', title: 'Full test', desc: 'R&W + Math · 4 modules · ~2h14m', mins: 134 },
    { key: 'rw', title: 'Reading & Writing only', desc: '2 modules · 64 min', mins: 64 },
    { key: 'math', title: 'Math only', desc: '2 modules · 70 min', mins: 70 },
  ];
  opts.forEach(o => {
    const card = el('div', { class: 'mock-card' },
      el('h3', null, o.title), el('p', { class: 'subtle' }, o.desc));
    const have = checkAvailability(o.key);
    if (!have.ok) {
      card.appendChild(el('div', { class: 'warn' }, have.msg));
    }
    const b = el('button', { class: 'btn btn-primary' + (have.ok ? '' : ' btn-disabled'), disabled: !have.ok }, 'Begin →');
    b.addEventListener('click', () => {
      // Stash the run and let the router render it exactly once
      // (rendering here too would start a second timer on the same clock).
      SAT.views.mock._pending = buildRun(o.key);
      location.hash = '#/mock/run';
    });
    card.appendChild(b);
    grid.appendChild(card);
  });
  page.appendChild(grid);

  // Past results
  const mocks = SAT.store.state.mocks;
  if (mocks.length) {
    page.appendChild(el('h2', null, 'Your mock history'));
    const list = el('div', { class: 'mock-history' });
    mocks.slice().reverse().forEach(m => {
      const row = el('div', { class: 'mh-row' },
        el('div', { class: 'mh-date' }, new Date(m.ts).toLocaleDateString()),
        el('div', { class: 'mh-score' }, m.total ? String(m.total) : '—'),
        el('div', { class: 'mh-detail subtle' },
          (m.rw ? `R&W ${m.rw.scaled} (${m.rw.route})` : '') +
          (m.math ? `  ·  Math ${m.math.scaled} (${m.math.route})` : '')),
      );
      list.appendChild(row);
    });
    page.appendChild(list);
  }

  root.appendChild(page);

  function checkAvailability(kind) {
    const need = SAT.config.sections;
    function enough(sec) {
      const per = need[sec].questionsPerModule;
      // need 2 modules worth, and a hard pool for module 2
      const easy = SAT.engine.count({ section: sec, difficulties: ['easy', 'medium'] });
      const hard = SAT.engine.count({ section: sec, difficulties: ['hard'] });
      return easy >= per && (easy + hard) >= per * 2 - 4;
    }
    if (kind === 'full') {
      if (enough('rw') && enough('math')) return { ok: true };
      return { ok: false, msg: 'Not enough questions loaded yet for a full mock — try a single-section mock or add more questions.' };
    }
    return enough(kind) ? { ok: true } : { ok: false, msg: 'Not enough ' + kind.toUpperCase() + ' questions loaded yet.' };
  }
};

/* Build the run plan. */
function buildRun(kind) {
  const seed = Math.floor(performance.now()) ^ 0x5a5a;
  const sections = kind === 'full' ? ['rw', 'math'] : [kind];
  return {
    kind,
    seed,
    sections: sections.map(s => SAT.engine.buildMockSection(s, seed + (s === 'rw' ? 1 : 2))),
    results: {},     // filled per section
    answers: {},     // qid -> choice
    flags: {},       // qid -> true
    order: [],       // running list of all served questions (for review)
  };
}

/* ---------- The actual timed runner ---------- */
function runMock(root, run) {
  const { el, clearNode, question } = SAT.ui;
  clearNode(root);

  let secIdx = 0;       // index into run.sections
  let moduleNo = 1;     // 1 or 2
  let qIdx = 0;
  let moduleQs = [];    // current module's questions
  let timer = null;
  let remaining = 0;
  let breakMode = false;

  startModule();

  function curSection() { return run.sections[secIdx]; }

  function startModule() {
    const sec = curSection();
    if (moduleNo === 1) {
      moduleQs = sec.module1.slice();
    } else {
      moduleQs = run._module2;
    }
    qIdx = 0;
    remaining = SAT.config.sections[sec.section].minutesPerModule * 60;
    renderModule();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      remaining--;
      updateClock();
      if (remaining <= 0) { stopTimer(); endModule(); }
    }, 1000);
  }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }

  function renderModule() {
    clearNode(root);
    const sec = curSection();
    const secName = SAT.config.sections[sec.section].name;

    const top = el('div', { class: 'mock-top' },
      el('div', { class: 'mock-where' }, `${secName} · Module ${moduleNo} of 2`),
      el('div', { class: 'mock-clock', id: 'mock-clock' }, fmtClock(remaining)),
      el('button', { class: 'btn btn-sm', onclick: toggleNav }, 'Question navigator'),
    );
    if (sec.section === 'math') {
      top.appendChild(el('button', { class: 'btn btn-sm', onclick: openCalc }, 'Calculator'));
      top.appendChild(el('button', { class: 'btn btn-sm', onclick: openRef }, 'Reference'));
    }
    root.appendChild(top);

    const slot = el('div', { class: 'mock-slot', id: 'mock-slot' });
    root.appendChild(slot);

    const nav = el('div', { class: 'mock-nav-bar' },
      el('button', { class: 'btn', onclick: prev }, '← Back'),
      el('div', { class: 'mock-counter', id: 'mock-counter' }, ''),
      el('button', { class: 'btn btn-primary', id: 'mock-next', onclick: next }, 'Next →'),
    );
    root.appendChild(nav);

    paintQuestion();
  }

  function paintQuestion() {
    const sec = curSection();
    const slot = document.getElementById('mock-slot');
    SAT.ui.clearNode(slot);
    const q = moduleQs[qIdx];
    const chosen = run.answers[q.id];

    const flagBtn = el('button', { class: 'flag' + (run.flags[q.id] ? ' on' : '') },
      run.flags[q.id] ? '★ Flagged' : '☆ Flag for review');
    flagBtn.addEventListener('click', () => {
      run.flags[q.id] = !run.flags[q.id];
      flagBtn.className = 'flag' + (run.flags[q.id] ? ' on' : '');
      flagBtn.textContent = run.flags[q.id] ? '★ Flagged' : '☆ Flag for review';
    });
    slot.appendChild(el('div', { class: 'flag-row' }, flagBtn));

    const qel = question(q, {
      chosen,
      showMeta: false,                 // no difficulty hints during a real test
      onAnswer(choice) { run.answers[q.id] = choice; refreshChoiceUI(); },
    });
    if (q.format === 'grid') {
      // pre-fill grid value
      const inp = qel.querySelector('.grid-input');
      if (inp && chosen != null) inp.value = chosen;
    }
    slot.appendChild(qel);
    if (qel._focus) qel._focus();

    document.getElementById('mock-counter').textContent = `Question ${qIdx + 1} of ${moduleQs.length}`;
    document.getElementById('mock-next').textContent =
      (qIdx + 1 >= moduleQs.length) ? (moduleNo === 1 ? 'Finish module →' : 'Finish module →') : 'Next →';
  }

  function refreshChoiceUI() {
    const sec = curSection();
    const q = moduleQs[qIdx];
    const slot = document.getElementById('mock-slot');
    const chosen = run.answers[q.id];
    slot.querySelectorAll('.choice').forEach((b, idx) => {
      b.classList.toggle('selected', idx === chosen);
    });
  }

  function next() {
    saveGrid();
    if (qIdx + 1 < moduleQs.length) { qIdx++; paintQuestion(); }
    else endModule();
  }
  function prev() {
    saveGrid();
    if (qIdx > 0) { qIdx--; paintQuestion(); }
  }
  function saveGrid() {
    const q = moduleQs[qIdx];
    if (q && q.format === 'grid') {
      const inp = document.querySelector('.grid-input');
      if (inp) run.answers[q.id] = inp.value.trim();
    }
  }

  function endModule() {
    stopTimer();
    saveGrid();
    const sec = curSection();
    moduleQs.forEach(q => { if (!run.order.includes(q.id)) run.order.push(q.id); });

    if (moduleNo === 1) {
      // grade module 1, route module 2
      const m1Correct = countCorrect(sec.module1);
      const route = SAT.scoring.routeFor(sec.section, m1Correct / sec.module1.length);
      run._m1Correct = m1Correct;
      run._route = route;
      run._module2 = SAT.engine.buildModule2(sec.section, route, sec.module1, run.seed + secIdx * 31);
      moduleNo = 2;
      routeInterstitial(route, () => startModule());
    } else {
      // grade section
      const m1 = sec.module1, m2 = run._module2;
      const r = SAT.scoring.mockSection(sec.section,
        countCorrect(m1), m1.length, countCorrect(m2), m2.length);
      r.route = run._route;
      run.results[sec.section] = r;
      run.results[sec.section].module1 = m1.map(q => q.id);
      run.results[sec.section].module2 = m2.map(q => q.id);
      // advance to next section or finish
      if (secIdx + 1 < run.sections.length) {
        secIdx++; moduleNo = 1;
        takeBreak(() => startModule());
      } else {
        finishMock();
      }
    }
  }

  function countCorrect(qs) {
    return qs.reduce((n, q) => n + (SAT.engine.isCorrect(q, run.answers[q.id]) ? 1 : 0), 0);
  }

  /* Interstitial screens */
  function routeInterstitial(route, cont) {
    stopTimer();
    clearNode(root);
    const good = route === 'hard';
    root.appendChild(el('div', { class: 'interstitial' },
      el('div', { class: 'inter-badge ' + (good ? 'good' : 'soft') }, good ? 'Hard Module 2 unlocked' : 'Standard Module 2'),
      el('h2', null, 'Module 1 complete'),
      el('p', { class: 'subtle' }, good
        ? 'Strong Module 1 — you’ve routed into the harder, higher-ceiling Module 2. This is the path to a top score. The questions get tougher; stay sharp.'
        : 'Based on Module 1, you’ve routed into the standard Module 2. On the real SAT this caps your section ceiling — a reminder that Module 1 accuracy is what unlocks the top scores. Keep going; every point still counts.'),
      el('button', { class: 'btn btn-primary btn-lg', onclick: cont }, 'Start Module 2 →'),
    ));
  }

  function takeBreak(cont) {
    stopTimer();
    clearNode(root);
    let left = SAT.config.breakMinutes * 60;
    const clock = el('div', { class: 'break-clock' }, fmtClock(left));
    const box = el('div', { class: 'interstitial' },
      el('h2', null, 'Section complete — break time'),
      el('p', { class: 'subtle' }, 'On test day you get a 10-minute break here. Take a breath, then continue to Math.'),
      clock,
      el('button', { class: 'btn btn-primary btn-lg', onclick: () => { clearInterval(bt); cont(); } }, 'Skip break, continue →'),
    );
    root.appendChild(box);
    const bt = setInterval(() => {
      left--; clock.textContent = fmtClock(left);
      if (left <= 0) { clearInterval(bt); cont(); }
    }, 1000);
  }

  /* Final scoring + review */
  function finishMock() {
    stopTimer();
    const rw = run.results.rw, math = run.results.math;
    const total = (rw ? rw.scaled : 0) + (math ? math.scaled : 0);
    const record = {
      kind: run.kind,
      rw: rw || null, math: math || null,
      total: (rw && math) ? total : (rw ? rw.scaled : math ? math.scaled : 0),
      detail: { answers: run.answers, order: run.order, flags: run.flags },
    };
    SAT.store.recordMock(record);
    renderResults(record);
  }

  function renderResults(rec) {
    clearNode(root);
    const t = SAT.config.targets;
    const page = el('div', { class: 'page' });
    page.appendChild(el('h1', null, 'Mock results'));

    if (rec.rw && rec.math) {
      page.appendChild(scoreHero(rec.total, t.total, 'Total', 400, 1600));
    }
    const cards = el('div', { class: 'score-cards' });
    if (rec.rw) cards.appendChild(sectionScoreCard('Reading & Writing', rec.rw, t.rw));
    if (rec.math) cards.appendChild(sectionScoreCard('Math', rec.math, t.math));
    page.appendChild(cards);

    page.appendChild(el('p', { class: 'disclaimer' },
      'Scores are estimates from a fixed practice curve — the real adaptive curve varies by form. Use them to track trends, not as a guaranteed prediction.'));

    // Review button
    const reviewBtn = el('button', { class: 'btn btn-primary' }, 'Review every question →');
    reviewBtn.addEventListener('click', () => renderReview(rec));
    page.appendChild(el('div', { class: 'actions' },
      reviewBtn,
      el('button', { class: 'btn', onclick: () => location.hash = '#/mock' }, 'Back to mocks'),
      el('button', { class: 'btn', onclick: () => location.hash = '#/progress' }, 'Progress'),
    ));
    root.appendChild(page);
  }

  function renderReview(rec) {
    clearNode(root);
    const page = el('div', { class: 'page' });
    page.appendChild(el('div', { class: 'actions' },
      el('button', { class: 'btn', onclick: () => renderResults(rec) }, '← Back to results')));
    page.appendChild(el('h1', null, 'Question review'));
    page.appendChild(el('p', { class: 'subtle' }, 'Spend most of your time here. Reviewing why you missed each question is where the score gains come from.'));

    // Only-wrong filter
    let onlyWrong = false;
    const filterBtn = el('button', { class: 'btn btn-sm' }, 'Show: all');
    const listWrap = el('div');
    filterBtn.addEventListener('click', () => {
      onlyWrong = !onlyWrong;
      filterBtn.textContent = onlyWrong ? 'Show: mistakes only' : 'Show: all';
      paint();
    });
    page.appendChild(el('div', { class: 'actions' }, filterBtn));
    page.appendChild(listWrap);
    root.appendChild(page);

    function paint() {
      SAT.ui.clearNode(listWrap);
      rec.detail.order.forEach((qid, idx) => {
        const q = SAT.engine.byId(qid);
        if (!q) return;
        const chosen = rec.detail.answers[qid];
        const ok = SAT.engine.isCorrect(q, chosen);
        if (onlyWrong && ok) return;
        const wrap = el('div', { class: 'review-item ' + (ok ? 'ri-ok' : 'ri-bad') });
        wrap.appendChild(el('div', { class: 'ri-num' }, `#${idx + 1} ${ok ? '✓' : '✗'}${rec.detail.flags[qid] ? ' ★' : ''}`));
        wrap.appendChild(SAT.ui.question(q, { reveal: true, chosen, locked: true }));
        listWrap.appendChild(wrap);
      });
    }
    paint();
  }

  /* clock + utilities */
  function updateClock() {
    const c = document.getElementById('mock-clock');
    if (c) {
      c.textContent = fmtClock(remaining);
      c.classList.toggle('low', remaining <= 60);
    }
  }

  /* Question navigator overlay */
  function toggleNav() {
    const sec = curSection();
    const grid = el('div', { class: 'navgrid' });
    moduleQs.forEach((q, idx) => {
      const answered = run.answers[q.id] != null && run.answers[q.id] !== '';
      const b = el('button', {
        class: 'navcell' + (idx === qIdx ? ' cur' : '') + (answered ? ' done' : '') + (run.flags[q.id] ? ' flagged' : ''),
      }, String(idx + 1));
      b.addEventListener('click', () => { saveGrid(); qIdx = idx; paintQuestion(); m.close(); });
      grid.appendChild(b);
    });
    const legend = el('div', { class: 'navlegend subtle' }, 'Filled = answered · ★ = flagged · outline = current');
    const m = SAT.ui.modal('Question navigator', el('div', null, grid, legend),
      [{ label: 'Close', primary: true }]);
  }

  function openCalc() {
    const frame = el('iframe', {
      class: 'calc-frame', src: 'https://www.desmos.com/calculator', title: 'Desmos calculator',
    });
    SAT.ui.modal('Graphing calculator (Desmos)', el('div', null,
      el('p', { class: 'subtle small' }, 'The real test embeds this exact calculator. Requires an internet connection.'),
      frame));
  }
  function openRef() {
    SAT.ui.modal('Math reference sheet', el('div', { class: 'refsheet', html: SAT.refSheetHTML() }));
  }

  // keyboard
  root._keys = e => {
    if (breakMode) return;
    const q = moduleQs[qIdx];
    if (q && q.format !== 'grid' && /^[1-4]$/.test(e.key)) {
      const btn = document.querySelectorAll('#mock-slot .choice')[+e.key - 1];
      if (btn) btn.click();
    } else if (e.key === 'ArrowRight') { next(); }
    else if (e.key === 'ArrowLeft') { prev(); }
  };
  document.addEventListener('keydown', root._keys);
}

function fmtClock(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/* score UI helpers */
function scoreHero(score, target, label, min, max) {
  const { el } = SAT.ui;
  const hit = score >= target;
  const frac = (score - min) / (max - min);
  return el('div', { class: 'score-hero' },
    el('div', { class: 'sh-label' }, label),
    el('div', { class: 'sh-score' + (hit ? ' hit' : '') }, String(score)),
    el('div', { class: 'sh-target subtle' }, `Target ${target} ${hit ? '✓ reached' : '· ' + (target - score) + ' to go'}`),
    el('div', { class: 'sh-bar' }, el('div', { class: 'sh-bar-fill', style: `width:${Math.max(2, frac * 100)}%` }),
      el('div', { class: 'sh-bar-target', style: `left:${(target - min) / (max - min) * 100}%` })),
  );
}
function sectionScoreCard(name, r, target) {
  const { el } = SAT.ui;
  const hit = r.scaled >= target;
  return el('div', { class: 'score-card' },
    el('div', { class: 'sc-name' }, name),
    el('div', { class: 'sc-score' + (hit ? ' hit' : '') }, String(r.scaled)),
    el('div', { class: 'sc-meta subtle' },
      `${r.raw}/${r.total} correct · ${SAT.ui.pct(r.acc)}`),
    el('div', { class: 'sc-route' },
      el('span', { class: 'pill ' + (r.route === 'hard' ? 'pill-good' : 'pill-soft') },
        r.route === 'hard' ? 'Hard Module 2' : 'Standard Module 2')),
    el('div', { class: 'sc-target subtle' }, `Target ${target} ${hit ? '✓' : '· ' + (target - r.scaled) + ' to go'}`),
  );
}
