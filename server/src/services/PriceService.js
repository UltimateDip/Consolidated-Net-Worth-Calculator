const { getGlobalDb } = require('../models/db');
const logger = require('../utils/logger');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class PriceAdapter {
  async getPrice(ticker) {
    throw new Error('getPrice must be implemented');
  }
}

class YahooFinanceAdapter extends PriceAdapter {
  async getPrice(ticker) {
    let attempts = 3;
    while (attempts > 0) {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const data = await res.json();
        const result = data.chart?.result?.[0];
        if (result && result.meta?.regularMarketPrice) {
          return result.meta.regularMarketPrice;
        }
        throw new Error('Price not found in Yahoo Finance');
      } catch (e) {
        attempts--;
        if (attempts === 0) throw new Error(`Yahoo Finance fetch failed after 3 attempts: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
}

class MFAdapter extends PriceAdapter {
  async getPrice(ticker) {
    if (!/^\d+$/.test(ticker)) {
      throw new Error(`Invalid Mutual Fund Scheme Code: ${ticker}. Please use the 6-digit numeric code from mfapi.in`);
    }

    const res = await fetch(`https://api.mfapi.in/mf/${ticker}/latest`);
    const data = await res.json();

    if (data && data.data && data.data.length > 0) {
      return parseFloat(data.data[0].nav);
    }
    throw new Error('Mutual Fund price not found');
  }

  async search(query) {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return (data || []).slice(0, 10).map(item => ({
      symbol: item.schemeCode.toString(),
      description: item.schemeName,
      type: 'MF'
    }));
  }
}

class PriceService {

  async findMFCodeByName(name) {
    try {
      const mfAdapter = new MFAdapter();
      const results = await mfAdapter.search(name);
      if (results && results.length > 0) {
        return {
          ticker: results[0].symbol,
          name: results[0].description
        };
      }
    } catch (e) {
      logger.error(`MF lookup failed: ${e.message}`);
    }
    return null;
  }

  async searchSymbols(query, type, finnhubKey) {
    let results = [];

    if (type === 'MF') {
      return await new MFAdapter().search(query);
    }

    try {
      if (finnhubKey) {
        const finnhubRes = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${finnhubKey}`);
        const finnhubData = await finnhubRes.json();
        if (finnhubData.result) {
          results = [...results, ...finnhubData.result.map(r => ({
            symbol: r.symbol,
            description: r.description,
            type: 'EQUITY'
          }))];
        }
      }
    } catch (e) {
      logger.error(`Equity search failed: ${e.message}`);
    }

    if (results.length < 5) {
      try {
        const mfResults = await new MFAdapter().search(query);
        results = [...results, ...mfResults];
      } catch (e) { }
    }

    return results;
  }

  async fetchPrice(ticker, type, currency = 'INR') {
    if (type === 'CASH') return 1;

    // --- Check cache first ---
    const cached = getGlobalDb().prepare('SELECT price, manual_price, timestamp FROM price_cache WHERE ticker = ?').get(ticker);
    if (cached) {
      const isFresh = (new Date() - new Date(cached.timestamp)) < CACHE_TTL_MS;
      if (isFresh && !cached.manual_price) {
        return cached.price;
      }
    }

    // --- Determine adapter ---
    // Yahoo Finance for ALL equity and gold price fetching
    // MF API for mutual funds
    let adapter;
    if (type === 'EQUITY') {
      adapter = new YahooFinanceAdapter();
    } else if (type === 'GOLD') {
      // Gold SGBs are traded on exchanges, use Yahoo via their exchange ticker
      adapter = new YahooFinanceAdapter();
      const exchangeTicker = ticker.includes('.') ? ticker : (ticker.startsWith('SGB') ? `${ticker}.NS` : ticker);
      logger.debug('[PriceService] Mapping GOLD ticker %s -> %s for Yahoo', ticker, exchangeTicker);
      ticker = exchangeTicker;
    } else if (type === 'MF') {
      adapter = new MFAdapter();
    } else {
      // Unknown type — return cached or null
      return cached ? (cached.manual_price || cached.price) : null;
    }

    try {
      const price = await adapter.getPrice(ticker, currency);

      getGlobalDb().prepare(`
        INSERT INTO price_cache (ticker, price, timestamp, manual_price) 
        VALUES (?, ?, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP, manual_price=NULL
      `).run(ticker, price);

      return price;
    } catch (err) {
      logger.debug('[PriceService] Price fetch failed for %s: %s', ticker, err.message);
      if (cached) {
        return cached.manual_price || cached.price;
      }
      return null;
    }
  }

  getPriceDetails(ticker) {
    return getGlobalDb().prepare('SELECT price, manual_price, timestamp FROM price_cache WHERE ticker = ?').get(ticker);
  }

  async searchSymbolsGlobal(query, finnhubKey) {
    if (!query || query.length < 2) return [];

    const cached = getGlobalDb().prepare('SELECT results, timestamp FROM search_cache WHERE query = ?').get(query.toUpperCase());
    if (cached) {
      const isFresh = (new Date() - new Date(cached.timestamp)) < 24 * 60 * 60 * 1000;
      if (isFresh) return JSON.parse(cached.results);
    }

    if (!finnhubKey) return [];

    try {
      const res = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubKey}`);
      const data = await res.json();
      const results = data.result || [];

      getGlobalDb().prepare(`
        INSERT INTO search_cache (query, results, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(query) DO UPDATE SET results=excluded.results, timestamp=CURRENT_TIMESTAMP
      `).run(query.toUpperCase(), JSON.stringify(results));

      return results;
    } catch (err) {
      return [];
    }
  }

  async fetchProfile(ticker, finnhubKey) {
    if (!finnhubKey) return null;

    try {
      const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${finnhubKey}`);
      const data = await res.json();
      
      if (data && data.name) return data;
      
      if (!data || !data.name || res.status === 403) {
        const searchRes = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(ticker)}&token=${finnhubKey}`);
        const searchData = await searchRes.json();
        const match = (searchData.result || []).find(r => r.symbol === ticker || r.displaySymbol === ticker);
        if (match && match.description) {
          return { name: match.description };
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }
}

module.exports = new PriceService();
