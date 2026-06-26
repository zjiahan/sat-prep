/* =====================================================================
 * ui.js — tiny DOM helpers + the shared question renderer.
 * No framework: just functions that build elements / HTML strings.
 * ===================================================================== */
window.SAT = window.SAT || {};

SAT.ui = (function () {
  /* Create an element with props + children. */
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === 'class') node.className = props[k];
        else if (k === 'html') node.innerHTML = props[k];
        else if (k === 'dataset') Object.assign(node.dataset, props[k]);
        else if (k.startsWith('on') && typeof props[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        } else if (props[k] != null && props[k] !== false) {
          node.setAttribute(k, props[k]);
        }
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Lightweight inline formatting for passages/prompts/explanations:
   * **bold**, *italic*, _underline_, `code`, $math$ (kept literal),
   * paragraph breaks on blank lines. Input is escaped first. */
  function fmt(text) {
    if (text == null) return '';
    let t = esc(text);
    t = t
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return '<p>' + t + '</p>';
  }

  /* Render an optional figure attached to a question. */
  function figure(fig) {
    if (!fig) return null;
    if (fig.type === 'table') {
      const thead = el('thead', null,
        el('tr', null, ...(fig.headers || []).map(h => el('th', null, String(h)))));
      const tbody = el('tbody', null,
        ...(fig.rows || []).map(r => el('tr', null, ...r.map(c => el('td', null, String(c))))));
      const wrap = el('div', { class: 'figure' });
      if (fig.title) wrap.appendChild(el('div', { class: 'figure-title' }, fig.title));
      wrap.appendChild(el('table', { class: 'data-table' }, thead, tbody));
      if (fig.note) wrap.appendChild(el('div', { class: 'figure-note' }, fig.note));
      return wrap;
    }
    if (fig.type === 'note' || fig.type === 'text') {
      return el('div', { class: 'figure figure-text', html: fmt(fig.text) });
    }
    if (fig.type === 'svg') {
      return el('div', { class: 'figure', html: fig.svg });
    }
    return null;
  }

  /* Render one question into a container.
   * opts: { onAnswer(choiceIdxOrStr), reveal:bool, chosen, locked, showMeta }
   * Returns the root element. */
  function question(q, opts = {}) {
    const root = el('div', { class: 'question', dataset: { qid: q.id } });

    if (opts.showMeta !== false) {
      root.appendChild(el('div', { class: 'q-meta' },
        el('span', { class: 'pill pill-' + q.section }, q.section === 'rw' ? 'R&W' : 'Math'),
        el('span', { class: 'pill' }, q.domain),
        el('span', { class: 'pill pill-diff pill-' + q.difficulty }, q.difficulty),
      ));
    }

    if (q.passage) root.appendChild(el('div', { class: 'q-passage', html: fmt(q.passage) }));
    const f = figure(q.figure);
    if (f) root.appendChild(f);
    root.appendChild(el('div', { class: 'q-prompt', html: fmt(q.prompt) }));

    if (q.format === 'grid') {
      // student-produced response
      const input = el('input', { class: 'grid-input', type: 'text', placeholder: 'Type your answer', autocomplete: 'off' });
      const submit = el('button', { class: 'btn btn-primary' }, 'Submit');
      const row = el('div', { class: 'grid-row' }, input, submit);
      const act = () => { if (!opts.locked) opts.onAnswer && opts.onAnswer(input.value.trim()); };
      submit.addEventListener('click', act);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') act(); });
      root.appendChild(row);
      if (opts.reveal) {
        const ok = SAT.engine.gridCorrect(q, opts.chosen);
        root.appendChild(verdict(ok, 'Accepted answers: ' + (q.accept || []).join(', ')));
      }
      root._focus = () => input.focus();
    } else {
      const list = el('div', { class: 'choices' });
      q.choices.forEach((c, i) => {
        const letter = 'ABCD'[i];
        const btn = el('button', {
          class: 'choice', dataset: { idx: i }, type: 'button',
        },
          el('span', { class: 'choice-letter' }, letter),
          el('span', { class: 'choice-text', html: fmt(c).replace(/^<p>|<\/p>$/g, '') }),
        );
        if (opts.reveal) {
          if (i === q.answer) btn.classList.add('correct');
          else if (i === opts.chosen) btn.classList.add('wrong');
        } else if (i === opts.chosen) {
          btn.classList.add('selected');
        }
        if (opts.locked) btn.disabled = true;
        btn.addEventListener('click', () => { if (!opts.locked) opts.onAnswer && opts.onAnswer(i); });
        list.appendChild(btn);
      });
      root.appendChild(list);
    }

    if (opts.reveal && q.explanation) {
      root.appendChild(el('div', { class: 'explanation' },
        el('div', { class: 'explanation-h' }, 'Explanation'),
        el('div', { html: fmt(q.explanation) }),
        q.type ? el('div', { class: 'explanation-tag' }, q.type) : null,
      ));
    }
    return root;
  }

  function verdict(ok, detail) {
    return el('div', { class: 'verdict ' + (ok ? 'verdict-ok' : 'verdict-bad') },
      ok ? '✓ Correct' : '✗ Not quite', detail ? el('div', { class: 'verdict-detail' }, detail) : null);
  }

  /* Toast notifications. */
  let toastTimer;
  function toast(msg, kind) {
    let t = document.getElementById('toast');
    if (!t) { t = el('div', { id: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, 2200);
  }

  /* Modal dialog. content is an element or HTML string. */
  function modal(title, content, actions) {
    const overlay = el('div', { class: 'modal-overlay' });
    const body = typeof content === 'string' ? el('div', { html: content }) : content;
    const foot = el('div', { class: 'modal-foot' });
    (actions || [{ label: 'Close', primary: true }]).forEach(a => {
      const b = el('button', { class: 'btn ' + (a.primary ? 'btn-primary' : '') }, a.label);
      b.addEventListener('click', () => { if (a.onClick) a.onClick(); if (a.keepOpen !== true) close(); });
      foot.appendChild(b);
    });
    const box = el('div', { class: 'modal' },
      el('div', { class: 'modal-head' }, el('h3', null, title),
        el('button', { class: 'modal-x', onclick: () => close() }, '×')),
      el('div', { class: 'modal-body' }, body), foot);
    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    return { close };
  }

  function pct(x) { return Math.round((x || 0) * 100) + '%'; }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  return { el, esc, fmt, figure, question, verdict, toast, modal, pct, clearNode };
})();
