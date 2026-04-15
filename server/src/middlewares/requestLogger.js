const morgan = require('morgan');
const logger = require('../utils/logger');

// Define the format for morgan to use (can be dev, combined, etc.)
const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

// Create a stream object with a 'write' function that will be used by morgan
const stream = {
  write: (message) => logger.info(message.trim()),
};

// Export the middleware
module.exports = morgan(format, { stream });
