const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let globalDbInstance = null;
const userDbConnections = {}; // Simple memoization for open tenant connections

function getGlobalDb() {
  if (globalDbInstance) return globalDbInstance;
  
  const dbPath = path.join(dataDir, 'global.sqlite');
  const db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS price_cache (
      ticker TEXT PRIMARY KEY,
      price REAL,
      name TEXT,
      manual_price REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS search_cache (
      query TEXT PRIMARY KEY,
      results TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fx_rates (
      date TEXT,
      currency TEXT,
      rate REAL,
      PRIMARY KEY (date, currency)
    );
  `);
  
  // Migrations: Add name column to price_cache if it doesn't exist
  try {
    db.prepare('ALTER TABLE price_cache ADD COLUMN name TEXT').run();
  } catch (e) {
    // Column already exists, ignore
  }

  globalDbInstance = db;
  return globalDbInstance;
}

function getUserDb(username) {
  if (!username) {
    throw new Error('Username required to access tenant database.');
  }

  // Use cached connection if already open
  if (userDbConnections[username]) {
    return userDbConnections[username];
  }

  const userDir = path.join(dataDir, username);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const dbPath = path.join(userDir, 'portfolio.sqlite');
  const db = new Database(dbPath);

  // Initialize tenant schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ticker TEXT,
      type TEXT NOT NULL,
      units REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      suggested_name TEXT,
      suggested_ticker TEXT,
      display_name TEXT,
      verification_status TEXT DEFAULT 'UNVERIFIED'
    );
    CREATE TABLE IF NOT EXISTS holdings_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      units REAL NOT NULL,
      price REAL,
      currency TEXT,
      entry_type TEXT DEFAULT 'UPDATE',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS networth_snapshots (
      date TEXT PRIMARY KEY,
      total_value REAL,
      base_currency TEXT
    );
  `);

  // Migrations: Add verification_status if it doesn't exist
  try {
    db.exec("ALTER TABLE assets ADD COLUMN verification_status TEXT DEFAULT 'UNVERIFIED'");
  } catch (e) {
    // Column already exists, ignore
  }

  logger.info(`[DatabaseManager] Initialized connection for tenant: ${username}`);
  userDbConnections[username] = db;
  return db;
}

module.exports = {
  getGlobalDb,
  getUserDb
};
