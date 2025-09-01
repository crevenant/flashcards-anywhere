// src/db/db.js
// SQLite database connection for Flashcards Anywhere
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/flashcards.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('[Backend Startup Error] Database file not found:', DB_PATH);
  process.exit(1);
}

let db;
try {
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('[Backend Startup Error] Failed to connect to database:', err.message);
      process.exit(1);
    }
  });
} catch (e) {
  console.error('[Backend Startup Error] Exception during DB connect:', e);
  process.exit(1);
}

module.exports = db;
