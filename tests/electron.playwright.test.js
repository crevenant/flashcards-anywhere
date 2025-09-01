/* eslint-env node, jest */
// (removed stray describe)
// Playwright Electron test: launches the app and checks for window and backend
const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const net = require('net');

let app;

test.describe('Electron App (Playwright)', () => {
	test.beforeAll(async () => {
		console.log('Launching Electron app...');
		app = await electron.launch({ args: ['.'], env: { ...process.env, DEBUG: 'true' } });
		console.log('Electron app launched. Waiting for backend...');
		// Wait for backend to be up
		await new Promise((resolve) => {
			const tryConnect = () => {
				const client = net.createConnection({ port: 8000 }, () => {
					client.end();
					console.log('Backend server is up.');
					resolve();
				});
				client.on('error', () => setTimeout(tryConnect, 500));
			};
			tryConnect();
		});
	}, 60000); // 60s timeout

	test.afterAll(async () => {
		if (app) {
			console.log('Closing Electron app...');
			await app.close();
		}
	});

	test('main window is visible', async () => {
		const window = await app.firstWindow();
		expect(await window.isVisible()).toBe(true);
		const title = await window.title();
		expect(title.toLowerCase()).toContain('flashcards');
	});

	test('backend server is available', async () => {
		await new Promise((resolve, reject) => {
			const client = net.createConnection({ port: 8000 }, () => {
				client.end();
				resolve();
			});
			client.on('error', (err) => {
				reject(new Error('Backend server not available: ' + err.message));
			});
		});
	});
});
