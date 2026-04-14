const db = require('../models/db');

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
    // Prevent accidental US ticker matching (e.g., LTM US vs LTIMindtree India)
    if (currency === 'INR' && !ticker.includes('.')) {
        searchTicker = `${ticker}.NS`;
    }

    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${searchTicker}&token=${this.apiKey}`);
    const data = await res.json();
    if (data.c) return data.c; // Current price
    throw new Error('Price not found');
  }
}

class CoinGeckoAdapter extends PriceAdapter {
  async getPrice(ticker) {
    // Ticker needs to be coin id e.g. bitcoin, ethereum
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ticker.toLowerCase()}&vs_currencies=usd`);
    const data = await res.json();
    if (data[ticker.toLowerCase()] && data[ticker.toLowerCase()].usd) {
       return data[ticker.toLowerCase()].usd;
    }
    throw new Error('Crypto price not found');
  }
}

class MetalPriceAdapter extends PriceAdapter {
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
    }
    async getPrice(ticker) {
        // Ticker like XAU, XAG
        if (!this.apiKey) throw new Error('MetalPriceAPI key not configured');
        const res = await fetch(`https://api.metalpriceapi.com/v1/latest?api_key=${this.apiKey}&base=USD&currencies=${ticker}`);
        const data = await res.json();
        if (data.rates && data.rates[ticker]) {
            // Price is generally USD per 1 Ounce. The API returns the multiplier, we often need 1/rate if base is USD and rate is XAU
            // MetalPriceAPI free tier base is USD. rate for XAU is 0.0004..., so 1 Ounce = 1 / 0.0004 USD
            return 1 / data.rates[ticker];
        }
        throw new Error('Metal price not found');
    }
}

class MFAdapter extends PriceAdapter {
  async getPrice(ticker) {
    // Basic validation for Scheme Code (usually 6 digits)
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
  constructor() {
    this.adapters = {
      'EQUITY': () => new FinnhubAdapter(this.getSetting('FINNHUB_KEY')),
      'CRYPTO': () => new CoinGeckoAdapter(),
      'GOLD': () => new MetalPriceAdapter(this.getSetting('METALPRICE_KEY')),
      'SILVER': () => new MetalPriceAdapter(this.getSetting('METALPRICE_KEY')),
      'MF': () => new MFAdapter()
    };
  }

  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  async searchSymbols(query, type) {
    let results = [];
    
    // If type is specified, prioritize that adapter
    if (type === 'MF') {
       return await new MFAdapter().search(query);
    }

    // Default: Try Equity (Finnhub)
    try {
        const equityAdapter = this.adapters['EQUITY']();
        const finnhubRes = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${equityAdapter.apiKey}`);
        const finnhubData = await finnhubRes.json();
        if (finnhubData.result) {
            results = [...results, ...finnhubData.result.map(r => ({
                symbol: r.symbol,
                description: r.description,
                type: 'EQUITY'
            }))];
        }
    } catch (e) {
        console.error('Equity search failed:', e.message);
    }

    // Also include MF if results are low or query looks like an Indian MF
    if (results.length < 5) {
        try {
            const mfResults = await new MFAdapter().search(query);
            results = [...results, ...mfResults];
        } catch (e) {}
    }

    return results;
  }

  async fetchPrice(ticker, type, currency = 'USD') {
    if (type === 'CASH') return 1;

    // Handle SGBs (Sovereign Gold Bonds)
    if (type === 'GOLD' && ticker.startsWith('SGB')) {
        try {
            // First attempt: Try to get market price from exchange (NSE/BSE)
            const exchangeTicker = ticker.includes('.') ? ticker : `${ticker}.NS`;
            const marketPrice = await this.adapters['EQUITY']().getPrice(exchangeTicker);
            if (marketPrice && marketPrice > 0) return marketPrice;
        } catch (e) {
            console.log(`Market price unavailable for ${ticker}, falling back to spot gold calculation.`);
        }

        // Fallback: Calculate derived price from Spot Gold (XAU)
        try {
            const xauPriceUsdOz = await this.adapters['GOLD']().getPrice('XAU');
            
            // Need Currency Service for USD -> INR conversion
            const CurrencyService = require('./CurrencyService');
            const usdToInr = await CurrencyService.getExchangeRate('USD', 'INR');
            
            const inrPerOz = xauPriceUsdOz * usdToInr;
            const inrPerGram = inrPerOz / 31.1035; // 1 troy ounce = 31.1035 grams
            
            // Add a slight 'SGB premium' if desired, but spot gram is the most accurate base
            return inrPerGram;
        } catch (e) {
            console.error('SGB fallback pricing failed:', e.message);
        }
    }

    // Check Cache
    const cached = db.prepare('SELECT price, timestamp FROM price_cache WHERE ticker = ?').get(ticker);
    if (cached) {
      // Mutual Fund NAVs change once a day, so we can cache them longer (24h) than stocks (1h)
      const ttl = type === 'MF' ? 24 * 60 * 60 * 1000 : CACHE_TTL_MS;
      const isFresh = (new Date() - new Date(cached.timestamp)) < ttl;
      if (isFresh) return cached.price;
    }

    // Fetch from adapter
    const getAdapter = this.adapters[type];
    if (!getAdapter) {
      // If no adapter (like for MF), fall back to the last known cached price (from import)
      return cached ? cached.price : null;
    }

    const adapter = getAdapter();
    try {
      const price = await adapter.getPrice(ticker, currency);
      
      // Update Cache
      db.prepare(`
        INSERT INTO price_cache (ticker, price, timestamp) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP
      `).run(ticker, price);

      return price;
    } catch (err) {
      if (!err.message.includes('Price not found') && !err.message.includes('API key not configured')) {
         console.error(`[PriceService] Failed to fetch price for ${ticker}:`, err.message);
      }
      // Fallback to stale cache if API fails
      if (cached) return cached.price;
      return null;
    }
  }

  async searchSymbols(query) {
    if (!query || query.length < 2) return [];

    // Check Search Cache (24h TTL)
    const cached = db.prepare('SELECT results, timestamp FROM search_cache WHERE query = ?').get(query.toUpperCase());
    if (cached) {
      const isFresh = (new Date() - new Date(cached.timestamp)) < 24 * 60 * 60 * 1000;
      if (isFresh) return JSON.parse(cached.results);
    }

    const apiKey = this.getSetting('FINNHUB_KEY');
    if (!apiKey) return [];

    try {
      const res = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`);
      const data = await res.json();
      const results = data.result || [];

      // Update Search Cache
      db.prepare(`
        INSERT INTO search_cache (query, results, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(query) DO UPDATE SET results=excluded.results, timestamp=CURRENT_TIMESTAMP
      `).run(query.toUpperCase(), JSON.stringify(results));

      return results;
    } catch (err) {
      console.error('Search symbols failed:', err.message);
      return [];
    }
  }

  async fetchProfile(ticker) {
    const apiKey = this.getSetting('FINNHUB_KEY');
    if (!apiKey) return null;

    try {
      const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`);
      const data = await res.json();
      return data && data.name ? data : null;
    } catch (err) {
      console.error('Fetch profile failed:', err.message);
      return null;
    }
  }
}

module.exports = new PriceService();
