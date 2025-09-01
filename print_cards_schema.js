const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'flashcards.db');
const db = new sqlite3.Database(dbPath);

db.all('PRAGMA table_info(cards);', [], (err, rows) => {
	if (err) {
		console.error('Error:', err.message);
		process.exit(1);
	}
	console.log('Schema for cards table:');
	rows.forEach((row) => {
		console.log(`${row.cid}: ${row.name} (${row.type})${row.pk ? ' [PK]' : ''}`);
	});
	db.close();
});
