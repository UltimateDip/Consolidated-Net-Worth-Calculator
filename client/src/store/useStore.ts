import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../api/portfolioApi';
import { User, Asset, PortfolioHistory, Settings, PortfolioSummary } from '../types';

interface StoreState {
  baseCurrency: string;
  totalNetWorth: number;
  assets: Asset[];
  portfolioHistory: PortfolioHistory[];
  settings: Settings;
  autoRefresh: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
  isAuthenticated: boolean;

  // Actions
  setAutoRefresh: (val: boolean) => void;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (current: string, newPass: string) => Promise<void>;
  fetchPortfolio: () => Promise<void>;
  fetchPortfolioSilent: () => Promise<void>;
  fetchCachedPortfolio: () => Promise<void>;
  fetchPortfolioHistory: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSetting: (key: string, value: any) => Promise<void>;
  addOrUpdateHolding: (payload: any) => Promise<void>;
  importBrokerFile: (broker: string, file: File) => Promise<void>;
  applySuggestion: (id: number) => Promise<void>;
  ignoreSuggestion: (id: number) => Promise<void>;
  bulkEnrichAssets: () => Promise<void>;
}

const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      baseCurrency: 'INR',
      totalNetWorth: 0,
      assets: [],
      portfolioHistory: [],
      settings: {},
      autoRefresh: false,
      isLoading: false,
      error: null,
      user: null,
      isAuthenticated: !!localStorage.getItem('assetaura_token'),

      setAutoRefresh: (val) => set({ autoRefresh: val }),

      login: async (username, password) => {
        try {
          const data = await api.loginUser({ username, password });
          localStorage.setItem('assetaura_token', data.token);
          set({ 
            user: data.user, 
            isAuthenticated: true, 
            error: null, 
            assets: [], 
            totalNetWorth: 0, 
            portfolioHistory: [], 
            settings: {} 
          });
          return true;
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        }
      },

      register: async (username, password) => {
        try {
          const data = await api.registerUser({ username, password });
          localStorage.setItem('assetaura_token', data.token);
          set({ 
            user: data.user, 
            isAuthenticated: true, 
            error: null, 
            assets: [], 
            totalNetWorth: 0, 
            portfolioHistory: [], 
            settings: {} 
          });
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem('assetaura_token');
        set({ 
          user: null, 
          isAuthenticated: false, 
          assets: [], 
          totalNetWorth: 0, 
          portfolioHistory: [], 
          settings: {} 
        });
      },

      changePassword: async (currentPassword, newPassword) => {
        try {
          await api.changePassword({ currentPassword, newPassword });
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        }
      },

      fetchPortfolio: async () => {
        set({ isLoading: true });
        try {
          const data: PortfolioSummary = await api.fetchPortfolioSummary();
          set({ 
            assets: data.assets, 
            totalNetWorth: data.totalNetWorth, 
            baseCurrency: data.baseCurrency, 
            error: null 
          });
          // Refresh history too as a snapshot might have been created
          await get().fetchPortfolioHistory();
        } catch (err: any) {
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchPortfolioSilent: async () => {
        try {
          const data: PortfolioSummary = await api.fetchPortfolioSummary();
          set({ 
            assets: data.assets, 
            totalNetWorth: data.totalNetWorth, 
            baseCurrency: data.baseCurrency, 
            error: null 
          });
        } catch (err: any) {
          // Fail silently in background
          console.error('Silent refresh failed:', err);
        }
      },

      fetchCachedPortfolio: async () => {
        try {
          const data: PortfolioSummary = await api.fetchCachedPortfolio();
          set({ 
            assets: data.assets, 
            totalNetWorth: data.totalNetWorth, 
            baseCurrency: data.baseCurrency, 
            error: null 
          });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      fetchPortfolioHistory: async () => {
        try {
          const data: PortfolioHistory[] = await api.fetchPortfolioHistory();
          set({ portfolioHistory: data, error: null });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      fetchSettings: async () => {
        try {
          const data: Settings = await api.fetchSettings();
          set({ settings: data, error: null });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      updateSetting: async (key, value) => {
        try {
          await api.updateSetting({ key, value });
          const newSettings = { ...get().settings, [key]: value };
          set({ settings: newSettings, error: null });
          
          // If base currency changed, refresh everything to show correct values
          if (key === 'BASE_CURRENCY') {
            set({ baseCurrency: value });
            await get().fetchPortfolio();
          }
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        }
      },

      addOrUpdateHolding: async (payload) => {
        set({ isLoading: true });
        try {
          await api.addOrUpdateHolding(payload);
          await get().fetchPortfolio();
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      importBrokerFile: async (broker, file) => {
        set({ isLoading: true });
        try {
          await api.importBrokerFile(broker, file);
          await get().fetchPortfolio();
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      applySuggestion: async (id) => {
        try {
          await api.applySuggestion(id);
          await get().fetchPortfolio();
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      ignoreSuggestion: async (id) => {
        try {
          await api.ignoreSuggestion(id);
          await get().fetchPortfolio();
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      bulkEnrichAssets: async () => {
        set({ isLoading: true });
        try {
          await api.bulkEnrichAssets();
          await get().fetchPortfolio();
        } catch (err: any) {
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'assetaura-storage',
      partialize: (state) => ({ 
        autoRefresh: state.autoRefresh, 
        baseCurrency: state.baseCurrency,
        user: state.user
      }),
    }
  )
);

export default useStore;
