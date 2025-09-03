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
