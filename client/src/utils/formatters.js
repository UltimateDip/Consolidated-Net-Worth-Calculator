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

export const TYPE_COLORS = {
  EQUITY: '#10b981',
  MF: '#6366f1',
  CRYPTO: '#f59e0b',
  GOLD: '#ec4899',
  SILVER: '#8b5cf6',
  CASH: '#06b6d4',
  OTHER: '#94a3b8',
};

/**
 * Formats a number as a currency string using Indian notation (Lakhs/Crores)
 * but with the specified currency symbol.
 */
export const formatCurrency = (amount, currency = 'INR') => {
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
export const formatCompact = (val) => {
  if (val >= 1e7) return `${(val / 1e7).toFixed(2)}Cr`;
  if (val >= 1e5) return `${(val / 1e5).toFixed(2)}L`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(0);
};

/**
 * Cleans long mutual fund names algorithmically based on common delimiters.
 * Zero-maintenance compared to string-replacement lists.
 */
export const cleanAssetName = (name) => {
  if (!name) return '';
  // Split by common delimiters used in financial names
  const match = name.split(/[-:(\[]/);
  return match[0].trim();
};

/**
 * Truncates a string to a max length and adds ellipsis.
 */
export const truncateLabel = (str, len = 20) => {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
};
