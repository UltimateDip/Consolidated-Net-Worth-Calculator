/**
 * Base class for all application-specific errors.
 * Includes a statusCode that the global error handler uses.
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Indicates this is a known/handled error

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 409 Conflict - Used when a ticker or asset already exists.
 */
export class AssetCollisionError extends AppError {
  constructor(message: string = 'Asset collision detected') {
    super(message, 409);
  }
}

/**
 * 400 Bad Request - Used for missing or invalid parameters.
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
  }
}

/**
 * 404 Not Found - Used when a resource (e.g. asset ID) doesn't exist.
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * 401 Unauthorized - Used for authentication failures.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401);
  }
}
