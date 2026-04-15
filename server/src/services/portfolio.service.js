const repo = require('../repositories/portfolio.repository');
const priceService = require('./PriceService');
const currencyService = require('./CurrencyService');
const { BrokerParserFactory } = require('./BrokerParser');

class PortfolioService {

  // ─── Asset Enrichment ───────────────────────────────────────

  async triggerAssetEnrichment(assetId, ticker, type, currentName) {
    try {
      if (type === 'EQUITY') {
        const profile = await priceService.fetchProfile(ticker);
        if (profile && profile.name && profile.name !== currentName) {
          repo.updateSuggestedName(assetId, profile.name);
        }
      } else if (type === 'MF') {
        // If it's a mutual fund and doesn't have a numeric ticker, try to find the AMFI code
        if (!/^\d+$/.test(ticker)) {
          const lookup = await priceService.findMFCodeByName(currentName);
          if (lookup && (lookup.name !== currentName || lookup.ticker !== ticker)) {
            repo.updateSuggestedNameAndTicker(assetId, lookup.name, lookup.ticker);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to enrich asset ${ticker}:`, err.message);
    }
  }

  // ─── Portfolio Summary ──────────────────────────────────────

  async getPortfolio() {
    const baseCurrency = repo.getSetting('BASE_CURRENCY') || 'USD';
    const assets = repo.getAllAssetsWithLatestHoldings();

    // --- Phase 1: Fetch all live prices concurrently ---
    const pricePromises = assets.map(asset => {
      if (['EQUITY', 'MF', 'CRYPTO', 'GOLD', 'SILVER'].includes(asset.type)) {
        const priceType = (asset.type === 'GOLD' && asset.ticker.startsWith('SGB')) ? 'EQUITY' : asset.type;
        return priceService.fetchPrice(asset.ticker, priceType, asset.currency)
          .catch(err => {
            console.error(`[Portfolio] Price fetch failed for ${asset.ticker}:`, err.message);
            return null;
          });
      }
      return Promise.resolve(null);
    });

    const livePrices = await Promise.all(pricePromises);

    // --- Phase 2: Pre-fetch unique FX rates concurrently ---
    const uniqueCurrencies = [...new Set(
      assets.map(a => a.currency || 'USD').filter(c => c !== baseCurrency)
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
      let currentPrice = livePrices[i] || asset.avg_price || 1;

      let finalPrice = currentPrice;
      const assetCurrency = asset.currency || 'USD';
      if (assetCurrency !== baseCurrency) {
        finalPrice = currentPrice * (fxRateMap[assetCurrency] || 1);
      }

      const totalValue = finalPrice * asset.current_units;
      totalNetWorth += totalValue;

      return {
        ...asset,
        currentPrice: finalPrice,
        originalPrice: currentPrice,
        totalValue,
      };
    });

    // Save daily snapshot with FX rates for accurate historical conversion
    const today = new Date().toISOString().split('T')[0];
    const fxSnapshot = { [baseCurrency]: 1, ...fxRateMap };
    repo.saveSnapshot(today, totalNetWorth, baseCurrency, JSON.stringify(fxSnapshot));

    return { baseCurrency, totalNetWorth, assets: enrichedAssets };
  }

  // ─── History ────────────────────────────────────────────────

  async getHistory() {
    const baseCurrency = repo.getSetting('BASE_CURRENCY') || 'USD';
    const snapshots = repo.getSnapshots(90);

    // Collect legacy snapshots (no stored fx_rates) that need a live fallback
    const legacyCurrencies = [...new Set(
      snapshots
        .filter(s => !s.fx_rates && s.base_currency && s.base_currency !== baseCurrency)
        .map(s => s.base_currency)
    )];

    const legacyFxMap = {};
    if (legacyCurrencies.length > 0) {
      const fxPromises = legacyCurrencies.map(cur =>
        currencyService.getExchangeRate(cur, baseCurrency)
          .then(rate => ({ cur, rate }))
          .catch(() => ({ cur, rate: 1 }))
      );
      const fxResults = await Promise.all(fxPromises);
      fxResults.forEach(({ cur, rate }) => { legacyFxMap[cur] = rate; });
    }

    // Normalise each snapshot using its own stored FX rates
    return snapshots.map(s => {
      const snapshotCurrency = s.base_currency || baseCurrency;

      if (snapshotCurrency === baseCurrency) {
        return { date: s.date, total_value: s.total_value, base_currency: baseCurrency };
      }

      let rate = 1;

      if (s.fx_rates) {
        const storedRates = JSON.parse(s.fx_rates);
        if (storedRates[baseCurrency]) {
          rate = 1 / storedRates[baseCurrency];
        } else {
          rate = legacyFxMap[snapshotCurrency] || 1;
        }
      } else {
        rate = legacyFxMap[snapshotCurrency] || 1;
      }

      return {
        date: s.date,
        total_value: s.total_value * rate,
        base_currency: baseCurrency,
      };
    });
  }

  // ─── Settings ───────────────────────────────────────────────

  getSettings() {
    return repo.getSettings();
  }

  saveSetting(key, value) {
    repo.upsertSetting(key, value);
  }

  // ─── Manual Holding ─────────────────────────────────────────

  addOrUpdateHolding({ id, name, ticker, type, units, price, currency }) {
    // Auto-generate missing tickers based on type
    if (!ticker || ticker.trim() === '') {
      if (type === 'CASH') {
        ticker = `CASH_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      } else if (type === 'GOLD') {
        ticker = 'XAU';
      } else if (type === 'SILVER') {
        ticker = 'XAG';
      } else {
        throw new Error('TICKER_REQUIRED');
      }
    }

    // Auto-ensure price = 1 for CASH if undefined
    if (type === 'CASH' && (!price || isNaN(parseFloat(price)))) {
      price = 1;
    }

    const enrichFn = (assetId, ticker, type, name) => {
      this.triggerAssetEnrichment(assetId, ticker, type, name).catch(err => 
        console.error('[Background Task] Enrichment failed for', ticker, ':', err.message)
      );
    };
    
    const assetId = repo.upsertHolding(
      { id, name, ticker, type, units, price, currency: currency || 'USD' },
      enrichFn
    );

    return assetId;
  }

  // ─── Broker Import ──────────────────────────────────────────

  async importBrokerFile(brokerName, filePath) {
    const parser = BrokerParserFactory.getParser(brokerName);
    const results = await parser.parse(filePath);

    const enrichFn = (assetId, ticker, type, name) => {
      this.triggerAssetEnrichment(assetId, ticker, type, name).catch(err => 
        console.error('[Background Task] Enrichment failed for', ticker, ':', err.message)
      );
    };
    
    repo.importBrokerResults(results, enrichFn);

    return results.length;
  }

  // ─── Symbol Search ──────────────────────────────────────────

  async searchSymbols(query, type) {
    return priceService.searchSymbols(query, type);
  }

  // ─── Ticker Validation ──────────────────────────────────────

  async validateTicker(ticker, type, currency) {
    return priceService.fetchPrice(ticker, type, currency);
  }

  // ─── Name Suggestions ──────────────────────────────────────

  applySuggestion(assetId) {
    const asset = repo.getAssetWithSuggestion(assetId);
    if (!asset) return null; 
    
    if (!asset.suggested_name && !asset.suggested_ticker) {
      return true; // Already applied
    }
    const newName = asset.suggested_name || asset.name;
    const newTicker = asset.suggested_ticker || asset.ticker;
    
    console.log(`[Service] Updating asset ${assetId}: ticker="${asset.ticker}" -> "${newTicker}", name="${asset.name}" -> "${newName}"`);
    repo.applySuggestedName(assetId, newName, newTicker);
    return true;
  }

  ignoreSuggestion(assetId) {
    console.log(`[Service] Ignoring suggestion for asset ${assetId}`);
    repo.clearSuggestedName(assetId);
  }

  // ─── Bulk Enrichment ───────────────────────────────────────

  async startBulkEnrichment() {
    const assets = repo.getEnrichableAssets();
    console.log(`[Service] Starting bulk enrichment for ${assets.length} items (EQUITY + MF)`);
 
    // Process in background to prevent timeout
    (async () => {
      try {
        for (const asset of assets) {
          await this.triggerAssetEnrichment(asset.id, asset.ticker, asset.type, asset.name);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log(`[Service] Bulk enrichment completed`);
      } catch (err) {
        console.error('[Background Task] Bulk enrichment process failed:', err.message);
      }
    })();
 
    return assets.length;
  }
}

module.exports = new PortfolioService();
