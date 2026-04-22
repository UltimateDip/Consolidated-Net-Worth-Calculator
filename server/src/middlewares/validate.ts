import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Generic validation middleware that parses request data against a Zod schema.
 * Rejects bad data with a 400 status before it ever reaches the controllers.
 */
export const validateSchema = (schema: z.ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validates body, query, and params against the provided schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.issues.map((issue: any) => ({
            path: issue.path,
            message: issue.message
          }))
        });
      }
      next(err);
    }
  };
};
