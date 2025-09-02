// public/state.test.js
import { state } from './state.js';

describe('state object', () => {
  it('should be defined and an object', () => {
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
  });

  it('should have all expected keys', () => {
    const expectedKeys = [
      'cards','idx','showBack','deckName','selected','correct','resetTimer','multiSelected','multiChecked','showAdder','showDecks','showCards','showStats','showSettings','statsPage','statsPerPage','statsPerCard','srsMode','lastCardId','choiceOrder','deckMap','cardsPage','cardsPerPage','cardsFilter','timerEnabled','autoAdvanceEnabled','timerDurationMs','autoAdvanceDelayMs','timerStart','timerRAF','timerHold','timeoutReveal','autoAdvanceTimer','autoAdvanceStart','autoAdvanceRAF','viewStart','logged','deckNameToId'
    ];
    for (const key of expectedKeys) {
      expect(state).toHaveProperty(key);
    }
  });

  it('should initialize mutable fields correctly', () => {
    expect(Array.isArray(state.cards)).toBe(true);
    expect(state.multiSelected instanceof Set).toBe(true);
    expect(typeof state.deckMap).toBe('object');
    expect(typeof state.deckNameToId).toBe('object');
    expect(Array.isArray(state.statsPerCard)).toBe(true);
  });
});
