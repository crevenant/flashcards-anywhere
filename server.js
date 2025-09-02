/* eslint-env node */

// Global error handlers for debugging server crashes
process.on('uncaughtException', (err) => {
	console.error('[Uncaught Exception]', err);
	process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
	console.error('[Unhandled Rejection]', reason);
	process.exit(1);
});
const registerGlobalErrorHandlers = require('./src/middleware/globalErrorHandlers');
registerGlobalErrorHandlers();
console.log('Starting server.js...');
// Flashcards Anywhere backend server
// Express app serving REST API and static frontend for flashcard management

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { loadDatabase } = require('./src/db/db');
// Modular API route registration
const registerDeckRoutes = require('./src/api/decks');
const registerCardRoutes = require('./src/api/cards');
const registerSrsRoutes = require('./src/api/srs');
const registerReviewRoutes = require('./src/api/reviews');
const registerStatsRoutes = require('./src/api/stats');

// Initialize Express app and configuration
const config = require('./src/config');
const app = express();
const PORT = config.PORT;

// Middleware: parse JSON request bodies and serve static frontend files
app.use(bodyParser.json());
app.use(express.static(config.PUBLIC_DIR));
// Serve frontend utilities (for browser import)
app.use('/src/frontend/utils', express.static(path.join(__dirname, 'src', 'frontend', 'utils')));

let appReady = (async () => {
	const db = await loadDatabase();
	registerDeckRoutes(app, db);
	registerCardRoutes(app, db);
	registerSrsRoutes(app, db);
	registerReviewRoutes(app, db);
	registerStatsRoutes(app, db);

	// Start the server only if run directly (not during tests)
	if (require.main === module) {
		console.log('Reached listen block');
		app.listen(PORT, (err) => {
			if (err) {
				console.error('[Backend Startup Error] Failed to start server:', err);
				process.exit(1);
			}
			console.log(`Flashcards Anywhere Node server running at http://localhost:${PORT}`);
		});
	}
	return app;
})();

// Export a promise that resolves to the app for testing and integration
module.exports = appReady;
