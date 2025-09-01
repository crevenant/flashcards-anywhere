// Use utilities attached to window (see below for attaching them)

(() => {
	// Robust Electron detection for all Electron versions/contexts
	// Fallback: if loaded as file://, assume Electron and use localhost backend
	// isElectron removed (was unused)
	// Use localhost:8000 for Electron or file://, relative for web
	// API_BASE removed (was unused)

	// Element references
	/**
	 * Element references for main UI components.
	 * @type {Object<string, HTMLElement>}
	 */
	const els = {
		card: document.getElementById('card'),
		frontText: document.getElementById('front-text'),
		back: document.getElementById('back'),
		backText: document.getElementById('back-text'),
		choicesSection: document.getElementById('choices-section'),
		mcqChoices: document.getElementById('mcq-choices'),
		mcqResult: document.getElementById('mcq-result'),
		srsActions: document.getElementById('srs-actions'),
	};

	/**
	 * Ensures the auto-advance progress bar UI is present in the DOM.
	 * @returns {HTMLElement|null}
	 */
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

	/**
	 * Determines if auto-advance should trigger based on current state.
	 * @returns {boolean}
	 */
	function shouldAutoAdvanceFromState() {
		if (!state.autoAdvanceEnabled) return false;
		if (els.viewerSection && els.viewerSection.hidden) return false;
		const c = state.cards[state.idx];
		if (!c) return false;
		const type = c.type || 'basic';
		if (type === 'basic') {
			// Only once the card has been flipped to back
			return !!state.showBack;
		} else {
			// MCQ: only after an answer is selected (single) or checked (multi)
			return c.multi ? !!state.multiChecked : state.selected != null;
		}
	}

	/**
	 * Updates the visibility of the main viewer section based on UI state.
	 */
	function updateViewerVisibility() {
		const anyOpen = !!(
			state.showAdder ||
			state.showDecks ||
			state.showCards ||
			state.showStats ||
			state.showSettings
		);
		if (els.viewerSection) els.viewerSection.hidden = anyOpen;
	}
	// const DELAY_MS = 1200; // delay before reset/advance (unused)
	// const FLIP_MS = 500; // CSS flip transition duration (keep in sync with styles) (unused)

	// Allowlist-based HTML sanitizer for safe rendering
	/**
	 * Allowed HTML tags for safe rendering.
	 * @type {Set<string>}
	 */
	const ALLOWED_TAGS = new Set([
		'b',
		'strong',
		'i',
		'em',
		'u',
		's',
		'br',
		'p',
		'ul',
		'ol',
		'li',
		'code',
		'pre',
		'ruby',
		'rt',
		'rb',
		'rp',
		'span',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'font',
		'a',
		'img',
		'sup',
		'sub',
		'mark',
	]);
	/**
	 * Allowed HTML attributes for each tag for safe rendering.
	 * @type {Object<string, Set<string>>}
	 */
	const ALLOWED_ATTRS = {
		font: new Set(['color', 'size', 'face']),
		a: new Set(['href']),
		img: new Set(['src', 'alt', 'title', 'width', 'height']),
	};
	/**
	 * Sanitizes a single HTML attribute value for a given tag.
	 * @param {string} tag
	 * @param {string} name
	 * @param {string} value
	 * @returns {string|null}
	 */
	function sanitizeAttr(tag, name, value) {
		// Only allow attributes explicitly listed per tag
		const allowed = ALLOWED_ATTRS[tag];
		if (!allowed || !allowed.has(name)) return null;
		// Basic value validation to avoid scriptable values
		if (tag === 'font') {
			if (name === 'color') {
				const v = String(value).trim();
				if (
					/^#[0-9a-fA-F]{3}$/.test(v) ||
					/^#[0-9a-fA-F]{6}$/.test(v) ||
					/^[a-zA-Z]+$/.test(v)
				)
					return v;
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
	/**
	 * Sanitizes HTML and returns a safe DocumentFragment for insertion.
	 * @param {string} html
	 * @returns {DocumentFragment}
	 */
	function sanitizeHtmlToFragment(html) {
		const template = document.createElement('template');
		template.innerHTML = html;
		function clean(node) {
			if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
			if (node.nodeType === Node.ELEMENT_NODE) {
				const tag = node.tagName.toLowerCase();
				if (!ALLOWED_TAGS.has(tag)) {
					const frag = document.createDocumentFragment();
					node.childNodes.forEach((ch) => {
						const c = clean(ch);
						if (c) frag.appendChild(c);
					});
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
				node.childNodes.forEach((ch) => {
					const c = clean(ch);
					if (c) el.appendChild(c);
				});
				return el;
			}
			return document.createTextNode('');
		}
		const out = document.createDocumentFragment();
		template.content.childNodes.forEach((n) => {
			const c = clean(n);
			if (c) out.appendChild(c);
		});
		return out;
	}
	/**
	 * Renders sanitized HTML into a DOM element.
	 * @param {HTMLElement} el
	 * @param {string} text
	 */
	function renderSafe(el, text) {
		el.innerHTML = '';
		el.appendChild(sanitizeHtmlToFragment(String(text)));
	}

	/**
	 * Renders the decks dropdowns and lists in the UI.
	 * @param {Array<Object>} decks
	 */
	function renderDecks(decks) {
		els.deckSelect.innerHTML = '';
		const anyOpt = document.createElement('option');
		anyOpt.value = '';
		anyOpt.textContent = 'All Decks';
		els.deckSelect.appendChild(anyOpt);
		decks.forEach((d) => {
			const opt = document.createElement('option');
			opt.value = d.id;
			opt.textContent = d.name;
			els.deckSelect.appendChild(opt);
		});
		els.deckSelect.value = state.deckId || '';
		// Build id->name and name->id maps
		state.deckMap = {};
		state.deckNameToId = {};
		decks.forEach((d) => {
			state.deckMap[d.id] = d.name;
			state.deckNameToId[d.name] = d.id;
		});
		// Populate Settings default deck dropdown if present
		if (els.setDefaultDeck) {
			els.setDefaultDeck.innerHTML = '';
			const any = document.createElement('option');
			any.value = '';
			any.textContent = 'All Decks';
			els.setDefaultDeck.appendChild(any);
			decks.forEach((d) => {
				const opt = document.createElement('option');
				opt.value = d.name;
				opt.textContent = d.name;
				els.setDefaultDeck.appendChild(opt);
			});
			try {
				const savedDef = localStorage.getItem('defaultDeckName') || '';
				els.setDefaultDeck.value = savedDef;
			} catch {
				els.setDefaultDeck.value = '';
			}
		}
		// Populate Add Card deck dropdown if present and is a <select>
		if (
			els.deckInput &&
			els.deckInput.tagName &&
			els.deckInput.tagName.toLowerCase() === 'select'
		) {
			els.deckInput.innerHTML = '';
			const def = document.createElement('option');
			def.value = '';
			def.textContent = 'Default';
			els.deckInput.appendChild(def);
			decks.forEach((d) => {
				const opt = document.createElement('option');
				opt.value = d.name;
				opt.textContent = d.name;
				els.deckInput.appendChild(opt);
			});
			els.deckInput.value = state.deckName || '';
		}
		if (els.decksList) {
			els.decksList.innerHTML = '';
			decks.forEach((d) => {
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

	/**
	 * Renders the cards list as a grid of mini-cards in the UI.
	 */
	function renderCardsTable() {
		// Render as mini-cards grid instead of table
		if (!els.cardsList) return;
		els.cardsList.innerHTML = '';
		const query = (state.cardsFilter || '').trim().toLowerCase();
		const list = !query
			? state.cards
			: state.cards.filter((card) => {
					const type = card.type || 'basic';
					const deck = state.deckMap[card.deck_id] || '';
					const backOrAns =
						type === 'mcq'
							? (card.multi
									? card.answers || []
									: card.answer != null
										? [card.answer]
										: []
								)
									.map((i) => (card.choices || [])[i])
									.join(' ')
							: card.back || '';
					const hay = [
						String(card.id),
						deck,
						type,
						card.front || '',
						backOrAns || '',
						(card.choices || []).join(' '),
					]
						.join(' ')
						.toLowerCase();
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

		pageItems.forEach((card, i) => {
			const tile = document.createElement('div');
			tile.className = 'mini-card enter';
			tile.style.animationDelay = i * 20 + 'ms';
			tile.addEventListener('animationend', () => tile.classList.remove('enter'), {
				once: true,
			});
			const typeBadge = document.createElement('div');
			typeBadge.className = 'mini-type';
			typeBadge.textContent = (card.type || 'basic').toUpperCase();
			tile.appendChild(typeBadge);
			const body = document.createElement('div');
			body.className = 'mini-scroll';
			const content = document.createElement('div');
			content.className = 'mini-content';
			renderSafe(content, card.front || '');
			body.appendChild(content);
			if ((card.type || 'basic') === 'mcq') {
				const choices = card.choices || [];
				// Answers section
				const idxs = card.multi
					? card.answers || []
					: card.answer != null
						? [card.answer]
						: Array.isArray(card.answers)
							? card.answers
							: [];
				const answersWrap = document.createElement('div');
				const ansLabel = document.createElement('div');
				ansLabel.className = 'mini-label';
				ansLabel.textContent = 'Answers';
				answersWrap.appendChild(ansLabel);
				const mcAns = document.createElement('div');
				mcAns.className = 'mini-choices';
				(idxs || []).forEach((i) => {
					const txt = choices[i];
					if (!txt) return;
					const d = document.createElement('div');
					d.className = 'mini-choice correct';
					renderSafe(d, txt);
					mcAns.appendChild(d);
				});
				answersWrap.appendChild(mcAns);
				body.appendChild(answersWrap);
				// Choices section
				const chWrap = document.createElement('div');
				const chLabel = document.createElement('div');
				chLabel.className = 'mini-label';
				chLabel.textContent = 'Choices';
				chWrap.appendChild(chLabel);
				const mcChoices = document.createElement('div');
				mcChoices.className = 'mini-choices';
				choices.forEach((txt, i) => {
					const d = document.createElement('div');
					d.className = 'mini-choice';
					if ((idxs || []).includes(i)) d.classList.add('correct');
					renderSafe(d, txt);
					mcChoices.appendChild(d);
				});
				chWrap.appendChild(mcChoices);
				body.appendChild(chWrap);
			} else {
				// For basic, show a hint of the back
				const back = document.createElement('div');
				back.className = 'mini-choice';
				renderSafe(back, card.back || '');
				body.appendChild(back);
			}
			tile.appendChild(body);
			const actions = document.createElement('div');
			actions.className = 'actions';
			const edit = document.createElement('button');
			edit.className = 'icon-btn';
			edit.setAttribute('title', 'Edit');
			edit.setAttribute('aria-label', 'Edit');
			edit.textContent = '✎';
			const del = document.createElement('button');
			del.className = 'icon-btn';
			del.setAttribute('title', 'Delete');
			del.setAttribute('aria-label', 'Delete');
			del.textContent = '🗑️';
			actions.appendChild(edit);
			actions.appendChild(del);
			tile.appendChild(actions);
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
		if (els.cardsNext)
			els.cardsNext.disabled = !(totalPages > 0 && state.cardsPage < totalPages);
		if (els.cardsCount)
			els.cardsCount.textContent = `${total} matching card${total === 1 ? '' : 's'}`;
	}

	// _enterEditRow function removed (was unused)

	/**
	 * Begins the rename flow for a deck row in the UI.
	 * @param {HTMLElement} row
	 * @param {Object} deck
	 */
	function beginRename(row, deck) {
		row.innerHTML = '';
		const wrap = document.createElement('div');
		wrap.className = 'deck-rename';
		const input = document.createElement('input');
		input.type = 'text';
		input.value = deck.name;
		input.className = 'deck-name';
		const save = document.createElement('button');
		save.className = 'btn btn-primary';
		save.textContent = 'Save';
		const cancel = document.createElement('button');
		cancel.className = 'btn';
		cancel.textContent = 'Cancel';
		wrap.appendChild(input);
		wrap.appendChild(save);
		wrap.appendChild(cancel);
		row.appendChild(wrap);
		save.addEventListener('click', async () => {
			const name = input.value.trim();
			if (!name) return;
			await api.renameDeck(deck.id, name);
			if (state.deckName === deck.name) state.deckName = name;
			await refresh();
			alert('Failed to save');
		});
		cancel.addEventListener('click', async () => {
			await refresh();
			if (window.setDecksVisible) window.setDecksVisible(true);
		});
		input.focus();
		input.select();
	}

	/**
	 * Renders the current card in the main viewer, including MCQ and basic types.
	 */
	function renderCard() {
		if (!state.cards.length) {
			renderSafe(els.frontText, 'No cards yet');
			els.choicesSection.hidden = true;
			els.mcqChoices.hidden = true;
			els.mcqResult.hidden = true;
			if (els.srsActions) els.srsActions.hidden = true;
			if (els.srsActionsBasic) els.srsActionsBasic.hidden = true;
			renderSafe(els.back, 'Use the form below to add one');
			els.card.classList.toggle('flipped', state.showBack);
			els.pos.textContent = '0 / 0';
			return;
		}
		const c = state.cards[state.idx];
		// Prepare shuffled order for MCQ whenever entering a new card
		if ((c.type || 'basic') === 'mcq') {
			if (
				state.lastCardId !== c.id ||
				!state.choiceOrder ||
				state.choiceOrder.length !== (c.choices || []).length
			) {
				state.choiceOrder = Array.from({ length: (c.choices || []).length }, (_, i) => i);
				for (let i = state.choiceOrder.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[state.choiceOrder[i], state.choiceOrder[j]] = [
						state.choiceOrder[j],
						state.choiceOrder[i],
					];
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
				btn.style.animationDelay = i * 30 + 'ms';
				btn.addEventListener('animationend', () => btn.classList.remove('enter'), {
					once: true,
				});
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
						setResult(
							"Time's up.",
							(c.answers || []).map((i) => c.choices[i])
						);
					} else {
						setResult(
							state.correct ? 'Correct!' : 'Wrong.',
							(c.answers || []).map((i) => c.choices[i])
						);
					}
					els.mcqResult.hidden = false;
					if (els.srsActions) els.srsActions.hidden = false;
				} else {
					clearResult();
					els.mcqResult.hidden = true;
					if (els.srsActions) els.srsActions.hidden = true;
				}
			} else {
				els.mcqCheck.hidden = true;
				if (state.selected == null) {
					clearResult();
					els.mcqResult.hidden = true;
					if (els.srsActions) els.srsActions.hidden = true;
				} else if (state.timeoutReveal) {
					const correctText = c.answer != null ? c.choices[c.answer] : '';
					setResult("Time's up.", correctText ? [correctText] : []);
					els.mcqResult.hidden = false;
					if (els.srsActions) els.srsActions.hidden = false;
				} else if (state.correct) {
					setResult('Correct!', []);
					els.mcqResult.hidden = false;
					if (els.srsActions) els.srsActions.hidden = false;
				} else {
					const correctText = c.answer != null ? c.choices[c.answer] : '';
					setResult('Wrong.', correctText ? [correctText] : []);
					els.mcqResult.hidden = false;
					if (els.srsActions) els.srsActions.hidden = false;
				}
			}
			if (els.backText) {
				renderSafe(els.backText, '');
			}
			// Keep card unflipped for MCQ
			state.showBack = false;
		} else {
			els.choicesSection.hidden = true;
			els.mcqChoices.hidden = true;
			els.mcqResult.hidden = true;
			els.mcqCheck.hidden = true;
			if (els.backText) {
				renderSafe(els.backText, c.back);
			} else {
				renderSafe(els.back, c.back);
			}
		}
		els.card.classList.toggle('flipped', state.showBack);
		els.pos.textContent = `${state.idx + 1} / ${state.cards.length}`;
		// Start/restart timers
		if (state.timerEnabled && !state.showBack && !state.timerHold) startCardTimer();
		if (shouldAutoAdvanceFromState()) startAutoAdvance();
		else clearAutoAdvance();
		// Mark start time for metrics when entering a new card id
		if (state.viewedCardId !== c.id) {
			state.viewStart = performance.now();
			state.logged = false;
			state.viewedCardId = c.id;
		}
		// Adjust card height for MCQ to fit content
		adjustCardHeight();
		// For basic cards, show SRS actions only when back is visible
		if ((c.type || 'basic') === 'basic') {
			if (els.srsActionsBasic) els.srsActionsBasic.hidden = !state.showBack;
		}
	}

	function enterEditTile(tile, card) {
		tile.innerHTML = '';
		tile.classList.add('mini-card');
		const type = card.type || 'basic';
		const wrap = document.createElement('div');
		wrap.className = 'mini-edit';
		wrap.style.width = '100%';
		const typeBadge = document.createElement('div');
		typeBadge.className = 'mini-type';
		typeBadge.textContent = type.toUpperCase();
		wrap.appendChild(typeBadge);
		const front = document.createElement('textarea');
		front.value = card.front || '';
		front.style.width = '100%';
		front.rows = 4;
		wrap.appendChild(front);
		let back, choicesArea, multiChk, answerInput, answersInput, cardsChk;
		if (type === 'basic') {
			back = document.createElement('textarea');
			back.value = card.back || '';
			back.style.width = '100%';
			back.rows = 4;
			wrap.appendChild(back);
		} else {
			// MCQ editors
			cardsChk = document.createElement('input');
			cardsChk.type = 'checkbox';
			cardsChk.checked = !!card.choices_as_cards;
			const cardsLbl = document.createElement('label');
			cardsLbl.className = 'inline';
			cardsLbl.appendChild(cardsChk);
			cardsLbl.appendChild(document.createTextNode(' Display choices as mini cards'));
			wrap.appendChild(cardsLbl);
			multiChk = document.createElement('input');
			multiChk.type = 'checkbox';
			multiChk.checked = !!card.multi;
			const multiLbl = document.createElement('label');
			multiLbl.className = 'inline';
			multiLbl.appendChild(multiChk);
			multiLbl.appendChild(document.createTextNode(' Allow multiple answers'));
			wrap.appendChild(multiLbl);
			choicesArea = document.createElement('textarea');
			choicesArea.style.width = '100%';
			choicesArea.rows = 6;
			choicesArea.value = (card.choices || []).join('\n');
			wrap.appendChild(choicesArea);
			const singleWrap = document.createElement('div');
			answerInput = document.createElement('input');
			answerInput.type = 'number';
			answerInput.min = '1';
			answerInput.value = card.answer != null ? card.answer + 1 : 1;
			answerInput.style.width = '100%';
			singleWrap.appendChild(answerInput);
			singleWrap.style.display = multiChk.checked ? 'none' : '';
			const multiWrap = document.createElement('div');
			answersInput = document.createElement('input');
			answersInput.type = 'text';
			answersInput.placeholder = 'e.g. 1,3';
			answersInput.value = (card.answers || []).map((i) => i + 1).join(',');
			answersInput.style.width = '100%';
			multiWrap.appendChild(answersInput);
			multiWrap.style.display = multiChk.checked ? '' : 'none';
			wrap.appendChild(singleWrap);
			wrap.appendChild(multiWrap);
			multiChk.addEventListener('change', () => {
				singleWrap.style.display = multiChk.checked ? 'none' : '';
				multiWrap.style.display = multiChk.checked ? '' : 'none';
			});
		}
		const actions = document.createElement('div');
		actions.style.display = 'flex';
		actions.style.gap = '8px';
		actions.style.marginTop = '8px';
		const save = document.createElement('button');
		save.className = 'btn btn-primary';
		save.textContent = 'Save';
		const cancel = document.createElement('button');
		cancel.className = 'btn';
		cancel.textContent = 'Cancel';
		actions.appendChild(save);
		actions.appendChild(cancel);
		wrap.appendChild(actions);
		tile.appendChild(wrap);
		save.addEventListener('click', async () => {
			const patch = {};
			const nf = front.value.trim();
			if (nf && nf !== (card.front || '')) patch.front = nf;
			if (type === 'basic') {
				const nb = (back.value || '').trim();
				if (nb !== (card.back || '')) patch.back = nb;
			} else {
				const lines = (choicesArea.value || '')
					.split(/\r?\n/)
					.map((s) => s.trim())
					.filter(Boolean);
				if (JSON.stringify(lines) !== JSON.stringify(card.choices || []))
					patch.choices = lines;
				const isMulti = !!multiChk.checked;
				patch.multi = isMulti;
				if (cardsChk) patch.choices_as_cards = !!cardsChk.checked;
				if (isMulti) {
					const nums = (answersInput.value || '')
						.split(/[^\d]+/)
						.map((s) => s.trim())
						.filter(Boolean)
						.map((s) => parseInt(s, 10) - 1);
					const uniq = [...new Set(nums)];
					patch.answers = uniq;
				} else {
					const idx = parseInt(answerInput.value, 10) - 1;
					patch.answer = isNaN(idx) ? null : idx;
				}
			}
			try {
				await api.updateCard(card.id, patch);
				await refresh();
				if (window.setCardsVisible) window.setCardsVisible(true);
			} catch (_e) {
				alert('Failed to save: ' + _e);
			}
		});
		cancel.addEventListener('click', async () => {
			await refresh();
			if (window.setCardsVisible) window.setCardsVisible(true);
		});
	}

	// Cancels any running auto-advance timer and animation frame
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
		// Optionally reset progress bar UI
		const el = document.getElementById('auto-adv-progress-bar');
		if (el) {
			el.style.width = '0%';
			el.style.background = '';
		}
		if (els.autoAdvBtn) {
			els.autoAdvBtn.textContent = 'Auto-Advance';
		}
	}

	// Size the flashcard to fit the currently visible content
	function adjustCardHeight() {
		const c = state.cards[state.idx];
		if (!c) return;
		const type = c.type || 'basic';
		// Choose the element that is visible: MCQ always on front; basic depends on flip
		let faceEl = null;
		if (type === 'mcq') {
			faceEl = els.front;
		} else {
			faceEl = state.showBack ? els.back : els.front;
		}
		if (!faceEl) return;
		const h = faceEl.scrollHeight;
		if (h && h > 0) {
			els.card.style.height = h + 'px';
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
			state.selected = null;
			state.correct = null;
			state.multiSelected.clear();
			state.multiChecked = false;
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
			const onIn = () => {
				cardEl.classList.remove('advance-in');
				cardEl.removeEventListener('animationend', onIn);
			};
			cardEl.addEventListener('animationend', onIn);
		};
		cardEl.addEventListener('animationend', onOut);
	}

	// Start the 'advance-out' animation now and wait for it to finish before swapping.
	// If outDurationMs is provided, temporarily set animationDuration to sync with flip.

	function prev() {
		if (!state.cards.length) return;
		const doRender = () => {
			state.idx = (state.idx - 1 + state.cards.length) % state.cards.length;
			state.showBack = false;
			state.selected = null;
			state.correct = null;
			state.multiSelected.clear();
			state.multiChecked = false;
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
		   if (window.shuffle) window.shuffle(state.cards);
		   state.idx = 0;
		   state.showBack = false;
		   state.selected = null;
		   state.correct = null;
		   state.multiSelected.clear();
		   state.multiChecked = false;
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
		state.correct = chosenOrig === c.answer;
		// Clear timers first; render will re-schedule auto-advance if enabled and applicable
		clearCardTimer();
		renderCard();
		// Show result and hold until user moves to next (auto-advance may handle this if enabled)
		// Log once per card
		if (!state.logged && state.viewStart != null) {
			const dur = Math.max(0, Math.round(performance.now() - state.viewStart));
			api.review(c.id, state.correct ? 'correct' : 'wrong', dur);
			state.logged = true;
		}
	}

	function toggleMultiChoice(i) {
		const c = state.cards[state.idx];
		if ((c.type || 'basic') !== 'mcq' || !c.multi || state.multiChecked) return;
		state.timeoutReveal = false;
		if (state.multiSelected.has(i)) state.multiSelected.delete(i);
		else state.multiSelected.add(i);
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
			let variant = isOk ? 'success' : isErr ? 'error' : isTimeout ? 'timeout' : '';
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
			correctTexts.forEach((text) => {
				const div = document.createElement('div');
				div.className = 'choice correct-item correct' + (asCards ? ' card-choice' : '');
				renderSafe(div, text);
				list.appendChild(div);
			});
			els.mcqResult.appendChild(list);
		}
	}
	function clearResult() {
		els.mcqResult.classList.remove('ok', 'err');
		els.mcqResult.innerHTML = '';
		els.mcqResult.hidden = true;
	}

	function checkMulti() {
		const c = state.cards[state.idx];
		if ((c.type || 'basic') !== 'mcq' || !c.multi) return;
		state.timeoutReveal = false;
		const answers = new Set(c.answers || []);
		const order = state.choiceOrder || (c.choices || []).map((_, k) => k);
		let ok = answers.size === state.multiSelected.size;
		if (ok) {
			for (const dispIdx of state.multiSelected) {
				const origIdx = order[dispIdx];
				if (!answers.has(origIdx)) {
					ok = false;
					break;
				}
			}
		}
		state.multiChecked = true;
		state.correct = ok;
		// Clear timers before rendering; render will schedule auto-advance if applicable
		clearTimer();
		clearCardTimer();
		renderCard();
		// Keep result visible; wait for user to move to next card
		if (!state.logged && state.viewStart != null) {
			const dur = Math.max(0, Math.round(performance.now() - state.viewStart));
			api.review(c.id, state.correct ? 'correct' : 'wrong', dur);
			state.logged = true;
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
			state.srsMode ? api.srsDue(state.deckName, 100) : api.cards(state.deckName),
		]);
		renderDecks(decks);
		state.cards = cards;
		state.idx = 0;
		state.showBack = false;
		state.selected = null;
		state.correct = null;
		state.multiSelected.clear();
		state.multiChecked = false;
		state.timeoutReveal = false;
		state.timerHold = false;
		clearTimer();
		clearCardTimer();
		renderCard();
		state.cardsPage = 1;
		renderCardsTable();
		if (state.showStats) await renderStats();
		// Keep settings panel inputs in sync
		syncSettingsUI();
	}

	function syncSettingsUI() {
		if (!els.settingsSection) return;
		if (els.setAutoAdvEnable) els.setAutoAdvEnable.checked = !!state.autoAdvanceEnabled;
		if (els.setAutoAdvSecs)
			els.setAutoAdvSecs.value = Math.max(
				1,
				Math.round((state.autoAdvanceDelayMs || 5000) / 1000)
			);
		if (els.setTimerEnable) els.setTimerEnable.checked = !!state.timerEnabled;
		if (els.setTimerSecs)
			els.setTimerSecs.value = Math.max(
				1,
				Math.round((state.timerDurationMs || 10000) / 1000)
			);
		if (els.setCardsPerPage) els.setCardsPerPage.value = String(state.cardsPerPage);
	}

	async function renderStats() {
		if (!els.statsSummary || !els.statsList) return;
		const data = await (async () => {
			try {
				return await api.stats(state.deckName);
			} catch {
				return {
					total_cards: 0,
					reviewed_cards: 0,
					total_reviews: 0,
					correct: 0,
					wrong: 0,
					timeout: 0,
					per_card: [],
				};
			}
		})();
		// Show selected deck name
		if (els.statsDeckName) {
			els.statsDeckName.textContent = state.deckName ? state.deckName : 'All Decks';
		}
		els.statsSummary.innerHTML = '';
		const items = [
			{ label: 'Cards', value: `${data.reviewed_cards || 0} / ${data.total_cards || 0}` },
			{ label: 'Reviews', value: `${data.total_reviews || 0}` },
			{ label: 'Correct', value: `${data.correct || 0}` },
			{ label: 'Wrong', value: `${data.wrong || 0}` },
			{ label: 'Timeout', value: `${data.timeout || 0}` },
			{
				label: 'Avg ms',
				value: `${data.avg_duration_ms != null ? Math.round(data.avg_duration_ms) : '-'}`,
			},
			{ label: 'Due', value: `${(data.srs && data.srs.due_total) || 0}` },
			{ label: 'New', value: `${(data.srs && data.srs.new) || 0}` },
			{ label: 'Learn', value: `${(data.srs && data.srs.learn) || 0}` },
			{ label: 'Review', value: `${(data.srs && data.srs.review) || 0}` },
		];
		items.forEach((it) => {
			const box = document.createElement('div');
			box.className = 'stat-box';
			const v = document.createElement('div');
			v.className = 'value';
			v.textContent = it.value;
			box.appendChild(v);
			const l = document.createElement('div');
			l.className = 'label';
			l.textContent = it.label;
			box.appendChild(l);
			els.statsSummary.appendChild(box);
		});
		// Store per-card and render current page
		state.statsPerCard = data.per_card || [];
		state.statsPage = 1;
		renderStatsList();
	}

	function renderStatsList() {
		if (!els.statsList) return;
		els.statsList.innerHTML = '';
		const total = state.statsPerCard.length;
		const per = state.statsPerPage;
		const totalPages = total === 0 ? 0 : Math.ceil(total / per);
		if (totalPages === 0) state.statsPage = 0;
		else if (state.statsPage < 1) state.statsPage = 1;
		else if (state.statsPage > totalPages) state.statsPage = totalPages;
		const start = totalPages === 0 ? 0 : (state.statsPage - 1) * per;
		const end = totalPages === 0 ? 0 : Math.min(start + per, total);
		const items = state.statsPerCard.slice(start, end);
		items.forEach((row) => {
			const div = document.createElement('div');
			div.className = 'stats-row';
			const front = document.createElement('div');
			front.className = 'front';
			renderSafe(front, row.front || '');
			div.appendChild(front);
			const meta = document.createElement('div');
			meta.className = 'meta';
			meta.textContent = `Total ${row.total} • Correct ${row.correct} • Wrong ${row.wrong} • Timeout ${row.timeout}`;
			div.appendChild(meta);
			els.statsList.appendChild(div);
		});
		if (els.statsPageEl)
			els.statsPageEl.textContent = `${totalPages === 0 ? 0 : state.statsPage} / ${totalPages}`;
		if (els.statsPrev) els.statsPrev.disabled = !(totalPages > 0 && state.statsPage > 1);
		if (els.statsNext)
			els.statsNext.disabled = !(totalPages > 0 && state.statsPage < totalPages);
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
			const type = c.type || 'basic';
			// If answer/result is showing, space/enter advances (mouse click does not)
			if (
				(type === 'basic' && state.showBack) ||
				(type === 'mcq' && (state.multiChecked || state.selected !== null))
			) {
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
	function bindSrsButtons() {
		const click = (grade) => async () => {
			const c = state.cards[state.idx];
			if (!c) return;
			await api.srsReview(c.id, grade);
			await refresh();
		};
		if (els.srsAgain) els.srsAgain.addEventListener('click', click('again'));
		if (els.srsHard) els.srsHard.addEventListener('click', click('hard'));
		if (els.srsGood) els.srsGood.addEventListener('click', click('good'));
		if (els.srsEasy) els.srsEasy.addEventListener('click', click('easy'));
		if (els.srsAgainBasic) els.srsAgainBasic.addEventListener('click', click('again'));
		if (els.srsHardBasic) els.srsHardBasic.addEventListener('click', click('hard'));
		if (els.srsGoodBasic) els.srsGoodBasic.addEventListener('click', click('good'));
		if (els.srsEasyBasic) els.srsEasyBasic.addEventListener('click', click('easy'));
	}

	els.mcqCheck.addEventListener('click', checkMulti);
	els.next.addEventListener('click', next);
	els.prev.addEventListener('click', prev);
	els.shuffleBtn.addEventListener('click', shuffle);
	bindSrsButtons();
	// Recalculate MCQ height on window resize
	window.addEventListener('resize', () => adjustCardHeight());
	if (els.timerBtn) {
		const setTimerEnabled = (on) => {
			state.timerEnabled = !!on;
			els.timerBtn.classList.toggle('active', state.timerEnabled);
			els.timerBtn.setAttribute('aria-pressed', state.timerEnabled ? 'true' : 'false');
			// Update button label for clear feedback
			els.timerBtn.textContent = state.timerEnabled ? '⏱ 10s' : '⏱';
			try {
				localStorage.setItem('timerEnabled', state.timerEnabled ? '1' : '0');
			} catch {
				/* intentionally empty */
			}
			if (state.timerEnabled) startCardTimer();
			else clearCardTimer();
		};
		els.timerBtn.addEventListener('click', () => setTimerEnabled(!state.timerEnabled));
		try {
			state.timerEnabled = localStorage.getItem('timerEnabled') === '1';
		} catch {
			/* intentionally empty */
		}
		setTimerEnabled(state.timerEnabled);
	}
	if (els.autoAdvBtn) {
		const setAutoAdvEnabled = (on) => {
			state.autoAdvanceEnabled = !!on;
			els.autoAdvBtn.classList.toggle('active', state.autoAdvanceEnabled);
			els.autoAdvBtn.setAttribute(
				'aria-pressed',
				state.autoAdvanceEnabled ? 'true' : 'false'
			);
			// Show seconds on the button when enabled, like the timer button
			const secs = Math.round((state.autoAdvanceDelayMs || 5000) / 1000);
			els.autoAdvBtn.textContent = state.autoAdvanceEnabled
				? `Auto-Advance ${secs}s`
				: 'Auto-Advance';
			try {
				localStorage.setItem('autoAdvanceEnabled', state.autoAdvanceEnabled ? '1' : '0');
			} catch {
				/* intentionally empty */
			}
			if (state.autoAdvanceEnabled) startAutoAdvance();
			else clearAutoAdvance();
		};
		els.autoAdvBtn.addEventListener('click', () =>
			setAutoAdvEnabled(!state.autoAdvanceEnabled)
		);
		try {
			state.autoAdvanceEnabled = localStorage.getItem('autoAdvanceEnabled') === '1';
		} catch {
			/* intentionally empty */
		}
		setAutoAdvEnabled(state.autoAdvanceEnabled);
	}
	if (els.toggleAddBtn) {
		const setAdderVisible = (show) => {
			state.showAdder = !!show;
			if (els.adderSection) setPanelVisible(els.adderSection, state.showAdder);
			els.toggleAddBtn.classList.toggle('active', state.showAdder);
			els.toggleAddBtn.setAttribute('aria-pressed', state.showAdder ? 'true' : 'false');
			// Adjust main grid columns when adder is hidden/visible
			const mainEl = document.getElementById('main');
			if (mainEl) mainEl.classList.toggle('single-column', !state.showAdder);
			try {
				localStorage.setItem('showAdder', state.showAdder ? '1' : '0');
			} catch {
				/* intentionally empty */
			}
			updateViewerVisibility();
		};
		els.toggleAddBtn.addEventListener('click', () => setAdderVisible(!state.showAdder));
		// restore persisted preference
		try {
			state.showAdder = localStorage.getItem('showAdder') === '1';
		} catch {
			/* intentionally empty */
		}
		setAdderVisible(state.showAdder);
	}
	if (els.toggleDecksBtn) {
		const setDecksVisible = (show) => {
			state.showDecks = !!show;
			if (els.decksSection) setPanelVisible(els.decksSection, state.showDecks);
			els.toggleDecksBtn.classList.toggle('active', state.showDecks);
			els.toggleDecksBtn.setAttribute('aria-pressed', state.showDecks ? 'true' : 'false');
			if (state.showDecks) {
				/* refresh list */ refresh();
			}
			try {
				localStorage.setItem('showDecks', state.showDecks ? '1' : '0');
			} catch {
				/* intentionally empty */
			}
			updateViewerVisibility();
		};
		els.toggleDecksBtn.addEventListener('click', () => setDecksVisible(!state.showDecks));
		try {
			state.showDecks = localStorage.getItem('showDecks') === '1';
		} catch {
			/* intentionally empty */
		}
		setDecksVisible(state.showDecks);
		window.setDecksVisible = setDecksVisible;
	}
	if (els.toggleCardsBtn) {
		const setCardsVisible = (show) => {
			state.showCards = !!show;
			if (els.cardsSection) setPanelVisible(els.cardsSection, state.showCards);
			els.toggleCardsBtn.classList.toggle('active', state.showCards);
			els.toggleCardsBtn.setAttribute('aria-pressed', state.showCards ? 'true' : 'false');
			if (state.showCards) renderCardsTable();
			try {
				localStorage.setItem('showCards', state.showCards ? '1' : '0');
			} catch {
				/* intentionally empty */
			}
			updateViewerVisibility();
		};
		els.toggleCardsBtn.addEventListener('click', () => setCardsVisible(!state.showCards));
		try {
			state.showCards = localStorage.getItem('showCards') === '1';
		} catch {
			/* intentionally empty */
		}
		setCardsVisible(state.showCards);
		window.setCardsVisible = setCardsVisible;
	}
	if (els.toggleStatsBtn) {
		const setStatsVisible = async (show) => {
			state.showStats = !!show;
			if (els.statsSection) setPanelVisible(els.statsSection, state.showStats);
			els.toggleStatsBtn.classList.toggle('active', state.showStats);
			els.toggleStatsBtn.setAttribute('aria-pressed', state.showStats ? 'true' : 'false');
			updateViewerVisibility();
			if (state.showStats) await renderStats();
			try {
				localStorage.setItem('showStats', state.showStats ? '1' : '0');
			} catch {
				/* intentionally empty */
			}
		};
		els.toggleStatsBtn.addEventListener('click', () => setStatsVisible(!state.showStats));
		try {
			state.showStats = localStorage.getItem('showStats') === '1';
		} catch {
			/* intentionally empty */
		}
		setStatsVisible(state.showStats);
		window.setStatsVisible = setStatsVisible;
	}
	if (els.toggleSettingsBtn) {
		const setSettingsVisible = (show) => {
			state.showSettings = !!show;
			if (els.settingsSection) setPanelVisible(els.settingsSection, state.showSettings);
			els.toggleSettingsBtn.classList.toggle('active', state.showSettings);
			els.toggleSettingsBtn.setAttribute(
				'aria-pressed',
				state.showSettings ? 'true' : 'false'
			);
			updateViewerVisibility();
			syncSettingsUI();
		};
		els.toggleSettingsBtn.addEventListener('click', () =>
			setSettingsVisible(!state.showSettings)
		);
		try {
			state.showSettings = localStorage.getItem('showSettings') === '1';
		} catch {
			/* intentionally empty */
		}
		setSettingsVisible(state.showSettings);
	}

	if (els.settingsApply) {
		els.settingsApply.addEventListener('click', () => {
			// Apply Auto-Advance settings
			if (els.setAutoAdvEnable) state.autoAdvanceEnabled = !!els.setAutoAdvEnable.checked;
			if (els.setAutoAdvSecs) {
				const secs = parseInt(els.setAutoAdvSecs.value, 10);
				if (!isNaN(secs) && secs > 0) state.autoAdvanceDelayMs = secs * 1000;
			}
			// Apply Timer settings
			if (els.setTimerEnable) state.timerEnabled = !!els.setTimerEnable.checked;
			if (els.setTimerSecs) {
				const t = parseInt(els.setTimerSecs.value, 10);
				if (!isNaN(t) && t > 0) state.timerDurationMs = t * 1000;
			}
			// Apply Cards page size
			if (els.setCardsPerPage) {
				const v = parseInt(els.setCardsPerPage.value, 10);
				if (!isNaN(v)) {
					state.cardsPerPage = v;
					state.cardsPage = 1;
					try {
						localStorage.setItem('cardsPerPage', String(v));
					} catch {
						/* intentionally empty */
					}
					// mirror into toolbar selector if present
					if (els.cardsPageSize) els.cardsPageSize.value = String(v);
				}
			}
			// Apply Default Deck
			if (els.setDefaultDeck) {
				const defName = els.setDefaultDeck.value || '';
				try {
					localStorage.setItem('defaultDeckName', defName);
				} catch {
					/* intentionally empty */
				}
				if (state.deckName !== defName) {
					state.deckName = defName;
					if (els.deckSelect) els.deckSelect.value = defName;
				}
			}
			// Persist toggles
			try {
				localStorage.setItem('autoAdvanceEnabled', state.autoAdvanceEnabled ? '1' : '0');
				localStorage.setItem(
					'autoAdvanceDelayMs',
					String(state.autoAdvanceDelayMs || 5000)
				);
				localStorage.setItem('timerEnabled', state.timerEnabled ? '1' : '0');
				localStorage.setItem('timerDurationMs', String(state.timerDurationMs || 10000));
			} catch {
				/* intentionally empty */
			}
			// Reflect header toggles and behaviors
			if (els.autoAdvBtn) {
				els.autoAdvBtn.classList.toggle('active', state.autoAdvanceEnabled);
				els.autoAdvBtn.setAttribute(
					'aria-pressed',
					state.autoAdvanceEnabled ? 'true' : 'false'
				);
				if (state.autoAdvanceEnabled) startAutoAdvance();
				else clearAutoAdvance();
			}
			if (els.timerBtn) {
				els.timerBtn.classList.toggle('active', state.timerEnabled);
				els.timerBtn.setAttribute('aria-pressed', state.timerEnabled ? 'true' : 'false');
				if (state.timerEnabled) startCardTimer();
				else clearCardTimer();
			}
			renderCardsTable();
			refresh();
			showToast('Settings applied');
		});
	}

	function setPanelVisible(el, show) {
		const DURATION = 220;
		if (show) {
			if (!el) return;
			el.hidden = false;
			requestAnimationFrame(() => el.classList.add('open'));
		} else {
			if (!el) return;
			el.classList.remove('open');
			setTimeout(() => {
				el.hidden = true;
			}, DURATION);
		}
	}

	function showToast(msg) {
		const t = document.createElement('div');
		t.className = 'toast';
		t.textContent = String(msg || '');
		document.body.appendChild(t);
		requestAnimationFrame(() => t.classList.add('show'));
		setTimeout(() => {
			t.classList.remove('show');
			setTimeout(() => {
				if (t.parentElement) t.parentElement.removeChild(t);
			}, 220);
		}, 1600);
	}
	if (els.srsModeBtn) {
		const setSrsMode = async (on) => {
			state.srsMode = !!on;
			els.srsModeBtn.classList.toggle('active', state.srsMode);
			els.srsModeBtn.setAttribute('aria-pressed', state.srsMode ? 'true' : 'false');
			els.srsModeBtn.textContent = 'Study (SRS)';
			try {
				localStorage.setItem('srsMode', state.srsMode ? '1' : '0');
			} catch {
				/* intentionally empty */
			}
			await refresh();
		};
		els.srsModeBtn.addEventListener('click', () => setSrsMode(!state.srsMode));
		try {
			state.srsMode = localStorage.getItem('srsMode') === '1';
		} catch {
			/* intentionally empty */
		}
		setSrsMode(state.srsMode);
	}
	if (els.statsPrev)
		els.statsPrev.addEventListener('click', () => {
			state.statsPage = Math.max(1, state.statsPage - 1);
			renderStatsList();
		});
	if (els.statsNext)
		els.statsNext.addEventListener('click', () => {
			state.statsPage = state.statsPage + 1;
			renderStatsList();
		});
	if (els.cardsPrev)
		els.cardsPrev.addEventListener('click', () => {
			state.cardsPage = Math.max(1, state.cardsPage - 1);
			renderCardsTable();
		});
	if (els.cardsNext)
		els.cardsNext.addEventListener('click', () => {
			state.cardsPage = state.cardsPage + 1;
			renderCardsTable();
		});
	if (els.cardsFilterInput)
		els.cardsFilterInput.addEventListener('input', () => {
			state.cardsFilter = els.cardsFilterInput.value;
			state.cardsPage = 1;
			renderCardsTable();
		});
	if (els.cardsPageSize) {
		// Initialize from saved preference
		try {
			const saved = parseInt(localStorage.getItem('cardsPerPage') || '', 10);
			if (!isNaN(saved) && [5, 10, 25, 50, 100].includes(saved)) state.cardsPerPage = saved;
		} catch {
			/* intentionally empty */
		}
		els.cardsPageSize.value = String(state.cardsPerPage);
		els.cardsPageSize.addEventListener('change', () => {
			const v = parseInt(els.cardsPageSize.value, 10);
			if (!isNaN(v)) {
				state.cardsPerPage = v;
				state.cardsPage = 1;
				try {
					localStorage.setItem('cardsPerPage', String(v));
				} catch {
					/* intentionally empty */
				}
				renderCardsTable();
			}
		});
	}
	// (Deck management dropdown removed)
	if (els.deckAddForm) {
		els.deckAddForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const name = els.deckNewInput.value.trim();
			if (!name) return;
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
			const lines = els.choicesInput.value
				.split(/\r?\n/)
				.map((s) => s.trim())
				.filter(Boolean);
			const multi = els.multiInput.checked;
			const choicesAsCards = !!(els.choicesCardsInput && els.choicesCardsInput.checked);
			if (!front || lines.length < 2) return;
			if (multi) {
				const nums = els.answersInput.value
					.split(/[^\d]+/)
					.map((s) => s.trim())
					.filter(Boolean)
					.map((s) => parseInt(s, 10) - 1);
				const uniq = [...new Set(nums)].filter((n) => n >= 0 && n < lines.length);
				if (uniq.length === 0) return;
				await api.addCard({
					type: 'mcq',
					front,
					choices: lines,
					multi: true,
					answers: uniq,
					deck,
					choices_as_cards: choicesAsCards,
				});
			} else {
				const idx = parseInt(els.answerInput.value, 10) - 1;
				if (!(idx >= 0 && idx < lines.length)) return;
				await api.addCard({
					type: 'mcq',
					front,
					choices: lines,
					multi: false,
					answer: idx,
					deck,
					choices_as_cards: choicesAsCards,
				});
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
	// Restore default deck before first refresh
	try {
		const def = localStorage.getItem('defaultDeckName');
		if (def != null) state.deckName = def;
	} catch {
		/* intentionally empty */
	}
	// Always allow limited, safe HTML rendering
	refresh().catch((err) => {
		console.error(err);
		alert('Failed to load data. See console for details.');
	});
})();
