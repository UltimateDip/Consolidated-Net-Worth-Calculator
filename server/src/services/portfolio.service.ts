import PortfolioRepository from '../repositories/portfolio.repository';
import priceService from './PriceService';
import currencyService from './CurrencyService';
import BrokerParserFactory from './parsers/BrokerParserFactory';
import logger from '../utils/logger';
import { BadRequestError } from '../utils/errors';

interface HoldingInput {
  id?: number;
  name: string;
  ticker: string | null;
  type: string;
  units: number;
  price?: number;
  currency: string;
  manualPrice?: number;
  displayName?: string;
}

export default class PortfolioService {
  private repo: PortfolioRepository;
  private username: string;

  constructor(userDb: any, globalDb: any, username: string) {
    this.repo = new PortfolioRepository(userDb, globalDb);
    this.username = username;
  }

  // ─── Asset Enrichment ───────────────────────────────────────

  async triggerAssetEnrichment(assetId: number, ticker: string | null, type: string, currentName: string): Promise<void> {
    try {
      const finnhubKey = this.repo.getSetting('FINNHUB_KEY');
      if (type === 'EQUITY') {
        const profile = await priceService.fetchProfile(ticker, finnhubKey);
        if (profile && profile.name && profile.name !== currentName) {
          this.repo.updateSuggestedName(assetId, profile.name);
        }
      } else if (type === 'MF') {
        if (ticker && !/^\d+$/.test(ticker)) {
          const lookup = await priceService.findMFCodeByName(currentName);
          if (lookup && (lookup.name !== currentName || (lookup.ticker !== ticker && ticker !== null))) {
            this.repo.updateSuggestedNameAndTicker(assetId, lookup.name, lookup.ticker);
          }
        }
      }
    } catch (err: any) {
      logger.error(`Failed to enrich asset ${ticker}: ${err.message}`);
    }
  }

  // ─── Cached Portfolio (instant, no external API calls) ──────

  getCachedPortfolio(): any {
    const baseCurrency = this.repo.getSetting('BASE_CURRENCY') || 'INR';
    const assets = this.repo.getAllAssetsWithLatestHoldings();

    // Use cached prices from price_cache and last known FX rates
    let totalNetWorth = 0;
    const enrichedAssets = assets.map((asset: any) => {
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

  async getPortfolio(): Promise<any> {
    const baseCurrency = this.repo.getSetting('BASE_CURRENCY') || 'INR';
    const assets = this.repo.getAllAssetsWithLatestHoldings();

    // --- Phase 1: Fetch all live prices concurrently ---
    const pricePromises = assets.map((asset: any) => {
      if (asset.type === 'CASH') {
        return Promise.resolve(1);
      }
      if (['EQUITY', 'MF', 'GOLD'].includes(asset.type)) {
        return priceService.fetchPrice(asset.ticker, asset.type, asset.currency)
          .catch(() => null);
      }
      return Promise.resolve(null);
    });

    const livePrices = await Promise.all(pricePromises);

    // --- Phase 2: Pre-fetch unique FX rates concurrently ---
    const uniqueCurrencies: string[] = [...new Set(
      assets.map((a: any) => a.currency || 'INR').filter((c: string) => c !== baseCurrency)
    )] as string[];

    const fxRateMap: Record<string, number> = {};
    if (uniqueCurrencies.length > 0) {
      const fxPromises = uniqueCurrencies.map((cur) =>
        currencyService.getExchangeRate(cur, baseCurrency)
          .then((rate: number) => ({ cur, rate }))
          .catch(() => ({ cur, rate: 1 }))
      );
      const fxResults = await Promise.all(fxPromises);
      fxResults.forEach(({ cur, rate }: any) => { fxRateMap[cur] = rate; });
    }

    // --- Phase 3: Assemble enriched portfolio ---
    let totalNetWorth = 0;
    const enrichedAssets = assets.map((asset: any, i: number) => {
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

  async getHistory(): Promise<any[]> {
    const baseCurrency = this.repo.getSetting('BASE_CURRENCY') || 'INR';
    const snapshots = this.repo.getSnapshots(90);

    const historyPromises = snapshots.map(async (s: any) => {
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

  getSettings(): Record<string, string> {
    return this.repo.getSettings();
  }

  saveSetting(key: string, value: string): void {
    this.repo.upsertSetting(key, value);
  }

  // ─── Manual Holding (Business Logic — extracted from Repository) ──

  addOrUpdateHolding(holdingData: HoldingInput): number {
    let { id, name, ticker, type, units, price, currency, manualPrice, displayName } = holdingData;

    if (!name || !type || units === undefined) {
      throw new BadRequestError('Missing required fields: name, type, and units are required');
    }

    // Normalize ticker for CASH assets
    if (!ticker || ticker.trim() === '') {
      if (type === 'CASH') {
        ticker = `CASH_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      } else {
        ticker = null;
      }
    }

    // Default price for CASH
    if (type === 'CASH' && (!price || isNaN(parseFloat(String(price))))) {
      price = 1;
    }

    let assetId = id;

    // --- Transactional business logic ---
    this.repo.runTransaction(() => {
      logger.debug('[PortfolioService] Starting upsert for %s (%s)', name, ticker);

      if (assetId) {
        // ── UPDATING an existing asset ──
        const collision = this.repo.checkTickerCollision(ticker, assetId);

        if (collision) {
          // MERGE: Another asset already owns this ticker
          logger.info(`[Merge] Ticker collision detected for ${ticker}. Merging asset ${collision.id} into ${assetId}`);

          const existingUnits = this.repo.getAssetLatestUnits(collision.id);
          const totalUnits = existingUnits + units;

          this.repo.updateAsset(assetId, name, ticker!, type, currency, displayName);
          this.repo.insertHoldingHistory(assetId, totalUnits, price || null, currency, 'MERGE');
          this.repo.deleteAsset(collision.id);
          this.repo.updateVerificationStatus(assetId, 'VERIFIED');
          this.repo.syncManualPrice(ticker, manualPrice, type);
          return;
        }

        // Standard update (no collision)
        this.repo.updateAsset(assetId, name, ticker, type, currency, displayName);
      } else {
        // ── CREATING a new asset (or finding an existing one by ticker) ──
        const existing = this.repo.getAssetByTicker(ticker);
        if (existing) {
          assetId = existing.id;
          this.repo.updateAsset(assetId!, name, ticker, type, currency, displayName);
        } else {
          assetId = this.repo.createAsset(name, ticker, type, currency, displayName);
        }
      }

      this.repo.insertHoldingHistory(assetId!, units, price || null, currency, 'UPDATE');
      this.repo.syncManualPrice(ticker, manualPrice, type);

      // Mark as VERIFIED since this was a manual user action
      this.repo.updateVerificationStatus(assetId!, 'VERIFIED');

      // Auto-verify if ticker is a valid numeric code for MF
      if (type === 'MF' && ticker && /^\d+$/.test(ticker)) {
        this.repo.updateVerificationStatus(assetId!, 'VERIFIED');
        this.repo.clearSuggestedTicker(assetId!);
      }
    });

    // Fire-and-forget enrichment AFTER the transaction completes
    if (assetId && (type === 'EQUITY' || type === 'MF')) {
      this.triggerAssetEnrichment(assetId, ticker, type, name).catch((err: any) =>
        logger.error(`[Background Task] Enrichment failed for ${ticker}: ${err.message}`)
      );
    }

    return assetId!;
  }

  // ─── Broker Import ──────────────────────────────────────────

  async importBrokerFile(brokerName: string, filePath: string): Promise<number> {
    const parser = BrokerParserFactory.getParser(brokerName);
    const results = await parser.parse(filePath);

    this.repo.runTransaction(() => {
      for (const item of results) {
        let asset: any = null;
        if (item.ticker) {
          asset = this.repo.getAssetByTicker(item.ticker);
        } else {
          // Fallback: check by name for tickerless assets (e.g. CASH entries)
          asset = this.repo.getAssetByName(item.name);
        }

        if (!asset) {
          const newId = this.repo.createAsset(item.name, item.ticker, item.type, item.currency || 'INR');
          asset = { id: newId };
        }

        this.repo.insertHoldingHistory(asset.id, item.units, item.price, item.currency || 'INR', 'UPDATE');

        // Update global price cache — skip for CASH and null tickers
        if (item.type !== 'CASH' && item.price && item.ticker) {
          this.repo.syncPriceCache(item.ticker, item.price);
        }

        // Fire enrichment
        if (item.type === 'EQUITY' || item.type === 'MF') {
          this.triggerAssetEnrichment(asset.id, item.ticker, item.type, item.name).catch((err: any) =>
            logger.error(`[Background Task] Enrichment failed for ${item.ticker}: ${err.message}`)
          );
        }
      }
    });

    return results.length;
  }

  // ─── Symbol Search ──────────────────────────────────────────

  async searchSymbols(query: string, type?: string): Promise<any[]> {
    if (!query || query.length < 2) return [];
    const results = await priceService.search(query);
    return Array.isArray(results) ? results : [];
  }

  async getMFSuggestions(query: string): Promise<any[]> {
    if (!query || query.length < 2) return [];
    return await priceService.searchMFWithPrices(query);
  }

  // ─── Ticker Validation ──────────────────────────────────────

  async validateTicker(ticker: string, type: string, currency: string): Promise<number> {
    return priceService.fetchPrice(ticker, type, currency);
  }

  // ─── Name Suggestions ──────────────────────────────────────

  applySuggestion(assetId: number): any {
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

  rejectSuggestion(assetId: number): void {
    this.repo.clearSuggestedName(assetId);
  }

  async performBulkEnrichment(): Promise<number> {
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
          // If it's an unverified slug, check if we can find ANY match to nudge the user
          if (asset.verification_status === 'UNVERIFIED' && (!asset.ticker || !/^\d+$/.test(asset.ticker))) {
            const results = await priceService.search(asset.name);
            if (results && results.length > 0) {
              this.repo.updateVerificationStatus(asset.id, 'NEEDS_REVIEW');
              count++;
            }
          }
        }
      } catch (err: any) {
        logger.error(`[BulkEnrich] Failed for ${asset.ticker}: ${err.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // rate limiting
    }
    return count;
  }
}
