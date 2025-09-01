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
      db.get('SELECT COUNT(*) as cardCount FROM cards WHERE deck_id = ?', [deck], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deck, cardCount: row.cardCount });
      });
    } else {
      db.get('SELECT COUNT(*) as cardCount FROM cards', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT COUNT(*) as deckCount FROM decks', [], (err2, row2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ cardCount: row.cardCount, deckCount: row2.deckCount });
        });
      });
    }
  });
}

module.exports = registerStatsRoutes;
