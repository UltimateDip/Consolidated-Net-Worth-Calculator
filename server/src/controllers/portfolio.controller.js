const portfolioService = require('../services/portfolio.service');
const asyncHandler = require('../utils/asyncHandler');

class PortfolioController {

  // GET /api/portfolio
  getPortfolio = asyncHandler(async (req, res) => {
    const result = await portfolioService.getPortfolio();
    res.json(result);
  });

  // GET /api/history
  getHistory = asyncHandler(async (req, res) => {
    const result = await portfolioService.getHistory();
    res.json(result);
  });

  // GET /api/settings
  getSettings = asyncHandler((req, res) => {
    res.json(portfolioService.getSettings());
  });

  // POST /api/settings
  saveSettings = asyncHandler((req, res) => {
    const { key, value } = req.body;
    if (!key) {
      const error = new Error('Key required');
      error.status = 400;
      throw error;
    }
    portfolioService.saveSetting(key, value);
    res.json({ success: true });
  });

  // POST /api/holdings
  addHolding = asyncHandler((req, res) => {
    const { id, name, ticker, type, units, price, currency } = req.body;
    try {
      const assetId = portfolioService.addOrUpdateHolding({ id, name, ticker, type, units, price, currency });
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
    const count = await portfolioService.importBrokerFile(req.params.broker, req.file.path);
    res.json({ success: true, count });
  });

  // GET /api/search-symbols
  searchSymbols = asyncHandler(async (req, res) => {
    const { q, type } = req.query;
    console.log(`[API] Symbol search: query="${q}", type="${type}"`);
    const results = await portfolioService.searchSymbols(q, type);
    res.json(results);
  });

  // GET /api/validate-ticker
  validateTicker = asyncHandler(async (req, res) => {
    const { ticker, type, currency } = req.query;
    const price = await portfolioService.validateTicker(ticker, type, currency);
    res.json({ price });
  });

  // POST /api/assets/:id/apply-suggestion
  applySuggestion = asyncHandler((req, res) => {
    const { id } = req.params;
    const result = portfolioService.applySuggestion(id);
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
    portfolioService.ignoreSuggestion(id);
    res.json({ success: true });
  });

  // POST /api/assets/bulk-enrich
  bulkEnrich = asyncHandler(async (req, res) => {
    const count = await portfolioService.startBulkEnrichment();
    res.json({
      success: true,
      message: `Enrichment started for ${count} assets. Names will appear in your holdings list as they are found.`
    });
  });
}

module.exports = new PortfolioController();
