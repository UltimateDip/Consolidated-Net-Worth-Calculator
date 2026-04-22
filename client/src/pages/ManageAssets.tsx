import React, { useState } from 'react';
import useStore from '../store/useStore';
import ManualEntry from '../components/ManualEntry';
import BrokerImport from '../components/BrokerImport';
import AssetCard from '../components/assets/AssetCard/AssetCard';
import { Eye, Edit3, ArrowDownWideNarrow } from 'lucide-react';
import * as api from '../api/portfolioApi';
import { Asset } from '../types';

type SortOption = 'VALUE' | 'NAME' | 'TYPE' | 'RECENT';

const ManageAssets: React.FC = () => {
  const { assets, baseCurrency, fetchPortfolio } = useStore();
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [processingId, setProcessingId] = useState<number | string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('VALUE');
  const [hasSynced, setHasSynced] = useState<boolean>(false);

  // Sync mode once data loads
  React.useEffect(() => {
    if (assets.length > 0 && !hasSynced) {
      setIsEditMode(false);
      setHasSynced(true);
    }
  }, [assets.length, hasSynced]);

  // Strict TypeScript Sorting logic
  const sortedAssets = [...assets].sort((a, b) => {
    if (sortBy === 'VALUE') return (b.totalValue || 0) - (a.totalValue || 0);
    if (sortBy === 'NAME') return a.name.localeCompare(b.name);
    if (sortBy === 'TYPE') return a.type.localeCompare(b.type);
    if (sortBy === 'RECENT') {
        const dateA = a.last_updated ? new Date(a.last_updated).getTime() : 0;
        const dateB = b.last_updated ? new Date(b.last_updated).getTime() : 0;
        return dateB - dateA;
    }
    return 0;
  });

  const handleEditClick = (asset: Asset) => {
    setAssetToEdit(asset);
    setIsEditMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplySuggestion = async (id: number) => {
    setProcessingId(id);
    try {
      await api.applySuggestion(id);
      await fetchPortfolio();
    } catch (err: any) {
      console.error('Failed to apply suggestion', err);
      alert(`Error updating asset: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleIgnoreSuggestion = async (id: number) => {
    setProcessingId(id);
    try {
      await api.ignoreSuggestion(id);
      await fetchPortfolio();
    } catch (err: any) {
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
                    {(['VALUE', 'NAME', 'TYPE', 'RECENT'] as SortOption[]).map(key => (
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
              <AssetCard 
                key={asset.id}
                asset={asset}
                baseCurrency={baseCurrency}
                isEditMode={isEditMode}
                processingId={processingId}
                onEdit={handleEditClick}
                onApplySuggestion={handleApplySuggestion}
                onIgnoreSuggestion={handleIgnoreSuggestion}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAssets;
