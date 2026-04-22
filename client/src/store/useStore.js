import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../api/portfolioApi';

const useStore = create(persist((set, get) => ({
  baseCurrency: 'USD',
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
      const data = await api.loginUser(username, password);
      localStorage.setItem('assetaura_token', data.token);
      set({ user: data.user, isAuthenticated: true, error: null, assets: [], totalNetWorth: 0, portfolioHistory: [], settings: {} });
      return true;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  register: async (username, password) => {
    try {
      const data = await api.registerUser(username, password);
      localStorage.setItem('assetaura_token', data.token);
      set({ user: data.user, isAuthenticated: true, error: null, assets: [], totalNetWorth: 0, portfolioHistory: [] });
      return true;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('assetaura_token');
    set({ user: null, isAuthenticated: false, assets: [], totalNetWorth: 0, portfolioHistory: [] });
    // Reset URL to home so the next login always opens the dashboard
    window.history.replaceState(null, '', '/');
  },

  fetchPortfolio: async () => {
    set({ isLoading: true, error: null });
    try {
      // Phase 1: Instant load from DB-cached prices (no external API calls)
      try {
        const cached = await api.fetchCachedPortfolio();
        set({ 
          baseCurrency: cached.baseCurrency, 
          totalNetWorth: cached.totalNetWorth, 
          assets: cached.assets
        });
      } catch (e) {
        // Cached endpoint failed, will fall through to live fetch
      }

      // Phase 2: Background sync with live prices
      const data = await api.fetchPortfolioSummary();
      set({ 
        baseCurrency: data.baseCurrency, 
        totalNetWorth: data.totalNetWorth, 
        assets: data.assets,
        isLoading: false 
      });
      // Silently refresh history after portfolio loads
      get().fetchHistory();
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchPortfolioSilent: async () => {
    try {
      const data = await api.fetchPortfolioSummary();
      set({ 
        baseCurrency: data.baseCurrency, 
        totalNetWorth: data.totalNetWorth, 
        assets: data.assets
      });
    } catch (error) {
      console.error('Silent refresh failed', error);
    }
  },

  fetchSettings: async () => {
    try {
      const data = await api.fetchSettings();
      set({ settings: data });
    } catch (error) {
       console.error("Error fetching settings", error);
    }
  },

  updateSetting: async (key, value) => {
    try {
      await api.updateSetting(key, value);
      await get().fetchSettings();
      // If base currency changed, refresh portfolio
      if (key === 'BASE_CURRENCY') {
         await get().fetchPortfolio();
      }
    } catch (error) {
      console.error("Error updating setting", error);
    }
  },

  fetchHistory: async () => {
    try {
      const data = await api.fetchPortfolioHistory();
      set({ portfolioHistory: data });
    } catch (error) {
      console.error('Error fetching history', error);
    }
  },
  
  addOrUpdateHolding: async (payload) => {
    await api.addOrUpdateHolding(payload);
    await get().fetchPortfolio();
    return true;
  }
}), {
  name: 'networth-storage', 
  partialize: (state) => ({ 
      assets: state.assets, 
      totalNetWorth: state.totalNetWorth, 
      baseCurrency: state.baseCurrency,
      portfolioHistory: state.portfolioHistory,
      settings: state.settings,
      user: state.user,
      isAuthenticated: state.isAuthenticated
  })
}));

export default useStore;
