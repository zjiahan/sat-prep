/* =====================================================================
 * lessons.js — strategy & concept lessons, with an optional inline
 * mini-drill at the end of each lesson.
 * ===================================================================== */
window.SAT = window.SAT || {};
SAT.views = SAT.views || {};

SAT.views.lessons = function (root, params) {
  const { el, clearNode, fmt } = SAT.ui;
  clearNode(root);
  const lessons = window.SAT_LESSONS || [];

  if (params && params.id) {
    const l = lessons.find(x => x.id === params.id);
    if (l) return renderLesson(root, l);
  }

  const page = el('div', { class: 'page' });
  page.appendChild(el('h1', null, 'Lessons & strategy'));
  page.appendChild(el('p', { class: 'subtle' }, 'Short, high-leverage lessons: how each question type works, the traps, and the exact tactics for 700+ R&W and a perfect 800 Math.'));

  // Group by tag
  const groups = {};
  lessons.forEach(l => { (groups[l.group] = groups[l.group] || []).push(l); });
  const order = ['Strategy', 'Reading & Writing', 'Math', 'Test day'];
  order.filter(g => groups[g]).forEach(g => {
    page.appendChild(el('h2', null, g));
    const grid = el('div', { class: 'lesson-grid' });
    groups[g].forEach(l => {
      const card = el('a', { class: 'lesson-card', href: '#/lessons/' + l.id },
        el('div', { class: 'lc-tag' }, l.tag || g),
        el('h3', null, l.title),
        el('p', { class: 'subtle' }, l.summary),
        l.minutes ? el('div', { class: 'lc-min' }, l.minutes + ' min read') : null,
      );
      grid.appendChild(card);
    });
    page.appendChild(grid);
  });

  if (!lessons.length) page.appendChild(el('p', { class: 'subtle' }, 'Lessons are being loaded…'));
  root.appendChild(page);
};

function renderLesson(root, l) {
  const { el, clearNode, fmt } = SAT.ui;
  clearNode(root);
  const page = el('div', { class: 'page lesson-read' });
  page.appendChild(el('div', { class: 'actions' },
    el('a', { class: 'btn btn-sm', href: '#/lessons' }, '← All lessons')));
  page.appendChild(el('div', { class: 'lc-tag' }, l.tag || l.group));
  page.appendChild(el('h1', null, l.title));
  page.appendChild(el('div', { class: 'article', html: mdToHtml(l.body) }));

  // optional inline practice
  if (l.practice && l.practice.length) {
    const ids = l.practice;
    const qs = SAT.engine.filter({ ids }).length ? SAT.engine.filter({ ids })
      : (l.practiceCrit ? SAT.engine.sample(l.practiceCrit, 5) : []);
    if (qs.length) {
      const startBtn = el('button', { class: 'btn btn-primary' }, 'Practice this now →');
      startBtn.addEventListener('click', () => {
        SAT.views.practice._pending = { title: l.title + ' — practice', section: qs[0].section, mode: 'lesson', questions: qs };
        location.hash = '#/practice/run';
      });
      page.appendChild(el('div', { class: 'lesson-cta' },
        el('h3', null, 'Lock it in'),
        el('p', { class: 'subtle' }, 'Do a quick set on this skill while it’s fresh.'),
        startBtn));
    }
  } else if (l.practiceCrit) {
    const qs = SAT.engine.sample(l.practiceCrit, 6);
    if (qs.length) {
      const startBtn = el('button', { class: 'btn btn-primary' }, 'Practice this now →');
      startBtn.addEventListener('click', () => {
        SAT.views.practice._pending = { title: l.title + ' — practice', section: qs[0].section, mode: 'lesson', questions: qs };
        location.hash = '#/practice/run';
      });
      page.appendChild(el('div', { class: 'lesson-cta' },
        el('h3', null, 'Lock it in'),
        el('p', { class: 'subtle' }, 'Do a quick set on this skill while it’s fresh.'),
        startBtn));
    }
  }

  root.appendChild(page);
  window.scrollTo(0, 0);
}

/* Minimal Markdown -> HTML for lesson bodies.
 * Supports: # / ## / ### headers, - bullets, 1. numbered, **bold**,
 * *italic*, `code`, > blockquote, --- rule, and paragraphs. */
function mdToHtml(md) {
  if (!md) return '';
  const esc = SAT.ui.esc;
  const lines = md.replace(/\r/g, '').split('\n');
  let html = '', inUl = false, inOl = false;
  const closeLists = () => {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  };
  const inline = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^### /.test(line)) { closeLists(); html += '<h3>' + inline(line.slice(4)) + '</h3>'; }
    else if (/^## /.test(line)) { closeLists(); html += '<h2>' + inline(line.slice(3)) + '</h2>'; }
    else if (/^# /.test(line)) { closeLists(); html += '<h1>' + inline(line.slice(2)) + '</h1>'; }
    else if (/^---+$/.test(line)) { closeLists(); html += '<hr>'; }
    else if (/^> /.test(line)) { closeLists(); html += '<blockquote>' + inline(line.slice(2)) + '</blockquote>'; }
    else if (/^- /.test(line)) { if (!inUl) { closeLists(); html += '<ul>'; inUl = true; } html += '<li>' + inline(line.slice(2)) + '</li>'; }
    else if (/^\d+\. /.test(line)) { if (!inOl) { closeLists(); html += '<ol>'; inOl = true; } html += '<li>' + inline(line.replace(/^\d+\.\s/, '')) + '</li>'; }
    else if (line.trim() === '') { closeLists(); }
    else { closeLists(); html += '<p>' + inline(line) + '</p>'; }
  }
  closeLists();
  return html;
}
