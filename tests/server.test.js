/* eslint-env node, jest */
const request = require('supertest');
const express = require('express');
let app;

describe('Flashcards Anywhere API', () => {
	beforeAll(() => {
		// Import the actual app after DB and middleware are set up
		app = require('../server');
	});

	it('GET /api/decks should return decks array', async () => {
		const res = await request(app).get('/api/decks');
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('decks');
		expect(Array.isArray(res.body.decks)).toBe(true);
	});

	it('GET /api/cards should return cards array', async () => {
		const res = await request(app).get('/api/cards');
		expect(res.statusCode).toBe(200);
		expect(res.body).toHaveProperty('cards');
		expect(Array.isArray(res.body.cards)).toBe(true);
	});
});
