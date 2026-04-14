class CurrencyService {
    constructor() {
        this.cache = {}; // Simple in-memory cache to prevent spamming
        this.cacheTime = 3600 * 1000; // 1 hour cache
    }

    async getExchangeRate(fromCurrency, toCurrency) {
        if (!fromCurrency || !toCurrency) return 1;
        const from = fromCurrency.toUpperCase();
        const to = toCurrency.toUpperCase();
        if (from === to) return 1;

        const cacheKey = `${from}_${to}`;
        const now = Date.now();

        // Check Cache
        if (this.cache[cacheKey] && now - this.cache[cacheKey].timestamp < this.cacheTime) {
            return this.cache[cacheKey].rate;
        }

        try {
            // Using open.er-api.com which provides free daily updated forex rates relative to USD without an API key!
            const response = await fetch(`https://open.er-api.com/v6/latest/${from}`);
            const data = await response.json();
            
            if (data.result === 'success' && data.rates[to]) {
                const rate = data.rates[to];
                // Save to cache
                this.cache[cacheKey] = { rate, timestamp: now };
                // Also cache the reverse rate implicitly
                this.cache[`${to}_${from}`] = { rate: 1 / rate, timestamp: now };
                return rate;
            } else {
                console.warn(`[CurrencyService] Rate not found for ${from} to ${to}`);
                return 1;
            }
        } catch (error) {
            console.error(`[CurrencyService] Error fetching explicit fx rate: ${error.message}`);
            return 1; // Fallback to 1:1 safely
        }
    }
}

module.exports = new CurrencyService();
