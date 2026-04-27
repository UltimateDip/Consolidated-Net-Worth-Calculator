import axios from 'axios';
import logger from '../utils/logger';
import { ASSET_TYPES } from '../utils/constants';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 5000; // 5 seconds maximum wait time

// --- Adapters ---

class YahooFinanceAdapter {
  async getPrice(ticker: string): Promise<{ price: number, name: string | null } | null> {
    let attempts = 3;
    while (attempts > 0) {
      try {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
          timeout: FETCH_TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const result = res.data?.chart?.result?.[0];
        if (result && result.meta?.regularMarketPrice) {
          const meta = result.meta;
          return { 
            price: meta.regularMarketPrice,
            name: meta.longName || meta.shortName || null
          };
        }
        throw new Error('Price not found in payload');
      } catch (e: any) {
        attempts--;
        if (attempts === 0) throw new Error(`Yahoo Finance failed: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    throw new Error('Retries exhausted');
  }

  async search(query: string): Promise<any[]> {
    try {
      const res = await axios.get(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`, {
        timeout: FETCH_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const quotes = res.data?.quotes || [];
      return quotes
        .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
        .map((q: any) => ({
          symbol: q.symbol,
          description: q.longname || q.shortname || q.symbol,
          type: 'EQUITY'
        }));
    } catch (e: any) {
      logger.error(`[PriceService] Yahoo search failed for ${query}: ${e.message}`);
      return [];
    }
  }
}

class MFAdapter {
  async getPrice(ticker: string): Promise<{ price: number, name: string | null } | null> {
    if (!ticker || !/^\d+$/.test(ticker)) {
      throw new Error('Unverified Mutual Fund. Needs linking to official code.');
    }
    const res = await axios.get(`https://api.mfapi.in/mf/${ticker}/latest`, { timeout: FETCH_TIMEOUT_MS });
    if (res.data && res.data.data && res.data.data.length > 0) {
      return {
        price: parseFloat(res.data.data[0].nav),
        name: null // MF API doesn't provide name in price payload
      };
    }
    return null;
  }

  async search(query: string): Promise<any[]> {
    const res = await axios.get(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`, { timeout: FETCH_TIMEOUT_MS });
    return (res.data || []).slice(0, 10).map((item: any) => ({
      symbol: item.schemeCode.toString(),
      description: item.schemeName,
      type: 'MF'
    }));
  }
}

// --- Main Service ---

export class PriceService {
  private globalDb: any;

  constructor(globalDb: any) {
    this.globalDb = globalDb;
  }

  async fetchPrice(ticker: string | null, type: string, currency: string = 'INR'): Promise<number | null> {
    if (type === ASSET_TYPES.CASH) return 1;
    if (!ticker) return null;

    const cached = this.globalDb.prepare('SELECT price, name, manual_price, timestamp FROM price_cache WHERE ticker = ?').get(ticker) as any;
    
    if (cached) {
      const isFresh = (new Date().getTime() - new Date(cached.timestamp).getTime()) < CACHE_TTL_MS;
      if (isFresh && !cached.manual_price) return cached.price;
    }

    let adapter;
    if (type === ASSET_TYPES.EQUITY) {
      adapter = new YahooFinanceAdapter();
    } else if (type === ASSET_TYPES.GOLD) {
      adapter = new YahooFinanceAdapter();
      ticker = ticker.includes('.') ? ticker : (ticker.startsWith('SGB') ? `${ticker}.NS` : ticker);
    } else if (type === ASSET_TYPES.MF) {
      adapter = new MFAdapter();
    } else {
      return cached ? (cached.manual_price || cached.price) : null;
    }

    try {
      const result = await adapter.getPrice(ticker);
      if (!result) throw new Error('No data received from adapter');

      const { price, name } = result;

      this.globalDb.prepare(`
        INSERT INTO price_cache (ticker, price, name, timestamp, manual_price) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, name=COALESCE(excluded.name, price_cache.name), timestamp=CURRENT_TIMESTAMP, manual_price=NULL
      `).run(ticker, price, name);
      return price;
    } catch (err: any) {
      logger.error(`[PriceService] Fetch failed for ${ticker}: ${err.message}`);
      return cached ? (cached.manual_price || cached.price) : null;
    }
  }

  getPriceDetails(ticker: string) {
    return this.globalDb.prepare('SELECT price, manual_price, timestamp FROM price_cache WHERE ticker = ?').get(ticker) as any;
  }

  async fetchProfile(ticker: string): Promise<any | null> {
    if (!ticker) return null;

    // 1. Check if we already have it in the database
    const cached = this.globalDb.prepare('SELECT name FROM price_cache WHERE ticker = ?').get(ticker);
    if (cached && cached.name) return { name: cached.name };

    // 2. Fallback: Force a main price fetch. 
    // This automatically calls the adapter AND executes the SQLite cache update.
    try {
      await this.fetchPrice(ticker, ASSET_TYPES.EQUITY);

      // 3. Now read the freshly cached name from the database
      const updatedCache = this.globalDb.prepare('SELECT name FROM price_cache WHERE ticker = ?').get(ticker);
      return updatedCache && updatedCache.name ? { name: updatedCache.name } : null;
    } catch (e) {
      return null;
    }
  }

  async findMFCodeByName(name: string): Promise<any | null> {
    try {
      const results = await new MFAdapter().search(name);
      if (results && results.length > 0) {
        return { ticker: results[0].symbol, name: results[0].description };
      }
    } catch (err: any) {
      logger.error(`[PriceService] MF lookup failed for ${name}: ${err.message}`);
    }
    return null;
  }

  async getMFSuggestions(query: string): Promise<any[]> {
    return await new MFAdapter().search(query);
  }

  async searchSymbols(query: string, type: string): Promise<any[]> {
    try {
      if (type === ASSET_TYPES.MF) {
        return await new MFAdapter().search(query);
      }
      return await new YahooFinanceAdapter().search(query);
    } catch (err: any) {
      logger.error(`[PriceService] Symbol search failed for ${query}: ${err.message}`);
      return [];
    }
  }
}
