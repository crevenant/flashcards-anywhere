// src/config/index.js
// Centralized configuration for Flashcards Anywhere

const path = require('path');

module.exports = {
  PORT: process.env.PORT || 8000,
  PUBLIC_DIR: path.join(__dirname, '../../public'),
  DATA_DIR: path.join(__dirname, '../../data'),
};
