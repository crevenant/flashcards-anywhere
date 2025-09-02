// src/db/db.js
// SQLite database connection for Flashcards Anywhere using sql.js
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

function resolveDbPath() {
  // In packaged Electron, resources path contains extraResources 'data' folder
  try {
    const electron = require('electron');
    const isPackaged = !!(electron.app && electron.app.isPackaged);
    if (isPackaged && process.resourcesPath) {
      return path.join(process.resourcesPath, 'data', 'flashcards.db');
    }
  } catch (_) {
    // not in electron main process
  }
  return path.join(__dirname, '../../data/flashcards.db');
}

const DB_PATH = resolveDbPath();
let db;

async function loadDatabase() {
  try {
    console.log('[DB] Using DB_PATH:', DB_PATH);
    if (!fs.existsSync(DB_PATH)) {
      console.error('[Backend Startup Error] Database file not found:', DB_PATH);
      process.exit(1);
    }
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
    return db;
  } catch (e) {
    console.error('[DB] loadDatabase error:', e);
    throw e;
  }
}

function getDbPath() {
  return DB_PATH;
}
module.exports = { loadDatabase, getDbPath };
