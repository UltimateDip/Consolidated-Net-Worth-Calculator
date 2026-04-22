const ZerodhaStrategy = require('./ZerodhaStrategy');
const GrowwStrategy = require('./GrowwStrategy');

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

module.exports = BrokerParserFactory;
