import axios from 'axios';
import logger from '../utils/logger';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 5000; // 5 seconds maximum wait time

// --- Adapters ---

class YahooFinanceAdapter {
  async getPrice(ticker: string): Promise<number> {
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
          return result.meta.regularMarketPrice;
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
}

class MFAdapter {
  async getPrice(ticker: string): Promise<number | null> {
    if (!ticker || !/^\d+$/.test(ticker)) {
      throw new Error('Unverified Mutual Fund. Needs linking to official code.');
    }
    const res = await axios.get(`https://api.mfapi.in/mf/${ticker}/latest`, { timeout: FETCH_TIMEOUT_MS });
    if (res.data && res.data.data && res.data.data.length > 0) {
      return parseFloat(res.data.data[0].nav);
    }
    throw new Error('Mutual Fund price not found in payload');
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
    if (type === 'CASH') return 1;
    if (!ticker) return null;

    const cached = this.globalDb.prepare('SELECT price, manual_price, timestamp FROM price_cache WHERE ticker = ?').get(ticker) as any;
    
    if (cached) {
      const isFresh = (new Date().getTime() - new Date(cached.timestamp).getTime()) < CACHE_TTL_MS;
      if (isFresh && !cached.manual_price) return cached.price;
    }

    let adapter;
    if (type === 'EQUITY') {
      adapter = new YahooFinanceAdapter();
    } else if (type === 'GOLD') {
      adapter = new YahooFinanceAdapter();
      ticker = ticker.includes('.') ? ticker : (ticker.startsWith('SGB') ? `${ticker}.NS` : ticker);
    } else if (type === 'MF') {
      adapter = new MFAdapter();
    } else {
      return cached ? (cached.manual_price || cached.price) : null;
    }

    try {
      const price = await adapter.getPrice(ticker);
      this.globalDb.prepare(`
        INSERT INTO price_cache (ticker, price, timestamp, manual_price) 
        VALUES (?, ?, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP, manual_price=NULL
      `).run(ticker, price);
      return price;
    } catch (err: any) {
      logger.error(`[PriceService] Fetch failed for ${ticker}: ${err.message}`);
      return cached ? (cached.manual_price || cached.price) : null;
    }
  }

  getPriceDetails(ticker: string) {
    return this.globalDb.prepare('SELECT price, manual_price, timestamp FROM price_cache WHERE ticker = ?').get(ticker) as any;
  }

  async fetchProfile(ticker: string, finnhubKey: string | null): Promise<any | null> {
    if (!ticker || !finnhubKey) return null;

    try {
      const res = await axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${finnhubKey}`, { timeout: FETCH_TIMEOUT_MS });
      if (res.data && res.data.name) return res.data;
      
      if (!res.data || !res.data.name) {
        const searchRes = await axios.get(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(ticker)}&token=${finnhubKey}`, { timeout: FETCH_TIMEOUT_MS });
        const match = (searchRes.data.result || []).find((r: any) => r.symbol === ticker || r.displaySymbol === ticker);
        if (match && match.description) return { name: match.description };
      }
      return null;
    } catch (err: any) {
      logger.error(`[PriceService] Finnhub profile fetch failed for ${ticker}: ${err.message}`);
      return null;
    }
  }

  async findMFCodeByName(name: string): Promise<any | null> {
    try {
      const mfAdapter = new MFAdapter();
      const results = await mfAdapter.search(name);
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

  async searchSymbols(query: string, type: string, finnhubKey: string | null): Promise<any[]> {
    if (type === 'MF') return await new MFAdapter().search(query);
    
    if (!finnhubKey) return [];
    
    let results: any[] = [];
    try {
      const res = await axios.get(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubKey}`, { timeout: FETCH_TIMEOUT_MS });
      if (res.data && res.data.result) {
        results = res.data.result.map((r: any) => ({ symbol: r.symbol, description: r.description, type: 'EQUITY' }));
      }
    } catch (e: any) {
      logger.error(`[PriceService] Finnhub search failed: ${e.message}`);
    }
    
    if (results.length < 5) {
      try {
         const mfResults = await new MFAdapter().search(query);
         results = [...results, ...mfResults];
      } catch(e) {}
    }
    return results;
  }
}
