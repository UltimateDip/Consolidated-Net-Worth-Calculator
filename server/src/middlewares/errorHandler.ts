import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Global Error Handler Middleware.
 * Catches all errors thrown in the application and returns a consistent JSON response.
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // If it's one of our custom AppErrors, use its specific status code
  if (err instanceof AppError) {
    logger.warn(`[AppError] ${req.method} ${req.path} - ${err.statusCode}: ${err.message}`);
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  // Handle unexpected errors (500)
  logger.error(`[UnhandledError] ${req.method} ${req.path}:`, err);

  return res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
};
