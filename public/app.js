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
    },
    async updateCard(id, patch) {
      const r = await fetch(`/api/cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!r.ok) throw new Error('Failed to update card');
      return await r.json();
    },
    async deleteCard(id) {
      const r = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
      if (r.status !== 204) throw new Error('Failed to delete card');
    },
    async renameDeck(id, name) {
      const r = await fetch(`/api/decks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!r.ok) throw new Error('Failed to rename deck');
      return await r.json();
    },
    async deleteDeck(id) {
      const r = await fetch(`/api/decks/${id}`, { method: 'DELETE' });
      if (r.status !== 204) throw new Error('Failed to delete deck');
    },
    async createDeck(name) {
      const r = await fetch('/api/decks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!r.ok) throw new Error('Failed to create deck');
      return await r.json();
    }
  };

  const els = {
    deckSelect: document.getElementById('deck-select'),
    shuffleBtn: document.getElementById('shuffle-btn'),
    timerBtn: document.getElementById('timer-btn'),
    autoAdvBtn: document.getElementById('auto-adv-btn'),
    toggleAddBtn: document.getElementById('toggle-add-btn'),
    toggleDecksBtn: document.getElementById('toggle-decks-btn'),
    toggleCardsBtn: document.getElementById('toggle-cards-btn'),
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
    choicesCardsInput: document.getElementById('choices-cards-input'),
    choicesInput: document.getElementById('choices-input'),
    answerInput: document.getElementById('answer-input'),
    answersInput: document.getElementById('answers-input'),
    singleAnswerRow: document.getElementById('single-answer-row'),
    multiAnswerRow: document.getElementById('multi-answer-row'),
    clearBtn: document.getElementById('clear-btn'),
    adderSection: document.getElementById('adder-section'),
    decksSection: document.getElementById('decks-section'),
    decksList: document.getElementById('decks-list'),
    deckAddForm: document.getElementById('deck-add-form'),
    deckNewInput: document.getElementById('deck-new-input'),
    cardsSection: document.getElementById('cards-section'),
    cardsTbody: document.getElementById('cards-tbody'),
    cardsList: document.getElementById('cards-list'),
    cardsPrev: document.getElementById('cards-prev'),
    cardsNext: document.getElementById('cards-next'),
    cardsPage: document.getElementById('cards-page'),
    viewerSection: document.querySelector('section.viewer'),
    cardsFilterInput: document.getElementById('cards-filter'),
    cardsCount: document.getElementById('cards-count'),
    cardsPreview: document.getElementById('cards-preview'),
    previewType: document.getElementById('preview-type'),
    previewFront: document.getElementById('preview-front'),
    previewBack: document.getElementById('preview-back'),
    previewBackWrap: document.getElementById('preview-back-wrap'),
    previewChoices: document.getElementById('preview-choices'),
    previewChoicesWrap: document.getElementById('preview-choices-wrap'),
    cardTimer: document.getElementById('card-timer'),
    cardTimerProgress: document.getElementById('card-timer-progress'),
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
    showAdder: false,
    showDecks: false,
    showCards: false,
    lastCardId: null,
    choiceOrder: null, // array mapping displayed index -> original index for current MCQ card
    deckMap: {},
    cardsPage: 1,
    cardsPerPage: 10,
    cardsFilter: '',
    timerEnabled: false,
    autoAdvanceEnabled: false,
    timerDurationMs: 10000,
    autoAdvanceDelayMs: 5000,
    timerStart: null,
    timerRAF: null,
    timerHold: false,
    timeoutReveal: false,
    autoAdvanceTimer: null,
    autoAdvanceStart: null,
    autoAdvanceRAF: null,
  };
  
  function clearAutoAdvance() {
    if (state.autoAdvanceTimer) {
      clearTimeout(state.autoAdvanceTimer);
      state.autoAdvanceTimer = null;
    }
    if (state.autoAdvanceRAF) {
      cancelAnimationFrame(state.autoAdvanceRAF);
      state.autoAdvanceRAF = null;
    }
    state.autoAdvanceStart = null;
    const p = document.getElementById('auto-adv-progress');
    if (p && p.parentElement) p.parentElement.removeChild(p);
    if (els.autoAdvBtn) {
      const secs = Math.round((state.autoAdvanceDelayMs || 5000) / 1000);
      els.autoAdvBtn.textContent = state.autoAdvanceEnabled ? `Auto-Advance ${secs}s` : 'Auto-Advance';
    }
  }

  function clearCardTimer() {
    if (state.timerRAF) {
      cancelAnimationFrame(state.timerRAF);
      state.timerRAF = null;
    }
    state.timerStart = null;
    if (els.cardTimer) els.cardTimer.hidden = true;
    if (els.cardTimerProgress) els.cardTimerProgress.style.width = '0%';
    // Keep auto-advance in sync with manual timer clearing
    clearAutoAdvance();
  }

  function startCardTimer() {
    clearCardTimer();
    if (!state.timerEnabled || !els.viewerSection || els.viewerSection.hidden) return;
    if (!els.cardTimer || !els.cardTimerProgress) return;
    els.cardTimer.hidden = false;
    state.timerStart = performance.now();
    const duration = state.timerDurationMs;
    const tick = (now) => {
      const elapsed = now - state.timerStart;
      const pct = Math.max(0, Math.min(1, elapsed / duration));
      els.cardTimerProgress.style.width = (pct * 100).toFixed(2) + '%';
      if (pct < 1) {
        state.timerRAF = requestAnimationFrame(tick);
      } else {
        // Give a moment to show the bar filled, then clear timer UI only
        setTimeout(() => {
          if (els.cardTimer) els.cardTimer.hidden = true;
          if (els.cardTimerProgress) els.cardTimerProgress.style.width = '0%';
          state.timerStart = null;
          state.timerRAF = null;
        }, 300);
        // Time's up: reveal the correct answer; do not auto-advance
        const c = state.cards[state.idx];
        if (!c) return;
        // Prevent auto-restarting the timer during reveal rerenders
        state.timerHold = true;
        state.timeoutReveal = true;
        if ((c.type || 'basic') === 'basic') {
          // Flip to back and show; wait for user to move next
          state.showBack = true;
          renderCard();
          clearTimer();
        } else if ((c.type || 'basic') === 'mcq') {
          if (c.multi) {
            // Show all correct answers
            state.multiChecked = true;
            state.correct = false; // label as not correct (time ran out)
            renderCard();
          } else {
            // Highlight the correct choice
            const order = state.choiceOrder || (c.choices || []).map((_, i) => i);
            const dispIdx = order.findIndex((orig) => orig === c.answer);
            if (dispIdx >= 0) {
              state.selected = dispIdx;
              state.correct = true; // highlight as correct
            }
            renderCard();
          }
          clearTimer();
          // Keep result visible; wait for user to move next
          // timerHold stays true to avoid auto-restarting timer during reveal
        }
      }
    };
    state.timerRAF = requestAnimationFrame(tick);
  }

  function startAutoAdvance() {
    clearAutoAdvance();
    if (!state.autoAdvanceEnabled) return;
    if (!els.viewerSection || els.viewerSection.hidden) return;
    // Actual triggering condition is checked by shouldAutoAdvanceFromState()
    state.autoAdvanceTimer = setTimeout(() => {
      if (!state.autoAdvanceEnabled) return;
      if (els.viewerSection && els.viewerSection.hidden) return;
      next();
    }, state.autoAdvanceDelayMs);
    // Show progress bar in result panel (MCQ only) if visible
    ensureAutoAdvProgressUI();
    state.autoAdvanceStart = performance.now();
    const delay = state.autoAdvanceDelayMs;
    const tick = (now) => {
      const el = document.getElementById('auto-adv-progress-bar');
      if (!el) { state.autoAdvanceRAF = null; return; }
      const elapsed = now - (state.autoAdvanceStart || now);
      const pct = Math.max(0, Math.min(1, elapsed / delay));
      el.style.width = (pct * 100).toFixed(2) + '%';
      // tint from amber (38deg) to green (140deg)
      const hue = 38 + (140 - 38) * pct;
      el.style.background = `hsl(${hue.toFixed(0)} 80% 50%)`;
      // Update Auto-Advance button countdown (5 → 0)
      if (els.autoAdvBtn && state.autoAdvanceEnabled) {
        const remaining = Math.max(0, delay - elapsed);
        const secs = Math.ceil(remaining / 1000);
        els.autoAdvBtn.textContent = `Auto-Advance ${secs}s`;
      }
      if (pct < 1) {
        state.autoAdvanceRAF = requestAnimationFrame(tick);
      } else {
        state.autoAdvanceRAF = null;
      }
    };
    state.autoAdvanceRAF = requestAnimationFrame(tick);
  }

  function ensureAutoAdvProgressUI() {
    if (!els.mcqResult || els.mcqResult.hidden) return null;
    let wrap = document.getElementById('auto-adv-progress');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'auto-adv-progress';
      wrap.className = 'auto-adv-progress';
      const bar = document.createElement('div');
      bar.id = 'auto-adv-progress-bar';
      bar.className = 'auto-adv-progress-bar';
      wrap.appendChild(bar);
      els.mcqResult.appendChild(wrap);
    } else {
      const bar = document.getElementById('auto-adv-progress-bar');
      if (bar) bar.style.width = '0%';
    }
    return wrap;
  }

  function shouldAutoAdvanceFromState() {
    if (!state.autoAdvanceEnabled) return false;
    if (els.viewerSection && els.viewerSection.hidden) return false;
    const c = state.cards[state.idx];
    if (!c) return false;
    const type = (c.type || 'basic');
    if (type === 'basic') {
      // Only once the card has been flipped to back
      return !!state.showBack;
    } else {
      // MCQ: only after an answer is selected (single) or checked (multi)
      return c.multi ? !!state.multiChecked : (state.selected != null);
    }
  }

  function updateViewerVisibility() {
    const anyOpen = !!(state.showAdder || state.showDecks || state.showCards);
    if (els.viewerSection) els.viewerSection.hidden = anyOpen;
  }
  const DELAY_MS = 1200; // delay before reset/advance
  const FLIP_MS = 500;   // CSS flip transition duration (keep in sync with styles)

  // Allowlist-based HTML sanitizer for safe rendering
  const ALLOWED_TAGS = new Set(['b','strong','i','em','u','s','br','p','ul','ol','li','code','pre','ruby','rt','rb','rp','span','h1','h2','h3','h4','h5','h6','font','a','img','sup','sub','mark']);
  const ALLOWED_ATTRS = {
    font: new Set(['color', 'size', 'face']),
    a: new Set(['href']),
    img: new Set(['src','alt','title','width','height'])
  };
  function sanitizeAttr(tag, name, value) {
    // Only allow attributes explicitly listed per tag
    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed || !allowed.has(name)) return null;
    // Basic value validation to avoid scriptable values
    if (tag === 'font') {
      if (name === 'color') {
        const v = String(value).trim();
        if (/^#[0-9a-fA-F]{3}$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v) || /^[a-zA-Z]+$/.test(v)) return v;
        return null;
      }
      if (name === 'size') {
        const v = String(value).trim();
        if (/^[1-7]$/.test(v)) return v; // classic HTML font size 1-7
        return null;
      }
      if (name === 'face') {
        const v = String(value).trim();
        if (/^[\w\s,-]+$/.test(v)) return v; // simple whitelist
        return null;
      }
    }
    if (tag === 'a') {
      if (name === 'href') {
        const v = String(value).trim();
        // allow http(s), mailto, and fragment links only
        if (/^(https?:)?\/\//i.test(v) || /^mailto:/i.test(v) || /^#/.test(v)) return v;
        return null;
      }
    }
    if (tag === 'img') {
      if (name === 'src') {
        const v = String(value).trim();
        // allow http(s) and data:image URIs
        if (/^(https?:)?\/\//i.test(v) || /^data:image\//i.test(v)) return v;
        return null;
      }
      if (name === 'alt' || name === 'title') {
        return String(value);
      }
      if (name === 'width' || name === 'height') {
        const v = String(value).trim();
        if (/^\d{1,4}$/.test(v)) return v; // simple numeric px
        return null;
      }
    }
    return null;
  }
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
        // Copy a safe subset of attributes when allowed
        if (node.attributes && node.attributes.length) {
          for (const attr of Array.from(node.attributes)) {
            const name = attr.name.toLowerCase();
            const val = sanitizeAttr(tag, name, attr.value);
            if (val != null) el.setAttribute(name, val);
          }
        }
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
    el.appendChild(sanitizeHtmlToFragment(String(text)));
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
    // Build id->name map
    state.deckMap = {};
    decks.forEach(d => { state.deckMap[d.id] = d.name; });
    // Populate Add Card deck dropdown if present and is a <select>
    if (els.deckInput && els.deckInput.tagName && els.deckInput.tagName.toLowerCase() === 'select') {
      els.deckInput.innerHTML = '';
      const def = document.createElement('option');
      def.value = '';
      def.textContent = 'Default';
      els.deckInput.appendChild(def);
      decks.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = d.name;
        els.deckInput.appendChild(opt);
      });
      els.deckInput.value = state.deckName || '';
    }
    if (els.decksList) {
      els.decksList.innerHTML = '';
      decks.forEach(d => {
        const row = document.createElement('div');
        row.className = 'deck-row';
        const name = document.createElement('div');
        name.className = 'deck-name';
        name.textContent = d.name;
        const actions = document.createElement('div');
        actions.className = 'deck-actions';
        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn';
        renameBtn.textContent = 'Rename';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn';
        deleteBtn.textContent = 'Delete';
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);
        row.appendChild(name);
        row.appendChild(actions);
        renameBtn.addEventListener('click', () => beginRename(row, d));
        deleteBtn.addEventListener('click', async () => {
          if (!confirm(`Delete deck "${d.name}"? Cards will be left unassigned.`)) return;
          await api.deleteDeck(d.id);
          if (state.deckName === d.name) state.deckName = '';
          await refresh();
          if (window.setDecksVisible) window.setDecksVisible(true);
        });
        els.decksList.appendChild(row);
      });
    }
  }

  function renderCardsTable() {
    // Render as mini-cards grid instead of table
    if (!els.cardsList) return;
    els.cardsList.innerHTML = '';
    const query = (state.cardsFilter || '').trim().toLowerCase();
    const list = !query ? state.cards : state.cards.filter(card => {
      const type = (card.type || 'basic');
      const deck = state.deckMap[card.deck_id] || '';
      const backOrAns = type === 'mcq'
        ? ((card.multi ? (card.answers || []) : (card.answer != null ? [card.answer] : [])).map(i => (card.choices || [])[i]).join(' '))
        : (card.back || '');
      const hay = [String(card.id), deck, type, card.front || '', backOrAns || '', (card.choices || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(query);
    });
    const total = list.length;
    const per = state.cardsPerPage;
    const totalPages = total === 0 ? 0 : Math.ceil(total / per);
    if (totalPages === 0) {
      state.cardsPage = 0;
    } else if (state.cardsPage < 1) {
      state.cardsPage = 1;
    } else if (state.cardsPage > totalPages) {
      state.cardsPage = totalPages;
    }
    const start = totalPages === 0 ? 0 : (state.cardsPage - 1) * per;
    const end = totalPages === 0 ? 0 : Math.min(start + per, total);
    const pageItems = list.slice(start, end);

    pageItems.forEach(card => {
      const tile = document.createElement('div');
      tile.className = 'mini-card';
      const typeBadge = document.createElement('div'); typeBadge.className = 'mini-type'; typeBadge.textContent = (card.type || 'basic').toUpperCase(); tile.appendChild(typeBadge);
      const body = document.createElement('div'); body.className = 'mini-scroll';
      const content = document.createElement('div'); content.className = 'mini-content';
      renderSafe(content, card.front || '');
      body.appendChild(content);
      if ((card.type || 'basic') === 'mcq') {
        const choices = card.choices || [];
        // Answers section
        const idxs = card.multi
          ? (card.answers || [])
          : (card.answer != null ? [card.answer] : (Array.isArray(card.answers) ? card.answers : []));
        const answersWrap = document.createElement('div');
        const ansLabel = document.createElement('div'); ansLabel.className = 'mini-label'; ansLabel.textContent = 'Answers'; answersWrap.appendChild(ansLabel);
        const mcAns = document.createElement('div'); mcAns.className = 'mini-choices';
        (idxs || []).forEach(i => { const txt = choices[i]; if (!txt) return; const d = document.createElement('div'); d.className = 'mini-choice correct'; renderSafe(d, txt); mcAns.appendChild(d); });
        answersWrap.appendChild(mcAns);
        body.appendChild(answersWrap);
        // Choices section
        const chWrap = document.createElement('div');
        const chLabel = document.createElement('div'); chLabel.className = 'mini-label'; chLabel.textContent = 'Choices'; chWrap.appendChild(chLabel);
        const mcChoices = document.createElement('div'); mcChoices.className = 'mini-choices';
        choices.forEach((txt, i) => { const d = document.createElement('div'); d.className = 'mini-choice'; if ((idxs || []).includes(i)) d.classList.add('correct'); renderSafe(d, txt); mcChoices.appendChild(d); });
        chWrap.appendChild(mcChoices);
        body.appendChild(chWrap);
      } else {
        // For basic, show a hint of the back
        const back = document.createElement('div'); back.className = 'mini-choice'; renderSafe(back, card.back || ''); body.appendChild(back);
      }
      tile.appendChild(body);
      const actions = document.createElement('div'); actions.className = 'actions';
      const edit = document.createElement('button'); edit.className = 'icon-btn'; edit.setAttribute('title', 'Edit'); edit.setAttribute('aria-label', 'Edit'); edit.textContent = '✎';
      const del = document.createElement('button'); del.className = 'icon-btn'; del.setAttribute('title', 'Delete'); del.setAttribute('aria-label', 'Delete'); del.textContent = '🗑️';
      actions.appendChild(edit); actions.appendChild(del); tile.appendChild(actions);
      del.addEventListener('click', async () => {
        if (!confirm('Delete this card?')) return;
        await api.deleteCard(card.id);
        await refresh();
        if (window.setCardsVisible) window.setCardsVisible(true);
      });
      edit.addEventListener('click', () => enterEditTile(tile, card));
      els.cardsList.appendChild(tile);
    });

    if (els.cardsPage) {
      els.cardsPage.textContent = `${totalPages === 0 ? 0 : state.cardsPage} / ${totalPages}`;
    }
    if (els.cardsPrev) els.cardsPrev.disabled = !(totalPages > 0 && state.cardsPage > 1);
    if (els.cardsNext) els.cardsNext.disabled = !(totalPages > 0 && state.cardsPage < totalPages);
    if (els.cardsCount) els.cardsCount.textContent = `${total} matching card${total === 1 ? '' : 's'}`;
  }

  function enterEditRow(tr, card) {
    tr.innerHTML = '';
    tr.classList.add('edit-row');
    const type = (card.type || 'basic');
    // ID
    const tdId = document.createElement('td'); tdId.textContent = card.id; tr.appendChild(tdId);
    // Deck select
    const tdDeck = document.createElement('td');
    const deckSel = document.createElement('select');
    deckSel.style.width = '100%';
    const def = document.createElement('option'); def.value = 'Default'; def.textContent = 'Default'; deckSel.appendChild(def);
    const currentDeckName = state.deckMap[card.deck_id] || 'Default';
    Object.values(state.deckMap).forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; deckSel.appendChild(opt); });
    deckSel.value = currentDeckName;
    tdDeck.appendChild(deckSel); tr.appendChild(tdDeck);
    // Type label
    const tdType = document.createElement('td'); tdType.className = 'cell-type'; tdType.textContent = type.toUpperCase(); tr.appendChild(tdType);
    // Front input (use textarea for more viewing space)
    const tdFront = document.createElement('td');
    const frontInput = document.createElement('textarea');
    frontInput.value = card.front || '';
    frontInput.style.width = '100%';
    frontInput.rows = 6;
    tdFront.appendChild(frontInput); tr.appendChild(tdFront);
    // Back/Answers editor
    const tdBack = document.createElement('td');
    let backInput, choicesArea, multiChk, cardsChk, answerInput, answersInput;
    if (type === 'basic') {
      backInput = document.createElement('textarea');
      backInput.value = card.back || ''; backInput.style.width = '100%'; backInput.rows = 8;
      tdBack.appendChild(backInput);
    } else {
      multiChk = document.createElement('input'); multiChk.type = 'checkbox'; multiChk.checked = !!card.multi;
      const multiLbl = document.createElement('label'); multiLbl.className = 'inline'; multiLbl.appendChild(multiChk); multiLbl.appendChild(document.createTextNode(' Allow multiple answers'));
      // Mini card layout toggle for MCQ choices
      cardsChk = document.createElement('input'); cardsChk.type = 'checkbox'; cardsChk.checked = !!card.choices_as_cards;
      const cardsLbl = document.createElement('label'); cardsLbl.className = 'inline'; cardsLbl.appendChild(cardsChk); cardsLbl.appendChild(document.createTextNode(' Display choices as mini cards'));
      choicesArea = document.createElement('textarea'); choicesArea.style.width = '100%'; choicesArea.rows = 8; choicesArea.value = (card.choices || []).join('\n');
      answerInput = document.createElement('input'); answerInput.type = 'number'; answerInput.min = '1'; answerInput.value = (card.answer != null ? (card.answer+1) : 1); answerInput.style.width = '100%';
      answersInput = document.createElement('input'); answersInput.type = 'text'; answersInput.placeholder = 'e.g. 1,3'; answersInput.value = (card.answers || []).map(i => i+1).join(','); answersInput.style.width = '100%';
      const singleWrap = document.createElement('div'); singleWrap.className = 'form-block';
      const singleLbl = document.createElement('div'); singleLbl.className = 'label'; singleLbl.textContent = 'Answer (1-based)';
      singleWrap.appendChild(singleLbl); singleWrap.appendChild(answerInput);
      const multiWrap = document.createElement('div'); multiWrap.className = 'form-block';
      const multiLbl2 = document.createElement('div'); multiLbl2.className = 'label'; multiLbl2.textContent = 'Answers (1-based, comma-separated)';
      multiWrap.appendChild(multiLbl2); multiWrap.appendChild(answersInput); multiWrap.style.display = multiChk.checked ? '' : 'none';
      singleWrap.style.display = multiChk.checked ? 'none' : '';
      multiChk.addEventListener('change', () => { multiWrap.style.display = multiChk.checked ? '' : 'none'; singleWrap.style.display = multiChk.checked ? 'none' : ''; });
      tdBack.appendChild(multiLbl);
      tdBack.appendChild(cardsLbl);
      tdBack.appendChild(choicesArea);
      tdBack.appendChild(singleWrap);
      tdBack.appendChild(multiWrap);
    }
    tr.appendChild(tdBack);
    // Actions
    const tdActions = document.createElement('td'); tdActions.className = 'row-actions';
    const save = document.createElement('button'); save.className = 'btn btn-primary'; save.textContent = 'Save';
    const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
    tdActions.appendChild(save); tdActions.appendChild(cancel); tr.appendChild(tdActions);

    const updatePreview = () => {
      if (!els.cardsPreview) return;
      els.cardsPreview.hidden = false;
      const typeLabel = type.toUpperCase() + (type === 'mcq' ? (multiChk && multiChk.checked ? ' (MULTI)' : ' (SINGLE)') : '');
      if (els.previewType) els.previewType.textContent = typeLabel;
      if (els.previewFront) renderSafe(els.previewFront, frontInput.value || '');
      if (type === 'basic') {
        els.previewBackWrap.hidden = false;
        els.previewChoicesWrap.hidden = true;
        renderSafe(els.previewBack, backInput ? backInput.value || '' : '');
      } else {
        els.previewBackWrap.hidden = true;
        els.previewChoicesWrap.hidden = false;
        els.previewChoices.innerHTML = '';
        els.previewChoices.classList.toggle('cards', !!(cardsChk && cardsChk.checked));
        const lines = (choicesArea.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        lines.forEach(txt => { const btn = document.createElement('div'); btn.className = 'choice'; if (cardsChk && cardsChk.checked) btn.classList.add('card-choice'); renderSafe(btn, txt); els.previewChoices.appendChild(btn); });
      }
    };
    // Initialize and bind live preview updates
    updatePreview();
    frontInput.addEventListener('input', updatePreview);
    if (backInput) backInput.addEventListener('input', updatePreview);
    if (choicesArea) choicesArea.addEventListener('input', updatePreview);
    if (cardsChk) cardsChk.addEventListener('change', updatePreview);
    if (multiChk) multiChk.addEventListener('change', updatePreview);

    save.addEventListener('click', async () => {
      const patch = {};
      const newFront = frontInput.value.trim(); if (newFront && newFront !== card.front) patch.front = newFront;
      const selectedDeck = deckSel.value;
      if ((state.deckMap[card.deck_id] || 'Default') !== selectedDeck) patch.deck = selectedDeck;
      if (type === 'basic') {
        const nb = (backInput.value || '').trim(); if (nb !== (card.back || '')) patch.back = nb;
      } else {
        const lines = (choicesArea.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (JSON.stringify(lines) !== JSON.stringify(card.choices || [])) patch.choices = lines;
        const isMulti = !!multiChk.checked;
        patch.multi = isMulti;
        if (typeof cardsChk !== 'undefined' && cardsChk) patch.choices_as_cards = !!cardsChk.checked;
        if (isMulti) {
          const nums = (answersInput.value || '').split(/[^\d]+/).map(s => s.trim()).filter(Boolean).map(s => parseInt(s,10)-1);
          const uniq = [...new Set(nums)];
          patch.answers = uniq;
        } else {
          const idx = parseInt(answerInput.value, 10) - 1; patch.answer = isNaN(idx) ? null : idx;
        }
      }
      try {
        await api.updateCard(card.id, patch);
        await refresh();
        if (window.setCardsVisible) window.setCardsVisible(true);
        if (els.cardsPreview) els.cardsPreview.hidden = true;
      } catch (e) {
        alert('Failed to save: ' + e);
      }
    });
    cancel.addEventListener('click', async () => { await refresh(); if (window.setCardsVisible) window.setCardsVisible(true); if (els.cardsPreview) els.cardsPreview.hidden = true; });
  }

  function beginRename(row, deck) {
    row.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'deck-rename';
    const input = document.createElement('input');
    input.type = 'text'; input.value = deck.name; input.className = 'deck-name';
    const save = document.createElement('button'); save.className = 'btn btn-primary'; save.textContent = 'Save';
    const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
    wrap.appendChild(input); wrap.appendChild(save); wrap.appendChild(cancel);
    row.appendChild(wrap);
    save.addEventListener('click', async () => {
      const name = input.value.trim(); if (!name) return;
      await api.renameDeck(deck.id, name);
      if (state.deckName === deck.name) state.deckName = name;
      await refresh();
      if (window.setDecksVisible) window.setDecksVisible(true);
    });
    cancel.addEventListener('click', async () => { await refresh(); if (window.setDecksVisible) window.setDecksVisible(true); });
    input.focus(); input.select();
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
      // Toggle mini-card layout for choices
      els.mcqChoices.classList.toggle('cards', !!c.choices_as_cards);
      order.forEach((origIdx, i) => {
        const ch = c.choices[origIdx];
        const btn = document.createElement('button');
        btn.type = 'button';
        renderSafe(btn, ch);
        btn.className = 'choice' + (c.choices_as_cards ? ' card-choice' : '');
        // Staggered entry animation
        btn.classList.add('enter');
        btn.style.animationDelay = (i * 30) + 'ms';
        btn.addEventListener('animationend', () => btn.classList.remove('enter'), { once: true });
        if (c.multi) {
          if (!state.multiChecked) {
            btn.addEventListener('click', () => toggleMultiChoice(i));
          } else {
            btn.disabled = true;
          }
          if (state.multiSelected.has(i)) btn.classList.add('selected');
          if (state.multiChecked) {
            const isAnswer = (c.answers || []).includes(origIdx);
            if (isAnswer) btn.classList.add('correct');
            if (!isAnswer && state.multiSelected.has(i)) btn.classList.add('wrong');
          }
        } else {
          if (state.selected == null) {
            btn.addEventListener('click', () => selectChoice(i));
          } else {
            btn.disabled = true;
          }
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
        els.mcqCheck.disabled = !!state.multiChecked;
        if (state.multiChecked) {
          if (state.timeoutReveal) {
            setResult("Time's up.", (c.answers || []).map(i => c.choices[i]));
          } else {
            setResult(state.correct ? 'Correct!' : 'Wrong.', (c.answers || []).map(i => c.choices[i]));
          }
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
        } else if (state.timeoutReveal) {
          const correctText = c.answer != null ? c.choices[c.answer] : '';
          setResult("Time's up.", correctText ? [correctText] : []);
          els.mcqResult.hidden = false;
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
    // Start/restart timers
    if (state.timerEnabled && !state.showBack && !state.timerHold) startCardTimer();
    if (shouldAutoAdvanceFromState()) startAutoAdvance(); else clearAutoAdvance();
    // Adjust card height for MCQ to fit content
    adjustCardHeight();
  }

  function enterEditTile(tile, card) {
    tile.innerHTML = '';
    tile.classList.add('mini-card');
    const type = (card.type || 'basic');
    const wrap = document.createElement('div'); wrap.className = 'mini-edit'; wrap.style.width = '100%';
    const typeBadge = document.createElement('div'); typeBadge.className = 'mini-type'; typeBadge.textContent = type.toUpperCase(); wrap.appendChild(typeBadge);
    const front = document.createElement('textarea'); front.value = card.front || ''; front.style.width = '100%'; front.rows = 4;
    wrap.appendChild(front);
    let back, choicesArea, multiChk, answerInput, answersInput, cardsChk;
    if (type === 'basic') {
      back = document.createElement('textarea'); back.value = card.back || ''; back.style.width = '100%'; back.rows = 4; wrap.appendChild(back);
    } else {
      // MCQ editors
      cardsChk = document.createElement('input'); cardsChk.type = 'checkbox'; cardsChk.checked = !!card.choices_as_cards;
      const cardsLbl = document.createElement('label'); cardsLbl.className = 'inline'; cardsLbl.appendChild(cardsChk); cardsLbl.appendChild(document.createTextNode(' Display choices as mini cards'));
      wrap.appendChild(cardsLbl);
      multiChk = document.createElement('input'); multiChk.type = 'checkbox'; multiChk.checked = !!card.multi;
      const multiLbl = document.createElement('label'); multiLbl.className = 'inline'; multiLbl.appendChild(multiChk); multiLbl.appendChild(document.createTextNode(' Allow multiple answers'));
      wrap.appendChild(multiLbl);
      choicesArea = document.createElement('textarea'); choicesArea.style.width = '100%'; choicesArea.rows = 6; choicesArea.value = (card.choices || []).join('\n'); wrap.appendChild(choicesArea);
      const singleWrap = document.createElement('div');
      answerInput = document.createElement('input'); answerInput.type = 'number'; answerInput.min = '1'; answerInput.value = (card.answer != null ? (card.answer+1) : 1); answerInput.style.width = '100%';
      singleWrap.appendChild(answerInput); singleWrap.style.display = multiChk.checked ? 'none' : '';
      const multiWrap = document.createElement('div');
      answersInput = document.createElement('input'); answersInput.type = 'text'; answersInput.placeholder = 'e.g. 1,3'; answersInput.value = (card.answers || []).map(i => i+1).join(','); answersInput.style.width = '100%';
      multiWrap.appendChild(answersInput); multiWrap.style.display = multiChk.checked ? '' : 'none';
      wrap.appendChild(singleWrap); wrap.appendChild(multiWrap);
      multiChk.addEventListener('change', () => { singleWrap.style.display = multiChk.checked ? 'none' : ''; multiWrap.style.display = multiChk.checked ? '' : 'none'; });
    }
    const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px'; actions.style.marginTop = '8px';
    const save = document.createElement('button'); save.className = 'btn btn-primary'; save.textContent = 'Save';
    const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
    actions.appendChild(save); actions.appendChild(cancel); wrap.appendChild(actions);
    tile.appendChild(wrap);
    save.addEventListener('click', async () => {
      const patch = {};
      const nf = front.value.trim(); if (nf && nf !== (card.front || '')) patch.front = nf;
      if (type === 'basic') {
        const nb = (back.value || '').trim(); if (nb !== (card.back || '')) patch.back = nb;
      } else {
        const lines = (choicesArea.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (JSON.stringify(lines) !== JSON.stringify(card.choices || [])) patch.choices = lines;
        const isMulti = !!multiChk.checked; patch.multi = isMulti;
        if (cardsChk) patch.choices_as_cards = !!cardsChk.checked;
        if (isMulti) {
          const nums = (answersInput.value || '').split(/[^\d]+/).map(s => s.trim()).filter(Boolean).map(s => parseInt(s,10)-1);
          const uniq = [...new Set(nums)];
          patch.answers = uniq;
        } else {
          const idx = parseInt(answerInput.value, 10) - 1; patch.answer = isNaN(idx) ? null : idx;
        }
      }
      try { await api.updateCard(card.id, patch); await refresh(); if (window.setCardsVisible) window.setCardsVisible(true); } catch(e){ alert('Failed to save: '+e); }
    });
    cancel.addEventListener('click', async () => { await refresh(); if (window.setCardsVisible) window.setCardsVisible(true); });
  }

  // For MCQ cards, let the card size to fit visible content (max 350px)
  function adjustCardHeight() {
    const c = state.cards[state.idx];
    if (!c) return;
    const type = (c.type || 'basic');
    if (type === 'mcq') {
      const el = els.front;
      if (!el) return;
      // Measure the front face content
      const h = el.scrollHeight;
      const maxH = 350;
      if (h && h > 0) {
        const finalH = Math.min(h, maxH);
        els.card.style.height = finalH + 'px';
        // Allow internal scrolling if content exceeds cap
        el.classList.toggle('scroll', h > maxH);
      }
    } else {
      // Revert to default CSS height for non-MCQ
      els.card.style.height = '';
      if (els.front) els.front.classList.remove('scroll');
    }
  }

  function next() {
    // Use animated transition for moving to the next card
    nextAnimated();
    clearCardTimer();
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
      state.timeoutReveal = false;
      state.timerHold = false;
      clearTimer();
      clearCardTimer();
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
      state.timeoutReveal = false;
      state.timerHold = false;
      clearTimer();
      clearCardTimer();
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
      state.timeoutReveal = false;
      state.timerHold = false;
      clearTimer();
      clearCardTimer();
      clearResult();
      renderCard();
    };
    els.card.classList.add('instant');
    doRender();
    requestAnimationFrame(() => els.card.classList.remove('instant'));
    clearCardTimer();
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
    state.timeoutReveal = false;
    state.timerHold = false;
    clearTimer();
    clearCardTimer();
    els.card.classList.add('instant');
    renderCard();
    requestAnimationFrame(() => els.card.classList.remove('instant'));
    clearCardTimer();
  }

  function selectChoice(i) {
    const c = state.cards[state.idx];
    if ((c.type || 'basic') !== 'mcq') return;
    // For single-answer MCQ, ignore further selections once chosen
    if (state.selected != null) return;
    state.timeoutReveal = false;
    state.selected = i;
    const order = state.choiceOrder || (c.choices || []).map((_, k) => k);
    const chosenOrig = order[i];
    state.correct = (chosenOrig === c.answer);
    // Clear timers first; render will re-schedule auto-advance if enabled and applicable
    clearCardTimer();
    renderCard();
    // Show result and hold until user moves to next (auto-advance may handle this if enabled)
  }


  function toggleMultiChoice(i) {
    const c = state.cards[state.idx];
    if ((c.type || 'basic') !== 'mcq' || !c.multi || state.multiChecked) return;
    state.timeoutReveal = false;
    if (state.multiSelected.has(i)) state.multiSelected.delete(i); else state.multiSelected.add(i);
    // User is still selecting; ensure no pending auto-advance
    clearCardTimer();
    renderCard();
  }

  // Result rendering with HTML support in correct answer text
  function setResult(message, correctTexts) {
    // Style state on container (ok/err)
    const isOk = message && /^Correct/i.test(message);
    const isErr = message && /^Wrong/i.test(message);
    const isTimeout = message && /^Time/i.test(message);
    els.mcqResult.classList.toggle('ok', !!isOk);
    els.mcqResult.classList.toggle('err', !!isErr);
    els.mcqResult.innerHTML = '';
    els.mcqResult.hidden = false;
    if (message) {
      const p = document.createElement('p');
      let variant = isOk ? 'success' : (isErr ? 'error' : (isTimeout ? 'timeout' : ''));
      p.className = 'status ' + variant;
      p.textContent = message;
      els.mcqResult.appendChild(p);
    }
    if (correctTexts && correctTexts.length) {
      const label = document.createElement('p');
      label.className = 'label';
      label.textContent = 'Correct answer' + (correctTexts.length > 1 ? 's' : '');
      els.mcqResult.appendChild(label);
      const list = document.createElement('div');
      // When choices are displayed as mini cards, mirror that in results
      const c = state.cards[state.idx];
      const asCards = !!(c && (c.type || 'basic') === 'mcq' && c.choices_as_cards);
      list.className = 'correct-list choices' + (asCards ? ' cards' : '');
      correctTexts.forEach(text => {
        const div = document.createElement('div');
        div.className = 'choice correct-item correct' + (asCards ? ' card-choice' : '');
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
    state.timeoutReveal = false;
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
    // Clear timers before rendering; render will schedule auto-advance if applicable
    clearTimer();
    clearCardTimer();
    renderCard();
    // Keep result visible; wait for user to move to next card
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
    state.timeoutReveal = false;
    state.timerHold = false;
    clearTimer();
    clearCardTimer();
    renderCard();
    state.cardsPage = 1;
    renderCardsTable();
  }

  // Events
  els.card.addEventListener('click', () => {
    const c = state.cards[state.idx];
    if (c && (c.type || 'basic') === 'basic') {
      state.timeoutReveal = false;
      state.showBack = !state.showBack;
      // Clear timers first, then render to allow re-scheduling based on new state
      clearTimer();
      clearCardTimer();
      renderCard();
      // If showing back, keep it until user navigates; no auto-advance
    }
  });
  els.card.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const c = state.cards[state.idx];
      if (!c) return;
      const type = (c.type || 'basic');
      // If answer/result is showing, space/enter advances (mouse click does not)
      if ((type === 'basic' && state.showBack) || (type === 'mcq' && (state.multiChecked || state.selected !== null))) {
        next();
        return;
      }
      // Otherwise, for basic cards, toggle front/back
      if (type === 'basic') {
        state.timeoutReveal = false;
        state.showBack = !state.showBack;
        clearTimer();
        clearCardTimer();
        renderCard();
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
  // Recalculate MCQ height on window resize
  window.addEventListener('resize', () => adjustCardHeight());
  if (els.timerBtn) {
    const setTimerEnabled = (on) => {
      state.timerEnabled = !!on;
      els.timerBtn.classList.toggle('active', state.timerEnabled);
      els.timerBtn.setAttribute('aria-pressed', state.timerEnabled ? 'true' : 'false');
      // Update button label for clear feedback
      els.timerBtn.textContent = state.timerEnabled ? '⏱ 10s' : '⏱';
      try { localStorage.setItem('timerEnabled', state.timerEnabled ? '1' : '0'); } catch {}
      if (state.timerEnabled) startCardTimer(); else clearCardTimer();
    };
    els.timerBtn.addEventListener('click', () => setTimerEnabled(!state.timerEnabled));
    try { state.timerEnabled = localStorage.getItem('timerEnabled') === '1'; } catch {}
    setTimerEnabled(state.timerEnabled);
  }
  if (els.autoAdvBtn) {
    const setAutoAdvEnabled = (on) => {
      state.autoAdvanceEnabled = !!on;
      els.autoAdvBtn.classList.toggle('active', state.autoAdvanceEnabled);
      els.autoAdvBtn.setAttribute('aria-pressed', state.autoAdvanceEnabled ? 'true' : 'false');
      // Show seconds on the button when enabled, like the timer button
      const secs = Math.round((state.autoAdvanceDelayMs || 5000) / 1000);
      els.autoAdvBtn.textContent = state.autoAdvanceEnabled ? `Auto-Advance ${secs}s` : 'Auto-Advance';
      try { localStorage.setItem('autoAdvanceEnabled', state.autoAdvanceEnabled ? '1' : '0'); } catch {}
      if (state.autoAdvanceEnabled) startAutoAdvance(); else clearAutoAdvance();
    };
    els.autoAdvBtn.addEventListener('click', () => setAutoAdvEnabled(!state.autoAdvanceEnabled));
    try { state.autoAdvanceEnabled = localStorage.getItem('autoAdvanceEnabled') === '1'; } catch {}
    setAutoAdvEnabled(state.autoAdvanceEnabled);
  }
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
      updateViewerVisibility();
    };
    els.toggleAddBtn.addEventListener('click', () => setAdderVisible(!state.showAdder));
    // restore persisted preference
    try { state.showAdder = localStorage.getItem('showAdder') === '1'; } catch {}
    setAdderVisible(state.showAdder);
  }
  if (els.toggleDecksBtn) {
    const setDecksVisible = (show) => {
      state.showDecks = !!show;
      if (els.decksSection) els.decksSection.hidden = !state.showDecks;
      els.toggleDecksBtn.classList.toggle('active', state.showDecks);
      els.toggleDecksBtn.setAttribute('aria-pressed', state.showDecks ? 'true' : 'false');
      if (state.showDecks) { /* refresh list */ refresh(); }
      try { localStorage.setItem('showDecks', state.showDecks ? '1' : '0'); } catch {}
      updateViewerVisibility();
    };
    els.toggleDecksBtn.addEventListener('click', () => setDecksVisible(!state.showDecks));
    try { state.showDecks = localStorage.getItem('showDecks') === '1'; } catch {}
    setDecksVisible(state.showDecks);
    window.setDecksVisible = setDecksVisible;
  }
  if (els.toggleCardsBtn) {
    const setCardsVisible = (show) => {
      state.showCards = !!show;
      if (els.cardsSection) els.cardsSection.hidden = !state.showCards;
      els.toggleCardsBtn.classList.toggle('active', state.showCards);
      els.toggleCardsBtn.setAttribute('aria-pressed', state.showCards ? 'true' : 'false');
      if (state.showCards) renderCardsTable();
      try { localStorage.setItem('showCards', state.showCards ? '1' : '0'); } catch {}
      updateViewerVisibility();
    };
    els.toggleCardsBtn.addEventListener('click', () => setCardsVisible(!state.showCards));
    try { state.showCards = localStorage.getItem('showCards') === '1'; } catch {}
    setCardsVisible(state.showCards);
    window.setCardsVisible = setCardsVisible;
  }
  if (els.cardsPrev) els.cardsPrev.addEventListener('click', () => { state.cardsPage = Math.max(1, state.cardsPage - 1); renderCardsTable(); });
  if (els.cardsNext) els.cardsNext.addEventListener('click', () => { state.cardsPage = state.cardsPage + 1; renderCardsTable(); });
  if (els.cardsFilterInput) els.cardsFilterInput.addEventListener('input', () => { state.cardsFilter = els.cardsFilterInput.value; state.cardsPage = 1; renderCardsTable(); });
  // (Deck management dropdown removed)
  if (els.deckAddForm) {
    els.deckAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = els.deckNewInput.value.trim(); if (!name) return;
      await api.createDeck(name);
      els.deckNewInput.value = '';
      await refresh();
      if (window.setDecksVisible) window.setDecksVisible(true);
    });
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
      if (els.choicesCardsInput) els.choicesCardsInput.checked = false;
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
      const choicesAsCards = !!(els.choicesCardsInput && els.choicesCardsInput.checked);
      if (!front || lines.length < 2) return;
      if (multi) {
        const nums = els.answersInput.value.split(/[^\d]+/).map(s => s.trim()).filter(Boolean).map(s => parseInt(s, 10) - 1);
        const uniq = [...new Set(nums)].filter(n => n >= 0 && n < lines.length);
        if (uniq.length === 0) return;
        await api.addCard({ type: 'mcq', front, choices: lines, multi: true, answers: uniq, deck, choices_as_cards: choicesAsCards });
      } else {
        const idx = parseInt(els.answerInput.value, 10) - 1;
        if (!(idx >= 0 && idx < lines.length)) return;
        await api.addCard({ type: 'mcq', front, choices: lines, multi: false, answer: idx, deck, choices_as_cards: choicesAsCards });
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
    if (els.choicesCardsInput) els.choicesCardsInput.checked = false;
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
  // Always allow limited, safe HTML rendering
  refresh().catch(err => {
    console.error(err);
    alert('Failed to load data. See console for details.');
  });
})();
