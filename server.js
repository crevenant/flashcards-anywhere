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


// API: Update a card
app.put('/api/cards/:id', (req, res) => {
  const id = req.params.id;
  const patch = req.body;
  // Build dynamic SQL for patching fields
  const fields = [];
  const values = [];
  if (patch.front !== undefined) { fields.push('front = ?'); values.push(patch.front); }
  if (patch.back !== undefined) { fields.push('back = ?'); values.push(patch.back); }
  if (patch.choices !== undefined) { fields.push('choices = ?'); values.push(JSON.stringify(patch.choices)); }
  if (patch.multi !== undefined) { fields.push('multi = ?'); values.push(patch.multi ? 1 : 0); }
  if (patch.choices_as_cards !== undefined) { fields.push('choices_as_cards = ?'); values.push(patch.choices_as_cards ? 1 : 0); }
  if (patch.answer !== undefined) { fields.push('answer = ?'); values.push(patch.answer); }
  if (patch.answers !== undefined) { fields.push('answers = ?'); values.push(JSON.stringify(patch.answers)); }
  if (patch.deck !== undefined) {
    // Accept deck as name or id
    if (isNaN(patch.deck)) {
      // Lookup deck id by name
      db.get('SELECT id FROM decks WHERE name = ?', [patch.deck], (err, row) => {
        if (err || !row) return res.status(400).json({ error: 'Deck not found' });
        fields.push('deck_id = ?'); values.push(row.id);
        finishUpdate();
      });
      return;
    } else {
      fields.push('deck_id = ?'); values.push(patch.deck);
    }
  }
  function finishUpdate() {
    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(id);
    db.run(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM cards WHERE id = ?', [id], (err, card) => {
        if (err || !card) return res.status(500).json({ error: 'Card not found after update' });
        // Parse choices/answers if present
        if (typeof card.choices === 'string') {
          try { card.choices = JSON.parse(card.choices); } catch { card.choices = null; }
        }
        if (typeof card.answers === 'string') {
          try { card.answers = JSON.parse(card.answers); } catch { card.answers = null; }
        }
        res.json(card);
      });
    });
  }
  if (patch.deck === undefined) finishUpdate();
});

// API: Log a review (dummy, just accept and return ok)
app.post('/api/reviews', (req, res) => {
  // Accepts: { id, result, duration_ms }
  // For now, just return ok (extend to log to DB if desired)
  res.status(200).json({ ok: true });
});

// API: SRS review (dummy, just accept and return ok)
app.post('/api/srs/review', (req, res) => {
  // Accepts: { id, grade }
  // For now, just return ok (extend to update SRS data if desired)
  res.status(200).json({ ok: true });
});

// API: Stats (dummy, returns card/deck counts)
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

app.listen(PORT, () => {
  console.log(`Flashcards Anywhere Node server running at http://localhost:${PORT}`);
});
