/* =====================================================================
 * config.js — single source of truth for the Digital SAT structure,
 * content taxonomy, timing, and score-estimation tables.
 *
 * All numbers reflect the College Board Digital SAT (Bluebook) as of 2026.
 * They live in ONE place so they are trivial to update if the test changes.
 * ===================================================================== */
window.SAT = window.SAT || {};

SAT.config = {
  /* ---- Target scores (the user's goal) ---- */
  targets: { total: 1500, rw: 700, math: 800 },

  /* ---- Section / module structure ---------------------------------- */
  // The real test routes module 1 -> an easier or harder module 2 (MST).
  // Each module mixes difficulties; counts below are per-module.
  sections: {
    rw: {
      key: 'rw',
      name: 'Reading & Writing',
      short: 'R&W',
      modules: 2,
      questionsPerModule: 27,   // 54 total
      minutesPerModule: 32,     // 64 min total
      scaled: { min: 200, max: 800 },
    },
    math: {
      key: 'math',
      name: 'Math',
      short: 'Math',
      modules: 2,
      questionsPerModule: 22,   // 44 total
      minutesPerModule: 35,     // 70 min total
      scaled: { min: 200, max: 800 },
    },
  },
  totalMinutes: 134,            // + a 10-minute break between sections
  breakMinutes: 10,

  /* ---- Content domains & question types ----------------------------
   * Weights are approximate share of scored questions per section.    */
  domains: {
    rw: [
      {
        key: 'info',
        name: 'Information and Ideas',
        weight: 0.26,
        blurb: 'Locate, interpret, and reason from explicit and implicit information, including data in graphs and tables.',
        types: [
          'Central Ideas and Details',
          'Command of Evidence (Textual)',
          'Command of Evidence (Quantitative)',
          'Inferences',
        ],
      },
      {
        key: 'craft',
        name: 'Craft and Structure',
        weight: 0.28,
        blurb: 'High-utility vocabulary in context, the purpose and structure of texts, and connections across paired passages.',
        types: [
          'Words in Context',
          'Text Structure and Purpose',
          'Cross-Text Connections',
        ],
      },
      {
        key: 'express',
        name: 'Expression of Ideas',
        weight: 0.20,
        blurb: 'Revise text to meet a rhetorical goal and choose logical transitions between ideas.',
        types: [
          'Rhetorical Synthesis',
          'Transitions',
        ],
      },
      {
        key: 'conventions',
        name: 'Standard English Conventions',
        weight: 0.26,
        blurb: 'Edit for grammar, usage, and punctuation — sentence boundaries, structure, and agreement.',
        types: [
          'Boundaries',
          'Form, Structure, and Sense',
        ],
      },
    ],
    math: [
      {
        key: 'algebra',
        name: 'Algebra',
        weight: 0.35,
        blurb: 'Linear equations, inequalities, systems, and their graphs and word problems.',
        types: [
          'Linear equations in 1 variable',
          'Linear equations in 2 variables',
          'Linear functions',
          'Systems of linear equations',
          'Linear inequalities',
        ],
      },
      {
        key: 'advanced',
        name: 'Advanced Math',
        weight: 0.35,
        blurb: 'Nonlinear relationships: quadratics, exponentials, polynomials, radicals, and function notation.',
        types: [
          'Equivalent expressions',
          'Nonlinear equations & systems',
          'Nonlinear functions (quadratic, exponential, polynomial)',
        ],
      },
      {
        key: 'data',
        name: 'Problem-Solving and Data Analysis',
        weight: 0.15,
        blurb: 'Ratios, rates, percentages, units, probability, statistics, and reading data displays.',
        types: [
          'Ratios, rates, proportions & units',
          'Percentages',
          'One- & two-variable data; statistics',
          'Probability & conditional probability',
          'Inference from sample statistics & margin of error',
        ],
      },
      {
        key: 'geometry',
        name: 'Geometry and Trigonometry',
        weight: 0.15,
        blurb: 'Area & volume, lines & angles, triangles, circles, and right-triangle trigonometry.',
        types: [
          'Area & volume',
          'Lines, angles & triangles',
          'Right triangles & trigonometry',
          'Circles',
        ],
      },
    ],
  },

  difficulties: ['easy', 'medium', 'hard'],

  /* ---- Score estimation -------------------------------------------
   * The real digital SAT is adaptive, so there is no single public
   * raw->scaled table. These piecewise-linear anchors approximate a
   * "hard module 2" path (the only path that can reach 800/top R&W).
   * They are clearly labeled as ESTIMATES in the UI.
   * raw = number correct out of the section's scored questions.       */
  scoring: {
    rwScored: 54,
    mathScored: 44,
    // Anchor points: [fractionCorrect, scaledScore] on the hard path.
    rwAnchorsHard: [
      [0.00, 200], [0.20, 330], [0.40, 450], [0.55, 540],
      [0.70, 620], [0.80, 680], [0.90, 740], [0.96, 780], [1.00, 800],
    ],
    mathAnchorsHard: [
      [0.00, 200], [0.20, 340], [0.40, 470], [0.55, 560],
      [0.70, 640], [0.82, 710], [0.91, 760], [0.97, 790], [1.00, 800],
    ],
    // If a student does NOT clear module 1 well, they take the easy
    // module 2 and the section score is capped well below the max.
    easyPathCap: { rw: 600, math: 610 },
    // Module-1 score needed (fraction correct) to route to hard module 2.
    hardRouteThreshold: { rw: 0.63, math: 0.60 },
  },

  /* ---- Pacing guidance (seconds per question) --------------------- */
  pacing: {
    rw: Math.round((32 * 60) / 27),   // ~71s
    math: Math.round((35 * 60) / 22), // ~95s
  },

  /* ---- External resources (official + reputable, free first) ------ */
  resources: [
    { name: 'Bluebook — official practice tests', url: 'https://bluebook.collegeboard.org/', free: true,
      note: 'The real testing app. 6 full official adaptive practice tests — your single most important resource.' },
    { name: 'Khan Academy — Official Digital SAT Practice', url: 'https://www.khanacademy.org/digital-sat', free: true,
      note: 'Free, College-Board-endorsed. Personalized practice tied to your official scores.' },
    { name: 'College Board — SAT Question Bank', url: 'https://satsuitequestionbank.collegeboard.org/', free: true,
      note: 'Thousands of real retired questions filterable by domain and difficulty.' },
    { name: 'College Board — SAT homepage', url: 'https://satsuite.collegeboard.org/sat', free: true,
      note: 'Registration, test dates, score release, and policies.' },
    { name: 'Desmos test calculator', url: 'https://www.desmos.com/testing/cb-digital-sat', free: true,
      note: 'The exact graphing calculator built into the Math section — practice with it.' },
  ],
};

/* Flat helper lists derived from the taxonomy above. */
SAT.config.allDomains = function (section) {
  return SAT.config.domains[section].map(d => d.name);
};
SAT.config.allTypes = function (section) {
  return SAT.config.domains[section].flatMap(d => d.types);
};
SAT.config.domainOfType = function (section, type) {
  const d = SAT.config.domains[section].find(d => d.types.includes(type));
  return d ? d.name : null;
};
