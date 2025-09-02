// src/api/stats.js
// Stats API routes for Flashcards Anywhere
const express = require('express');

/**
 * Registers stats routes on the given app instance.
 * @param {express.Application} app
 * @param {sqlite3.Database} db
 */
function registerStatsRoutes(app, db) {
  // Stats (dummy endpoint, returns card/deck counts)
  app.get('/api/stats', (req, res) => {
    const deck = req.query.deck;
    if (deck) {
      try {
        const row = db.prepare('SELECT COUNT(*) as cardCount FROM cards WHERE deck_id = ?').get(deck);
        res.json({ deck, cardCount: row.cardCount });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    } else {
      try {
        const row = db.prepare('SELECT COUNT(*) as cardCount FROM cards').get();
        const row2 = db.prepare('SELECT COUNT(*) as deckCount FROM decks').get();
        res.json({ cardCount: row.cardCount, deckCount: row2.deckCount });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  });
}

module.exports = registerStatsRoutes;
