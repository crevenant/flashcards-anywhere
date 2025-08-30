(() => {
  const api = {
    async decks() {
      const r = await fetch('/api/decks');
      if (!r.ok) throw new Error('Failed to load decks');
      return (await r.json()).decks || [];
    },
    async cards(deckName) {
      const url = deckName ? `/api/cards?deck=${encodeURIComponent(deckName)}` : '/api/cards';
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to load cards');
      return (await r.json()).cards || [];
    },
    async addCard(card) {
      const r = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card)
      });
      if (!r.ok) throw new Error('Failed to add card');
      return await r.json();
    }
  };

  const els = {
    deckSelect: document.getElementById('deck-select'),
    shuffleBtn: document.getElementById('shuffle-btn'),
    htmlToggle: document.getElementById('html-toggle'),
    toggleAddBtn: document.getElementById('toggle-add-btn'),
    card: document.getElementById('card'),
    front: document.getElementById('card-front'),
    frontText: document.getElementById('front-text'),
    choicesSection: document.getElementById('choices-section'),
    mcqChoices: document.getElementById('mcq-choices'),
    mcqCheck: document.getElementById('mcq-check'),
    mcqResult: document.getElementById('mcq-result'),
    back: document.getElementById('card-back'),
    prev: document.getElementById('prev-btn'),
    next: document.getElementById('next-btn'),
    pos: document.getElementById('position'),
    form: document.getElementById('add-form'),
    frontInput: document.getElementById('front-input'),
    backInput: document.getElementById('back-input'),
    backLabel: document.getElementById('back-label'),
    deckInput: document.getElementById('deck-input'),
    typeInput: document.getElementById('type-input'),
    mcqFields: document.getElementById('mcq-fields'),
    multiInput: document.getElementById('multi-input'),
    choicesInput: document.getElementById('choices-input'),
    answerInput: document.getElementById('answer-input'),
    answersInput: document.getElementById('answers-input'),
    singleAnswerRow: document.getElementById('single-answer-row'),
    multiAnswerRow: document.getElementById('multi-answer-row'),
    clearBtn: document.getElementById('clear-btn'),
    adderSection: document.getElementById('adder-section'),
  };

  let state = {
    cards: [],
    idx: 0,
    showBack: false,
    deckName: '',
    selected: null,
    correct: null,
    resetTimer: null,
    multiSelected: new Set(),
    multiChecked: false,
    allowHTML: false,
    showAdder: false,
    lastCardId: null,
    choiceOrder: null, // array mapping displayed index -> original index for current MCQ card
  };
  const DELAY_MS = 1200; // delay before reset/advance
  const FLIP_MS = 500;   // CSS flip transition duration (keep in sync with styles)

  // Allowlist-based HTML sanitizer for safe rendering
  const ALLOWED_TAGS = new Set(['b','strong','i','em','u','s','br','p','ul','ol','li','code','pre','ruby','rt','rb','rp','span']);
  function sanitizeHtmlToFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    function clean(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
          const frag = document.createDocumentFragment();
          node.childNodes.forEach(ch => { const c = clean(ch); if (c) frag.appendChild(c); });
          return frag;
        }
        const el = document.createElement(tag);
        node.childNodes.forEach(ch => { const c = clean(ch); if (c) el.appendChild(c); });
        return el;
      }
      return document.createTextNode('');
    }
    const out = document.createDocumentFragment();
    template.content.childNodes.forEach(n => { const c = clean(n); if (c) out.appendChild(c); });
    return out;
  }
  function renderSafe(el, text) {
    el.innerHTML = '';
    if (state.allowHTML) el.appendChild(sanitizeHtmlToFragment(String(text)));
    else el.textContent = String(text);
  }

  function renderDecks(decks) {
    els.deckSelect.innerHTML = '';
    const anyOpt = document.createElement('option');
    anyOpt.value = '';
    anyOpt.textContent = 'All Decks';
    els.deckSelect.appendChild(anyOpt);
    decks.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name;
      els.deckSelect.appendChild(opt);
    });
    els.deckSelect.value = state.deckName;
  }

  function renderCard() {
    if (!state.cards.length) {
      renderSafe(els.frontText, 'No cards yet');
      els.choicesSection.hidden = true;
      els.mcqChoices.hidden = true;
      els.mcqResult.hidden = true;
      renderSafe(els.back, 'Use the form below to add one');
      els.card.classList.toggle('flipped', state.showBack);
      els.pos.textContent = '0 / 0';
      return;
    }
    const c = state.cards[state.idx];
    // Prepare shuffled order for MCQ whenever entering a new card
    if ((c.type || 'basic') === 'mcq') {
      if (state.lastCardId !== c.id || !state.choiceOrder || state.choiceOrder.length !== (c.choices || []).length) {
        state.choiceOrder = Array.from({ length: (c.choices || []).length }, (_, i) => i);
        for (let i = state.choiceOrder.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.choiceOrder[i], state.choiceOrder[j]] = [state.choiceOrder[j], state.choiceOrder[i]];
        }
        state.lastCardId = c.id;
      }
    } else {
      state.choiceOrder = null;
      state.lastCardId = c.id;
    }
    renderSafe(els.frontText, c.front);
    if ((c.type || 'basic') === 'mcq') {
      // Build choices
      els.mcqChoices.innerHTML = '';
      const order = state.choiceOrder || (c.choices || []).map((_, i) => i);
      order.forEach((origIdx, i) => {
        const ch = c.choices[origIdx];
        const btn = document.createElement('button');
        btn.type = 'button';
        renderSafe(btn, ch);
        btn.className = 'choice';
        if (c.multi) {
          btn.addEventListener('click', () => toggleMultiChoice(i));
          if (state.multiSelected.has(i)) btn.classList.add('selected');
          if (state.multiChecked) {
            const isAnswer = (c.answers || []).includes(origIdx);
            if (isAnswer) btn.classList.add('correct');
            if (!isAnswer && state.multiSelected.has(i)) btn.classList.add('wrong');
          }
        } else {
          btn.addEventListener('click', () => selectChoice(i));
          if (state.selected === i) {
            btn.classList.add(state.correct ? 'correct' : 'wrong');
          }
        }
        els.mcqChoices.appendChild(btn);
      });
      els.choicesSection.hidden = false;
      els.mcqChoices.hidden = false;
      if (c.multi) {
        els.mcqCheck.hidden = false;
        if (state.multiChecked) {
          setResult(state.correct ? 'Correct!' : 'Wrong.', (c.answers || []).map(i => c.choices[i]));
          els.mcqResult.hidden = false;
        } else {
          clearResult();
          els.mcqResult.hidden = true;
        }
      } else {
        els.mcqCheck.hidden = true;
        if (state.selected == null) {
          clearResult();
          els.mcqResult.hidden = true;
        } else if (state.correct) {
          setResult('Correct!', []);
          els.mcqResult.hidden = false;
        } else {
          const correctText = c.answer != null ? c.choices[c.answer] : '';
          setResult('Wrong.', correctText ? [correctText] : []);
          els.mcqResult.hidden = false;
        }
      }
      renderSafe(els.back, '');
      // Keep card unflipped for MCQ
      state.showBack = false;
    } else {
      els.choicesSection.hidden = true;
      els.mcqChoices.hidden = true;
      els.mcqResult.hidden = true;
      els.mcqCheck.hidden = true;
      renderSafe(els.back, c.back);
    }
    els.card.classList.toggle('flipped', state.showBack);
    els.pos.textContent = `${state.idx + 1} / ${state.cards.length}`;
  }

  function next() {
    // Use animated transition for moving to the next card
    nextAnimated();
  }

  // Animated next transition: fade/slide out, swap, then fade/slide in
  function nextAnimated() {
    if (!state.cards.length) return;
    const cardEl = els.card;
    const doSwap = () => {
      state.idx = (state.idx + 1) % state.cards.length;
      state.showBack = false;
      state.selected = null; state.correct = null;
      state.multiSelected.clear(); state.multiChecked = false;
      clearTimer();
      renderCard();
    };
    // Start out animation
    cardEl.classList.remove('advance-in');
    cardEl.classList.add('advance-out');
    const onOut = () => {
      cardEl.removeEventListener('animationend', onOut);
      cardEl.classList.remove('advance-out');
      doSwap();
      // Animate in
      cardEl.classList.add('advance-in');
      const onIn = () => { cardEl.classList.remove('advance-in'); cardEl.removeEventListener('animationend', onIn); };
      cardEl.addEventListener('animationend', onIn);
    };
    cardEl.addEventListener('animationend', onOut);
  }

  // Start the 'advance-out' animation now and wait for it to finish before swapping.
  // If outDurationMs is provided, temporarily set animationDuration to sync with flip.
  function nextAnimatedWithOut(outDurationMs) {
    if (!state.cards.length) return;
    const cardEl = els.card;
    const doSwap = () => {
      state.idx = (state.idx + 1) % state.cards.length;
      state.showBack = false;
      state.selected = null; state.correct = null;
      state.multiSelected.clear(); state.multiChecked = false;
      clearTimer();
      renderCard();
    };
    // Set temporary duration if provided
    if (outDurationMs) cardEl.style.animationDuration = outDurationMs + 'ms';
    cardEl.classList.remove('advance-in');
    cardEl.classList.add('advance-out');
    const onOut = () => {
      cardEl.removeEventListener('animationend', onOut);
      cardEl.classList.remove('advance-out');
      // Clear temporary duration so 'advance-in' uses its own
      if (outDurationMs) cardEl.style.animationDuration = '';
      doSwap();
      cardEl.classList.add('advance-in');
      const onIn = () => { cardEl.classList.remove('advance-in'); cardEl.removeEventListener('animationend', onIn); };
      cardEl.addEventListener('animationend', onIn);
    };
    cardEl.addEventListener('animationend', onOut);
  }

  function prev() {
    if (!state.cards.length) return;
    const doRender = () => {
      state.idx = (state.idx - 1 + state.cards.length) % state.cards.length;
      state.showBack = false;
      state.selected = null; state.correct = null;
      state.multiSelected.clear(); state.multiChecked = false;
      clearTimer();
      renderCard();
    };
    els.card.classList.add('instant');
    doRender();
    requestAnimationFrame(() => els.card.classList.remove('instant'));
  }

  function shuffle() {
    for (let i = state.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.cards[i], state.cards[j]] = [state.cards[j], state.cards[i]];
    }
    state.idx = 0;
    state.showBack = false;
    state.selected = null; state.correct = null;
    state.multiSelected.clear(); state.multiChecked = false;
    clearTimer();
    els.card.classList.add('instant');
    renderCard();
    requestAnimationFrame(() => els.card.classList.remove('instant'));
  }

  function selectChoice(i) {
    const c = state.cards[state.idx];
    if ((c.type || 'basic') !== 'mcq') return;
    state.selected = i;
    const order = state.choiceOrder || (c.choices || []).map((_, k) => k);
    const chosenOrig = order[i];
    state.correct = (chosenOrig === c.answer);
    renderCard();
    // Reset after short delay
    clearTimer();
    if (state.correct) {
      state.resetTimer = setTimeout(() => {
        // Hide result panel before transitioning
        clearResult();
        nextAnimated();
        state.resetTimer = null;
      }, DELAY_MS);
    } else {
      state.resetTimer = setTimeout(() => {
        state.selected = null;
        state.correct = null;
        renderCard();
        state.resetTimer = null;
      }, DELAY_MS);
    }
  }


  function toggleMultiChoice(i) {
    const c = state.cards[state.idx];
    if ((c.type || 'basic') !== 'mcq' || !c.multi || state.multiChecked) return;
    if (state.multiSelected.has(i)) state.multiSelected.delete(i); else state.multiSelected.add(i);
    renderCard();
  }

  // Result rendering with HTML support in correct answer text
  function setResult(message, correctTexts) {
    // Style state on container (ok/err)
    els.mcqResult.classList.toggle('ok', message && /^Correct/i.test(message));
    els.mcqResult.classList.toggle('err', message && /^Wrong/i.test(message));
    els.mcqResult.innerHTML = '';
    els.mcqResult.hidden = false;
    if (message) {
      const p = document.createElement('p');
      p.className = 'status ' + (/^Correct/i.test(message) ? 'success' : 'error');
      p.textContent = message;
      els.mcqResult.appendChild(p);
    }
    if (correctTexts && correctTexts.length) {
      const label = document.createElement('p');
      label.className = 'label';
      label.textContent = 'Correct answer' + (correctTexts.length > 1 ? 's' : '');
      els.mcqResult.appendChild(label);
      const list = document.createElement('div');
      list.className = 'correct-list';
      correctTexts.forEach(text => {
        const div = document.createElement('div');
        div.className = 'choice correct-item correct';
        renderSafe(div, text);
        list.appendChild(div);
      });
      els.mcqResult.appendChild(list);
    }
  }
  function clearResult() { els.mcqResult.classList.remove('ok','err'); els.mcqResult.innerHTML = ''; els.mcqResult.hidden = true; }

  function checkMulti() {
    const c = state.cards[state.idx];
    if ((c.type || 'basic') !== 'mcq' || !c.multi) return;
    const answers = new Set((c.answers || []));
    const order = state.choiceOrder || (c.choices || []).map((_, k) => k);
    let ok = answers.size === state.multiSelected.size;
    if (ok) {
      for (const dispIdx of state.multiSelected) {
        const origIdx = order[dispIdx];
        if (!answers.has(origIdx)) { ok = false; break; }
      }
    }
    state.multiChecked = true;
    state.correct = ok;
    renderCard();
    clearTimer();
    if (ok) {
      state.resetTimer = setTimeout(() => {
        clearResult();
        nextAnimated();
        state.resetTimer = null;
      }, DELAY_MS);
    } else {
      state.resetTimer = setTimeout(() => {
        state.multiSelected.clear();
        state.multiChecked = false;
        state.correct = null;
        renderCard();
        state.resetTimer = null;
      }, DELAY_MS);
    }
  }

  function clearTimer() {
    if (state.resetTimer) {
      clearTimeout(state.resetTimer);
      state.resetTimer = null;
    }
  }

  async function refresh() {
    const [decks, cards] = await Promise.all([
      api.decks(),
      api.cards(state.deckName)
    ]);
    renderDecks(decks);
    state.cards = cards;
    state.idx = 0;
    state.showBack = false;
    state.selected = null; state.correct = null;
    state.multiSelected.clear(); state.multiChecked = false;
    clearTimer();
    renderCard();
  }

  // Events
  els.card.addEventListener('click', () => {
    const c = state.cards[state.idx];
    if (c && (c.type || 'basic') === 'basic') {
      state.showBack = !state.showBack;
      renderCard();
      clearTimer();
      if (state.showBack) {
        // After viewing back, flip to front fully, then advance
        state.resetTimer = setTimeout(() => {
          state.showBack = false;
          renderCard();
          // Start next transition now, synchronized to flip duration
          nextAnimatedWithOut(FLIP_MS);
          state.resetTimer = setTimeout(() => { state.resetTimer = null; }, FLIP_MS);
        }, DELAY_MS);
      }
    }
  });
  els.card.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const c = state.cards[state.idx];
      if (c && (c.type || 'basic') === 'basic') {
        state.showBack = !state.showBack;
        renderCard();
        clearTimer();
        if (state.showBack) {
          state.resetTimer = setTimeout(() => {
            state.showBack = false;
            renderCard();
            nextAnimatedWithOut(FLIP_MS);
            state.resetTimer = setTimeout(() => { state.resetTimer = null; }, FLIP_MS);
          }, DELAY_MS);
        }
      }
    } else if (e.key === 'ArrowRight') {
      next();
    } else if (e.key === 'ArrowLeft') {
      prev();
    }
  });
  els.mcqCheck.addEventListener('click', checkMulti);
  els.next.addEventListener('click', next);
  els.prev.addEventListener('click', prev);
  els.shuffleBtn.addEventListener('click', shuffle);
  if (els.toggleAddBtn) {
    const setAdderVisible = (show) => {
      state.showAdder = !!show;
      if (els.adderSection) els.adderSection.hidden = !state.showAdder;
      els.toggleAddBtn.classList.toggle('active', state.showAdder);
      els.toggleAddBtn.setAttribute('aria-pressed', state.showAdder ? 'true' : 'false');
      // Adjust main grid columns when adder is hidden/visible
      const mainEl = document.getElementById('main');
      if (mainEl) mainEl.classList.toggle('single-column', !state.showAdder);
      try { localStorage.setItem('showAdder', state.showAdder ? '1' : '0'); } catch {}
    };
    els.toggleAddBtn.addEventListener('click', () => setAdderVisible(!state.showAdder));
    // restore persisted preference
    try { state.showAdder = localStorage.getItem('showAdder') === '1'; } catch {}
    setAdderVisible(state.showAdder);
  }
  els.typeInput.addEventListener('change', () => {
    const type = els.typeInput.value;
    const isMcq = type === 'mcq';
    els.mcqFields.hidden = !isMcq;
    els.backLabel.hidden = isMcq;
    els.backInput.required = !isMcq;
    if (isMcq) {
      // Reset MCQ mode controls default
      els.multiInput.checked = false;
      els.singleAnswerRow.hidden = false;
      els.multiAnswerRow.hidden = true;
    }
  });
  els.multiInput.addEventListener('change', () => {
    const multi = els.multiInput.checked;
    els.singleAnswerRow.hidden = multi;
    els.multiAnswerRow.hidden = !multi;
  });
  els.deckSelect.addEventListener('change', async () => {
    state.deckName = els.deckSelect.value;
    await refresh();
  });
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const front = els.frontInput.value.trim();
    const deck = els.deckInput.value.trim();
    const type = els.typeInput.value;
    if (type === 'mcq') {
      const lines = els.choicesInput.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const multi = els.multiInput.checked;
      if (!front || lines.length < 2) return;
      if (multi) {
        const nums = els.answersInput.value.split(/[^\d]+/).map(s => s.trim()).filter(Boolean).map(s => parseInt(s, 10) - 1);
        const uniq = [...new Set(nums)].filter(n => n >= 0 && n < lines.length);
        if (uniq.length === 0) return;
        await api.addCard({ type: 'mcq', front, choices: lines, multi: true, answers: uniq, deck });
      } else {
        const idx = parseInt(els.answerInput.value, 10) - 1;
        if (!(idx >= 0 && idx < lines.length)) return;
        await api.addCard({ type: 'mcq', front, choices: lines, multi: false, answer: idx, deck });
      }
    } else {
      const back = els.backInput.value.trim();
      if (!front || !back) return;
      await api.addCard({ type: 'basic', front, back, deck });
    }
    els.frontInput.value = '';
    els.backInput.value = '';
    els.choicesInput.value = '';
    els.answerInput.value = '1';
    els.answersInput.value = '';
    els.multiInput.checked = false;
    els.singleAnswerRow.hidden = false;
    els.multiAnswerRow.hidden = true;
    await refresh();
  });

  els.clearBtn.addEventListener('click', () => {
    els.frontInput.value = '';
    els.backInput.value = '';
    els.choicesInput.value = '';
    els.answerInput.value = '1';
    els.typeInput.value = 'basic';
    els.mcqFields.hidden = true;
    els.backLabel.hidden = false;
    els.backInput.required = true;
    els.frontInput.focus();
  });

  // Init
  try {
    state.allowHTML = localStorage.getItem('allowHTML') === '1';
    if (els.htmlToggle) els.htmlToggle.checked = state.allowHTML;
  } catch {}
  if (els.htmlToggle) {
    els.htmlToggle.addEventListener('change', () => {
      state.allowHTML = !!els.htmlToggle.checked;
      try { localStorage.setItem('allowHTML', state.allowHTML ? '1' : '0'); } catch {}
      renderCard();
    });
  }
  refresh().catch(err => {
    console.error(err);
    alert('Failed to load data. See console for details.');
  });
})();
