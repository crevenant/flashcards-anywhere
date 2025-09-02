// src/db/db.js
// SQLite database connection for Flashcards Anywhere using sql.js
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../../data/flashcards.db');
let db;

async function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('[Backend Startup Error] Database file not found:', DB_PATH);
    process.exit(1);
  }
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync(DB_PATH);
  db = new SQL.Database(filebuffer);
  return db;
}

module.exports = { loadDatabase };
