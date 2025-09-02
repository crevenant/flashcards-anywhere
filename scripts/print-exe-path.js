// scripts/print-exe-path.js
const path = require('path');
const fs = require('fs');

const productName = 'Flashcards Anywhere';

const exeDir = path.resolve(__dirname, '..', 'dist', 'win-unpacked');
const exePath = path.join(exeDir, `${productName}.exe`);
const normalizedExePath = path.normalize(exePath);

const displayPath = normalizedExePath.includes(' ') ? `"${normalizedExePath}"` : normalizedExePath;
if (fs.existsSync(normalizedExePath)) {
  console.log(`\nBuilt EXE: ${displayPath}\n`);
} else {
  console.log(`\nEXE not found at: ${displayPath}\n`);
}
