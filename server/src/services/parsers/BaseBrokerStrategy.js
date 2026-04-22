const xlsx = require('xlsx');

class BaseBrokerStrategy {
  async parse(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const dataRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    const mappedResults = [];
    let columnMap = null;

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      // 1. Try to identify the header if we haven't yet
      if (!columnMap) {
        columnMap = this.identifyHeader(row);
        continue; // Move to next row after finding header
      }

      // 2. Map the row using the discovered indices
      const mapped = this.mapRow(row, columnMap);
      if (mapped) {
        mappedResults.push(mapped);
      }
    }

    return this.postProcess(mappedResults);
  }

  /**
   * Returns an object mapping field names to column indices, or null if not a header row.
   */
  identifyHeader(row) {
    throw new Error('identifyHeader(row) must be implemented');
  }

  /**
   * Maps a row using the provided columnMap.
   */
  mapRow(row, columnMap) {
    throw new Error('mapRow(row, columnMap) must be implemented');
  }

  postProcess(results) {
    return results;
  }
}

module.exports = BaseBrokerStrategy;
