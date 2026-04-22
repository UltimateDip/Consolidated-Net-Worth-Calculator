const BaseBrokerStrategy = require('./BaseBrokerStrategy');

class GrowwStrategy extends BaseBrokerStrategy {
  identifyHeader(row) {
    const nameIdx = row.findIndex(c => c && typeof c === 'string' && (
      c.includes('Scheme Name') || c.includes('Security Name') || c.includes('ISIN')
    ));
    const qtyIdx = row.findIndex(c => c && typeof c === 'string' && (
      c.includes('Units') || c.includes('Quantity')
    ));
    const investedIdx = row.findIndex(c => c && typeof c === 'string' && (
      c.includes('Invested Value') || c.includes('Cost of Acquisition')
    ));
    const currentValIdx = row.findIndex(c => c && typeof c === 'string' && (
      c.includes('Current Value') || c.includes('Market Value')
    ));

    const isinIdx = row.findIndex(c => c && typeof c === 'string' && c.includes('ISIN'));

    if (nameIdx !== -1 && qtyIdx !== -1) {
      const isMutualFund = row.some(c => c && typeof c === 'string' && c.includes('Scheme Name'));
      return { nameIdx, qtyIdx, investedIdx, currentValIdx, isMutualFund, isinIdx };
    }
    return null;
  }

  mapRow(row, map) {
    const nameStr = row[map.nameIdx];
    if (!nameStr || typeof nameStr !== 'string' || nameStr.trim() === '' || nameStr.includes('Total')) return null;

    const qty = parseFloat(row[map.qtyIdx]);
    if (isNaN(qty) || qty <= 0) return null;

    const investedValue = map.investedIdx !== -1 ? parseFloat(row[map.investedIdx]) : 0;
    const currentValue = map.currentValIdx !== -1 ? parseFloat(row[map.currentValIdx]) : null;
    const isin = map.isinIdx !== -1 ? row[map.isinIdx] : null;

    let ticker;
    if (isin && typeof isin === 'string' && isin.length > 5) {
      ticker = isin.trim();
    } else {
      ticker = map.isMutualFund
        ? `MF_${nameStr.trim().substring(0, 30).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
        : nameStr.trim();
    }

    return {
      ticker,
      name: nameStr.trim(),
      units: qty,
      investedValue: isNaN(investedValue) ? 0 : investedValue,
      currentValue: (currentValue !== null && !isNaN(currentValue)) ? currentValue : 0,
      type: map.isMutualFund ? 'MF' : 'EQUITY',
      currency: 'INR'
    };
  }

  postProcess(results) {
    const merged = {};
    for (const item of results) {
      if (merged[item.ticker]) {
        merged[item.ticker].units += item.units;
        merged[item.ticker].investedValue += item.investedValue;
        merged[item.ticker].currentValue += item.currentValue;
      } else {
        merged[item.ticker] = { ...item };
      }
    }

    return Object.values(merged).map(item => ({
      ticker: item.ticker,
      name: item.name,
      units: item.units,
      price: item.units > 0 ? item.investedValue / item.units : 0,
      currentPrice: item.currentValue && item.units > 0 ? item.currentValue / item.units : undefined,
      type: item.type,
      currency: item.currency,
    }));
  }
}

module.exports = GrowwStrategy;
