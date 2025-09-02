/* eslint-env node, jest */
// Integration test: frontend API functions <-> backend endpoints
const { test, expect } = require('@playwright/test');
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8000';

// These should match the frontend API functions
async function testDecks() {
	const res = await fetch(`${API_BASE}/api/decks`);
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(Array.isArray(data.decks)).toBe(true);
}

async function testAddDeck() {
	const res = await fetch(`${API_BASE}/api/decks`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: 'Integration Test Deck' }),
	});
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('id');
	return data.id;
}

async function testCards(deckId) {
	const res = await fetch(`${API_BASE}/api/cards?deck_id=${deckId}`);
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(Array.isArray(data.cards)).toBe(true);
}

async function testAddCard(deckId) {
	const res = await fetch(`${API_BASE}/api/cards`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ deck_id: deckId, front: 'Front', back: 'Back' }),
	});
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('id');
	return data.id;
}

async function testUpdateCard(cardId) {
	const res = await fetch(`${API_BASE}/api/cards/${cardId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ front: 'Updated Front' }),
	});
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('front', 'Updated Front');
}

async function testReview(cardId) {
	const res = await fetch(`${API_BASE}/api/reviews`, {
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id: cardId, result: 'correct', duration_ms: 1000 }),
		method: 'POST',
	});
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('ok', true);
}

async function testSrsReview(cardId) {
	const res = await fetch(`${API_BASE}/api/srs/review`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id: cardId, grade: 5 }),
	});
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('ok', true);
}

async function testStats() {
	const res = await fetch(`${API_BASE}/api/stats`);
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('cardCount');
	expect(data).toHaveProperty('deckCount');
}

async function testDeleteCard(cardId) {
	const res = await fetch(`${API_BASE}/api/cards/${cardId}`, { method: 'DELETE' });
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('success', true);
}

async function testDeleteDeck(deckId) {
	const res = await fetch(`${API_BASE}/api/decks/${deckId}`, { method: 'DELETE' });
	expect(res.ok).toBe(true);
	const data = await res.json();
	expect(data).toHaveProperty('success', true);
}

test('Frontend API functions work with backend endpoints', async () => {
	await testDecks();
	const deckId = await testAddDeck();
	await testCards(deckId);
	const cardId = await testAddCard(deckId);
	await testUpdateCard(cardId);
	await testReview(cardId);
	await testSrsReview(cardId);
	await testStats();
	await testDeleteCard(cardId);
	await testDeleteDeck(deckId);
});
