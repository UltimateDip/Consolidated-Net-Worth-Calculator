const db = require('../models/db');
const logger = require('../utils/logger');

class PortfolioRepository {

  // ─── Settings ───────────────────────────────────────────────

  getSettings() {
    const rows = db.prepare('SELECT * FROM settings').all();
    const map = {};
    rows.forEach(s => map[s.key] = s.value);
    return map;
  }

  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  upsertSetting(key, value) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run(key, value);
  }

  // ─── Assets ─────────────────────────────────────────────────

  getAllAssetsWithLatestHoldings() {
    return db.prepare(`
      SELECT a.*, h.units as current_units, h.price as avg_price, h.timestamp as last_updated 
      FROM assets a 
      LEFT JOIN holdings_history h ON a.id = h.asset_id 
      WHERE h.id = (SELECT MAX(id) FROM holdings_history WHERE asset_id = a.id)
       AND h.units > 0
    `).all();
  }

  getAssetById(id) {
    return db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  }

  getAssetByTicker(ticker) {
    return db.prepare('SELECT id FROM assets WHERE ticker = ?').get(ticker);
  }

  checkTickerCollision(ticker, excludeId) {
    return db.prepare('SELECT id FROM assets WHERE ticker = ? AND id != ?').get(ticker, excludeId);
  }

  createAsset(name, ticker, type, currency, displayName) {
    const info = db.prepare('INSERT INTO assets (name, ticker, type, currency, display_name) VALUES (?, ?, ?, ?, ?)').run(name, ticker, type, currency, displayName);
    return info.lastInsertRowid;
  }

  updateAsset(id, name, ticker, type, currency, displayName) {
    db.prepare('UPDATE assets SET name = ?, ticker = ?, type = ?, currency = ?, display_name = ? WHERE id = ?')
      .run(name, ticker, type, currency, displayName, id);
  }

  updateAssetNameAndCurrency(id, name, currency) {
    db.prepare('UPDATE assets SET name = ?, currency = ? WHERE id = ?').run(name, currency, id);
  }

  getAssetWithSuggestion(id) {
    return db.prepare('SELECT name, suggested_name, ticker, suggested_ticker FROM assets WHERE id = ?').get(id);
  }

  applySuggestedName(id, newName, newTicker) {
    if (newTicker) {
      db.prepare('UPDATE assets SET name = ?, ticker = ?, suggested_name = NULL, suggested_ticker = NULL WHERE id = ?')
        .run(newName, newTicker, id);
    } else {
      db.prepare('UPDATE assets SET name = ?, suggested_name = NULL, suggested_ticker = NULL WHERE id = ?')
        .run(newName, id);
    }
  }

  clearSuggestedName(id) {
    db.prepare('UPDATE assets SET suggested_name = NULL WHERE id = ?').run(id);
  }

  updateSuggestedName(id, suggestedName) {
    db.prepare('UPDATE assets SET suggested_name = ? WHERE id = ?').run(suggestedName, id);
  }

  updateSuggestedNameAndTicker(id, suggestedName, suggestedTicker) {
    db.prepare('UPDATE assets SET suggested_name = ?, suggested_ticker = ? WHERE id = ?')
      .run(suggestedName, suggestedTicker, id);
  }

  getEnrichableAssets() {
    return db.prepare("SELECT id, ticker, type, name FROM assets WHERE type IN ('EQUITY', 'MF')").all();
  }

  // ─── Holdings History ───────────────────────────────────────

  insertHoldingHistory(assetId, units, price, currency, entryType = 'UPDATE') {
    db.prepare('INSERT INTO holdings_history (asset_id, units, price, currency, entry_type) VALUES (?, ?, ?, ?, ?)')
      .run(assetId, units, price, currency, entryType);
  }

  // ─── Snapshots ──────────────────────────────────────────────

  saveSnapshot(date, totalValue, baseCurrency, fxRatesJson) {
    db.prepare(`
      INSERT INTO networth_snapshots (date, total_value, base_currency, fx_rates) VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET total_value=excluded.total_value, base_currency=excluded.base_currency, fx_rates=excluded.fx_rates
    `).run(date, totalValue, baseCurrency, fxRatesJson);
  }

  getSnapshots(limit = 90) {
    return db.prepare(
      'SELECT date, total_value, base_currency, fx_rates FROM networth_snapshots ORDER BY date ASC LIMIT ?'
    ).all(limit);
  }

  // ─── Price Cache ────────────────────────────────────────────

  upsertPriceCache(ticker, price) {
    db.prepare(`
      INSERT INTO price_cache (ticker, price, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP
    `).run(ticker, price);
  }

  // ─── Broker Import (Transactional) ─────────────────────────

  importBrokerResults(results, triggerEnrichmentFn) {
    const insertAsset = db.prepare('INSERT INTO assets (name, ticker, type, currency) VALUES (?, ?, ?, ?)');
    const insertHolding = db.prepare('INSERT INTO holdings_history (asset_id, units, price, entry_type) VALUES (?, ?, ?, ?)');
    const checkAsset = db.prepare('SELECT id FROM assets WHERE ticker = ?');
    const insertPriceCache = db.prepare('INSERT INTO price_cache (ticker, price, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP');

    db.transaction(() => {
      for (const item of results) {
        let asset = checkAsset.get(item.ticker);
        if (!asset) {
          const info = insertAsset.run(item.name, item.ticker, item.type, item.currency || 'USD');
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

    const transaction = db.transaction(() => {
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

      // Sync manual price override to cache
      if (manualPrice !== undefined) {
        db.prepare(`
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

module.exports = new PortfolioRepository();
