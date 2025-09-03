// Determines if auto-advance should trigger based on current state.
export function shouldAutoAdvanceFromState(state, els) {
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
// Ensures the auto-advance progress bar UI is present in the DOM.
export function ensureAutoAdvProgressUI(els) {
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

// Updates the visibility of the main viewer section based on UI state.
export function updateViewerVisibility(state) {
	const anyOpen = !!(
		state.showAdder ||
		state.showDecks ||
		state.showCards ||
		state.showStats ||
		state.showSettings
	);
	// Only hide the .viewer section, not the entire <main>
	const viewer = document.querySelector('.viewer');
	if (viewer) viewer.hidden = anyOpen;
}
// public/ui.js
// UI rendering and DOM update helpers for Flashcards Anywhere

// Add UI rendering functions here, e.g. renderCard, renderDeckList, updateStats, etc.

export function renderDecks(decks, state, els) {
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
			renameBtn.addEventListener('click', () => window.beginRename(row, d));
			deleteBtn.addEventListener('click', async () => {
				if (!confirm(`Delete deck "${d.name}"? Cards will be left unassigned.`)) return;
				await window.api.deleteDeck(d.id);
				if (state.deckName === d.name) state.deckName = '';
				await window.refresh();
				if (window.setDecksVisible) window.setDecksVisible(true);
			});
			els.decksList.appendChild(row);
		});
	}
}

export function renderCardsTable(state, els) {
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
							: [])
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
		// Normalize front/back to always be strings
		let front = card.front;
		if (Array.isArray(front)) front = front.join('');
		else if (typeof front === 'object' && front !== null) front = JSON.stringify(front);
		window.renderSafe(content, front || '');
		body.appendChild(content);
		if ((card.type || 'basic') === 'mcq') {
			let choices = card.choices;
			if (typeof choices === 'string') {
				try { choices = JSON.parse(choices); } catch { choices = []; }
			}
			if (!Array.isArray(choices)) choices = [];
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
				window.renderSafe(d, txt);
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
				window.renderSafe(d, txt);
				mcChoices.appendChild(d);
			});
			chWrap.appendChild(mcChoices);
			body.appendChild(chWrap);
		} else {
			// For basic, show a hint of the back
			const back = document.createElement('div');
			back.className = 'mini-choice';
			// Normalize back to always be a string
			let backStr = card.back;
			if (Array.isArray(backStr)) backStr = backStr.join('');
			else if (typeof backStr === 'object' && backStr !== null) backStr = JSON.stringify(backStr);
			window.renderSafe(back, backStr || '');
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
		del.addEventListener('click', async () => window.deleteCard(card.id));
		edit.addEventListener('click', () => window.editCard(card.id));
		els.cardsList.appendChild(tile);
	});
}
