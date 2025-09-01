// src/api/srs.js
// SRS API routes for Flashcards Anywhere
const express = require('express');

/**
 * Registers SRS routes on the given app instance.
 * @param {express.Application} app
 * @param {sqlite3.Database} db
 */
function registerSrsRoutes(app, db) {
  // Get SRS due cards (optionally filter by deck, limit)
  app.get('/api/srs/due', (req, res) => {
    const deck = req.query.deck || req.query.deck_id;
    const limit = parseInt(req.query.limit) || 50;
    let sql = 'SELECT * FROM cards';
    let params = [];
    if (deck) {
      sql += ' WHERE deck_id = ?';
      params.push(deck);
    }
    sql += ' LIMIT ?';
    params.push(limit);
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      // Parse choices as JSON if present and string
      rows.forEach((card) => {
        if (typeof card.choices === 'string') {
          try {
            card.choices = JSON.parse(card.choices);
          } catch (e) {
            card.choices = null;
          }
        }
      });
      res.json({ cards: rows });
    });
  });

  // SRS review (dummy endpoint, does not persist data)
  app.post('/api/srs/review', (req, res) => {
    // Accepts: { id, grade }
    // For now, just return ok (extend to update SRS data if desired)
    res.status(200).json({ ok: true });
  });
}

module.exports = registerSrsRoutes;
