import React from 'react';
import { Asset } from '../../../types';
import AssetBasicInfo from './AssetBasicInfo';
import PriceWarningNudge from './nudges/PriceWarningNudge';
import MFVerificationNudge from './nudges/MFVerificationNudge';
import SuggestionBanner from './nudges/SuggestionBanner';

interface AssetCardProps {
  asset: Asset;
  baseCurrency: string;
  isEditMode: boolean;
  processingId: number | string | null;
  onEdit: (asset: Asset) => void;
  onApplySuggestion: (id: number) => void;
  onIgnoreSuggestion: (id: number) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({
  asset, baseCurrency, isEditMode, processingId, onEdit, onApplySuggestion, onIgnoreSuggestion
}) => {
  const showPriceWarning = !isEditMode && asset.priceStatus === 'FAILED' && asset.type !== 'CASH';
  const showMFNudge = asset.type === 'MF' && (asset.verification_status !== 'VERIFIED' || !asset.ticker || asset.ticker.startsWith('MF_'));
  const showSuggestion = !isEditMode && asset.type === 'EQUITY' && ((asset.suggested_name && asset.suggested_name !== asset.name) || (asset.suggested_ticker && asset.suggested_ticker !== asset.ticker)) && processingId !== asset.id;

  return (
    <div>
      <AssetBasicInfo 
        asset={asset} 
        baseCurrency={baseCurrency} 
        isEditMode={isEditMode} 
        onEdit={onEdit} 
      />
      
      {showPriceWarning && (
        <PriceWarningNudge asset={asset} onClick={onEdit} />
      )}

      {showMFNudge && (
        <MFVerificationNudge asset={asset} onClick={onEdit} />
      )}

      {showSuggestion && (
        <SuggestionBanner 
          asset={asset} 
          isProcessing={processingId === asset.id} 
          onApply={onApplySuggestion} 
          onIgnore={onIgnoreSuggestion} 
        />
      )}
    </div>
  );
};

export default AssetCard;
