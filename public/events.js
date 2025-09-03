// Setup deck and card list event handlers (deck toggles, rename/delete, card edit/delete)
export function setupDeckCardEvents(state, els, helpers) {
	if (els.toggleDecksBtn) {
		const setDecksVisible = (show) => {
			state.showDecks = !!show;
			if (els.decksSection) helpers.setPanelVisible(els.decksSection, state.showDecks);
			els.toggleDecksBtn.classList.toggle('active', state.showDecks);
			els.toggleDecksBtn.setAttribute('aria-pressed', state.showDecks ? 'true' : 'false');
			if (state.showDecks) helpers.refresh();
			try {
				localStorage.setItem('showDecks', state.showDecks ? '1' : '0');
			} catch {}
			helpers.updateViewerVisibility(state);
		};
		els.toggleDecksBtn.addEventListener('click', () => setDecksVisible(!state.showDecks));
		try {
			state.showDecks = localStorage.getItem('showDecks') === '1';
		} catch {}
		setDecksVisible(state.showDecks);
		window.setDecksVisible = setDecksVisible;
	}
	// Deck rename/delete and card edit/delete are handled in renderDecks/renderCardsTable via window helpers
}
// Setup toggle button event handlers (timer, auto-advance, adder, decks, etc.)
export function setupToggleEvents(state, els, helpers) {
	if (els.timerBtn) {
		const setTimerEnabled = (on) => {
			state.timerEnabled = !!on;
			els.timerBtn.classList.toggle('active', state.timerEnabled);
			els.timerBtn.setAttribute('aria-pressed', state.timerEnabled ? 'true' : 'false');
			// Update button label for clear feedback
			els.timerBtn.textContent = state.timerEnabled ? '⏱ 10s' : '⏱';
			try {
				localStorage.setItem('timerEnabled', state.timerEnabled ? '1' : '0');
			} catch {}
			if (state.timerEnabled) helpers.startCardTimer();
			else helpers.clearCardTimer();
		};
		els.timerBtn.addEventListener('click', () => setTimerEnabled(!state.timerEnabled));
		try {
			state.timerEnabled = localStorage.getItem('timerEnabled') === '1';
		} catch {}
		setTimerEnabled(state.timerEnabled);
	}
	if (els.autoAdvBtn) {
		const setAutoAdvEnabled = (on) => {
			state.autoAdvanceEnabled = !!on;
			els.autoAdvBtn.classList.toggle('active', state.autoAdvanceEnabled);
			els.autoAdvBtn.setAttribute('aria-pressed', state.autoAdvanceEnabled ? 'true' : 'false');
			const secs = Math.round((state.autoAdvanceDelayMs || 5000) / 1000);
			els.autoAdvBtn.textContent = state.autoAdvanceEnabled ? `Auto-Advance ${secs}s` : 'Auto-Advance';
			try {
				localStorage.setItem('autoAdvanceEnabled', state.autoAdvanceEnabled ? '1' : '0');
			} catch {}
			if (state.autoAdvanceEnabled) helpers.startAutoAdvance();
			else helpers.clearAutoAdvance();
		};
		els.autoAdvBtn.addEventListener('click', () => setAutoAdvEnabled(!state.autoAdvanceEnabled));
		try {
			state.autoAdvanceEnabled = localStorage.getItem('autoAdvanceEnabled') === '1';
		} catch {}
		setAutoAdvEnabled(state.autoAdvanceEnabled);
	}
	if (els.toggleAddBtn) {
		const setAdderVisible = (show) => {
			state.showAdder = !!show;
			if (els.adderSection) helpers.setPanelVisible(els.adderSection, state.showAdder);
			els.toggleAddBtn.classList.toggle('active', state.showAdder);
			els.toggleAddBtn.setAttribute('aria-pressed', state.showAdder ? 'true' : 'false');
			const mainEl = document.getElementById('main');
			if (mainEl) mainEl.classList.toggle('single-column', !state.showAdder);
			try {
				localStorage.setItem('showAdder', state.showAdder ? '1' : '0');
			} catch {}
			helpers.updateViewerVisibility(state);
		};
		els.toggleAddBtn.addEventListener('click', () => setAdderVisible(!state.showAdder));
		try {
			state.showAdder = localStorage.getItem('showAdder') === '1';
		} catch {}
		setAdderVisible(state.showAdder);
	}
}
// public/events.js
// Event handler registration and logic for Flashcards Anywhere

// Add event handler setup functions here, e.g. setupCardEvents, setupDeckEvents, etc.

export function setupCardEvents(state, els, { clearTimer, clearCardTimer, renderCard, next, prev }) {
	// Card click: flip for basic cards
	if (els.card) {
		els.card.addEventListener('click', () => {
			const c = state.cards[state.idx];
			if (c && (c.type || 'basic') === 'basic') {
				state.timeoutReveal = false;
				state.showBack = !state.showBack;
				clearTimer();
				clearCardTimer();
				renderCard();
			}
		});
		els.card.addEventListener('keydown', (e) => {
			if (e.key === ' ' || e.key === 'Enter') {
				e.preventDefault();
				const c = state.cards[state.idx];
				if (!c) return;
				const type = c.type || 'basic';
				if (
					(type === 'basic' && state.showBack) ||
					(type === 'mcq' && (state.multiChecked || state.selected !== null))
				) {
					next();
					return;
				}
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
	}
	if (els.next) els.next.addEventListener('click', next);
	if (els.prev) els.prev.addEventListener('click', prev);
}

// Add more event helpers as needed
