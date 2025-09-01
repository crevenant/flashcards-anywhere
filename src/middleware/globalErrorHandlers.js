// src/middleware/globalErrorHandlers.js
// Global error handlers for debugging silent exits

function registerGlobalErrorHandlers() {
  process.on('uncaughtException', (err) => {
    console.error('[Global Error] Uncaught Exception:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Global Error] Unhandled Rejection:', reason);
    process.exit(1);
  });
}

module.exports = registerGlobalErrorHandlers;
