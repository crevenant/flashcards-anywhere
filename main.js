
// Electron main process entry point
// Responsible for creating the main application window and handling app lifecycle events
const { app, BrowserWindow } = require('electron');
const path = require('path');


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
app.whenReady().then(createWindow);


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
