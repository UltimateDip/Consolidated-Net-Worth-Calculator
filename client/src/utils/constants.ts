export const ASSET_TYPES = {
  CASH: 'CASH',
  EQUITY: 'EQUITY',
  MF: 'MF',
  GOLD: 'GOLD',
  OTHER: 'OTHER'
} as const;

export type AssetType = keyof typeof ASSET_TYPES;

export const PRICE_STATUS = {
  AUTOMATED: 'AUTOMATED',
  MANUAL: 'MANUAL',
  FAILED: 'FAILED',
} as const;

export type PriceStatus = keyof typeof PRICE_STATUS;

export const VERIFICATION_STATUS = {
  VERIFIED: 'VERIFIED',
  PENDING: 'PENDING',
} as const;

export const HISTORY_TYPES = {
  MERGE: 'MERGE',
  UPDATE: 'UPDATE',
} as const;
