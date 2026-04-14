const xlsx = require('xlsx');

// Base Strategy
class BrokerStrategy {
  async parse(filePath) {
    throw new Error('parse method must be implemented by concrete strategy');
  }
}

class ZerodhaStrategy extends BrokerStrategy {
  async parse(filePath) {
    const results = [];
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const dataRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

      let tableStarted = false;
      let symbolIdx = -1, qtyIdx = -1, priceIdx = -1, currentPriceIdx = -1;

      for (const row of dataRows) {
          if (!row || row.length === 0) continue;

          if (!tableStarted) {
              symbolIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Symbol') || c.includes('Instrument')));
              qtyIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Quantity Available') || c.includes('Qty.')));
              priceIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Average Price') || c.includes('Avg. cost')));
              currentPriceIdx = row.findIndex(c => c && typeof c === 'string' && (c.includes('Previous Closing Price') || c.includes('LTP') || c.includes('Current Price')));

              if (symbolIdx !== -1 && qtyIdx !== -1) tableStarted = true;
              continue;
          }

          const symbolStr = row[symbolIdx];
          if (!symbolStr || typeof symbolStr !== 'string' || symbolStr.trim() === '' || symbolStr.includes('Total')) continue;

          const qty = parseFloat(row[qtyIdx]);
          const price = parseFloat(row[priceIdx] || 0);
          const currentPrice = currentPriceIdx !== -1 ? parseFloat(row[currentPriceIdx]) : null;

          if (!isNaN(qty)) {
             results.push({
               ticker: symbolStr.trim(),
               name: symbolStr.trim(),
               units: qty,
               price: isNaN(price) ? 0 : price,
               currentPrice: (!isNaN(currentPrice) && currentPrice !== null) ? currentPrice : undefined,
               type: 'EQUITY',
               currency: 'INR'
             });
          }
      }
      return results;
    } catch (error) {
       throw new Error('Failed to parse Zerodha file: ' + error.message);
    }
  }
}

class GrowwStrategy extends BrokerStrategy {
  async parse(filePath) {
    const results = [];
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const dataRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

      let tableStarted = false;
      let nameIdx = -1, qtyIdx = -1, investedIdx = -1, currentValIdx = -1;
      let isMutualFund = false;

      for (const row of dataRows) {
          if (!row || row.length === 0) continue;

          if (!tableStarted) {
              // Try to match header row — support both Stocks and Mutual Funds exports
              nameIdx = row.findIndex(c => c && typeof c === 'string' && (
                c.includes('Scheme Name') || c.includes('Security Name') || c.includes('ISIN')
              ));
              qtyIdx = row.findIndex(c => c && typeof c === 'string' && (
                c.includes('Units') || c.includes('Quantity')
              ));
              investedIdx = row.findIndex(c => c && typeof c === 'string' && (
                c.includes('Invested Value') || c.includes('Cost of Acquisition')
              ));
              currentValIdx = row.findIndex(c => c && typeof c === 'string' && (
                c.includes('Current Value') || c.includes('Market Value')
              ));

              if (nameIdx !== -1 && qtyIdx !== -1) {
                tableStarted = true;
                // Detect if this is a Mutual Fund file
                isMutualFund = row.some(c => c && typeof c === 'string' && c.includes('Scheme Name'));
              }
              continue;
          }

          const nameStr = row[nameIdx];
          if (!nameStr || typeof nameStr !== 'string' || nameStr.trim() === '' || nameStr.includes('Total')) continue;

          const qty = parseFloat(row[qtyIdx]);
          if (isNaN(qty) || qty <= 0) continue;

          // For MFs: Invested Value is total, so avg price = investedValue / units
          const investedValue = investedIdx !== -1 ? parseFloat(row[investedIdx]) : 0;
          const currentValue = currentValIdx !== -1 ? parseFloat(row[currentValIdx]) : null;
          const avgPrice = (investedValue && qty) ? investedValue / qty : 0;
          const currentPrice = (currentValue && qty) ? currentValue / qty : null;

          // Generate a ticker-safe slug from the scheme name
          const ticker = isMutualFund
            ? `MF_${nameStr.trim().substring(0, 30).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
            : nameStr.trim();

          results.push({
            ticker,
            name: nameStr.trim(),
            units: qty,
            investedValue: isNaN(investedValue) ? 0 : investedValue,
            currentValue: (currentValue !== null && !isNaN(currentValue)) ? currentValue : 0,
            type: isMutualFund ? 'MF' : 'EQUITY',
            currency: 'INR'
          });
      }

      // Merge duplicate tickers (e.g. same MF scheme across multiple folios)
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
    } catch (error) {
      throw new Error('Failed to parse Groww file: ' + error.message);
    }
  }
}

class BrokerParserFactory {
  static getParser(brokerName) {
    const brokers = {
      'zerodha': new ZerodhaStrategy(),
      'groww': new GrowwStrategy(),
    };

    const parser = brokers[brokerName.toLowerCase()];
    if (!parser) {
      throw new Error(`Parser for broker ${brokerName} not implemented.`);
    }
    return parser;
  }
}

module.exports = { BrokerParserFactory };
