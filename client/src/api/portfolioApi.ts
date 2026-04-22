import axiosClient from './axiosClient';
import { Asset, PortfolioHistory, Settings, PortfolioSummary } from '../types';

// --- Auth APIs ---
export const registerUser = (data: any): Promise<any> => axiosClient.post('/auth/register', data);
export const loginUser = (data: any): Promise<any> => axiosClient.post('/auth/login', data);
export const changePassword = (data: any): Promise<any> => axiosClient.post('/auth/change-password', data);

// --- Portfolio APIs ---
export const fetchPortfolioSummary = (): Promise<PortfolioSummary> => axiosClient.get('/portfolio');
export const fetchCachedPortfolio = (): Promise<PortfolioSummary> => axiosClient.get('/portfolio/cached');
export const fetchPortfolioHistory = (): Promise<PortfolioHistory[]> => axiosClient.get('/history');

// --- Settings APIs ---
export const fetchSettings = (): Promise<Settings> => axiosClient.get('/settings');
export const updateSetting = (data: { key: string; value: any }): Promise<any> => axiosClient.post('/settings', data);

// --- Holding APIs ---
export const addOrUpdateHolding = (data: any): Promise<any> => axiosClient.post('/holdings', data);

// --- Broker Import ---
export const importBrokerFile = (broker: string, file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post(`/import/${broker}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// --- Utilities ---
export const searchSymbols = (query: string, type: string): Promise<any> => 
  axiosClient.get(`/search-symbols?q=${encodeURIComponent(query)}&type=${type}`);

export const fetchMFSuggestions = (query: string): Promise<any[]> => 
  axiosClient.get(`/mf-suggestions?q=${encodeURIComponent(query)}`);

export const validateTicker = (ticker: string, type: string, currency?: string): Promise<any> => {
  const params = new URLSearchParams({ ticker, type, currency: currency || 'INR' });
  return axiosClient.get(`/validate-ticker?${params.toString()}`);
};

// --- Management ---
export const applySuggestion = (id: number | string): Promise<any> => axiosClient.post(`/assets/${id}/apply-suggestion`);
export const ignoreSuggestion = (id: number | string): Promise<any> => axiosClient.post(`/assets/${id}/ignore-suggestion`);
export const bulkEnrichAssets = (): Promise<any> => axiosClient.post('/assets/bulk-enrich');
