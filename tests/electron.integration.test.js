/* eslint-env node, jest */
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

describe('Electron Integration', () => {
	let electronProcess;

		beforeAll((done) => {
			console.log('[TEST] Launching Electron app...');
			electronProcess = spawn(
				process.platform === 'win32' ? 'npx.cmd' : 'npx',
				['electron', '.'],
				{
					cwd: path.join(__dirname, '..'),
					stdio: 'inherit',
					env: { ...process.env, NODE_ENV: 'test' },
					shell: process.platform === 'win32',
				}
			);
			console.log('[TEST] Electron process spawned. Waiting for backend on port 8000...');
			const start = Date.now();
			const tryConnect = () => {
				const client = net.createConnection({ port: 8000 }, () => {
					client.end();
					console.log('[TEST] Backend is up after', ((Date.now()-start)/1000).toFixed(1), 'seconds.');
					done();
				});
				client.on('error', () => {
					if (Date.now() - start > 39000) {
						console.error('[TEST] Backend did not start within 40 seconds.');
					}
					setTimeout(tryConnect, 500);
				});
			};
			tryConnect();
		}, 40000);

		afterAll(() => {
			if (electronProcess && !electronProcess.killed) {
				try {
					electronProcess.kill();
				} catch (e) {}
			}
		});

	test('Electron app starts and backend is available', (done) => {
		// Try connecting to backend
		const client = net.createConnection({ port: 8000 }, () => {
			client.end();
			done();
		});
		client.on('error', (err) => {
			done.fail('Backend server not available: ' + err.message);
		});
	});
});
