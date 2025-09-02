// db.js - Pure JS SQLite (sql.js) wrapper for frontend (renderer)
// Loads sql.js via CDN, loads flashcards.db, exposes query/update helpers

// Usage:
// await window.dbReady; // resolves when DB is loaded
// window.db.query('SELECT * FROM cards')
// window.db.exec('INSERT ...')

(function () {
  let SQL = null;
  let db = null;
  let dbPath = 'data/flashcards.db';
  let dbLoaded = false;
  let dbReadyResolve;
  window.dbReady = new Promise((resolve) => { dbReadyResolve = resolve; });

  async function loadSqlJs() {
    if (window.initSqlJs) return window.initSqlJs;
    await new Promise((r) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js';
      s.onload = r;
      document.head.appendChild(s);
    });
    return window.initSqlJs;
  }

  async function loadDbFile() {
    // Try to load from filesystem (Electron), else fetch
    if (window.require && window.require('fs')) {
      // Electron renderer with Node integration
      const fs = window.require('fs');
      const path = window.require('path');
      const appPath = window.require('electron').remote.app.getAppPath();
      const dbFile = path.join(appPath, 'data', 'flashcards.db');
      return fs.readFileSync(dbFile);
    } else {
      // Browser: fetch from server
      const res = await fetch(dbPath);
      if (!res.ok) throw new Error('Failed to fetch DB file');
      return await res.arrayBuffer();
    }
  }

  async function init() {
    const initSqlJs = await loadSqlJs();
    SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`
    });
    const buf = await loadDbFile();
    db = new SQL.Database(new Uint8Array(buf));
    dbLoaded = true;
    dbReadyResolve();
  }

  window.db = {
    query(sql, params) {
      if (!dbLoaded) throw new Error('DB not loaded');
      const stmt = db.prepare(sql);
      if (params) stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        // Normalize all fields: decode Uint8Array, join arrays, stringify objects
        for (const k in row) {
          const v = row[k];
          if (v instanceof Uint8Array) {
            // Decode as UTF-8 string
            row[k] = new TextDecoder('utf-8').decode(v);
          } else if (Array.isArray(v)) {
            row[k] = v.join('');
          } else if (typeof v === 'object' && v !== null) {
            row[k] = JSON.stringify(v);
          }
        }
        rows.push(row);
      }
      stmt.free();
      return rows;
    },
    exec(sql, params) {
      if (!dbLoaded) throw new Error('DB not loaded');
      db.run(sql, params);
    },
    export() {
      if (!dbLoaded) throw new Error('DB not loaded');
      return db.export();
    },
    saveToFile(filename = 'flashcards.db') {
      if (!dbLoaded) throw new Error('DB not loaded');
      const blob = new Blob([db.export()], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, 100);
    }
  };

  init();
})();
