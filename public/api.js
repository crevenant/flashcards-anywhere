// Minimal API client for frontend
window.api = {
  async decks() {
    const res = await fetch('/api/decks');
    if (!res.ok) throw new Error('Failed to fetch decks');
    const data = await res.json();
    return data.decks || [];
  },
  async cards(deckName = '') {
    const url = deckName ? `/api/cards?deck=${encodeURIComponent(deckName)}` : '/api/cards';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch cards');
    const data = await res.json();
    return data.cards || [];
  },
  async srsDue(deckName = '', limit = 100) {
    const url = `/api/srs/due?deck=${encodeURIComponent(deckName)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch SRS due cards');
    const data = await res.json();
    return data.cards || [];
  },
  async stats(deckName = '') {
    const url = deckName ? `/api/stats?deck=${encodeURIComponent(deckName)}` : '/api/stats';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  },
  async addCard(card) {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!res.ok) throw new Error('Failed to add card');
    return res.json();
  },
  async updateCard(id, patch) {
    const res = await fetch(`/api/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update card');
    return res.json();
  },
  async deleteCard(id) {
    const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete card');
    return res.json();
  },
  async createDeck(name) {
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create deck');
    return res.json();
  },
  async deleteDeck(id) {
    const res = await fetch(`/api/decks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete deck');
    return res.json();
  },
  async renameDeck(id, name) {
    const res = await fetch(`/api/decks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to rename deck');
    return res.json();
  },
  async srsReview(id, grade) {
    const res = await fetch(`/api/srs/review/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade }),
    });
    if (!res.ok) throw new Error('Failed to review SRS card');
    return res.json();
  },
  async review(id, result, durationMs) {
    const res = await fetch(`/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, result, durationMs }),
    });
    if (!res.ok) throw new Error('Failed to log review');
    return res.json();
  },
};
