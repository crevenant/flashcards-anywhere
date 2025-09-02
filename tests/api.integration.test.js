/* eslint-env node, jest */
const request = require('supertest');
const app = require('../src/server');

describe('Flashcards Anywhere API (integration)', () => {
	let createdDeckId;
	let createdCardId;

	it('POST /api/decks should create a new deck', async () => {
		const res = await request(app).post('/api/decks').send({ name: 'Test Deck' });
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('id');
		expect(res.body).toHaveProperty('name', 'Test Deck');
		createdDeckId = res.body.id;
	});

	it('POST /api/cards should create a new card', async () => {
		const res = await request(app)
			.post('/api/cards')
			.send({ deck_id: createdDeckId, front: 'Front', back: 'Back' });
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('id');
		expect(res.body).toHaveProperty('front', 'Front');
		expect(res.body).toHaveProperty('back', 'Back');
		createdCardId = res.body.id;
	});

	it('PUT /api/cards/:id should update a card', async () => {
		const res = await request(app)
			.put(`/api/cards/${createdCardId}`)
			.send({ front: 'Updated Front' });
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('front', 'Updated Front');
	});

	it('GET /api/cards?deck_id=... should filter cards by deck', async () => {
		const res = await request(app).get(`/api/cards?deck_id=${createdDeckId}`);
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.body.cards)).toBe(true);
		expect(res.body.cards.some((card) => card.id === createdCardId)).toBe(true);
	});

	it('POST /api/reviews should accept review log', async () => {
		const res = await request(app)
			.post('/api/reviews')
			.send({ id: createdCardId, result: 'correct', duration_ms: 1000 });
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('ok', true);
	});

	it('POST /api/srs/review should accept SRS review', async () => {
		const res = await request(app)
			.post('/api/srs/review')
			.send({ id: createdCardId, grade: 5 });
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('ok', true);
	});

	it('GET /api/stats should return stats', async () => {
		const res = await request(app).get('/api/stats');
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('cardCount');
		expect(res.body).toHaveProperty('deckCount');
	});

	it('DELETE /api/cards/:id should delete a card', async () => {
		const res = await request(app).delete(`/api/cards/${createdCardId}`);
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('success', true);
	});

	it('DELETE /api/decks/:id should delete a deck', async () => {
		const res = await request(app).delete(`/api/decks/${createdDeckId}`);
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('success', true);
	});
});
