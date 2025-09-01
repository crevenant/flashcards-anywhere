// src/api/decks.js
// Decks API routes for Flashcards Anywhere
const express = require('express');
const router = express.Router();

/**
 * Registers deck routes on the given app instance.
 * @param {express.Application} app
 * @param {sqlite3.Database} db
 */
function registerDeckRoutes(app, db) {
  // Get all decks
  app.get('/api/decks', (req, res) => {
    db.all('SELECT * FROM decks', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ decks: rows });
    });
  });

  // Add a new deck
  app.post('/api/decks', (req, res) => {
    const { name } = req.body;
    db.run('INSERT INTO decks (name) VALUES (?)', [name], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name });
    });
  });

  // Update a deck's name
  app.put('/api/decks/:id', (req, res) => {
    const { name } = req.body;
    db.run('UPDATE decks SET name = ? WHERE id = ?', [name, req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: req.params.id, name });
    });
  });

  // Delete a deck by id
  app.delete('/api/decks/:id', (req, res) => {
    db.run('DELETE FROM decks WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
}

module.exports = registerDeckRoutes;
