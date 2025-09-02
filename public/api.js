// Minimal API client for frontend
// Detect if running in Electron (file:// protocol)
const isElectron = window.location.protocol === 'file:';
const API_BASE = isElectron ? 'http://localhost:8000' : '';
window.api = {
  async decks() {
    const res = await fetch(`${API_BASE}/api/decks`);
    if (!res.ok) throw new Error('Failed to fetch decks');
    const data = await res.json();
    return data.decks || [];
  },
  async cards(deckName = '') {
    const url = deckName ? `${API_BASE}/api/cards?deck=${encodeURIComponent(deckName)}` : `${API_BASE}/api/cards`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch cards');
    const data = await res.json();
    return data.cards || [];
  },
  async srsDue(deckName = '', limit = 100) {
    const url = `${API_BASE}/api/srs/due?deck=${encodeURIComponent(deckName)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch SRS due cards');
    const data = await res.json();
    return data.cards || [];
  },
  async stats(deckName = '') {
    const url = deckName ? `${API_BASE}/api/stats?deck=${encodeURIComponent(deckName)}` : `${API_BASE}/api/stats`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  },
  async addCard(card) {
    const res = await fetch(`${API_BASE}/api/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!res.ok) throw new Error('Failed to add card');
    return res.json();
  },
  async updateCard(id, patch) {
    const res = await fetch(`${API_BASE}/api/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update card');
    return res.json();
  },
  async deleteCard(id) {
    const res = await fetch(`${API_BASE}/api/cards/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete card');
    return res.json();
  },
  async createDeck(name) {
    const res = await fetch(`${API_BASE}/api/decks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create deck');
    return res.json();
  },
  async deleteDeck(id) {
    const res = await fetch(`${API_BASE}/api/decks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete deck');
    return res.json();
  },
  async renameDeck(id, name) {
    const res = await fetch(`${API_BASE}/api/decks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to rename deck');
    return res.json();
  },
  async srsReview(id, grade) {
    const res = await fetch(`${API_BASE}/api/srs/review/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade }),
    });
    if (!res.ok) throw new Error('Failed to review SRS card');
    return res.json();
  },
  async review(id, result, durationMs) {
    const res = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, result, durationMs }),
    });
    if (!res.ok) throw new Error('Failed to log review');
    return res.json();
  },
};
