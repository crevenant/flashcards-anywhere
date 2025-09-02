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
    if (deck) {
      sql += ' WHERE deck_id = ?';
    }
    try {
      const stmt = db.prepare(sql);
      const rows = deck ? stmt.all(deck) : stmt.all();
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a new card
  app.post('/api/cards', (req, res) => {
    const { deck_id, front, back } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)');
      const info = stmt.run(deck_id, front, back);
      res.json({ id: info.lastInsertRowid, deck_id, front, back });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a card by id
  app.delete('/api/cards/:id', (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM cards WHERE id = ?');
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update a card (patch fields)
  app.put('/api/cards/:id', (req, res) => {
    const id = req.params.id;
    const patch = req.body;
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
        try {
          const row = db.prepare('SELECT id FROM decks WHERE name = ?').get(patch.deck);
          if (!row) return res.status(400).json({ error: 'Deck not found' });
          fields.push('deck_id = ?');
          values.push(row.id);
        } catch (err) {
          return res.status(400).json({ error: 'Deck not found' });
        }
      } else {
        fields.push('deck_id = ?');
        values.push(patch.deck);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(id);
    try {
      db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
      if (!card) return res.status(500).json({ error: 'Card not found after update' });
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = registerCardRoutes;
