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
  const [passwordState, setPasswordState] = useState({ current: '', new: '' });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: null, success: null });

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

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordStatus({ loading: true, error: null, success: null });
    try {
      const data = await api.changePassword(passwordState.current, passwordState.new);
      setPasswordStatus({ loading: false, error: null, success: data.message });
      setPasswordState({ current: '', new: '' });
    } catch (err) {
      setPasswordStatus({ loading: false, error: err.message, success: null });
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
            value={localSettings['BASE_CURRENCY'] || 'INR'} 
            onChange={handleChange}
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
          <button className="btn-secondary" onClick={() => handleSave('BASE_CURRENCY')}>Save</button>
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border-color)', margin: '30px 0' }} />
      <h3>Account Security</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Change your current password securely.</p>
      
      <form onSubmit={handlePasswordChange} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label>Current Password</label>
          <input 
            type="password" 
            placeholder="Enter current password"
            value={passwordState.current}
            onChange={(e) => setPasswordState({ ...passwordState, current: e.target.value })}
            required
          />
        </div>
        <div>
          <label>New Password (min. 6 characters)</label>
          <input 
            type="password" 
            placeholder="Enter new password"
            value={passwordState.new}
            onChange={(e) => setPasswordState({ ...passwordState, new: e.target.value })}
            required
            minLength={6}
          />
        </div>
        
        {passwordStatus.error && <p style={{ color: '#ef4444', margin: '0' }}>{passwordStatus.error}</p>}
        {passwordStatus.success && <p style={{ color: '#10b981', margin: '0' }}>{passwordStatus.success}</p>}
        
        <div>
          <button type="submit" className="btn-secondary" disabled={passwordStatus.loading}>
            {passwordStatus.loading ? 'Updating...' : 'Change Password'}
          </button>
        </div>
      </form>

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
