import logger from '../utils/logger';

/**
 * PortfolioRepository — A "dumb" data access layer.
 *
 * This class provides atomic, raw SQL operations for the portfolio domain.
 * It NEVER performs business logic.
 */
export default class PortfolioRepository {
  private db: any;
  private globalDb: any;

  constructor(userDb: any, globalDb: any) {
    this.db = userDb;
    this.globalDb = globalDb;
  }

  // ─── Settings ───────────────────────────────────────────────

  getSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT * FROM settings').all();
    const map: Record<string, string> = {};
    rows.forEach((s: any) => map[s.key] = s.value);
    return map;
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  upsertSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run(key, value);
  }

  // ─── Assets ─────────────────────────────────────────────────

  getAllAssetsWithLatestHoldings(): any[] {
    return this.db.prepare(`
      SELECT a.*, h.units as current_units, h.price as avg_price, h.timestamp as last_updated 
      FROM assets a 
      LEFT JOIN holdings_history h ON a.id = h.asset_id 
      WHERE h.id = (SELECT MAX(id) FROM holdings_history WHERE asset_id = a.id)
       AND h.units > 0
    `).all();
  }

  getAssetById(id: number): any {
    return this.db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  }

  getAssetByTicker(ticker: string | null): any {
    if (!ticker) return null;
    return this.db.prepare('SELECT id FROM assets WHERE ticker = ?').get(ticker);
  }

  getAssetByName(name: string): any {
    return this.db.prepare('SELECT id FROM assets WHERE name = ? AND ticker IS NULL').get(name);
  }

  getAssetLatestUnits(id: number): number {
    const row = this.db.prepare('SELECT units FROM holdings_history WHERE asset_id = ? ORDER BY id DESC LIMIT 1').get(id);
    return row ? row.units : 0;
  }

  checkTickerCollision(ticker: string | null, excludeId: number): any {
    if (!ticker) return null;
    return this.db.prepare('SELECT id FROM assets WHERE ticker = ? AND id != ?').get(ticker, excludeId);
  }

  createAsset(name: string, ticker: string | null, type: string, currency: string, displayName?: string): number {
    const info = this.db.prepare('INSERT INTO assets (name, ticker, type, currency, display_name) VALUES (?, ?, ?, ?, ?)').run(name, ticker, type, currency, displayName || null);
    return info.lastInsertRowid;
  }

  updateAsset(id: number, name: string, ticker: string | null, type: string, currency: string, displayName?: string): void {
    this.db.prepare('UPDATE assets SET name = ?, ticker = ?, type = ?, currency = ?, display_name = ? WHERE id = ?')
      .run(name, ticker, type, currency, displayName || null, id);
  }

  deleteAsset(id: number): void {
    this.db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  }

  updateAssetNameAndCurrency(id: number, name: string, currency: string): void {
    this.db.prepare('UPDATE assets SET name = ?, currency = ? WHERE id = ?').run(name, currency, id);
  }

  getAssetWithSuggestion(id: number): any {
    return this.db.prepare('SELECT name, suggested_name, ticker, suggested_ticker FROM assets WHERE id = ?').get(id);
  }

  applySuggestedName(id: number, newName: string, newTicker?: string): void {
    if (newTicker) {
      this.db.prepare('UPDATE assets SET name = ?, ticker = ?, suggested_name = NULL, suggested_ticker = NULL WHERE id = ?')
        .run(newName, newTicker, id);
    } else {
      this.db.prepare('UPDATE assets SET name = ?, suggested_name = NULL, suggested_ticker = NULL WHERE id = ?')
        .run(newName, id);
    }
  }

  clearSuggestedName(id: number): void {
    this.db.prepare('UPDATE assets SET suggested_name = NULL WHERE id = ?').run(id);
  }

  clearSuggestedTicker(id: number): void {
    this.db.prepare('UPDATE assets SET suggested_ticker = NULL WHERE id = ?').run(id);
  }

  updateSuggestedName(id: number, suggestedName: string): void {
    this.db.prepare('UPDATE assets SET suggested_name = ? WHERE id = ?').run(suggestedName, id);
  }

  updateSuggestedNameAndTicker(id: number, suggestedName: string, suggestedTicker: string): void {
    this.db.prepare('UPDATE assets SET suggested_name = ?, suggested_ticker = ? WHERE id = ?')
      .run(suggestedName, suggestedTicker, id);
  }

  updateVerificationStatus(id: number, status: string): void {
    this.db.prepare('UPDATE assets SET verification_status = ? WHERE id = ?').run(status, id);
  }

  getEnrichableAssets(): any[] {
    return this.db.prepare("SELECT id, ticker, type, name, verification_status FROM assets WHERE type IN ('EQUITY', 'MF')").all();
  }

  // ─── Holdings History ───────────────────────────────────────

  insertHoldingHistory(assetId: number, units: number, price: number | null, currency: string, entryType: string = 'UPDATE'): void {
    this.db.prepare('INSERT INTO holdings_history (asset_id, units, price, currency, entry_type) VALUES (?, ?, ?, ?, ?)')
      .run(assetId, units, price, currency, entryType);
  }

  // ─── Price Cache (Global DB) ───────────────────────────────

  syncManualPrice(ticker: string | null, manualPrice: number | undefined, type: string): void {
    if (manualPrice !== undefined && type !== 'CASH' && ticker) {
      this.globalDb.prepare(`
        INSERT INTO price_cache (ticker, manual_price, timestamp) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(ticker) DO UPDATE SET manual_price=excluded.manual_price, timestamp=CURRENT_TIMESTAMP
      `).run(ticker, manualPrice);
    }
  }

  syncPriceCache(ticker: string, price: number): void {
    this.globalDb.prepare(
      'INSERT INTO price_cache (ticker, price, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ticker) DO UPDATE SET price=excluded.price, timestamp=CURRENT_TIMESTAMP'
    ).run(ticker, price);
  }

  // ─── Snapshots ──────────────────────────────────────────────

  saveSnapshot(date: string, totalValue: number, baseCurrency: string): void {
    this.db.prepare(`
      INSERT INTO networth_snapshots (date, total_value, base_currency) VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET total_value=excluded.total_value, base_currency=excluded.base_currency
    `).run(date, totalValue, baseCurrency);
  }

  getSnapshots(limit: number = 90): any[] {
    return this.db.prepare(
      'SELECT date, total_value, base_currency FROM networth_snapshots ORDER BY date ASC LIMIT ?'
    ).all(limit);
  }

  // ─── Transaction Helper ─────────────────────────────────────

  runTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
