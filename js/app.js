/* =====================================================================
 * app.js — boots the app: builds the shell, wires the hash router,
 * theme, and global keyboard cleanup between views.
 * ===================================================================== */
window.SAT = window.SAT || {};

(function () {
  const { el } = SAT.ui;

  const NAV = [
    { href: '#/', label: 'Home', icon: '◆' },
    { href: '#/practice', label: 'Practice', icon: '✎' },
    { href: '#/streak', label: 'Streak ladder', icon: '🔥' },
    { href: '#/mock', label: 'Mock test', icon: '◷' },
    { href: '#/lessons', label: 'Lessons', icon: '☰' },
    { href: '#/progress', label: 'Progress', icon: '▲' },
    { href: '#/plan', label: 'Study plan', icon: '✓' },
  ];

  let mainEl;

  function buildShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const brand = el('a', { class: 'brand', href: '#/' },
      el('span', { class: 'brand-mark' }, '1500'),
      el('span', { class: 'brand-name' }, 'SAT Trainer'));

    const nav = el('nav', { class: 'nav' });
    NAV.forEach(n => {
      nav.appendChild(el('a', { class: 'nav-link', href: n.href, dataset: { href: n.href } },
        el('span', { class: 'nav-icon' }, n.icon), el('span', null, n.label)));
    });

    const theme = el('button', { class: 'theme-btn', title: 'Toggle theme' }, '◐');
    theme.addEventListener('click', toggleTheme);

    const side = el('aside', { class: 'sidebar' }, brand, nav,
      el('div', { class: 'sidebar-foot' },
        theme,
        el('a', { class: 'subtle small', href: 'https://bluebook.collegeboard.org/', target: '_blank', rel: 'noopener' }, 'Official Bluebook ↗')));

    // mobile top bar
    const menuBtn = el('button', { class: 'menu-btn', onclick: () => side.classList.toggle('open') }, '☰');
    const topbar = el('div', { class: 'topbar' }, menuBtn, el('span', { class: 'brand-name' }, 'SAT Trainer'));

    mainEl = el('main', { class: 'main' });
    app.appendChild(side);
    app.appendChild(el('div', { class: 'content' }, topbar, mainEl));

    // close mobile menu on nav click
    nav.addEventListener('click', () => side.classList.remove('open'));
  }

  function setActiveNav(hash) {
    document.querySelectorAll('.nav-link').forEach(l => {
      const base = '#/' + (hash.split('/')[1] || '');
      l.classList.toggle('active', l.dataset.href === base || (base === '#/' && l.dataset.href === '#/'));
    });
  }

  /* ---- Router ---- */
  function route() {
    // cleanup previous view's key handler
    if (mainEl && mainEl._keys) { document.removeEventListener('keydown', mainEl._keys); mainEl._keys = null; }

    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\//, '').split('/');   // e.g. ['practice','run']
    const top = parts[0] || '';
    setActiveNav(hash);
    window.scrollTo(0, 0);

    try {
      if (top === '' || top === undefined) return SAT.views.home(mainEl);
      if (top === 'practice') {
        if (parts[1] === 'run') {
          const pending = SAT.views.practice._pending;
          if (pending) { SAT.views.practice._pending = null; return SAT.views.practice(mainEl, { run: pending }); }
          return SAT.views.practice(mainEl);  // no pending → show setup
        }
        return SAT.views.practice(mainEl);
      }
      if (top === 'mock') {
        if (parts[1] === 'run') {
          const pending = SAT.views.mock._pending;
          if (pending) { SAT.views.mock._pending = null; return SAT.views.mock(mainEl, { run: pending }); }
          return SAT.views.mock(mainEl);
        }
        return SAT.views.mock(mainEl);
      }
      if (top === 'streak') return SAT.views.streak(mainEl);
      if (top === 'lessons') return SAT.views.lessons(mainEl, { id: parts[1] });
      if (top === 'progress') return SAT.views.progress(mainEl);
      if (top === 'plan') return SAT.views.plan(mainEl);
      return SAT.views.home(mainEl);
    } catch (err) {
      console.error('route error', err);
      mainEl.innerHTML = '';
      mainEl.appendChild(el('div', { class: 'page' },
        el('h1', null, 'Something went wrong'),
        el('p', { class: 'subtle' }, String(err && err.message || err)),
        el('a', { class: 'btn btn-primary', href: '#/' }, 'Back home')));
    }
  }

  /* ---- Theme ---- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    SAT.store.setSetting('theme', t);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  /* ---- Boot ---- */
  function boot() {
    if (!window.SAT_QUESTIONS || !window.SAT_QUESTIONS.length) {
      console.warn('No question bank loaded.');
    }
    buildShell();
    applyTheme(SAT.store.getSetting('theme') || 'dark');
    window.addEventListener('hashchange', route);
    route();
    // expose coverage for debugging
    SAT.debug = { coverage: SAT.engine.coverage };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ---- Math reference sheet (provided on the real test) ---- */
SAT.refSheetHTML = function () {
  return `
  <p class="subtle small">These formulas are provided on the SAT Math section. Knowing them cold saves time.</p>
  <div class="ref-grid">
    <div><strong>Circle</strong><br>A = πr²<br>C = 2πr</div>
    <div><strong>Rectangle</strong><br>A = ℓw</div>
    <div><strong>Triangle</strong><br>A = ½bh</div>
    <div><strong>Right triangle</strong><br>c² = a² + b²</div>
    <div><strong>Special right △</strong><br>30-60-90: x, x√3, 2x<br>45-45-90: s, s, s√2</div>
    <div><strong>Rectangular solid</strong><br>V = ℓwh</div>
    <div><strong>Cylinder</strong><br>V = πr²h</div>
    <div><strong>Sphere</strong><br>V = (4/3)πr³</div>
    <div><strong>Cone</strong><br>V = (1/3)πr²h</div>
    <div><strong>Pyramid</strong><br>V = (1/3)ℓwh</div>
    <div><strong>Arc / angle</strong><br>Arc° = (central angle)·(arc fraction)</div>
    <div><strong>Facts</strong><br>360° in a circle · 2π radians<br>180° in a triangle</div>
  </div>`;
};
