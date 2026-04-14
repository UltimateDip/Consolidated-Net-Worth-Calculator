import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Use environment variable or default to localhost for dev
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
      const res = await fetch(`${API_URL}/portfolio`);
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const data = await res.json();
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
      const res = await fetch(`${API_URL}/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      set({ settings: data });
    } catch (error) {
       console.error("Error fetching settings", error);
    }
  },

  updateSetting: async (key, value) => {
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      // Update local state locally before re-fetching might be faster, but let's just refetch.
      get().fetchSettings();
      // If base currency changed, refresh portfolio
      if (key === 'BASE_CURRENCY') {
         get().fetchPortfolio();
      }
    } catch (error) {
      console.error("Error updating setting", error);
    }
  },

  fetchHistory: async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      set({ portfolioHistory: data });
    } catch (error) {
      console.error('Error fetching history', error);
    }
  },
  
  addOrUpdateHolding: async (payload) => {
     try {
       const res = await fetch(`${API_URL}/holdings`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
       });
       if (!res.ok) throw new Error('Failed to update holding');
       get().fetchPortfolio();
       return true;
     } catch (error) {
       console.error("Error updating holding", error);
       return false;
     }
  }
}), {
  name: 'networth-storage', // unique name for localStorage key
  partialize: (state) => ({ 
      // Only persist the non-volatile elements so that the Dashboard can render instantly from cache
      assets: state.assets, 
      totalNetWorth: state.totalNetWorth, 
      baseCurrency: state.baseCurrency,
      portfolioHistory: state.portfolioHistory,
      settings: state.settings
  })
}));

export default useStore;
