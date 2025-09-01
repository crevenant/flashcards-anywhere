// Test for configuration errors: invalid npm versions and lockfile sync
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

describe('Project configuration', () => {
  test('All package.json dependencies exist on npm', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [dep, version] of Object.entries(allDeps)) {
      // Use npm view to check if the version exists
      let exists = true;
      try {
        execSync(`npm view ${dep}@${version.replace('^','').replace('~','')} version`, { stdio: 'ignore' });
      } catch (e) {
        exists = false;
      }
      expect(exists).toBe(true);
    }
  });

  test('package-lock.json is in sync with package.json', () => {
    // npm ci --dry-run will fail if out of sync
    let inSync = true;
    try {
      execSync('npm ci --dry-run', { stdio: 'ignore' });
    } catch (e) {
      inSync = false;
    }
    expect(inSync).toBe(true);
  });
});
