import { Request, Response } from 'express';
import PortfolioService from '../services/portfolio.service';
import { getUserDb, getGlobalDb } from '../models/db';
import asyncHandler from '../utils/asyncHandler';
import logger from '../utils/logger';

export default class PortfolioController {

  private getService(req: Request): PortfolioService {
    // @ts-ignore - req.user is added by auth middleware
    const username = req.user ? req.user.username : 'admin'; 
    const userDb = getUserDb(username);
    const globalDb = getGlobalDb();
    return new PortfolioService(userDb, globalDb, username);
  }

  // GET /api/portfolio
  getPortfolio = asyncHandler(async (req: Request, res: Response) => {
    const service = this.getService(req);
    const result = await service.getPortfolio();
    res.json(result);
  });

  // GET /api/portfolio/cached
  getCachedPortfolio = asyncHandler(async (req: Request, res: Response) => {
    const service = this.getService(req);
    const result = service.getCachedPortfolio();
    res.json(result);
  });

  // POST /api/portfolio/holdings
  addHolding = asyncHandler(async (req: Request, res: Response) => {
    const service = this.getService(req);
    const assetId = service.addOrUpdateHolding(req.body);
    res.status(201).json({ 
      message: 'Asset saved successfully', 
      id: assetId 
    });
  });

  // GET /api/portfolio/history
  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const service = this.getService(req);
    const history = await service.getHistory();
    res.json(history);
  });

  // GET /api/portfolio/settings
  getSettings = asyncHandler(async (req: Request, res: Response) => {
    const service = this.getService(req);
    const settings = service.getSettings();
    res.json(settings);
  });

  // POST /api/portfolio/settings
  saveSetting = asyncHandler(async (req: Request, res: Response) => {
    const service = this.getService(req);
    const { key, value } = req.body;
    service.saveSetting(key, value);
    res.json({ message: 'Setting saved' });
  });

  // POST /api/portfolio/import
  importBrokerData = asyncHandler(async (req: Request, res: Response) => {
    const { broker } = req.params;
    const multerReq = req as any; // Cast to access multer's .file property
    
    if (!multerReq.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const service = this.getService(req);
    const count = await service.importBrokerFile(broker as string, multerReq.file.path);
    res.json({ 
      message: `Successfully imported ${count} holdings`,
      count 
    });
  });

  // GET /api/portfolio/search
  searchSymbols = asyncHandler(async (req: Request, res: Response) => {
    const { q, type } = req.query;
    const service = this.getService(req);
    const results = await service.searchSymbols(q as string, type as string);
    res.json(results);
  });

  // GET /api/portfolio/search-mf
  getMFSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    const service = this.getService(req);
    const results = await service.getMFSuggestions(q as string);
    res.json(results);
  });

  // GET /api/portfolio/validate-ticker
  validateTicker = asyncHandler(async (req: Request, res: Response) => {
    const { ticker, type, currency } = req.query;
    const service = this.getService(req);
    const price = await service.validateTicker(ticker as string, type as string, currency as string);
    res.json({ price });
  });

  // POST /api/portfolio/apply-suggestion
  applySuggestion = asyncHandler(async (req: Request, res: Response) => {
    const { assetId } = req.body;
    const service = this.getService(req);
    const asset = service.applySuggestion(assetId);
    res.json({ message: 'Suggestion applied', asset });
  });

  // POST /api/portfolio/reject-suggestion
  ignoreSuggestion = asyncHandler(async (req: Request, res: Response) => {
    const { assetId } = req.body;
    const service = this.getService(req);
    service.rejectSuggestion(assetId);
    res.json({ message: 'Suggestion rejected' });
  });

  // POST /api/portfolio/bulk-enrich
  bulkEnrich = asyncHandler(async (req: Request, res: Response) => {
    const service = this.getService(req);
    const count = await service.performBulkEnrichment();
    res.json({ message: `Successfully triggered enrichment for ${count} assets` });
  });
}
