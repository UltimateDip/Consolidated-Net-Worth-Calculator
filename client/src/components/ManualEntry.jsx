import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { X, CheckCircle, AlertCircle, RefreshCcw } from 'lucide-react';

import * as api from '../api/portfolioApi';
import { formatCurrency } from '../utils/formatters';
import CustomSelect from './CustomSelect';
import Autocomplete from './Autocomplete';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

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
  const [isSearching, setIsSearching] = useState(false);
  const [mfSuggestions, setMfSuggestions] = useState([]);
  const [isResolving, setIsResolving] = useState(false);
  const [selectedMfCode, setSelectedMfCode] = useState(null);
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
    setSelectedMfCode(null);
  }, [assetToEdit, baseCurrency]);

  useEffect(() => {
    if (assetToEdit && assetToEdit.type === 'MF' && !/^\d+$/.test(assetToEdit.ticker)) {
      // Auto-trigger resolution search for messy slugs
      const query = assetToEdit.name.split(' ').slice(0, 6).join(' ');
      resolveMF(query);
    } else {
      setMfSuggestions([]);
    }
  }, [assetToEdit]);

  const resolveMF = async (query) => {
    setIsResolving(true);
    try {
      const results = await api.fetchMFSuggestions(query);
      setMfSuggestions(results);
    } catch (err) {
      console.error('MF resolution failed', err);
    } finally {
      setIsResolving(false);
    }
  };

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
    verifyTicker(ticker, formData.type, isIndian ? 'INR' : formData.currency);
  };

  const handleSuggestionToggle = (s) => {
    const isSelected = formData.ticker === s.symbol || selectedMfCode === s.symbol;
    if (isSelected && assetToEdit) {
      // Unselect: Revert to original
      setFormData(prev => ({
        ...prev,
        ticker: assetToEdit.ticker || '',
        name: assetToEdit.name || '',
        currency: assetToEdit.currency || baseCurrency
      }));
      setSelectedMfCode(null);
    } else {
      selectSuggestion(s);
    }
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
    <div className="glass-panel animate-fade-in" style={{ position: 'relative', zIndex: 10 }}>
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
                <CustomSelect 
                  name="type" 
                  value={formData.type} 
                  onChange={handleChange} 
                  required 
                  disabled={!!assetToEdit}
                  options={[
                    { value: 'CASH', label: 'Cash' },
                    { value: 'EQUITY', label: 'Equity / Stock' },
                    { value: 'MF', label: 'Mutual Fund' },
                    { value: 'GOLD', label: 'Gold' },
                  ]}
                />
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
                      <Autocomplete
                        name="ticker"
                        value={formData.ticker}
                        onChange={handleChange}
                        onSelect={selectSuggestion}
                        suggestions={suggestions}
                        placeholder={formData.type === 'MF' ? "e.g. 101234 (Scheme Code)" : "AAPL, RELIANCE.NS"}
                        required={!isCash}
                        disabled={!!assetToEdit}
                      />
                      {formData.type === 'MF' && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Use the numeric Scheme Code from <a href="https://www.mfapi.in/" target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary)'}}>mfapi.in</a> for live prices.
                        </p>
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
                <CustomSelect 
                  name="currency" 
                  value={formData.currency} 
                  onChange={handleChange} 
                  required
                  options={CURRENCIES.map(c => ({ value: c, label: c }))}
                />
            </div>
        </div>

        {formData.type === 'MF' && mfSuggestions.length > 0 && (
          <div style={{ 
            backgroundColor: 'rgba(59, 130, 246, 0.05)', 
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '12px',
            padding: '15px',
            marginBottom: '10px'
          }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✨ Suggested Official Codes:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mfSuggestions.map((s, idx) => {
                const isSelected = formData.ticker === s.symbol || selectedMfCode === s.symbol;
                return (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.2)',
                    border: isSelected ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ fontWeight: 600, color: isSelected ? 'var(--accent-success)' : 'var(--text-primary)' }}>{s.description}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Code: {s.symbol} • NAV: {formatCurrency(s.nav, 'INR')}
                      </div>
                    </div>
                    <button 
                      type="button"
                      className={isSelected ? "btn-secondary" : "btn-primary"}
                      style={{ 
                        backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.2)' : undefined,
                        borderColor: isSelected ? 'var(--accent-success)' : undefined,
                        color: isSelected ? 'var(--accent-success)' : undefined,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        opacity: 1
                      }}
                      onClick={() => handleSuggestionToggle(s)}
                    >
                      {isSelected ? <><CheckCircle size={14}/> Selected</> : 'Use this Fund'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              If our live data providers fail to find a current price for your asset, this price will be used as a fallback for your valuation. It automatically clears if live data becomes available again.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="submit" className="btn-secondary" style={{ flex: 1 }}>Save Holding</button>
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
