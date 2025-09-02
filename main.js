/* eslint-env node */
// Electron main process entry point
// Responsible for creating the main application window and handling app lifecycle events


const { app, BrowserWindow } = require('electron');
const path = require('path');

// Ensure only one instance of the app is running
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
	process.exit(0);
}

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

app.whenReady().then(() => {
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


