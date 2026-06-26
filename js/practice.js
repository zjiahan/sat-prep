/* =====================================================================
 * practice.js — the drilling experience: pick filters, then answer
 * questions one at a time with immediate feedback + explanations.
 * ===================================================================== */
window.SAT = window.SAT || {};

SAT.views = SAT.views || {};

SAT.views.practice = function (root, params) {
  const { el, clearNode } = SAT.ui;
  clearNode(root);

  // If a run is already configured via params, jump straight in.
  if (params && params.run) return runSession(root, params.run);

  /* ---------- Setup screen ---------- */
  const state = {
    section: 'rw',
    domains: new Set(),
    difficulties: new Set(['easy', 'medium', 'hard']),
    mode: 'adaptive',
    count: 10,
  };

  const page = el('div', { class: 'page' });
  page.appendChild(el('h1', null, 'Practice'));
  page.appendChild(el('p', { class: 'subtle' },
    'Build a custom drill. Adaptive mode targets your weak domains and pushes harder questions to train for the hard module 2.'));

  const form = el('div', { class: 'setup-grid' });

  // Section toggle
  const secWrap = el('div', { class: 'field' }, el('label', null, 'Section'));
  const secToggle = el('div', { class: 'seg' });
  [['rw', 'Reading & Writing'], ['math', 'Math']].forEach(([k, label]) => {
    const b = el('button', { class: 'seg-btn' + (state.section === k ? ' active' : '') }, label);
    b.addEventListener('click', () => { state.section = k; rebuildDomains(); markSeg(secToggle, b); refreshCount(); });
    secToggle.appendChild(b);
  });
  secWrap.appendChild(secToggle);
  form.appendChild(secWrap);

  // Mode
  const modeWrap = el('div', { class: 'field' }, el('label', null, 'Mode'));
  const modeSel = el('div', { class: 'seg' });
  [['adaptive', 'Adaptive'], ['drill', 'Drill (by topic)'], ['errorlog', 'Error log'], ['hard', 'Hard only']].forEach(([k, label]) => {
    const b = el('button', { class: 'seg-btn' + (state.mode === k ? ' active' : '') }, label);
    b.addEventListener('click', () => {
      state.mode = k; markSeg(modeSel, b);
      if (k === 'hard') { state.difficulties = new Set(['hard']); }
      rebuildDifficulties(); refreshCount();
    });
    modeSel.appendChild(b);
  });
  modeWrap.appendChild(modeSel);
  form.appendChild(modeWrap);

  // Domains (rebuilt per section)
  const domWrap = el('div', { class: 'field field-wide' }, el('label', null, 'Domains (leave all off = everything)'));
  const domBox = el('div', { class: 'chips' });
  domWrap.appendChild(domBox);
  form.appendChild(domWrap);

  // Difficulty
  const diffWrap = el('div', { class: 'field' }, el('label', null, 'Difficulty'));
  const diffBox = el('div', { class: 'chips' });
  diffWrap.appendChild(diffBox);
  form.appendChild(diffWrap);

  // Count
  const countWrap = el('div', { class: 'field' }, el('label', null, 'How many questions'));
  const countSel = el('div', { class: 'seg' });
  [5, 10, 20, 40].forEach(n => {
    const b = el('button', { class: 'seg-btn' + (state.count === n ? ' active' : '') }, String(n));
    b.addEventListener('click', () => { state.count = n; markSeg(countSel, b); });
    countSel.appendChild(b);
  });
  countWrap.appendChild(countSel);
  form.appendChild(countWrap);

  page.appendChild(form);

  const avail = el('div', { class: 'avail subtle' });
  page.appendChild(avail);

  const start = el('button', { class: 'btn btn-primary btn-lg' }, 'Start practice →');
  start.addEventListener('click', () => {
    const cfg = resolveSession(state);
    if (!cfg.questions.length) { SAT.ui.toast('No questions match those filters yet.', 'bad'); return; }
    // Stash the session and let the router render it exactly once.
    SAT.views.practice._pending = cfg;
    location.hash = '#/practice/run';
  });
  page.appendChild(el('div', { class: 'actions' }, start));

  root.appendChild(page);

  function markSeg(container, btn) {
    [...container.children].forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
  function rebuildDomains() {
    clearNode(domBox); state.domains.clear();
    SAT.config.domains[state.section].forEach(d => {
      const chip = el('button', { class: 'chip' }, d.name);
      chip.addEventListener('click', () => {
        chip.classList.toggle('on');
        if (state.domains.has(d.name)) state.domains.delete(d.name); else state.domains.add(d.name);
        refreshCount();
      });
      domBox.appendChild(chip);
    });
  }
  function rebuildDifficulties() {
    clearNode(diffBox);
    SAT.config.difficulties.forEach(d => {
      const on = state.difficulties.has(d);
      const chip = el('button', { class: 'chip' + (on ? ' on' : '') }, d);
      chip.addEventListener('click', () => {
        chip.classList.toggle('on');
        if (state.difficulties.has(d)) state.difficulties.delete(d); else state.difficulties.add(d);
        if (state.difficulties.size === 0) { state.difficulties.add(d); chip.classList.add('on'); }
        refreshCount();
      });
      diffBox.appendChild(chip);
    });
  }
  function refreshCount() {
    const secName = state.section === 'rw' ? 'Reading & Writing' : 'Math';
    let msg;
    if (state.mode === 'errorlog') {
      const pool = SAT.engine.filter({ section: state.section, ids: SAT.store.state.errorLog }).length;
      msg = pool === 0
        ? `Your ${secName} error log is empty — answer some questions first, then come back to review the ones you miss.`
        : `This session will review all ${pool} ${secName} question${pool === 1 ? '' : 's'} you’ve missed.`;
    } else if (state.mode === 'adaptive') {
      const pool = SAT.engine.filter({ section: state.section }).length;
      const n = Math.min(state.count, pool);
      msg = pool === 0
        ? `No ${secName} questions are loaded yet.`
        : `You’ll get ${n} ${secName} question${n === 1 ? '' : 's'}, auto-picked to target your weak areas.`;
    } else {
      const pool = SAT.engine.filter({ section: state.section, domains: [...state.domains], difficulties: [...state.difficulties] }).length;
      if (pool === 0) msg = 'No questions match your current filters — turn some off to widen the pool.';
      else if (pool <= state.count) msg = `You’ll get all ${pool} question${pool === 1 ? '' : 's'} that match your filters.`;
      else msg = `You’ll get ${state.count} questions, picked at random from the ${pool} that match your filters.`;
    }
    avail.textContent = msg;
  }
  rebuildDomains(); rebuildDifficulties(); refreshCount();
};

/* Resolve the setup state into an ordered question list. */
function resolveSession(state) {
  const domains = [...state.domains];
  const difficulties = [...state.difficulties];
  let questions;
  if (state.mode === 'errorlog') {
    const ids = SAT.store.state.errorLog;
    questions = SAT.engine.filter({ section: state.section, ids });
    questions = SAT.engine.shuffle(questions);
  } else if (state.mode === 'adaptive') {
    questions = SAT.engine.adaptiveSet(state.section, state.count);
  } else {
    questions = SAT.engine.sample({ section: state.section, domains, difficulties }, state.count);
  }
  return {
    title: labelFor(state),
    section: state.section,
    mode: state.mode,
    questions,
  };
}
function labelFor(s) {
  const m = { adaptive: 'Adaptive', drill: 'Topic drill', errorlog: 'Error-log review', hard: 'Hard-only' }[s.mode];
  return m + ' — ' + (s.section === 'rw' ? 'Reading & Writing' : 'Math');
}

/* ---------- Run a practice session ---------- */
function runSession(root, cfg) {
  const { el, clearNode, question } = SAT.ui;
  clearNode(root);
  let i = 0, correct = 0;
  const startTs = performance.now();
  let qStart = performance.now();

  const head = el('div', { class: 'run-head' });
  const bar = el('div', { class: 'progress' }, el('div', { class: 'progress-fill' }));
  const meta = el('div', { class: 'run-meta' });
  head.appendChild(el('div', { class: 'run-title' }, cfg.title));
  head.appendChild(bar);
  head.appendChild(meta);
  root.appendChild(head);

  const slot = el('div', { class: 'run-slot' });
  root.appendChild(slot);

  const foot = el('div', { class: 'run-foot' });
  root.appendChild(foot);

  render();

  function render() {
    clearNode(slot); clearNode(foot);
    if (i >= cfg.questions.length) return finish();
    const q = cfg.questions[i];
    qStart = performance.now();
    let answered = false;

    const qel = question(q, {
      onAnswer(choice) {
        if (answered) return;
        answered = true;
        const ok = SAT.engine.isCorrect(q, choice);
        if (ok) correct++;
        SAT.store.recordAttempt({
          qid: q.id, section: q.section, domain: q.domain, type: q.type,
          difficulty: q.difficulty, correct: ok, choice,
          mode: cfg.mode, elapsedMs: Math.round(performance.now() - qStart),
        });
        // re-render the question revealed
        const revealed = question(q, { reveal: true, chosen: choice, locked: true });
        slot.replaceChild(revealed, qel2.node);
        qel2.node = revealed;
        showNext(ok);
      },
    });
    const qel2 = { node: qel };
    slot.appendChild(qel);
    if (qel._focus) qel._focus();
    updateMeta();
  }

  function showNext(ok) {
    clearNode(foot);
    const next = el('button', { class: 'btn btn-primary' },
      i + 1 >= cfg.questions.length ? 'See results →' : 'Next question →');
    next.addEventListener('click', () => { i++; render(); });
    foot.appendChild(SAT.ui.verdict(ok));
    foot.appendChild(next);
    next.focus();
  }

  function updateMeta() {
    bar.firstChild.style.width = (i / cfg.questions.length * 100) + '%';
    meta.textContent = `Question ${i + 1} of ${cfg.questions.length} · ${correct} correct`;
  }

  function finish() {
    bar.firstChild.style.width = '100%';
    const total = cfg.questions.length;
    const acc = total ? correct / total : 0;
    const secs = Math.round((performance.now() - startTs) / 1000);
    clearNode(slot); clearNode(foot); clearNode(meta);
    const est = SAT.scoring.sectionScore(cfg.section, acc, 'hard');
    slot.appendChild(el('div', { class: 'result-card' },
      el('div', { class: 'result-big' }, SAT.ui.pct(acc)),
      el('div', { class: 'result-sub' }, `${correct} / ${total} correct · ${fmtTime(secs)}`),
      el('div', { class: 'result-note subtle' },
        `If you sustained ${SAT.ui.pct(acc)} across a full ${cfg.section === 'rw' ? 'R&W' : 'Math'} section on the hard path, that’s roughly a ${est} (estimate).`),
    ));
    const again = el('button', { class: 'btn btn-primary' }, 'Practice again');
    again.addEventListener('click', () => { location.hash = '#/practice'; });
    const dash = el('button', { class: 'btn' }, 'View progress');
    dash.addEventListener('click', () => { location.hash = '#/progress'; });
    foot.appendChild(again); foot.appendChild(dash);
  }

  // keyboard shortcuts
  root._keys = e => {
    if (i >= cfg.questions.length) return;
    const q = cfg.questions[i];
    if (q && q.format !== 'grid' && /^[1-4]$/.test(e.key)) {
      const btn = slot.querySelectorAll('.choice')[+e.key - 1];
      if (btn && !btn.disabled) btn.click();
    }
    if (e.key === 'Enter') {
      const nx = foot.querySelector('.btn-primary');
      if (nx) nx.click();
    }
  };
  document.addEventListener('keydown', root._keys);
}

function fmtTime(s) {
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}
