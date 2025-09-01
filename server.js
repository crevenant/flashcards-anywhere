const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;
const DB_PATH = path.join(__dirname, 'data', 'flashcards.db');

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
  throw new Error('Database file not found: ' + DB_PATH);
}

const db = new sqlite3.Database(DB_PATH);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all decks
app.get('/api/decks', (req, res) => {
  db.all('SELECT * FROM decks', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ decks: rows });
  });
});

// API: Get all cards (optionally by deck_id)
app.get('/api/cards', (req, res) => {
  const deck = req.query.deck;
  let sql = 'SELECT * FROM cards';
  let params = [];
  if (deck) {
    sql += ' WHERE deck_id = ?';
    params.push(deck);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Parse choices as JSON if present and string
    rows.forEach(card => {
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

// API: Add a new deck
app.post('/api/decks', (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO decks (name) VALUES (?)', [name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name });
  });
});

// API: Add a new card
app.post('/api/cards', (req, res) => {
  const { deck_id, front, back } = req.body;
  db.run('INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)', [deck_id, front, back], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, deck_id, front, back });
  });
});

// API: Update a deck
app.put('/api/decks/:id', (req, res) => {
  const { name } = req.body;
  db.run('UPDATE decks SET name = ? WHERE id = ?', [name, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: req.params.id, name });
  });
});

// API: Delete a deck
app.delete('/api/decks/:id', (req, res) => {
  db.run('DELETE FROM decks WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// API: Delete a card
app.delete('/api/cards/:id', (req, res) => {
  db.run('DELETE FROM cards WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// API: SRS due cards (simple version)
app.get('/api/srs/due', (req, res) => {
  const deck = req.query.deck;
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
    rows.forEach(card => {
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

app.listen(PORT, () => {
  console.log(`Flashcards Anywhere Node server running at http://localhost:${PORT}`);
});
