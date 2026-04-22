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
    return this.db.prepare('SELECT id FROM assets WHERE ticker = ?').get(ticker);
  }

  checkTickerCollision(ticker, excludeId) {
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

  getEnrichableAssets() {
    return this.db.prepare("SELECT id, ticker, type, name FROM assets WHERE type IN ('EQUITY', 'MF')").all();
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

  // ─── Price Cache ────────────────────────────────────────────

  upsertPriceCache(ticker, price) {
    this.db.prepare(`
      INSERT INTO price_cache (ticker, price, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP
    `).run(ticker, price);
  }

  // ─── Broker Import (Transactional) ─────────────────────────

  importBrokerResults(results, triggerEnrichmentFn) {
    const insertAsset = this.db.prepare('INSERT INTO assets (name, ticker, type, currency) VALUES (?, ?, ?, ?)');
    const insertHolding = this.db.prepare('INSERT INTO holdings_history (asset_id, units, price, entry_type) VALUES (?, ?, ?, ?)');
    const checkAsset = this.db.prepare('SELECT id FROM assets WHERE ticker = ?');
    const insertPriceCache = this.db.prepare('INSERT INTO price_cache (ticker, price, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP');

    this.db.transaction(() => {
      for (const item of results) {
        let asset = checkAsset.get(item.ticker);
        if (!asset) {
          const info = insertAsset.run(item.name, item.ticker, item.type, item.currency || 'INR');
          asset = { id: info.lastInsertRowid };
        }
        insertHolding.run(asset.id, item.units, item.price, 'UPDATE');

        if (item.currentPrice !== undefined && item.currentPrice !== null) {
          insertPriceCache.run(item.ticker, item.currentPrice);
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
          throw new Error('COLLISION');
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

      // Sync manual price override to cache (Global DB)
      if (manualPrice !== undefined) {
        require('../models/db').getGlobalDb().prepare(`
          INSERT INTO price_cache (ticker, manual_price, timestamp) 
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(ticker) DO UPDATE SET manual_price=excluded.manual_price, timestamp=CURRENT_TIMESTAMP
        `).run(ticker, manualPrice);
      }
      
      if (enrichFn && (type === 'EQUITY' || type === 'MF')) {
        enrichFn(assetId, ticker, type, name);
      }
    })();

    return assetId;
  }
}
module.exports = PortfolioRepository;
