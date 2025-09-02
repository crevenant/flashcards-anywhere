// Minimal API client for frontend
// Detect if running in Electron (file:// protocol)
const isElectron = window.location.protocol === 'file:';
const API_BASE = isElectron ? 'http://localhost:8000' : '';
// Pure JS SQLite API using window.db (sql.js)
window.api = {
  async decks() {
    await window.dbReady;
    return window.db.query('SELECT * FROM decks');
  },
  async cards(deckName = '') {
    await window.dbReady;
    if (deckName) {
      return window.db.query('SELECT * FROM cards WHERE deck_id = ?', [deckName]);
    } else {
      return window.db.query('SELECT * FROM cards');
    }
  },
  async srsDue(deckName = '', limit = 100) {
    await window.dbReady;
    let sql = 'SELECT * FROM cards WHERE due <= date("now")';
    const params = [];
    if (deckName) {
      sql += ' AND deck_id = ?';
      params.push(deckName);
    }
    sql += ' LIMIT ?';
    params.push(limit);
    return window.db.query(sql, params);
  },
  async stats(deckName = '') {
    await window.dbReady;
    if (deckName) {
      const cards = window.db.query('SELECT COUNT(*) as cardCount FROM cards WHERE deck_id = ?', [deckName]);
      return { deck: deckName, cardCount: cards[0]?.cardCount || 0 };
    } else {
      const cardCount = window.db.query('SELECT COUNT(*) as cardCount FROM cards')[0]?.cardCount || 0;
      const deckCount = window.db.query('SELECT COUNT(*) as deckCount FROM decks')[0]?.deckCount || 0;
      return { cardCount, deckCount };
    }
  },
  async addCard(card) {
    await window.dbReady;
    // card: { front, back, deck_id, ... }
    const keys = Object.keys(card);
    const vals = keys.map(k => card[k]);
    const placeholders = keys.map(() => '?').join(',');
    window.db.exec(`INSERT INTO cards (${keys.join(',')}) VALUES (${placeholders})`, vals);
    return { success: true };
  },
  async updateCard(id, patch) {
    await window.dbReady;
    const keys = Object.keys(patch);
    const vals = keys.map(k => patch[k]);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    vals.push(id);
    window.db.exec(`UPDATE cards SET ${setClause} WHERE id = ?`, vals);
    return { success: true };
  },
  async deleteCard(id) {
    await window.dbReady;
    window.db.exec('DELETE FROM cards WHERE id = ?', [id]);
    return { success: true };
  },
  async createDeck(name) {
    await window.dbReady;
    window.db.exec('INSERT INTO decks (name) VALUES (?)', [name]);
    return { success: true };
  },
  async deleteDeck(id) {
    await window.dbReady;
    window.db.exec('DELETE FROM decks WHERE id = ?', [id]);
    return { success: true };
  },
  async renameDeck(id, name) {
    await window.dbReady;
    window.db.exec('UPDATE decks SET name = ? WHERE id = ?', [name, id]);
    return { success: true };
  },
  async srsReview(id, grade) {
    await window.dbReady;
    // Example: update due date or stats based on grade
    // This is a stub; real SRS logic should be implemented as needed
    window.db.exec('UPDATE cards SET last_review = date("now") WHERE id = ?', [id]);
    return { success: true };
  },
  async review(id, result, durationMs) {
    await window.dbReady;
    // Example: log review result (not implemented in schema)
    return { success: true };
  },
};
