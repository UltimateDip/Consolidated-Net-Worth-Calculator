const BaseBrokerStrategy = require('./BaseBrokerStrategy');

class ZerodhaStrategy extends BaseBrokerStrategy {
  identifyHeader(row) {
    const symbolIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Symbol') || c.includes('Instrument')));
    const qtyIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Quantity Available') || c.includes('Qty.')));
    const priceIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Average Price') || c.includes('Avg. cost')));
    const currentPriceIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Previous Closing Price') || c.includes('LTP') || c.includes('Current Price')));

    if (symbolIdx !== -1 && qtyIdx !== -1) {
      return { symbolIdx, qtyIdx, priceIdx, currentPriceIdx };
    }
    return null;
  }

  mapRow(row, map) {
    const symbolStr = row[map.symbolIdx];
    if (!symbolStr || typeof symbolStr !== 'string' || symbolStr.trim() === '' || symbolStr.includes('Total')) return null;

    const qty = parseFloat(row[map.qtyIdx]);
    const price = parseFloat(row[map.priceIdx] || 0);
    const currentPrice = map.currentPriceIdx !== -1 ? parseFloat(row[map.currentPriceIdx]) : null;

    if (isNaN(qty)) return null;

    let ticker = symbolStr.trim();
    let assetType = ticker.toUpperCase().includes('SGB') ? 'GOLD' : 'EQUITY';

    if (assetType === 'EQUITY' && !ticker.includes('.')) {
      ticker = `${ticker}.NS`;
    }

    return {
      ticker,
      name: symbolStr.trim(),
      units: qty,
      investedValue: qty * (isNaN(price) ? 0 : price),
      currentPrice: (!isNaN(currentPrice) && currentPrice !== null) ? currentPrice : undefined,
      type: assetType,
      currency: 'INR'
    };
  }

  postProcess(results) {
    const merged = {};
    for (const item of results) {
      // Use ticker if available, otherwise fallback to Name
      const key = item.ticker || item.name;
      if (merged[key]) {
        merged[key].units += item.units;
        merged[key].investedValue += item.investedValue;
        if (item.currentPrice !== undefined) merged[key].currentPrice = item.currentPrice;
      } else {
        merged[key] = { ...item };
      }
    }

    return Object.values(merged).map(item => ({
      ticker: item.ticker,
      name: item.name,
      units: item.units,
      price: item.units > 0 ? item.investedValue / item.units : 0,
      currentPrice: item.currentPrice,
      type: item.type,
      currency: item.currency,
    }));
  }
}

module.exports = ZerodhaStrategy;
