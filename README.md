# SAT Trainer — your road to 1500+

A focused, **zero-dependency** web app for preparing for the **Digital SAT** (College Board / Bluebook format). Built around one student profile: aiming for **1500+**, with **700+ Reading & Writing** and a **perfect 800 Math**.

There is nothing to install to *use* it. Open `index.html` and study.

```bash
# Option A — just open it
open index.html            # macOS  (double-click also works)

# Option B — run a tiny local server (nicer URLs, identical behavior)
python3 -m http.server 8123   # then visit http://localhost:8123
```

Your progress, error log, mock scores, and settings are saved in your browser (`localStorage`) — private, on-device, and persistent across sessions.

---

## Why this app is built the way it is

The digital SAT is **section-adaptive**. Each section has two modules; how you do on **Module 1** routes you to an easier or harder **Module 2** — and *only the hard Module 2 can reach the top of the score range.* Everything here is designed around that reality:

| Goal | What the app does about it |
|---|---|
| **Understand the adaptive format** | The full-length mock actually routes you Module 1 → (easy/hard) Module 2 and shows your ceiling, so the format is never a surprise. |
| **700+ R&W** | An adaptive practice bank that over-weights your weak domains and the highest-leverage question types (Command of Evidence, Transitions, Inferences, Rhetorical Synthesis). |
| **800 Math** | Hard-only drills to train the Module-2 path, a Desmos calculator + reference sheet, and a lesson devoted to *eliminating careless errors* — the real limiter at 800. |
| **Steady improvement** | Per-domain / per-type / per-difficulty analytics, an automatic **error log**, and a week-by-week **study plan** driven by your actual data and test date. |

---

## Features

- **Adaptive practice bank** — drill by section / domain / difficulty, or let *Adaptive mode* target your weak spots. Immediate feedback + full explanations. Keyboard shortcuts (1–4 to answer, Enter for next).
- **Streak ladder** — an endless, mixed English + Math drill that ramps **easy → medium → hard** as your streak grows. One wrong answer ends the run; your **best streak** is saved so you can keep trying to beat it. Pure momentum practice.
- **Full-length, module-adaptive mock tests** — real timing (R&W 2×32 min, Math 2×35 min), a question navigator with flag-for-review, the 10-minute break, true Module-1→Module-2 routing, and an estimated scaled score per section + total.
- **Lessons & strategy** — short, high-leverage playbooks for every question type plus the specific 1500+/700+/800 tactics.
- **Progress & analytics** — accuracy by domain, difficulty, and question type; mock-score history vs. your 1500 target; a reviewable error log.
- **Study plan** — enter your test date and get a diagnosis-driven weekly routine and your target in raw terms ("for 800 Math you can miss about N").

---

## The Digital SAT, at a glance

| | Reading & Writing | Math |
|---|---|---|
| Modules | 2 | 2 |
| Questions/module | 27 | 22 |
| Total questions | 54 | 44 |
| Time/module | 32 min | 35 min |
| Section time | 64 min | 70 min |

- **Total:** 98 questions, 134 minutes, one 10-minute break. Each section scores **200–800**; total **400–1600**.
- Each module has **2 unscored pretest questions** (indistinguishable — answer everything).
- **No wrong-answer penalty** — always fill in an answer.
- Calculator (built-in **Desmos** + a reference sheet) is allowed **throughout Math**; none on R&W.

Full sourced research lives in [`docs/SAT-content-and-strategy-bible.md`](docs/SAT-content-and-strategy-bible.md).

> **Scores are estimates.** The real exam re-curves every form via Item Response Theory and folds in which Module 2 you got; there's no public conversion chart. Use the app's scores to track *trends*, not as a guaranteed prediction. The one irreplaceable resource is the **official Bluebook practice tests** — this app is built to make those (and your real prep) far more effective.

---

## How the question bank was built

Questions are **original** (not copied from College Board) and quality-controlled:

1. **Research** — a multi-agent pass over official + reputable sources produced the content/strategy bible in `docs/`.
2. **Authoring** — items were written per (section, domain, difficulty) to match real SAT style and calibration.
3. **Adversarial verification** — every item was **independently re-solved by a separate reviewer**; only items where the independent solution matched the answer key *and* exactly one option was defensible were kept. Mismatches were dropped (fail-closed for correctness).

Run `node test/verify-bank.js` to re-check the bank's integrity at any time.

---

## Project layout

```
index.html            App shell + script load order
css/styles.css        Design system (dark/light)
js/
  config.js           Test structure, taxonomy, scoring tables (single source of truth)
  store.js            localStorage persistence + analytics
  scoring.js          Raw → estimated scaled score, with adaptive routing
  ui.js               DOM helpers + the question renderer
  engine.js           Filtering, sampling, adaptive selection, mock assembly
  practice.js         Practice/drill view
  streak.js           Endless streak-ladder view
  mock.js             Full-length module-adaptive mock view
  lessons.js          Lessons view
  dashboard.js        Home, Progress, Study Plan views
  app.js              Router + boot
data/
  questions.js        The question bank (window.SAT_QUESTIONS)
  lessons.js          Lessons (window.SAT_LESSONS)
docs/                 Research bible + briefs
test/                 jsdom smoke test + bank validator
```

## Testing

```bash
npm install      # installs jsdom (dev-only; the app itself needs no deps)
npm test         # loads the app in a real DOM and exercises every route + a live answer
node test/verify-bank.js   # validates question-bank integrity
```

## How to study with it (the short version)

1. Take a **full mock** for a baseline (Home → Mock test).
2. Open **Study plan**, set your test date, follow the weekly rhythm.
3. Do **Adaptive practice** daily; after every set, **review every miss**.
4. Clear your **error log** regularly — re-doing missed questions is the highest-ROI habit.
5. Re-test with a full mock every 1–2 weeks and watch the trend climb toward 1500.
