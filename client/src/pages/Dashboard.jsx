import React from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store/useStore';
import { RefreshCw, PlusCircle } from 'lucide-react';

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
      const cur = asset.currency || 'INR';
      if (!acc[cur]) acc[cur] = { name: cur, value: 0 };
      acc[cur].value += asset.totalValue || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  // Top 5 Holdings
  const top5 = [...assets]
    .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
    .slice(0, 5)
    .map(a => ({ 
      name: a.name, 
      display_name: a.display_name,
      value: Math.round(a.totalValue || 0) 
    }));

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

  // Note: No full-page loading blocker. Dashboard renders instantly with cached
  // data. The syncing spinner on StatCards indicates a live refresh is in progress.

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
      
      {assets.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '20px' }}>
          <Link to="/edit" className="add-asset-icon-link" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            marginBottom: '1.5rem',
            color: 'var(--primary-color)',
            textDecoration: 'none',
            transition: 'transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease'
          }}>
            <PlusCircle size={32} />
          </Link>
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.8rem' }}>Welcome to AssetAura</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
            Your financial portfolio is entirely empty. Get started by adding your first asset or importing data from your broker.
          </p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};

export default Dashboard;
