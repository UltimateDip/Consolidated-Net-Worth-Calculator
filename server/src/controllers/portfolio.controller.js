const portfolioService = require('../services/portfolio.service');

class PortfolioController {

  // GET /api/portfolio
  async getPortfolio(req, res) {
    try {
      const result = await portfolioService.getPortfolio();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/history
  async getHistory(req, res) {
    try {
      const result = await portfolioService.getHistory();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/settings
  getSettings(req, res) {
    res.json(portfolioService.getSettings());
  }

  // POST /api/settings
  saveSettings(req, res) {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    portfolioService.saveSetting(key, value);
    res.json({ success: true });
  }

  // POST /api/holdings
  addHolding(req, res) {
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
      console.error('Failed to save holding:', err.message);
      res.status(500).json({ error: 'Internal server error while saving holding.' });
    }
  }

  // POST /api/import/:broker
  async importBrokerData(req, res) {
    if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });
    try {
      const count = await portfolioService.importBrokerFile(req.params.broker, req.file.path);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/search-symbols
  async searchSymbols(req, res) {
    const { q, type } = req.query;
    console.log(`[API] Symbol search: query="${q}", type="${type}"`);
    const results = await portfolioService.searchSymbols(q, type);
    res.json(results);
  }

  // GET /api/validate-ticker
  async validateTicker(req, res) {
    const { ticker, type, currency } = req.query;
    const price = await portfolioService.validateTicker(ticker, type, currency);
    res.json({ price });
  }

  // POST /api/assets/:id/apply-suggestion
  applySuggestion(req, res) {
    const { id } = req.params;
    const result = portfolioService.applySuggestion(id);
    if (result) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'No suggestion found' });
    }
  }

  // POST /api/assets/:id/ignore-suggestion
  ignoreSuggestion(req, res) {
    const { id } = req.params;
    portfolioService.ignoreSuggestion(id);
    res.json({ success: true });
  }

  // POST /api/assets/bulk-enrich
  async bulkEnrich(req, res) {
    try {
      const count = await portfolioService.startBulkEnrichment();
      res.json({
        success: true,
        message: `Enrichment started for ${count} assets. Names will appear in your holdings list as they are found.`
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PortfolioController();
