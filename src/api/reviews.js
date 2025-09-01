// src/api/reviews.js
// Reviews API routes for Flashcards Anywhere
const express = require('express');

/**
 * Registers review routes on the given app instance.
 * @param {express.Application} app
 * @param {sqlite3.Database} db
 */
function registerReviewRoutes(app, db) {
  // Log a review (dummy endpoint, does not persist data)
  app.post('/api/reviews', (req, res) => {
    // Accepts: { id, result, duration_ms }
    // For now, just return ok (extend to log to DB if desired)
    res.status(200).json({ ok: true });
  });
}

module.exports = registerReviewRoutes;
