const PortfolioService = require('../services/portfolio.service');
const { getUserDb } = require('../models/db');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

class PortfolioController {

  getService(req) {
    const username = req.user ? req.user.username : 'admin'; // fallback for dev
    const userDb = getUserDb(username);
    return new PortfolioService(userDb, username);
  }

  // GET /api/portfolio
  getPortfolio = asyncHandler(async (req, res) => {
    const result = await this.getService(req).getPortfolio();
    logger.debug('[PortfolioController] Fetched portfolio for base currency: %s', result.baseCurrency);
    res.json(result);
  });

  // GET /api/portfolio/cached — instant response, no external API calls
  getCachedPortfolio = asyncHandler((req, res) => {
    const result = this.getService(req).getCachedPortfolio();
    logger.debug('[PortfolioController] Served cached portfolio for base currency: %s', result.baseCurrency);
    res.json(result);
  });

  // GET /api/history
  getHistory = asyncHandler(async (req, res) => {
    const result = await this.getService(req).getHistory();
    res.json(result);
  });

  // GET /api/settings
  getSettings = asyncHandler((req, res) => {
    res.json(this.getService(req).getSettings());
  });

  // POST /api/settings
  saveSettings = asyncHandler((req, res) => {
    const { key, value } = req.body;
    if (!key) {
      const error = new Error('Key required');
      error.status = 400;
      throw error;
    }
    this.getService(req).saveSetting(key, value);
    res.json({ success: true });
  });

  // POST /api/holdings
  addHolding = asyncHandler(async (req, res) => {
    const { id, name, ticker, type, units, price, currency, manualPrice, displayName } = req.body;
    
    logger.info('[PortfolioController] Adding/Updating holding: %s (%s)', name, ticker || 'CASH');
    logger.debug('[PortfolioController] Payload:', { id, type, units, price, currency, manualPrice, displayName });

    try {
      const assetId = await this.getService(req).addOrUpdateHolding({ id, name, ticker, type, units, price, currency, manualPrice, displayName });
      logger.info('[PortfolioController] Successfully saved asset ID: %d', assetId);
      res.json({ success: true, id: assetId });
    } catch (err) {
      if (err.message === 'COLLISION') {
        return res.status(409).json({ error: 'An asset with this ticker or name already exists.' });
      }
      if (err.message === 'TICKER_REQUIRED') {
        return res.status(400).json({ error: 'Ticker is required for this asset type' });
      }
      throw err;
    }
  });

  // POST /api/import/:broker
  importBrokerData = asyncHandler(async (req, res) => {
    if (!req.file) {
      const error = new Error('No CSV file provided');
      error.status = 400;
      throw error;
    }
    const count = await this.getService(req).importBrokerFile(req.params.broker, req.file.path);
    res.json({ success: true, count });
  });

  // GET /api/search-symbols
  searchSymbols = asyncHandler(async (req, res) => {
    const { q, type } = req.query;
    const results = await this.getService(req).searchSymbols(q, type);
    res.json(results);
  });

  // GET /api/validate-ticker
  validateTicker = asyncHandler(async (req, res, next) => {
    try {
      const { ticker, type, currency } = req.query;
      logger.debug('[PortfolioController] Validating ticker: %s (%s) in %s', ticker, type, currency);
      const price = await this.getService(req).validateTicker(ticker, type, currency);
      res.json({ price });
    } catch (error) {
      logger.error('[PortfolioController] Ticker validation failed: %s', error.message);
      next(error);
    }
  });

  // POST /api/assets/:id/apply-suggestion
  applySuggestion = asyncHandler((req, res) => {
    const { id } = req.params;
    const result = this.getService(req).applySuggestion(id);
    if (result) {
      res.json({ success: true });
    } else {
      const error = new Error('No suggestion found');
      error.status = 404;
      throw error;
    }
  });

  // POST /api/assets/:id/ignore-suggestion
  ignoreSuggestion = asyncHandler((req, res) => {
    const { id } = req.params;
    this.getService(req).rejectSuggestion(id); // NOTE: Fixed method name from ignore to reject based on service
    res.json({ success: true });
  });

  // POST /api/assets/bulk-enrich
  bulkEnrich = asyncHandler(async (req, res) => {
    const count = await this.getService(req).performBulkEnrichment(); // NOTE: Fixed method to match service
    res.json({
      success: true,
      message: `Enrichment started for ${count} assets. Names will appear in your holdings list as they are found.`
    });
  });
}

module.exports = new PortfolioController();
