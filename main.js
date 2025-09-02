/* eslint-env node */
// Electron main process entry point
// Responsible for creating the main application window and handling app lifecycle events

const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const LOG_PATH = require('path').join(__dirname, 'logs', 'electron.log');
function log(msg) {
	const line = `[${new Date().toISOString()}] ${msg}\n`;
	try { fs.appendFileSync(LOG_PATH, line); } catch (_) {}
	console.log(msg);
}
// Ensure only one instance of the app is running
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
	process.exit(0);
}
const path = require('path');
const { spawn } = require('child_process');

let backendProcess = null;

// Creates the main application window
// - Sets window size and icon
// - Disables Node integration for security
// - Enables context isolation for security
function createWindow() {
	const win = new BrowserWindow({
		width: 1200,
		height: 750,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
		icon: path.join(__dirname, 'public', 'favicon.svg'),
	});

	win.loadFile(path.join(__dirname, 'public', 'index.html'));
}

// Start backend server as a child process
function startBackend() {
	// Prevent infinite Electron spawn: only start backend if not running under Electron
	const isElectron = !!process.versions.electron;
	const execPath = process.execPath.toLowerCase();
	let nodeExec = process.execPath; // electron binary
	const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };

	let serverPath;
	const isPackaged = app.isPackaged || (process.mainModule && /\.asar[\\\/]main\.js$/.test(process.mainModule.filename));
	if (isPackaged) {
		serverPath = path.join(process.resourcesPath, 'app.asar', 'server.js');
		log(`[Electron] Packaged backend path: ${serverPath}`);
	} else {
		serverPath = path.join(__dirname, 'server.js');
		log(`[Electron] Dev backend path: ${serverPath}`);
	}

	try {
		log(`[Electron] Spawning backend: ${nodeExec} ${serverPath}`);
		const backend = spawn(nodeExec, [serverPath], {
			stdio: 'ignore',
			detached: true,
			env,
		});
		backend.on('error', (err) => {
			log(`[Electron] Failed to spawn backend: ${err}`);
		});
		backend.unref();
		return backend;
	} catch (e) {
		log(`[Electron] Exception during backend spawn: ${e}`);
		return null;
	}
}

// Wait for backend server to be available
function waitForBackend(port = 8000, timeout = 20000) {
	const net = require('net');
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const tryConnect = () => {
			const client = net.createConnection({ port }, () => {
				client.end();
				resolve();
			});
			client.on('error', () => {
				if (Date.now() - start > timeout) {
					reject(new Error('Backend server did not start in time'));
				} else {
					setTimeout(tryConnect, 300);
				}
			});
		};
		tryConnect();
	});
}

app.whenReady().then(async () => {
	log('[Electron] App ready, starting backend...');
	backendProcess = startBackend();
	let backendOk = false;
	try {
		await waitForBackend(8000, 20000);
		log('[Electron] Backend is up, creating window.');
		backendOk = true;
	} catch (e) {
		log(`[Electron] Backend failed to start: ${e}`);
		dialog.showErrorBox('Backend Startup Error',
			'The backend server failed to start. The app cannot function without it.\n\nCheck logs/electron.log for details.');
	}
	createWindow();
	if (!backendOk) {
		// Optionally, close the app after showing the error
		setTimeout(() => app.quit(), 10000);
	}
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// On macOS, re-create a window when the dock icon is clicked and there are no open windows
app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// Ensure backend server is killed when Electron quits
app.on('quit', () => {
	if (backendProcess && !backendProcess.killed) {
		try {
			process.kill(-backendProcess.pid);
		} catch (e) {
			// Already exited or failed to kill
		}
	}
});
