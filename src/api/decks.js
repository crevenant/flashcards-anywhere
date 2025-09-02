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
    try {
      const rows = db.prepare('SELECT * FROM decks').all();
      res.json({ decks: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a new deck
  app.post('/api/decks', (req, res) => {
    const { name } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO decks (name) VALUES (?)');
      const info = stmt.run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update a deck's name
  app.put('/api/decks/:id', (req, res) => {
    const { name } = req.body;
    try {
      db.prepare('UPDATE decks SET name = ? WHERE id = ?').run(name, req.params.id);
      res.json({ id: req.params.id, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a deck by id
  app.delete('/api/decks/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM decks WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = registerDeckRoutes;
