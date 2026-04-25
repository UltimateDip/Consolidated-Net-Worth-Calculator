import { ASSET_TYPES } from './constants';

// --- Theme / Color Constants ---
export const CHART_COLORS = [
  '#10b981', // emerald
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
];

export const TYPE_COLORS: Record<string, string> = {
  [ASSET_TYPES.EQUITY]: '#10b981',
  [ASSET_TYPES.MF]: '#6366f1',
  [ASSET_TYPES.GOLD]: '#ec4899',
  [ASSET_TYPES.CASH]: '#06b6d4',
  [ASSET_TYPES.OTHER]: '#94a3b8',
};

/**
 * Formats a number as a currency string using Indian notation (Lakhs/Crores)
 * but with the specified currency symbol.
 */
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toLocaleString()}`;
  }
};

/**
 * Formats large numbers into a compact human-readable format (K, L, Cr)
 */
export const formatCompact = (val: number): string => {
  if (val >= 1e7) return `${(val / 1e7).toFixed(2)}Cr`;
  if (val >= 1e5) return `${(val / 1e5).toFixed(2)}L`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return (val || 0).toFixed(0);
};

/**
 * Cleans long mutual fund names algorithmically based on common delimiters.
 * Zero-maintenance compared to string-replacement lists.
 */
export const cleanAssetName = (name: string): string => {
  if (!name) return '';
  // Split by common delimiters used in financial names
  const match = name.split(/[-:(\[]/);
  return match[0].trim();
};

/**
 * Truncates a string to a max length and adds ellipsis.
 */
export const truncateLabel = (str: string, len: number = 20): string => {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
};
