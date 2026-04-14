const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'networth.sqlite');
const db = new Database(dbPath);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ticker TEXT,
      type TEXT NOT NULL, -- EQUITY, MF, CRYPTO, GOLD, CASH, SILVER, OTHER
      units REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD'
    );

    CREATE TABLE IF NOT EXISTS holdings_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      units REAL NOT NULL,
      price REAL,
      currency TEXT,
      entry_type TEXT DEFAULT 'UPDATE', -- UPDATE, BUY, SELL
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_cache (
      ticker TEXT PRIMARY KEY,
      price REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS networth_snapshots (
      date TEXT PRIMARY KEY,
      total_value REAL,
      base_currency TEXT
    );

    CREATE TABLE IF NOT EXISTS search_cache (
      query TEXT PRIMARY KEY,
      results TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add suggested_name to assets if it doesn't exist
  const tableInfo = db.prepare("PRAGMA table_info(assets)").all();
  if (!tableInfo.some(col => col.name === 'suggested_name')) {
    db.exec("ALTER TABLE assets ADD COLUMN suggested_name TEXT");
  }
}

initDb();

module.exports = db;
