import React from 'react';
import { Asset } from '../../../../types';

interface SuggestionBannerProps {
  asset: Asset;
  isProcessing: boolean;
  onApply: (id: number) => void;
  onIgnore: (id: number) => void;
}

const SuggestionBanner: React.FC<SuggestionBannerProps> = ({ asset, isProcessing, onApply, onIgnore }) => {
  const hasNameChange = asset.suggested_name && asset.suggested_name !== asset.name;
  const hasTickerChange = asset.suggested_ticker && asset.suggested_ticker !== asset.ticker;

  return (
    <div className="animate-fade-in-up" style={{
      marginTop: '8px', marginLeft: '20px', padding: '10px 16px',
      background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: '10px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', fontSize: '0.85rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Suggestion:</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
          {hasNameChange && <span>Rename to <strong style={{ color: 'var(--accent-success)' }}>{asset.suggested_name}</strong></span>}
          {hasNameChange && hasTickerChange && ' + '}
          {hasTickerChange && <span>Update ticker to <strong style={{ color: 'var(--accent-success)' }}>{asset.suggested_ticker}</strong></span>}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => onApply(asset.id)}
          disabled={isProcessing}
          className="btn-primary"
          style={{ padding: '4px 12px', fontSize: '0.75rem', backgroundColor: 'var(--accent-success)', color: 'black' }}
        >
          Apply
        </button>
        <button 
          onClick={() => onIgnore(asset.id)}
          style={{ 
            background: 'transparent', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem'
          }}
        >
          Ignore
        </button>
      </div>
    </div>
  );
};

export default SuggestionBanner;
