import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Asset } from '../../../../types';

interface PriceWarningNudgeProps {
  asset: Asset;
  onClick: (asset: Asset) => void;
}

const PriceWarningNudge: React.FC<PriceWarningNudgeProps> = ({ asset, onClick }) => {
  return (
    <div 
      onClick={() => onClick(asset)}
      style={{
        marginTop: '8px', marginLeft: '20px', padding: '10px 16px',
        background: 'rgba(255, 193, 7, 0.05)', border: '1px solid rgba(255, 193, 7, 0.1)',
        borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
        fontSize: '0.85rem', cursor: 'pointer',
      }}
    >
      <AlertCircle size={14} color="var(--accent-warning)" />
      <span style={{ color: 'var(--text-primary)' }}>
        Live price unavailable. <span style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Click to set a manual fallback.</span>
      </span>
    </div>
  );
};

export default PriceWarningNudge;
