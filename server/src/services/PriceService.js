const { getGlobalDb } = require('../models/db');
const logger = require('../utils/logger');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class PriceAdapter {
  async getPrice(ticker) {
    throw new Error('getPrice must be implemented');
  }
}

class FinnhubAdapter extends PriceAdapter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }
  async getPrice(ticker, currency) {
    if (!this.apiKey) throw new Error('Finnhub API key not configured');

    let searchTicker = ticker;
    if (currency === 'INR' && !ticker.includes('.')) {
      searchTicker = `${ticker}.NS`;
    }

    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${searchTicker}&token=${this.apiKey}`);
    const data = await res.json();
    if (data.c) return data.c; // Current price
    throw new Error('Price not found');
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
  
  getAdapters(finnhubKey) {
    return {
      'EQUITY': () => new FinnhubAdapter(finnhubKey),
      'MF': () => new MFAdapter()
    };
  }

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
      const equityAdapter = this.getAdapters(finnhubKey)['EQUITY']();
      if (equityAdapter.apiKey) {
        const finnhubRes = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${equityAdapter.apiKey}`);
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

  async fetchPrice(ticker, type, currency = 'USD', finnhubKey = null) {
    if (type === 'CASH') return 1;

    if (type === 'GOLD') {
      try {
        logger.debug('[PriceService] Processing GOLD ticker: %s', ticker);
        const exchangeTicker = ticker.includes('.') ? ticker : (ticker.startsWith('SGB') ? `${ticker}.NS` : ticker);
        logger.debug('[PriceService] Mapping GOLD to exchange ticker: %s', exchangeTicker);
        const marketPrice = await this.getAdapters(finnhubKey)['EQUITY']().getPrice(exchangeTicker);
        if (marketPrice && marketPrice > 0) {
          return marketPrice;
        }
      } catch (e) {
        logger.debug('[PortfolioService] SGB market fetch failed (expected if non-exchange gold): %s', e.message);
      }
    }

    const cached = getGlobalDb().prepare('SELECT price, manual_price, timestamp FROM price_cache WHERE ticker = ?').get(ticker);
    if (cached) {
      const isFresh = (new Date() - new Date(cached.timestamp)) < CACHE_TTL_MS;
      if (isFresh && !cached.manual_price) {
        return cached.price;
      }
    }

    let adapter;
    if (type === 'EQUITY') {
      if (ticker.endsWith('.NS') || ticker.endsWith('.BO') || currency === 'INR') {
        adapter = new YahooFinanceAdapter();
      } else {
        adapter = this.getAdapters(finnhubKey)['EQUITY']();
      }
    } else {
      const getAdapter = this.getAdapters(finnhubKey)[type];
      if (!getAdapter) {
        const result = cached ? (cached.manual_price || cached.price) : null;
        return result;
      }
      adapter = getAdapter();
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
