import { useState } from 'react';
import useStore from '../store/useStore';
import ManualEntry from '../components/ManualEntry';
import BrokerImport from '../components/BrokerImport';
import { Eye, Edit3, ChevronRight, ArrowDownWideNarrow } from 'lucide-react';
import { formatCurrency, TYPE_COLORS } from '../utils/formatters';
import * as api from '../api/portfolioApi';

const ManageAssets = () => {
  const { assets, baseCurrency, fetchPortfolio } = useStore();
  const [isEditMode, setIsEditMode] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [sortBy, setSortBy] = useState('VALUE'); // VALUE, NAME, TYPE, RECENT

  // Sort logic
  const sortedAssets = [...assets].sort((a, b) => {
    if (sortBy === 'VALUE') return (b.totalValue || 0) - (a.totalValue || 0);
    if (sortBy === 'NAME') return a.name.localeCompare(b.name);
    if (sortBy === 'TYPE') return a.type.localeCompare(b.type);
    if (sortBy === 'RECENT') return new Date(b.last_updated) - new Date(a.last_updated);
    return 0;
  });

  const handleEditClick = (asset) => {
    setAssetToEdit(asset);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplySuggestion = async (id) => {
    setProcessingId(id);
    try {
      await api.applySuggestion(id);
      await fetchPortfolio();
    } catch (err) {
      console.error('Failed to apply suggestion', err);
      alert(`Error updating asset: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleIgnoreSuggestion = async (id) => {
    setProcessingId(id);
    try {
      await api.ignoreSuggestion(id);
      await fetchPortfolio();
    } catch (err) {
      console.error('Failed to ignore suggestion', err);
      alert(`Error ignoring suggestion: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Holdings</h2>
        <button
          onClick={() => { setIsEditMode(!isEditMode); setAssetToEdit(null); }}
          className={isEditMode ? 'btn-primary' : 'btn-secondary'}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', fontSize: '0.85rem',
            transition: 'all 0.3s ease',
          }}
        >
          {isEditMode ? <><Eye size={16} /> View Mode</> : <><Edit3 size={16} /> Edit Mode</>}
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
        {isEditMode
          ? 'Add new assets manually or import from your broker. Click "Edit" on any asset to update it.'
          : `Viewing ${assets.length} tracked holding${assets.length !== 1 ? 's' : ''}.`
        }
      </p>

      {/* Edit Mode Panels — ManualEntry + BrokerImport */}
      <div style={{
        maxHeight: isEditMode ? '2000px' : '0',
        overflow: 'hidden',
        opacity: isEditMode ? 1 : 0,
        transition: 'max-height 0.5s ease, opacity 0.4s ease',
        display: 'flex', flexDirection: 'column', gap: '30px',
        marginBottom: isEditMode ? '30px' : '0',
      }}>
        <ManualEntry assetToEdit={assetToEdit} onClearEdit={() => setAssetToEdit(null)} />
        <BrokerImport />
      </div>

      {/* Asset List */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>
                {isEditMode ? 'Current Assets (click Edit to modify)' : 'All Holdings'}
            </h3>
            
            {/* Sorting Controls */}
            {!isEditMode && assets.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                    <ArrowDownWideNarrow size={14} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-muted)' }}>Sort by:</span>
                    {['VALUE', 'NAME', 'TYPE', 'RECENT'].map(key => (
                        <button
                            key={key}
                            onClick={() => setSortBy(key)}
                            style={{
                                background: sortBy === key ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                border: 'none',
                                color: sortBy === key ? 'var(--accent-primary)' : 'var(--text-muted)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: sortBy === key ? '600' : '400'
                            }}
                        >
                            {key.charAt(0) + key.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {assets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No assets added yet. Switch to Edit Mode to get started.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sortedAssets.map((asset) => (
              <div key={asset.id}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `4px solid ${TYPE_COLORS[asset.type] || TYPE_COLORS.OTHER}`,
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)'}
                >
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{asset.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {asset.type === 'CASH' && (
                        <>{asset.currency || baseCurrency} Balance</>
                      )}
                      {asset.type === 'EQUITY' && (
                        <>{parseFloat(asset.current_units).toFixed(2)} Shares • {asset.ticker} • {asset.currency || baseCurrency}</>
                      )}
                      {asset.type === 'MF' && (
                        <>{parseFloat(asset.current_units).toFixed(2)} Units • {asset.currency || baseCurrency}</>
                      )}
                      {asset.type === 'CRYPTO' && (
                        <>{parseFloat(asset.current_units).toFixed(4)} • {asset.ticker} • {asset.currency || baseCurrency}</>
                      )}
                      {(asset.type === 'GOLD' || asset.type === 'SILVER') && (
                        <>{parseFloat(asset.current_units).toFixed(2)} oz • {asset.currency || baseCurrency}</>
                      )}
                      {!['CASH', 'EQUITY', 'MF', 'CRYPTO', 'GOLD', 'SILVER'].includes(asset.type) && (
                        <>{parseFloat(asset.current_units).toFixed(2)} Units • {asset.currency || baseCurrency}</>
                      )}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: isEditMode ? '12px' : '0' }}>
                    <strong style={{ fontSize: '1.1rem', display: 'block' }}>
                      {formatCurrency(asset.totalValue, baseCurrency)}
                    </strong>
                    {asset.type !== 'CASH' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {asset.type === 'MF' ? 'NAV ' : ''}
                        {formatCurrency(asset.originalPrice, asset.currency || baseCurrency)}
                        {asset.type === 'EQUITY' ? '/share' : asset.type === 'MF' ? '' : '/unit'}
                      </span>
                    )}
                  </div>
                  {isEditMode && (
                    <button
                      onClick={() => handleEditClick(asset)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--accent-primary)', padding: '4px',
                        transition: 'transform 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(3px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                      title="Edit this asset"
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>

                {/* Suggestion Notification */}
                {!isEditMode && asset.suggested_name && processingId !== asset.id && (
                  <div style={{
                    marginTop: '8px',
                    marginLeft: '20px',
                    padding: '8px 12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    animation: 'fade-in-up 0.3s ease'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Did you mean <strong style={{ color: 'var(--accent-success)' }}>{asset.suggested_name}</strong>?
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleApplySuggestion(asset.id)}
                        style={{ background: 'var(--accent-success)', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleIgnoreSuggestion(asset.id)}
                        style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAssets;
