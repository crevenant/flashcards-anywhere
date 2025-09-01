#!/usr/bin/env node
// Usage: node release.js <new_version>
// Example: node release.js 1.0.4

const fs = require('fs');
const { execSync } = require('child_process');

const pkgPath = './package.json';
const newVersion = process.argv[2];
if (!newVersion) {
	console.error('Usage: node release.js <new_version>');
	process.exit(1);
}

// Read and update package.json version
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Updated package.json version to ${newVersion}`);

// Commit the version bump
execSync(`git add package.json`, { stdio: 'inherit' });
execSync(`git commit -m "chore: bump version to v${newVersion}"`, { stdio: 'inherit' });

// Tag and push
execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
execSync('git push', { stdio: 'inherit' });
execSync('git push --tags', { stdio: 'inherit' });

console.log(`Release v${newVersion} pushed!`);
