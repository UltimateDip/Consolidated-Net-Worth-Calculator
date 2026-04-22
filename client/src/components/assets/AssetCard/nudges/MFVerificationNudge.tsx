import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Asset } from '../../../../types';

interface MFVerificationNudgeProps {
  asset: Asset;
  onClick: (asset: Asset) => void;
}

const MFVerificationNudge: React.FC<MFVerificationNudgeProps> = ({ asset, onClick }) => {
  return (
    <div 
      onClick={() => onClick(asset)}
      style={{
        marginTop: '8px', marginLeft: '20px', padding: '10px 16px',
        background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.2rem' }}>✨</span>
        <span style={{ color: 'var(--text-primary)' }}>Potential market link found for this fund.</span>
      </div>
      <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
        Verify Fund <ChevronRight size={14} />
      </span>
    </div>
  );
};

export default MFVerificationNudge;
