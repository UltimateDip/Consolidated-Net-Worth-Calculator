import { z } from 'zod';

/**
 * Schema for adding or updating an asset holding.
 * Enforces strict numeric constraints and enum types.
 */
export const addHoldingSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    ticker: z.string().nullable().optional(),
    type: z.enum(['EQUITY', 'MF', 'GOLD', 'CASH', 'CRYPTO']),
    units: z.number().gt(0, 'Units must be greater than 0'),
    price: z.number().nonnegative('Price cannot be negative').optional(),
    currency: z.string().length(3, 'Currency must be a 3-letter code').default('INR')
  })
});

/**
 * Schema for updating application settings.
 */
export const saveSettingsSchema = z.object({
  body: z.object({
    key: z.string().min(1, 'Setting key is required'),
    value: z.any()
  })
});

// Inferred types for use in controllers/services
export type AddHoldingInput = z.infer<typeof addHoldingSchema>['body'];
export type SaveSettingsInput = z.infer<typeof saveSettingsSchema>['body'];
