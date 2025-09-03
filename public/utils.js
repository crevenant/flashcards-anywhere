// public/utils.js
// Utility functions for Flashcards Anywhere

// Add utility functions here, e.g. shuffle, debounce, etc.

export function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

// Add more utilities as needed
