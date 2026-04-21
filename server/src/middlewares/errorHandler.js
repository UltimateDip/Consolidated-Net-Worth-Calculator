const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('[ErrorHandler] %s %s - %s', req.method, req.url, err.message, {
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.body, // Safe for this app as no passwords are saved
    stack: err.stack
  });
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
};

module.exports = errorHandler;
