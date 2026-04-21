import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { X, Search, CheckCircle, AlertCircle, RefreshCcw } from 'lucide-react';

import * as api from '../api/portfolioApi';
import { formatCurrency } from '../utils/formatters';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP'];

const ManualEntry = ({ assetToEdit, onClearEdit }) => {
  const { addOrUpdateHolding, baseCurrency, fetchPortfolio } = useStore();
  
  const defaultState = {
    name: '',
    ticker: '',
    type: 'CASH',
    units: '',
    price: '',
    manualPrice: '',
    totalInvested: '',
    currency: baseCurrency,
    displayName: ''
  };

  const [formData, setFormData] = useState(defaultState);
  const [status, setStatus] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [validation, setValidation] = useState({ loading: false, price: null, error: null });
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (assetToEdit) {
      setFormData({
        name: assetToEdit.name || '',
        ticker: assetToEdit.ticker || '',
        type: assetToEdit.type || 'CASH',
        units: assetToEdit.current_units || '',
        price: assetToEdit.avg_price || '',
        manualPrice: assetToEdit.manualPrice || '',
        totalInvested: '',
        currency: assetToEdit.currency || baseCurrency,
        displayName: assetToEdit.display_name || ''
      });
    } else {
      setFormData(defaultState);
    }
  }, [assetToEdit, baseCurrency]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'ticker' && (formData.type === 'EQUITY' || formData.type === 'MF')) {
      handleSearch(value, formData.type);
    }
  };

  const handleSearch = (query, currentType) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await api.searchSymbols(query, currentType);
        setSuggestions(data.slice(0, 5));
        setShowSuggestions(true);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const selectSuggestion = (s) => {
    const ticker = s.symbol || s.ticker;
    const name = s.description || s.name;
    const isIndian = ticker.endsWith('.NS') || ticker.endsWith('.BO');
    
    setFormData(prev => ({
      ...prev,
      ticker,
      name,
      currency: isIndian ? 'INR' : prev.currency
    }));
    setSuggestions([]);
    setShowSuggestions(false);
    verifyTicker(ticker, formData.type, isIndian ? 'INR' : formData.currency);
  };

  const verifyTicker = async (ticker, type, currency) => {
    setValidation({ loading: true, price: null, error: null });
    try {
      const data = await api.validateTicker(ticker, type, currency);
      if (data.price) {
        setValidation({ loading: false, price: data.price, error: null });
        setFormData(prev => ({ ...prev, price: prev.price || data.price }));
      } else {
        setValidation({ loading: false, price: null, error: 'Ticker not found' });
      }
    } catch (err) {
      setValidation({ loading: false, price: null, error: 'Failed to verify' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Saving...');

    let finalUnits = parseFloat(formData.units);
    if (formData.type === 'GOLD' && isNaN(finalUnits) && formData.totalInvested) {
        const invested = parseFloat(formData.totalInvested);
        const manualPrice = parseFloat(formData.price);
        if (!isNaN(invested) && !isNaN(manualPrice) && manualPrice > 0) {
            finalUnits = invested / manualPrice;
        }
    }

    const payload = {
        id: assetToEdit?.id,
        ...formData,
        units: finalUnits,
        price: formData.price ? parseFloat(formData.price) : null,
        manualPrice: formData.manualPrice ? parseFloat(formData.manualPrice) : null
    };
    
    try {
      await addOrUpdateHolding(payload);

      setStatus('Saved successfully!');
      if (!assetToEdit) setFormData({...defaultState, currency: baseCurrency});
      setValidation({ loading: false, price: null, error: null });
      setTimeout(() => setStatus(''), 2000);
      if (assetToEdit && onClearEdit) onClearEdit();
    } catch (error) {
      console.error("Error updating holding", error);
      setStatus("Failed to save asset. Please check the ticker and try again.");
    }
  };

  const isCash = formData.type === 'CASH';
  const isMetal = formData.type === 'GOLD';

  return (
    <div className="glass-panel animate-fade-in" style={{ position: 'relative' }}>
      {assetToEdit && (
        <button 
          onClick={onClearEdit} 
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Cancel Edit"
        >
          <X color="var(--text-secondary)" size={20} />
        </button>
      )}
      <h3>{assetToEdit ? `Updating: ${assetToEdit.name}` : 'Add New Asset'}</h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
                <label>Asset Type</label>
                <select name="type" value={formData.type} onChange={handleChange} required disabled={!!assetToEdit}>
                    <option value="CASH">Cash</option>
                    <option value="EQUITY">Equity / Stock</option>
                    <option value="MF">Mutual Fund</option>
                    <option value="GOLD">Gold</option>
                </select>
            </div>
            <div style={{ flex: 1 }}>
                <label>Asset Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Apple Inc" required />
            </div>
            <div style={{ flex: 1 }}>
                <label>Display Name / Nickname (Optional)</label>
                <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} placeholder="e.g. My Apple Stocks" />
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {!isCash && (
              <div style={{ position: 'relative' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Ticker ID
                    {isSearching && <RefreshCcw size={12} className="spin" />}
                  </label>
                  <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        name="ticker" 
                        value={formData.ticker} 
                        onChange={handleChange} 
                        placeholder={formData.type === 'MF' ? "e.g. 101234 (Scheme Code)" : "AAPL, RELIANCE.NS"} 
                        autoComplete="off"
                        required={!isCash} 
                        disabled={!!assetToEdit} 
                      />
                      {formData.type === 'MF' && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Use the numeric Scheme Code from <a href="https://www.mfapi.in/" target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary)'}}>mfapi.in</a> for live prices.
                        </p>
                      )}
                      {showSuggestions && suggestions.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                          background: 'rgba(30, 34, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px', marginTop: '4px', overflow: 'hidden', backdropFilter: 'blur(10px)'
                        }}>
                          {suggestions.map((s, i) => (
                            <div key={i} onClick={() => selectSuggestion(s)} style={{
                              padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)',
                              fontSize: '0.85rem'
                            }} className="suggestion-item">
                              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{s.symbol}</span>
                              <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>{s.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                  {/* Validation Feedback */}
                  <div style={{ marginTop: '5px', fontSize: '0.75rem' }}>
                    {validation.loading && <span style={{ color: 'var(--text-muted)' }}>Verifying...</span>}
                    {validation.error && <span style={{ color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12}/> {validation.error}</span>}
                    {validation.price && <span style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12}/> Valid: {validation.price.toLocaleString()} {formData.currency}</span>}
                  </div>
              </div>
            )}
            {isMetal && (
              <div>
                  <label>Total Invested (Optional if Weight given)</label>
                  <input type="number" step="any" name="totalInvested" value={formData.totalInvested} onChange={handleChange} placeholder="e.g. 10000" />
              </div>
            )}
            
            <div>
                <label>{isCash ? "Total Amount / Balance" : isMetal ? "Weight (Grams)" : "Total Units / Shares"}</label>
                <input type="number" step="any" name="units" value={formData.units} onChange={handleChange} placeholder={isMetal ? "e.g. 5" : "e.g. 50"} required={!isMetal || !formData.totalInvested} />
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {!isCash && (
              <div>
                  <label>{isMetal ? "Purchase Price per Gram" : "Avg Price per unit"}</label>
                  <input type="number" step="any" name="price" value={formData.price} onChange={handleChange} placeholder="Price will auto-fill if verified" required={isMetal && !formData.units && formData.totalInvested} />
              </div>
            )}
            
            <div>
                <label>Currency</label>
                <select name="currency" value={formData.currency} onChange={handleChange} required>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        </div>

        {/* Manual Fallback Price Section */}
        {!isCash && (
          <div style={{ 
            padding: '15px', 
            background: 'rgba(255, 193, 7, 0.05)', 
            border: '1px solid rgba(255, 193, 7, 0.1)', 
            borderRadius: '12px',
            marginTop: '5px'
          }}>
            <label style={{ color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={14} /> Fallback Market Price (Optional)
            </label>
            <input 
              type="number" 
              step="any" 
              name="manualPrice" 
              value={formData.manualPrice} 
              onChange={handleChange} 
              placeholder="Enter current market price if auto-refresh fails" 
              style={{ background: 'rgba(0,0,0,0.2)' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
              If our live data provider (Yahoo Finance/Finnhub) fails to find a price for your ticker, this price will be used for your portfolio valuation instead. It automatically clears if the live data becomes available again.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Holding</button>
          {!isCash && formData.ticker && (
            <button type="button" className="btn-secondary" onClick={() => verifyTicker(formData.ticker, formData.type, formData.currency)}>
              Verify
            </button>
          )}
        </div>
        {status && <div style={{ fontSize: '0.875rem', textAlign: 'center', color: status.includes('Failed') ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{status}</div>}
      </form>
    </div>
  );
};

export default ManualEntry;
