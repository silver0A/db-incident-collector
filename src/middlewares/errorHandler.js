/**
 * Error Handler Middleware - 중앙 집중 에러 처리
 */

const logger = require('../utils/logger');

function errorHandler(err, _req, res, _next) {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ status: 'error', message: 'Internal server error' });
}

module.exports = errorHandler;
