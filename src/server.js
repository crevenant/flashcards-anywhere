/* eslint-env node */
const registerGlobalErrorHandlers = require('./middleware/globalErrorHandlers');
registerGlobalErrorHandlers();
console.log('Starting server.js...');
// Flashcards Anywhere backend server
// Express app serving REST API and static frontend for flashcard management

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const db = require('./db/db');
// Modular API route registration
const registerDeckRoutes = require('./api/decks');
const registerCardRoutes = require('./api/cards');
const registerSrsRoutes = require('./api/srs');
const registerReviewRoutes = require('./api/reviews');
const registerStatsRoutes = require('./api/stats');

// Initialize Express app and configuration
const config = require('./config');
const app = express();
const PORT = config.PORT;


// Middleware: parse JSON request bodies and serve static frontend files
app.use(bodyParser.json());
app.use(express.static(config.PUBLIC_DIR));


// Register modular API routes
registerDeckRoutes(app, db);
registerCardRoutes(app, db);
registerSrsRoutes(app, db);
registerReviewRoutes(app, db);
registerStatsRoutes(app, db);

// Start the server only if run directly (not during tests)
// This allows the app to be imported for testing without starting the server
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

// Export the app for testing and integration
module.exports = app;
