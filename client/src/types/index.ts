export interface User {
  id: number;
  username: string;
}

export interface Asset {
  id: number;
  name: string;
  ticker: string | null;
  type: 'EQUITY' | 'MF' | 'CASH' | 'GOLD';
  current_units: number;
  currency: string;
  avg_price: number;
  totalValue: number;
  priceStatus: 'AUTOMATED' | 'MANUAL' | 'FAILED';
  verification_status: 'UNVERIFIED' | 'NEEDS_REVIEW' | 'VERIFIED';
  suggested_name?: string;
  suggested_ticker?: string;
  display_name?: string;
  last_updated?: string;
  originalPrice?: number;
}

export interface PortfolioHistory {
  date: string;
  total_value: number;
  base_currency: string;
}

export interface Settings {
  BASE_CURRENCY?: string;
  FINNHUB_KEY?: string;
  [key: string]: any;
}

export interface PortfolioSummary {
  assets: Asset[];
  totalNetWorth: number;
  baseCurrency: string;
}
