const errorHandler = (err, req, res, next) => {
  console.error('[Global Error]', err.stack || err.message);
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
};

module.exports = errorHandler;
