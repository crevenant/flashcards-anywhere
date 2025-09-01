/* eslint-env node */
// Electron main process entry point
// Responsible for creating the main application window and handling app lifecycle events

// Electron main process entry point
// Responsible for creating the main application window and handling app lifecycle events
const { app, BrowserWindow } = require('electron');
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

// Called when Electron has finished initialization

// Start backend server as a child process
function startBackend() {
	// Use Node to run server.js
	const backend = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
		stdio: 'ignore', // or ['ignore', 'pipe', 'pipe'] to capture output
		detached: true,
	});
	backend.unref();
	return backend;
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
	backendProcess = startBackend();
	try {
		await waitForBackend(8000, 20000);
	} catch (e) {
		console.error(e);
	}
	createWindow();
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
