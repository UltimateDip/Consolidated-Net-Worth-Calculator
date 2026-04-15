import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../api/portfolioApi';

const useStore = create(persist((set, get) => ({
  baseCurrency: 'USD',
  totalNetWorth: 0,
  assets: [],
  portfolioHistory: [],
  settings: {},
  isLoading: false,
  error: null,

  fetchPortfolio: async () => {
    set({ isLoading: true, error: null });
    try {
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
      settings: state.settings
  })
}));

export default useStore;
