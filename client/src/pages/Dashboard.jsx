import React from 'react';
import useStore from '../store/useStore';
import { RefreshCw } from 'lucide-react';

// Child Components
import StatCards from '../components/dashboard/StatCards';
import AllocationCharts from '../components/dashboard/AllocationCharts';
import TopHoldingsChart from '../components/dashboard/TopHoldingsChart';
import PortfolioHistoryChart from '../components/dashboard/PortfolioHistoryChart';

const Dashboard = () => {
  const { 
    totalNetWorth, 
    baseCurrency, 
    assets, 
    isLoading, 
    portfolioHistory,
    autoRefresh,
    setAutoRefresh,
    fetchPortfolioSilent
  } = useStore();

  // --- Auto Refresh Logic ---
  React.useEffect(() => {
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchPortfolioSilent();
      }, 10000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, fetchPortfolioSilent]);

  // --- Derived Data ---

  // Asset Allocation by Type
  const allocationData = Object.values(
    assets.reduce((acc, asset) => {
      const type = asset.type || 'OTHER';
      if (!acc[type]) acc[type] = { name: type, value: 0 };
      acc[type].value += asset.totalValue || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  // Currency Exposure
  const currencyData = Object.values(
    assets.reduce((acc, asset) => {
      const cur = asset.currency || 'USD';
      if (!acc[cur]) acc[cur] = { name: cur, value: 0 };
      acc[cur].value += asset.totalValue || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  // Top 5 Holdings
  const top5 = [...assets]
    .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
    .slice(0, 5)
    .map(a => ({ name: a.name, value: Math.round(a.totalValue || 0) }));

  // Largest Holding
  const largest = assets.length > 0
    ? [...assets].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))[0]
    : null;
  const largestPct = largest && totalNetWorth > 0
    ? ((largest.totalValue / totalNetWorth) * 100).toFixed(1)
    : 0;

  // Top Asset Class
  const topClass = allocationData.length > 0 ? allocationData[0] : null;

  // History for Area Chart
  const historyData = portfolioHistory.map(s => ({
    date: s.date,
    value: s.total_value,
  }));

  // Initial load screen
  if (isLoading && assets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
        <RefreshCw size={32} className="spin" style={{ marginBottom: '20px', color: 'var(--accent-primary)' }} />
        <h2>Loading Portfolio Data...</h2>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <StatCards 
        totalNetWorth={totalNetWorth} 
        baseCurrency={baseCurrency} 
        isLoading={isLoading} 
        assets={assets} 
        largest={largest} 
        largestPct={largestPct} 
        topClass={topClass} 
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
      />
      
      <AllocationCharts 
        allocationData={allocationData} 
        currencyData={currencyData} 
        baseCurrency={baseCurrency} 
      />
      
      <TopHoldingsChart 
        top5={top5} 
        baseCurrency={baseCurrency} 
      />
      
      <PortfolioHistoryChart 
        historyData={historyData} 
        baseCurrency={baseCurrency} 
      />
    </div>
  );
};

export default Dashboard;
