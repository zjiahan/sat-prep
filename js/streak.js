/* =====================================================================
 * streak.js — Endless Ladder: random mixed R&W + Math questions that
 * ramp easy -> medium -> hard as your streak grows. One miss ends the
 * run; your best streak is saved. Try again to beat it.
 * ===================================================================== */
window.SAT = window.SAT || {};
SAT.views = SAT.views || {};

SAT.views.streak = function (root) {
  const { el, clearNode, question } = SAT.ui;
  clearNode(root);

  const best0 = SAT.store.bestStreak();
  const run = { streak: 0, seen: new Set() };

  const page = el('div', { class: 'page streak-page' });

  // Scoreboard
  const curEl = el('div', { class: 'streak-cur' }, '0');
  const tierEl = el('span', { class: 'pill pill-diff pill-easy' }, 'Easy');
  const secEl = el('span', { class: 'pill' }, '');
  const bestEl = el('div', { class: 'streak-best subtle' }, 'Best: ' + best0);
  const board = el('div', { class: 'streak-board' },
    el('div', { class: 'streak-cur-wrap' },
      el('div', { class: 'streak-flame' }, '🔥'),
      curEl,
      el('div', { class: 'streak-label' }, 'streak')),
    el('div', { class: 'streak-meta' },
      el('div', { class: 'streak-tier' }, 'Next: ', secEl, tierEl),
      bestEl),
  );
  page.appendChild(board);

  page.appendChild(el('p', { class: 'subtle streak-hint' },
    'Mixed English & Math. It gets harder the longer you last. One wrong answer ends the run.'));

  const slot = el('div', { class: 'streak-slot run-slot' });
  page.appendChild(slot);
  const foot = el('div', { class: 'run-foot' });
  page.appendChild(foot);
  root.appendChild(page);

  nextQ();

  function nextQ() {
    clearNode(foot);
    const q = SAT.engine.streakPick(run.streak, run.seen);
    if (!q) return cleared();
    run.seen.add(q.id);

    const diff = SAT.engine.streakDifficulty(run.streak);
    tierEl.textContent = _streakCap(diff);
    tierEl.className = 'pill pill-diff pill-' + diff;
    secEl.textContent = q.section === 'rw' ? 'R&W' : 'Math';
    secEl.className = 'pill pill-' + q.section;

    let answered = false;
    const qel = question(q, {
      showMeta: false,
      onAnswer(choice) {
        if (answered) return;
        answered = true;
        const ok = SAT.engine.isCorrect(q, choice);
        SAT.store.recordAttempt({
          qid: q.id, section: q.section, domain: q.domain, type: q.type,
          difficulty: q.difficulty, correct: ok, choice, mode: 'streak', elapsedMs: 0,
        });
        const revealed = question(q, { reveal: true, chosen: choice, locked: true, showMeta: false });
        slot.replaceChild(revealed, holder.node);
        holder.node = revealed;
        if (ok) onCorrect(); else onWrong();
      },
    });
    const holder = { node: qel };
    clearNode(slot);
    slot.appendChild(qel);
    if (qel._focus) qel._focus();
  }

  function onCorrect() {
    run.streak++;
    curEl.textContent = String(run.streak);
    curEl.classList.remove('pop'); void curEl.offsetWidth; curEl.classList.add('pop');
    if (run.streak > best0) bestEl.textContent = 'Best: ' + run.streak + ' ✨ (live record)';

    clearNode(foot);
    const cont = el('button', { class: 'btn btn-primary' }, 'Continue →');
    cont.addEventListener('click', nextQ);
    foot.appendChild(el('div', { class: 'verdict verdict-ok' }, _streakMsg(run.streak)));
    foot.appendChild(cont);
    cont.focus();
  }

  function onWrong() {
    const res = SAT.store.recordStreakRun(run.streak);
    clearNode(foot);
    foot.appendChild(el('div', { class: 'streak-over' },
      el('div', { class: 'verdict verdict-bad' }, 'Streak ended at ' + run.streak),
      (res.isRecord && run.streak > 0)
        ? el('div', { class: 'streak-record' }, '🏆 New best streak — ' + run.streak + '!')
        : el('div', { class: 'subtle' }, 'Best: ' + res.best + (run.streak ? ` · you needed ${res.best - run.streak + 1} more` : '')),
    ));
    const again = el('button', { class: 'btn btn-primary' }, 'Try again');
    again.addEventListener('click', () => SAT.views.streak(root));
    const home = el('button', { class: 'btn' }, 'Home');
    home.addEventListener('click', () => { location.hash = '#/'; });
    foot.appendChild(el('div', { class: 'actions' }, again, home));
    again.focus();
  }

  function cleared() {
    const res = SAT.store.recordStreakRun(run.streak);
    clearNode(slot); clearNode(foot);
    slot.appendChild(el('div', { class: 'result-card' },
      el('div', { class: 'result-big' }, String(run.streak)),
      el('div', { class: 'result-sub' }, 'You cleared every available question without a miss!'),
      el('div', { class: 'subtle' }, 'Best: ' + res.best)));
    const again = el('button', { class: 'btn btn-primary' }, 'Play again');
    again.addEventListener('click', () => SAT.views.streak(root));
    foot.appendChild(again);
  }

  // keyboard: 1-4 to answer, Enter to continue / retry
  root._keys = e => {
    if (/^[1-4]$/.test(e.key)) {
      const b = slot.querySelectorAll('.choice')[+e.key - 1];
      if (b && !b.disabled) b.click();
    } else if (e.key === 'Enter') {
      const b = foot.querySelector('.btn-primary');
      if (b) b.click();
    }
  };
  document.addEventListener('keydown', root._keys);
};

function _streakCap(s) { return s[0].toUpperCase() + s.slice(1); }
function _streakMsg(n) {
  if (n === 3) return 'Correct — stepping up to Medium ⬆';
  if (n === 7) return 'Correct — Hard tier unlocked 🔥';
  if (n % 10 === 0) return 'Correct! ' + n + ' in a row 🔥🔥';
  if (n % 5 === 0) return 'Correct! ' + n + ' streak 🔥';
  return 'Correct!';
}
