const PortfolioRepository = require('../repositories/portfolio.repository');
const priceService = require('./PriceService');
const currencyService = require('./CurrencyService');
const { BrokerParserFactory } = require('./BrokerParser');
const logger = require('../utils/logger');

class PortfolioService {
  constructor(userDb, username) {
    this.repo = new PortfolioRepository(userDb);
    this.username = username;
  }

  // ─── Asset Enrichment ───────────────────────────────────────

  async triggerAssetEnrichment(assetId, ticker, type, currentName) {
    try {
      const finnhubKey = this.repo.getSetting('FINNHUB_KEY');
      if (type === 'EQUITY') {
        const profile = await priceService.fetchProfile(ticker, finnhubKey);
        if (profile && profile.name && profile.name !== currentName) {
          this.repo.updateSuggestedName(assetId, profile.name);
        }
      } else if (type === 'MF') {
        if (!/^\d+$/.test(ticker)) {
          const lookup = await priceService.findMFCodeByName(currentName);
          if (lookup && (lookup.name !== currentName || lookup.ticker !== ticker)) {
            this.repo.updateSuggestedNameAndTicker(assetId, lookup.name, lookup.ticker);
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to enrich asset ${ticker}: ${err.message}`);
    }
  }

  // ─── Cached Portfolio (instant, no external API calls) ──────

  getCachedPortfolio() {
    const baseCurrency = this.repo.getSetting('BASE_CURRENCY') || 'INR';
    const assets = this.repo.getAllAssetsWithLatestHoldings();

    // Use cached prices from price_cache and last known FX rates
    let totalNetWorth = 0;
    const enrichedAssets = assets.map(asset => {
      let currentPrice = 0;
      
      if (asset.type === 'CASH') {
        currentPrice = 1;
      } else if (asset.ticker) {
        const cached = priceService.getPriceDetails(asset.ticker);
        currentPrice = (cached && cached.price) || asset.avg_price || 0;
      }

      let finalPrice = currentPrice;
      const assetCurrency = asset.currency || 'INR';

      if (assetCurrency !== baseCurrency) {
        const fxRate = currencyService.getCachedRate(assetCurrency, baseCurrency);
        finalPrice = currentPrice * fxRate;
      }

      const totalValue = finalPrice * (asset.current_units || 0);
      totalNetWorth += totalValue;

      return {
        ...asset,
        currentPrice: finalPrice,
        originalPrice: currentPrice,
        totalValue,
        priceStatus: asset.type === 'CASH' ? 'MANUAL' : 'CACHED',
        manualPrice: null
      };
    });

    return { baseCurrency, totalNetWorth, assets: enrichedAssets, isCached: true };
  }

  // ─── Portfolio Summary ──────────────────────────────────────

  async getPortfolio() {
    const baseCurrency = this.repo.getSetting('BASE_CURRENCY') || 'INR';
    const assets = this.repo.getAllAssetsWithLatestHoldings();

    // --- Phase 1: Fetch all live prices concurrently ---
    const pricePromises = assets.map(asset => {
      if (asset.type === 'CASH') {
        return Promise.resolve(1);
      }
      if (['EQUITY', 'MF', 'GOLD'].includes(asset.type)) {
        return priceService.fetchPrice(asset.ticker, asset.type, asset.currency)
          .catch(err => null);
      }
      return Promise.resolve(null);
    });

    const livePrices = await Promise.all(pricePromises);

    // --- Phase 2: Pre-fetch unique FX rates concurrently ---
    const uniqueCurrencies = [...new Set(
      assets.map(a => a.currency || 'INR').filter(c => c !== baseCurrency)
    )];

    const fxRateMap = {};
    if (uniqueCurrencies.length > 0) {
      const fxPromises = uniqueCurrencies.map(cur =>
        currencyService.getExchangeRate(cur, baseCurrency)
          .then(rate => ({ cur, rate }))
          .catch(() => ({ cur, rate: 1 }))
      );
      const fxResults = await Promise.all(fxPromises);
      fxResults.forEach(({ cur, rate }) => { fxRateMap[cur] = rate; });
    }

    // --- Phase 3: Assemble enriched portfolio ---
    let totalNetWorth = 0;
    const enrichedAssets = assets.map((asset, i) => {
      const priceFromService = livePrices[i];
      const details = priceService.getPriceDetails(asset.ticker);
      
      let priceStatus = 'AUTOMATED';
      if (asset.type === 'CASH') {
        priceStatus = 'MANUAL';
      } else if (priceFromService === null) {
        priceStatus = 'FAILED';
      } else if (details && details.manual_price !== null && details.manual_price !== undefined) {
        priceStatus = 'MANUAL';
      }

      const currentPrice = priceFromService || asset.avg_price || 0;
      let finalPrice = currentPrice;
      const assetCurrency = asset.currency || 'INR';
      
      if (assetCurrency !== baseCurrency) {
        finalPrice = currentPrice * (fxRateMap[assetCurrency] || 1);
      }

      const totalValue = finalPrice * (asset.current_units || 0);
      totalNetWorth += totalValue;

      return {
        ...asset,
        currentPrice: finalPrice,
        originalPrice: currentPrice,
        totalValue,
        priceStatus,
        manualPrice: details ? details.manual_price : null
      };
    });

    // Save daily snapshot
    const today = new Date().toISOString().split('T')[0];
    this.repo.saveSnapshot(today, totalNetWorth, baseCurrency);

    return { baseCurrency, totalNetWorth, assets: enrichedAssets };
  }

  // ─── History ────────────────────────────────────────────────

  async getHistory() {
    const baseCurrency = this.repo.getSetting('BASE_CURRENCY') || 'INR';
    const snapshots = this.repo.getSnapshots(90);

    const historyPromises = snapshots.map(async (s) => {
      const snapshotCurrency = s.base_currency || baseCurrency;

      if (snapshotCurrency === baseCurrency) {
        return { date: s.date, total_value: s.total_value, base_currency: baseCurrency };
      }

      const rate = await currencyService.getHistoricalExchangeRate(s.date, snapshotCurrency, baseCurrency);

      return {
        date: s.date,
        total_value: s.total_value * rate,
        base_currency: baseCurrency,
      };
    });

    return Promise.all(historyPromises);
  }

  // ─── Settings ───────────────────────────────────────────────

  getSettings() {
    return this.repo.getSettings();
  }

  saveSetting(key, value) {
    this.repo.upsertSetting(key, value);
  }

  // ─── Manual Holding ─────────────────────────────────────────

  addOrUpdateHolding(holdingData) {
    let { id, name, ticker, type, units, price, currency, manualPrice, displayName } = holdingData;
    
    if (!name || !type || units === undefined) {
      throw new Error('Missing required fields');
    }

    if (!ticker || ticker.trim() === '') {
      if (type === 'CASH') {
        ticker = `CASH_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      } else {
        throw new Error('TICKER_REQUIRED');
      }
    }

    if (type === 'CASH' && (!price || isNaN(parseFloat(price)))) {
      price = 1;
    }

    const enrichFn = (assetId, ticker, type, name) => {
      this.triggerAssetEnrichment(assetId, ticker, type, name).catch(err => 
        logger.error(`[Background Task] Enrichment failed for ${ticker}: ${err.message}`)
      );
    };
    
    return this.repo.upsertHolding(
      { id, name, ticker, type, units, price, currency: currency || 'INR', manualPrice, displayName },
      enrichFn
    );
  }

  // ─── Broker Import ──────────────────────────────────────────

  async importBrokerFile(brokerName, filePath) {
    const parser = BrokerParserFactory.getParser(brokerName);
    const results = await parser.parse(filePath);

    const enrichFn = (assetId, ticker, type, name) => {
      this.triggerAssetEnrichment(assetId, ticker, type, name).catch(err => 
        logger.error(`[Background Task] Enrichment failed for ${ticker}: ${err.message}`)
      );
    };
    
    this.repo.importBrokerResults(results, enrichFn);

    return results.length;
  }

  // ─── Symbol Search ──────────────────────────────────────────

  async searchSymbols(query, type) {
    const finnhubKey = this.repo.getSetting('FINNHUB_KEY');
    return priceService.searchSymbols(query, type, finnhubKey);
  }

  // ─── Ticker Validation ──────────────────────────────────────

  async validateTicker(ticker, type, currency) {
    return priceService.fetchPrice(ticker, type, currency);
  }

  // ─── Name Suggestions ──────────────────────────────────────

  applySuggestion(assetId) {
    const asset = this.repo.getAssetWithSuggestion(assetId);
    if (!asset) return null; 

    if (asset.suggested_name || asset.suggested_ticker) {
      this.repo.applySuggestedName(
        assetId, 
        asset.suggested_name || asset.name, 
        asset.suggested_ticker || asset.ticker
      );
    }
    return asset;
  }

  rejectSuggestion(assetId) {
    this.repo.clearSuggestedName(assetId);
  }

  async performBulkEnrichment() {
    const assets = this.repo.getEnrichableAssets();
    let count = 0;
    const finnhubKey = this.repo.getSetting('FINNHUB_KEY');

    for (const asset of assets) {
      try {
        if (asset.type === 'EQUITY') {
          const profile = await priceService.fetchProfile(asset.ticker, finnhubKey);
          if (profile && profile.name && profile.name !== asset.name) {
            this.repo.updateSuggestedName(asset.id, profile.name);
            count++;
          }
        } else if (asset.type === 'MF') {
          if (!/^\d+$/.test(asset.ticker)) {
            const lookup = await priceService.findMFCodeByName(asset.name);
            if (lookup && (lookup.name !== asset.name || lookup.ticker !== asset.ticker)) {
              this.repo.updateSuggestedNameAndTicker(asset.id, lookup.name, lookup.ticker);
              count++;
            }
          }
        }
      } catch (err) {
        logger.error(`[BulkEnrich] Failed for ${asset.ticker}: ${err.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // rate limiting
    }
    return count;
  }
}

module.exports = PortfolioService;
