const express = require('express');
const multer = require('multer');
const db = require('../models/db');
const priceService = require('../services/PriceService');
const currencyService = require('../services/CurrencyService');
const { BrokerParserFactory } = require('../services/BrokerParser');

const router = express.Router();
const upload = multer({ dest: '/tmp/' });

// Helper to fetch official name in background
async function triggerAssetEnrichment(assetId, ticker) {
  try {
    const profile = await priceService.fetchProfile(ticker);
    if (profile && profile.name) {
      db.prepare('UPDATE assets SET suggested_name = ? WHERE id = ?').run(profile.name, assetId);
    }
  } catch (err) {
    console.error(`Failed to enrich asset ${ticker}:`, err.message);
  }
}

// GET base currency and portfolio summary
router.get('/portfolio', async (req, res) => {
  try {
    const baseCurrency = db.prepare('SELECT value FROM settings WHERE key = ?').get('BASE_CURRENCY')?.value || 'USD';
    const assets = db.prepare(`
      SELECT a.*, h.units as current_units, h.price as avg_price, h.timestamp as last_updated 
      FROM assets a 
      LEFT JOIN holdings_history h ON a.id = h.asset_id 
      WHERE h.id = (SELECT MAX(id) FROM holdings_history WHERE asset_id = a.id)
       AND h.units > 0
    `).all();

    // --- Phase 1: Fetch all live prices concurrently ---
    const pricePromises = assets.map(asset => {
      if (['EQUITY', 'MF', 'CRYPTO', 'GOLD', 'SILVER'].includes(asset.type)) {
        const priceType = (asset.type === 'GOLD' && asset.ticker.startsWith('SGB')) ? 'EQUITY' : asset.type;
        return priceService.fetchPrice(asset.ticker, priceType, asset.currency)
          .catch(err => {
            console.error(`[Portfolio] Price fetch failed for ${asset.ticker}:`, err.message);
            return null; // Graceful fallback — use avg_price
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
          .catch(() => ({ cur, rate: 1 })) // Fallback to 1:1 if FX fails
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

    // Save a daily snapshot for the historical graph
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO networth_snapshots (date, total_value, base_currency) VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET total_value=excluded.total_value, base_currency=excluded.base_currency
    `).run(today, totalNetWorth, baseCurrency);

    res.json({ baseCurrency, totalNetWorth, assets: enrichedAssets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET historical portfolio snapshots (normalised to current base currency)
router.get('/history', async (req, res) => {
  try {
    const baseCurrency = db.prepare('SELECT value FROM settings WHERE key = ?').get('BASE_CURRENCY')?.value || 'USD';
    const snapshots = db.prepare(
      'SELECT date, total_value, base_currency FROM networth_snapshots ORDER BY date ASC LIMIT 90'
    ).all();

    // Identify which past snapshots were saved in a different currency
    const foreignCurrencies = [...new Set(
      snapshots.map(s => s.base_currency).filter(c => c && c !== baseCurrency)
    )];

    // Pre-fetch FX rates for all unique foreign currencies concurrently
    const fxRateMap = {};
    if (foreignCurrencies.length > 0) {
      const fxPromises = foreignCurrencies.map(cur =>
        currencyService.getExchangeRate(cur, baseCurrency)
          .then(rate => ({ cur, rate }))
          .catch(() => ({ cur, rate: 1 }))
      );
      const fxResults = await Promise.all(fxPromises);
      fxResults.forEach(({ cur, rate }) => { fxRateMap[cur] = rate; });
    }

    // Normalise all snapshots to the current base currency
    const normalised = snapshots.map(s => {
      const snapshotCurrency = s.base_currency || baseCurrency;
      const rate = snapshotCurrency === baseCurrency ? 1 : (fxRateMap[snapshotCurrency] || 1);
      return {
        date: s.date,
        total_value: s.total_value * rate,
        base_currency: baseCurrency,
      };
    });

    res.json(normalised);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET settings
router.get('/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const settingsMap = {};
  settings.forEach(s => settingsMap[s.key] = s.value);
  res.json(settingsMap);
});

// POST save settings
router.post('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, value);
  res.json({ success: true });
});

// POST manual entry
router.post('/holdings', (req, res) => {
  let { id, name, ticker, type, units, price, currency } = req.body;

  // Auto-generate missing tickers based on type
  if (!ticker || ticker.trim() === '') {
      if (type === 'CASH') {
          ticker = `CASH_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      } else if (type === 'GOLD') {
          ticker = 'XAU';
      } else if (type === 'SILVER') {
          ticker = 'XAG';
      } else {
          return res.status(400).json({ error: 'Ticker is required for this asset type' });
      }
  }

  // Auto-ensure price = 1 for CASH if undefined
  if (type === 'CASH' && (!price || isNaN(parseFloat(price)))) {
      price = 1;
  }
  
  try {
    let assetId = id;
    
    db.transaction(() => {
      if (assetId) {
        // EXPLICIT UPDATE: Check for collisions with other assets
        const collision = db.prepare('SELECT id FROM assets WHERE ticker = ? AND id != ?').get(ticker, assetId);
        if (collision) {
          throw new Error('COLLISION');
        }
        db.prepare('UPDATE assets SET name = ?, ticker = ?, type = ?, currency = ? WHERE id = ?')
          .run(name, ticker, type, currency || 'USD', assetId);
      } else {
        // NEW or IMPLICIT UPDATE (by ticker)
        let existing = db.prepare('SELECT id FROM assets WHERE ticker = ?').get(ticker);
        if (existing) {
          assetId = existing.id;
          // Sync name if it has changed in the form
          db.prepare('UPDATE assets SET name = ?, currency = ? WHERE id = ?').run(name, currency || 'USD', assetId);
        } else {
          const info = db.prepare('INSERT INTO assets (name, ticker, type, currency) VALUES (?, ?, ?, ?)').run(name, ticker, type, currency || 'USD');
          assetId = info.lastInsertRowid;
        }
      }

      // Update holding history
      db.prepare('INSERT INTO holdings_history (asset_id, units, price, currency, entry_type) VALUES (?, ?, ?, ?, ?)')
        .run(assetId, units, price, currency || 'USD', 'UPDATE');

      // Trigger background enrichment if equity
      if (type === 'EQUITY' && ticker) {
        triggerAssetEnrichment(assetId, ticker);
      }
    })();

    res.json({ success: true, id: assetId });
  } catch (err) {
    if (err.message === 'COLLISION') {
      return res.status(409).json({ error: 'An asset with this ticker or name already exists.' });
    }
    console.error('Failed to save holding:', err.message);
    res.status(500).json({ error: 'Internal server error while saving holding.' });
  }
});

// POST broker import
router.post('/import/:broker', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });
  
  try {
    const parser = BrokerParserFactory.getParser(req.params.broker);
    const results = await parser.parse(req.file.path);
    
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
        // Update current holding directly (cost basis / qty)
        insertHolding.run(asset.id, item.units, item.price, 'UPDATE');

        // Populate price cache manually if the broker sheet provided the current market value
        if (item.currentPrice !== undefined && item.currentPrice !== null) {
            insertPriceCache.run(item.ticker, item.currentPrice);
        }

        // Trigger background name enrichment if it's an equity
        if (item.type === 'EQUITY') {
          triggerAssetEnrichment(asset.id, item.ticker);
        }
      }
    })();

    res.json({ success: true, count: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Symbol Search (powered by cache + Finnhub + MFAPI)
router.get('/search-symbols', async (req, res) => {
  const { q, type } = req.query;
  console.log(`[API] Symbol search: query="${q}", type="${type}"`);
  const results = await priceService.searchSymbols(q, type);
  res.json(results);
});

// Ticker Validation (Price Fetch)
router.get('/validate-ticker', async (req, res) => {
  const { ticker, type, currency } = req.query;
  const price = await priceService.fetchPrice(ticker, type, currency);
  res.json({ price });
});

// Apply suggested name
router.post('/assets/:id/apply-suggestion', (req, res) => {
  const { id } = req.params;
  console.log(`[API] Applying suggestion for asset ${id}`);
  const asset = db.prepare('SELECT name, suggested_name FROM assets WHERE id = ?').get(id);
  
  if (asset && asset.suggested_name) {
    console.log(`[API] Updating name from "${asset.name}" to "${asset.suggested_name}"`);
    db.prepare('UPDATE assets SET name = ?, suggested_name = NULL WHERE id = ?').run(asset.suggested_name, id);
    res.json({ success: true });
  } else {
    console.error(`[API] No suggestion found for asset ${id}`);
    res.status(404).json({ error: 'No suggestion found' });
  }
});

// Ignore suggested name
router.post('/assets/:id/ignore-suggestion', (req, res) => {
  const { id } = req.params;
  console.log(`[API] Ignoring suggestion for asset ${id}`);
  db.prepare('UPDATE assets SET suggested_name = NULL WHERE id = ?').run(id);
  res.json({ success: true });
});

// Bulk Enrichment: Request names for all stocks missing suggestions
router.post('/assets/bulk-enrich', async (req, res) => {
  try {
    const assets = db.prepare("SELECT id, ticker FROM assets WHERE type = 'EQUITY'").all();
    console.log(`[API] Starting bulk enrichment for ${assets.length} items`);
    
    // Process in background to prevent timeout
    (async () => {
      for (const asset of assets) {
        await triggerAssetEnrichment(asset.id, asset.ticker);
        // Sleep 500ms between calls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500)); 
      }
      console.log(`[API] Bulk enrichment completed`);
    })();

    res.json({ 
      success: true, 
      message: `Enrichment started for ${assets.length} assets. Names will appear in your holdings list as they are found.` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
