import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Asset } from '../../../types';
import { formatCurrency, TYPE_COLORS, cleanAssetName } from '../../../utils/formatters';

interface AssetBasicInfoProps {
  asset: Asset;
  baseCurrency: string;
  isEditMode: boolean;
  onEdit: (asset: Asset) => void;
}

const AssetBasicInfo: React.FC<AssetBasicInfoProps> = ({ asset, baseCurrency, isEditMode, onEdit }) => {
  return (
    <div 
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 16px', backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 'var(--radius-sm)',
        borderLeft: `4px solid ${TYPE_COLORS[asset.type] || TYPE_COLORS.OTHER}`,
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)'}
    >
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', fontSize: '1rem' }} title={asset.display_name ? `Official: ${asset.name}` : asset.name}>
          {asset.display_name || cleanAssetName(asset.name)}
          {asset.priceStatus && asset.priceStatus !== 'AUTOMATED' && (
            <span style={{ 
              fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px',
              backgroundColor: asset.priceStatus === 'MANUAL' ? 'rgba(255, 193, 7, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: asset.priceStatus === 'MANUAL' ? 'var(--accent-warning)' : 'var(--accent-danger)',
              border: `1px solid ${asset.priceStatus === 'MANUAL' ? 'rgba(255, 193, 7, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              textTransform: 'uppercase', verticalAlign: 'middle', fontWeight: '600'
            }}>
              {asset.priceStatus === 'MANUAL' ? 'Manual' : asset.priceStatus}
            </span>
          )}
        </strong>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {asset.type === 'CASH' && <>{asset.currency || baseCurrency} Balance</>}
          {asset.type === 'EQUITY' && <>{parseFloat(asset.current_units.toString()).toFixed(2)} Shares • {asset.ticker || 'Unverified'} • {asset.currency || baseCurrency}</>}
          {asset.type === 'MF' && <>{parseFloat(asset.current_units.toString()).toFixed(2)} Units • {asset.currency || baseCurrency}</>}
          {asset.type === 'GOLD' && <>{parseFloat(asset.current_units.toString()).toFixed(2)} Grams • {asset.currency || baseCurrency}</>}
          {!['CASH', 'EQUITY', 'MF', 'GOLD'].includes(asset.type) && <>{parseFloat(asset.current_units.toString()).toFixed(2)} Units • {asset.currency || baseCurrency}</>}
        </span>
      </div>

      <div style={{ textAlign: 'right', marginRight: isEditMode ? '12px' : '0' }}>
        <strong style={{ fontSize: '1.1rem', display: 'block' }}>
          {formatCurrency(asset.totalValue, baseCurrency)}
        </strong>
        {asset.type !== 'CASH' && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {asset.type === 'MF' ? 'NAV ' : ''}
            {formatCurrency(asset.originalPrice || asset.avg_price, asset.currency || baseCurrency)}
            {asset.type === 'EQUITY' ? '/share' : asset.type === 'MF' ? '' : asset.type === 'GOLD' ? '/gram' : '/unit'}
          </span>
        )}
      </div>

      {isEditMode && (
        <button
          onClick={() => onEdit(asset)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--accent-primary)', padding: '4px', transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(3px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
};

export default AssetBasicInfo;
