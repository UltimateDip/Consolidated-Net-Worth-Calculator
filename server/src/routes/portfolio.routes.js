const express = require('express');
const multer = require('multer');
const controller = require('../controllers/portfolio.controller');
const { validateSchema } = require('../middlewares/validate');
const { addHoldingSchema, saveSettingsSchema } = require('../validators/portfolio.validators');

const router = express.Router();
const upload = multer({ dest: '/tmp/' });

// Portfolio & History
router.get('/portfolio/cached', controller.getCachedPortfolio);
router.get('/portfolio', controller.getPortfolio);
router.get('/history', controller.getHistory);

// Settings
router.get('/settings', controller.getSettings);
router.post('/settings', validateSchema(saveSettingsSchema), controller.saveSettings);

// Holdings
router.post('/holdings', validateSchema(addHoldingSchema), controller.addHolding);

// Broker Import
router.post('/import/:broker', upload.single('file'), controller.importBrokerData);

// Symbol Search & Validation
router.get('/search-symbols', controller.searchSymbols);
router.get('/mf-suggestions', controller.getMFSuggestions);
router.get('/validate-ticker', controller.validateTicker);

// Name Suggestions
router.post('/assets/:id/apply-suggestion', controller.applySuggestion);
router.post('/assets/:id/ignore-suggestion', controller.ignoreSuggestion);

// Bulk Enrichment
router.post('/assets/bulk-enrich', controller.bulkEnrich);

module.exports = router;
