/* eslint-env node */
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '../../data/flashcards.db');

async function printSchema() {
	if (!fs.existsSync(dbPath)) {
		console.error('Database file not found:', dbPath);
		process.exit(1);
	}
	const SQL = await initSqlJs();
	const filebuffer = fs.readFileSync(dbPath);
	const db = new SQL.Database(filebuffer);
	const res = db.exec('PRAGMA table_info(cards);');
	if (!res.length) {
		console.error('No schema found for cards table.');
		process.exit(1);
	}
	const rows = res[0].values;
	const cols = res[0].columns;
	console.log('Schema for cards table:');
	rows.forEach((row) => {
		const obj = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
		console.log(`${obj.cid}: ${obj.name} (${obj.type})${obj.pk ? ' [PK]' : ''}`);
	});
	db.close();
}

printSchema();
