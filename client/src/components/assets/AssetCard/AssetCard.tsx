import React from 'react';
import { Asset } from '../../../types';
import AssetBasicInfo from './AssetBasicInfo';
import PriceWarningNudge from './nudges/PriceWarningNudge';
import MFVerificationNudge from './nudges/MFVerificationNudge';
import SuggestionBanner from './nudges/SuggestionBanner';
import { ASSET_TYPES, PRICE_STATUS, VERIFICATION_STATUS } from '../../../utils/constants';

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
  const showPriceWarning = !isEditMode && asset.priceStatus === PRICE_STATUS.FAILED && asset.type !== ASSET_TYPES.CASH;
  const showMFNudge = asset.type === ASSET_TYPES.MF && (asset.verification_status !== VERIFICATION_STATUS.VERIFIED || !asset.ticker || asset.ticker.startsWith('MF_'));
  const showSuggestion = !isEditMode && asset.type === ASSET_TYPES.EQUITY && ((asset.suggested_name && asset.suggested_name !== asset.name) || (asset.suggested_ticker && asset.suggested_ticker !== asset.ticker)) && processingId !== asset.id;

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
