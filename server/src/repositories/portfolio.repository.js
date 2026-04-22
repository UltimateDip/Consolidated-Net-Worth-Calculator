const logger = require('../utils/logger');

class PortfolioRepository {
  constructor(userDb) {
    this.db = userDb;
  }

  // ─── Settings ───────────────────────────────────────────────

  getSettings() {
    const rows = this.db.prepare('SELECT * FROM settings').all();
    const map = {};
    rows.forEach(s => map[s.key] = s.value);
    return map;
  }

  getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  upsertSetting(key, value) {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run(key, value);
  }

  // ─── Assets ─────────────────────────────────────────────────

  getAllAssetsWithLatestHoldings() {
    return this.db.prepare(`
      SELECT a.*, h.units as current_units, h.price as avg_price, h.timestamp as last_updated 
      FROM assets a 
      LEFT JOIN holdings_history h ON a.id = h.asset_id 
      WHERE h.id = (SELECT MAX(id) FROM holdings_history WHERE asset_id = a.id)
       AND h.units > 0
    `).all();
  }

  getAssetById(id) {
    return this.db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  }

  getAssetByTicker(ticker) {
    if (!ticker) return null;
    return this.db.prepare('SELECT id FROM assets WHERE ticker = ?').get(ticker);
  }

  getAssetLatestUnits(id) {
    const row = this.db.prepare('SELECT units FROM holdings_history WHERE asset_id = ? ORDER BY id DESC LIMIT 1').get(id);
    return row ? row.units : 0;
  }

  checkTickerCollision(ticker, excludeId) {
    if (!ticker) return null;
    return this.db.prepare('SELECT id FROM assets WHERE ticker = ? AND id != ?').get(ticker, excludeId);
  }

  createAsset(name, ticker, type, currency, displayName) {
    const info = this.db.prepare('INSERT INTO assets (name, ticker, type, currency, display_name) VALUES (?, ?, ?, ?, ?)').run(name, ticker, type, currency, displayName);
    return info.lastInsertRowid;
  }

  updateAsset(id, name, ticker, type, currency, displayName) {
    this.db.prepare('UPDATE assets SET name = ?, ticker = ?, type = ?, currency = ?, display_name = ? WHERE id = ?')
      .run(name, ticker, type, currency, displayName, id);
  }

  deleteAsset(id) {
    this.db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  }

  updateAssetNameAndCurrency(id, name, currency) {
    this.db.prepare('UPDATE assets SET name = ?, currency = ? WHERE id = ?').run(name, currency, id);
  }

  getAssetWithSuggestion(id) {
    return this.db.prepare('SELECT name, suggested_name, ticker, suggested_ticker FROM assets WHERE id = ?').get(id);
  }

  applySuggestedName(id, newName, newTicker) {
    if (newTicker) {
      this.db.prepare('UPDATE assets SET name = ?, ticker = ?, suggested_name = NULL, suggested_ticker = NULL WHERE id = ?')
        .run(newName, newTicker, id);
    } else {
      this.db.prepare('UPDATE assets SET name = ?, suggested_name = NULL, suggested_ticker = NULL WHERE id = ?')
        .run(newName, id);
    }
  }

  clearSuggestedName(id) {
    this.db.prepare('UPDATE assets SET suggested_name = NULL WHERE id = ?').run(id);
  }

  updateSuggestedName(id, suggestedName) {
    this.db.prepare('UPDATE assets SET suggested_name = ? WHERE id = ?').run(suggestedName, id);
  }

  updateSuggestedNameAndTicker(id, suggestedName, suggestedTicker) {
    this.db.prepare('UPDATE assets SET suggested_name = ?, suggested_ticker = ? WHERE id = ?')
      .run(suggestedName, suggestedTicker, id);
  }

  updateVerificationStatus(id, status) {
    this.db.prepare('UPDATE assets SET verification_status = ? WHERE id = ?').run(status, id);
  }

  getEnrichableAssets() {
    return this.db.prepare("SELECT id, ticker, type, name, verification_status FROM assets WHERE type IN ('EQUITY', 'MF')").all();
  }

  // ─── Holdings History ───────────────────────────────────────

  insertHoldingHistory(assetId, units, price, currency, entryType = 'UPDATE') {
    this.db.prepare('INSERT INTO holdings_history (asset_id, units, price, currency, entry_type) VALUES (?, ?, ?, ?, ?)')
      .run(assetId, units, price, currency, entryType);
  }

  // ─── Snapshots ──────────────────────────────────────────────

  saveSnapshot(date, totalValue, baseCurrency) {
    this.db.prepare(`
      INSERT INTO networth_snapshots (date, total_value, base_currency) VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET total_value=excluded.total_value, base_currency=excluded.base_currency
    `).run(date, totalValue, baseCurrency);
  }

  getSnapshots(limit = 90) {
    return this.db.prepare(
      'SELECT date, total_value, base_currency FROM networth_snapshots ORDER BY date ASC LIMIT ?'
    ).all(limit);
  }

  // ─── Broker Import (Transactional) ─────────────────────────

  importBrokerResults(results, triggerEnrichmentFn) {
    const { getGlobalDb } = require('../models/db');
    const globalDb = getGlobalDb();

    const insertAsset = this.db.prepare('INSERT INTO assets (name, ticker, type, currency) VALUES (?, ?, ?, ?)');
    const insertHolding = this.db.prepare('INSERT INTO holdings_history (asset_id, units, price, entry_type) VALUES (?, ?, ?, ?)');
    const checkAssetByTicker = this.db.prepare('SELECT id FROM assets WHERE ticker = ?');
    const checkAssetByName = this.db.prepare('SELECT id FROM assets WHERE name = ? AND ticker IS NULL');
    const insertPriceCache = globalDb.prepare('INSERT INTO price_cache (ticker, price, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP');

    this.db.transaction(() => {
      for (const item of results) {
        let asset = null;
        if (item.ticker) {
          asset = checkAssetByTicker.get(item.ticker);
        } else {
          asset = checkAssetByName.get(item.name);
        }

        if (!asset) {
          const info = insertAsset.run(item.name, item.ticker, item.type, item.currency || 'INR');
          asset = { id: info.lastInsertRowid };
        }
        insertHolding.run(asset.id, item.units, item.price, 'UPDATE');

        // Update global price cache - Skip for CASH and NULL tickers
        if (item.type !== 'CASH' && item.price && item.ticker) {
          insertPriceCache.run(item.ticker, item.price);
        }
        
        if (triggerEnrichmentFn && (item.type === 'EQUITY' || item.type === 'MF')) {
          triggerEnrichmentFn(asset.id, item.ticker, item.type, item.name);
        }
      }
    })();
  }

  // ─── Manual Holding Upsert (Transactional) ─────────────────

  upsertHolding({ id, name, ticker, type, units, price, currency, manualPrice, displayName }, enrichFn) {
    let assetId = id;

    const transaction = this.db.transaction(() => {
      logger.debug('[PortfolioRepository] Starting upsert for %s (%s)', name, ticker);
      if (assetId) {
        const collision = this.checkTickerCollision(ticker, assetId);
        if (collision) {
          logger.info(`[Merge] Ticker collision detected for ${ticker}. Merging asset ${collision.id} into ${assetId}`);
          
          // 1. Get units from the existing asset that already uses this ticker
          const existingUnits = this.getAssetLatestUnits(collision.id);
          
          // 2. Sum them with the new units
          const totalUnits = existingUnits + units;
          
          // 3. Update current asset with verified name/ticker
          this.updateAsset(assetId, name, ticker, type, currency, displayName);
          
          // 4. Save combined units
          this.insertHoldingHistory(assetId, totalUnits, price, currency, 'MERGE');
          
          // 5. Delete the duplicate
          this.deleteAsset(collision.id);
          
          // 6. Mark as verified
          this.updateVerificationStatus(assetId, 'VERIFIED');
          
          // Finish transaction early for merge case
          this.syncManualPrice(ticker, manualPrice, type);
          return;
        }
        this.updateAsset(assetId, name, ticker, type, currency, displayName);
      } else {
        const existing = this.getAssetByTicker(ticker);
        if (existing) {
          assetId = existing.id;
          this.updateAsset(assetId, name, ticker, type, currency, displayName);
        } else {
          assetId = this.createAsset(name, ticker, type, currency, displayName);
        }
      }

      this.insertHoldingHistory(assetId, units, price, currency, 'UPDATE');
      this.syncManualPrice(ticker, manualPrice, type);
      
      // Mark as VERIFIED since this was a manual user action
      this.updateVerificationStatus(assetId, 'VERIFIED');

      // Auto-verify if ticker is a valid numeric code for MF (extra cleanup)
      if (type === 'MF' && /^\d+$/.test(ticker)) {
        this.updateVerificationStatus(assetId, 'VERIFIED');
        // Final purge of any suggested placeholders
        this.db.prepare('UPDATE assets SET suggested_ticker = NULL WHERE id = ?').run(assetId);
      }
      
      if (enrichFn && (type === 'EQUITY' || type === 'MF')) {
        enrichFn(assetId, ticker, type, name);
      }
    })();

    return assetId;
  }

  syncManualPrice(ticker, manualPrice, type) {
    if (manualPrice !== undefined && type !== 'CASH') {
      const globalDb = require('../models/db').getGlobalDb();
      globalDb.prepare(`
        INSERT INTO price_cache (ticker, manual_price, timestamp) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(ticker) DO UPDATE SET manual_price=excluded.manual_price, timestamp=CURRENT_TIMESTAMP
      `).run(ticker, manualPrice);
    }
  }
}
module.exports = PortfolioRepository;
