import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Info, RefreshCw } from 'lucide-react';

import * as api from '../api/portfolioApi';

const Tooltip = ({ children }) => (
  <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block', marginLeft: '8px', cursor: 'pointer' }}>
    <Info size={16} color="var(--text-muted)" />
    <div className="tooltip-text" style={{
      visibility: 'hidden',
      width: '300px',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      textAlign: 'left',
      borderRadius: '6px',
      padding: '10px',
      position: 'absolute',
      zIndex: 50,
      bottom: '125%',
      left: '50%',
      marginLeft: '-150px',
      boxShadow: 'var(--shadow-lg)',
      border: '1px solid var(--border-color)',
      fontSize: '0.8rem',
      lineHeight: '1.4'
    }}>
      {children}
    </div>
  </div>
);

const Settings = () => {
  const { settings, updateSetting } = useStore();
  const [localSettings, setLocalSettings] = useState({});
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (e) => {
    setLocalSettings({ ...localSettings, [e.target.name]: e.target.value });
  };

  const handleSave = (key) => {
    updateSetting(key, localSettings[key]);
  };

  const handleBulkEnrich = async () => {
    setIsEnriching(true);
    try {
      const data = await api.bulkEnrichAssets();
      alert(data.message || 'Bulk enrichment started!');
    } catch (err) {
      console.error(err);
      alert('Failed to start enrichment');
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label>
          Base Currency
          <Tooltip>This currency will be used to display your total net worth on the dashboard. All conversions will use live forex rates.</Tooltip>
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select 
            name="BASE_CURRENCY" 
            value={localSettings['BASE_CURRENCY'] || 'USD'} 
            onChange={handleChange}
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="INR">INR (₹)</option>
            <option value="GBP">GBP (£)</option>
          </select>
          <button className="btn-secondary" onClick={() => handleSave('BASE_CURRENCY')}>Save</button>
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border-color)', margin: '30px 0' }} />
      <h3>API Integrations</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Add free API keys to enable live market data for your assets.</p>

      <div style={{ marginBottom: '20px' }}>
        <label>
          Finnhub API Key (Equities/Stocks)
          <Tooltip>
            1. Go to <a href="https://finnhub.io/" target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary)'}}>Finnhub.io</a> and sign up.<br/>
            2. The free tier offers 60 requests/minute, perfect for this app.<br/>
            3. Copy the "API Key" from your dashboard.
          </Tooltip>
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="password"
            name="FINNHUB_KEY" 
            placeholder="Enter key..."
            value={localSettings['FINNHUB_KEY'] || ''} 
            onChange={handleChange}
          />
          <button className="btn-secondary" onClick={() => handleSave('FINNHUB_KEY')}>Save</button>
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '20px' }}>
        Note: Indian Mutual Funds use public AMFI data, and Sovereign Gold Bonds (SGB) are checked via public equity tickers. They do not require API keys for tracking.
      </p>

      <hr style={{ borderColor: 'var(--border-color)', margin: '30px 0' }} />
      <h3>Maintenance & Tools</h3>
      <div style={{ marginTop: '20px' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
          Cleanup your portfolio by fetching official market names for all your holdings at once.
        </p>
        <button 
          className="btn-secondary" 
          onClick={handleBulkEnrich}
          disabled={isEnriching}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <RefreshCw size={16} className={isEnriching ? 'spin' : ''} />
          {isEnriching ? 'Starting Scan...' : 'Refresh All Asset Names'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
