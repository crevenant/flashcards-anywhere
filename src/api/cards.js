// src/api/cards.js
// Cards API routes for Flashcards Anywhere
const express = require('express');
const router = express.Router();

/**
 * Registers card routes on the given app instance.
 * @param {express.Application} app
 * @param {sqlite3.Database} db
 */
function registerCardRoutes(app, db) {
  // Get all cards (optionally filter by deck)
  app.get('/api/cards', (req, res) => {
    const deck = req.query.deck || req.query.deck_id;
    let sql = 'SELECT * FROM cards';
    let params = [];
    if (deck) {
      sql += ' WHERE deck_id = ?';
      params.push(deck);
    }
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

  // Add a new card
  app.post('/api/cards', (req, res) => {
    const { deck_id, front, back } = req.body;
    db.run(
      'INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)',
      [deck_id, front, back],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, deck_id, front, back });
      }
    );
  });

  // Delete a card by id
  app.delete('/api/cards/:id', (req, res) => {
    db.run('DELETE FROM cards WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });

  // Update a card (patch fields)
  app.put('/api/cards/:id', (req, res) => {
    const id = req.params.id;
    const patch = req.body;
    // Build dynamic SQL for patching fields
    const fields = [];
    const values = [];
    if (patch.front !== undefined) {
      fields.push('front = ?');
      values.push(patch.front);
    }
    if (patch.back !== undefined) {
      fields.push('back = ?');
      values.push(patch.back);
    }
    if (patch.choices !== undefined) {
      fields.push('choices = ?');
      values.push(JSON.stringify(patch.choices));
    }
    if (patch.multi !== undefined) {
      fields.push('multi = ?');
      values.push(patch.multi ? 1 : 0);
    }
    if (patch.choices_as_cards !== undefined) {
      fields.push('choices_as_cards = ?');
      values.push(patch.choices_as_cards ? 1 : 0);
    }
    if (patch.answer !== undefined) {
      fields.push('answer = ?');
      values.push(patch.answer);
    }
    if (patch.answers !== undefined) {
      fields.push('answers = ?');
      values.push(JSON.stringify(patch.answers));
    }
    if (patch.deck !== undefined) {
      // Accept deck as name or id for flexibility
      if (isNaN(patch.deck)) {
        // Lookup deck id by name
        db.get('SELECT id FROM decks WHERE name = ?', [patch.deck], (err, row) => {
          if (err || !row) return res.status(400).json({ error: 'Deck not found' });
          fields.push('deck_id = ?');
          values.push(row.id);
          finishUpdate();
        });
        return;
      } else {
        fields.push('deck_id = ?');
        values.push(patch.deck);
      }
    }
    function finishUpdate() {
      if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });
      values.push(id);
      db.run(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT * FROM cards WHERE id = ?', [id], (err, card) => {
          if (err || !card)
            return res.status(500).json({ error: 'Card not found after update' });
          // Parse choices/answers if present
          if (typeof card.choices === 'string') {
            try {
              card.choices = JSON.parse(card.choices);
            } catch {
              card.choices = null;
            }
          }
          if (typeof card.answers === 'string') {
            try {
              card.answers = JSON.parse(card.answers);
            } catch {
              card.answers = null;
            }
          }
          res.json(card);
        });
      });
    }
    if (patch.deck === undefined) finishUpdate();
  });
}

module.exports = registerCardRoutes;
