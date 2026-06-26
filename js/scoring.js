/* =====================================================================
 * scoring.js — converts raw performance into ESTIMATED scaled scores,
 * modelling the digital SAT's multistage-adaptive (MST) routing.
 *
 * The real exam's curve is secret and varies per form. We use published
 * behaviour to anchor a piecewise-linear estimate, and we model the key
 * fact the user must internalize: you can only reach the top of the
 * range by clearing module 1 and earning the HARD module 2.
 * ===================================================================== */
window.SAT = window.SAT || {};

SAT.scoring = (function () {
  const C = SAT.config.scoring;

  // Piecewise-linear interpolation over [fraction, scaled] anchor points.
  function interp(anchors, frac) {
    frac = Math.max(0, Math.min(1, frac));
    for (let i = 1; i < anchors.length; i++) {
      const [f0, s0] = anchors[i - 1];
      const [f1, s1] = anchors[i];
      if (frac <= f1) {
        const t = (frac - f0) / (f1 - f0 || 1);
        return Math.round(s0 + t * (s1 - s0));
      }
    }
    return anchors[anchors.length - 1][1];
  }

  // Round to the nearest 10 (SAT scaled scores are multiples of 10).
  const round10 = s => Math.round(s / 10) * 10;

  /* Estimate a section score from a *practice set* of arbitrary size.
   * fractionCorrect drives a hard-path curve; if `route` is 'easy' the
   * score is capped to reflect the easier module 2. */
  function sectionScore(section, fractionCorrect, route) {
    const anchors = section === 'rw' ? C.rwAnchorsHard : C.mathAnchorsHard;
    let scaled = interp(anchors, fractionCorrect);
    if (route === 'easy') {
      const cap = section === 'rw' ? C.easyPathCap.rw : C.easyPathCap.math;
      scaled = Math.min(scaled, cap);
    }
    scaled = Math.max(200, Math.min(800, scaled));
    return round10(scaled);
  }

  /* Decide which module-2 path a module-1 performance unlocks. */
  function routeFor(section, module1Fraction) {
    const t = section === 'rw' ? C.hardRouteThreshold.rw : C.hardRouteThreshold.math;
    return module1Fraction >= t ? 'hard' : 'easy';
  }

  /* Full mock scoring: combine module 1 + module 2 with routing. */
  function mockSection(section, m1Correct, m1Total, m2Correct, m2Total) {
    const m1Frac = m1Total ? m1Correct / m1Total : 0;
    const route = routeFor(section, m1Frac);
    const totalCorrect = m1Correct + m2Correct;
    const totalQ = m1Total + m2Total;
    const frac = totalQ ? totalCorrect / totalQ : 0;
    const scaled = sectionScore(section, frac, route);
    return {
      route,
      m1Correct, m1Total, m2Correct, m2Total,
      raw: totalCorrect, total: totalQ,
      acc: frac,
      scaled,
    };
  }

  /* Given a target section score, estimate the fraction correct required
   * on the hard path (used for the "what you need" coaching). */
  function fractionForTarget(section, targetScaled) {
    const anchors = section === 'rw' ? C.rwAnchorsHard : C.mathAnchorsHard;
    for (let i = 1; i < anchors.length; i++) {
      const [f0, s0] = anchors[i - 1];
      const [f1, s1] = anchors[i];
      if (targetScaled <= s1) {
        const t = (targetScaled - s0) / (s1 - s0 || 1);
        return Math.max(0, Math.min(1, f0 + t * (f1 - f0)));
      }
    }
    return 1;
  }

  /* How many questions you can miss (out of scored total) for a target. */
  function missesAllowed(section, targetScaled) {
    const scored = section === 'rw' ? C.rwScored : C.mathScored;
    const frac = fractionForTarget(section, targetScaled);
    return Math.max(0, Math.floor(scored * (1 - frac)));
  }

  return { sectionScore, routeFor, mockSection, fractionForTarget, missesAllowed, round10 };
})();
