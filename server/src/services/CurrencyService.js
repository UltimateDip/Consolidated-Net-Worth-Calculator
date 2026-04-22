const logger = require('../utils/logger');
const { getGlobalDb } = require('../models/db');

class CurrencyService {
    constructor() {
        this.cache = {}; // Simple in-memory cache to prevent spamming
        this.cacheTime = 3600 * 1000; // 1 hour cache
    }

    async fetchAndCacheInrRates(now, todayDate) {
        // Only fetch if we haven't fetched INR rates recently
        if (this.cache['INR_RATES_FETCHED'] && now - this.cache['INR_RATES_FETCHED'] < this.cacheTime) {
            return true;
        }

        const globalDb = getGlobalDb();

        try {
            // Using open.er-api.com to fetch everything relative to INR
            const response = await fetch(`https://open.er-api.com/v6/latest/INR`);
            const data = await response.json();
            
            if (data.result === 'success' && data.rates) {
                globalDb.transaction(() => {
                    const stmt = globalDb.prepare(`
                        INSERT INTO fx_rates (date, currency, rate) 
                        VALUES (?, ?, ?)
                        ON CONFLICT(date, currency) DO UPDATE SET rate = excluded.rate
                    `);
                    
                    const supportedCurrencies = ['USD', 'EUR', 'INR', 'GBP'];
                    
                    for (const [currency, rate] of Object.entries(data.rates)) {
                        if (!supportedCurrencies.includes(currency)) continue;

                        stmt.run(todayDate, currency, rate);
                        // Save to in-memory cache as INR -> Currency
                        this.cache[`INR_${currency}`] = { rate, timestamp: now };
                    }
                })();
                
                this.cache['INR_RATES_FETCHED'] = now;
                return true;
            }
            throw new Error('API response unsuccessful or missing rates');
        } catch (error) {
            logger.warn(`[CurrencyService] API fetch failed: ${error.message}.`);
            return false;
        }
    }

    async getExchangeRate(fromCurrency, toCurrency) {
        if (!fromCurrency || !toCurrency) return 1;
        const from = fromCurrency.toUpperCase();
        const to = toCurrency.toUpperCase();
        if (from === to) return 1;

        const now = Date.now();
        const todayDate = new Date().toISOString().split('T')[0];

        // Ensure we have fresh INR rates
        await this.fetchAndCacheInrRates(now, todayDate);

        // Fetch INR->From and INR->To directly from historical DB
        const rateFrom = await this.getHistoricalExchangeRate(todayDate, 'INR', from);
        const rateTo = await this.getHistoricalExchangeRate(todayDate, 'INR', to);

        if (rateFrom && rateTo) {
            return rateTo / rateFrom;
        }

        return 1; // Fallback to 1:1 if absolute disaster
    }

    async getHistoricalExchangeRate(date, fromCurrency, toCurrency) {
        if (!fromCurrency || !toCurrency) return 1;
        const from = fromCurrency.toUpperCase();
        const to = toCurrency.toUpperCase();
        if (from === to) return 1;

        // INR to INR edge case check
        const getRateVsInr = (currency) => {
            if (currency === 'INR') return 1;

            const globalDb = getGlobalDb();
            let row = globalDb.prepare('SELECT rate FROM fx_rates WHERE date = ? AND currency = ?').get(date, currency);
            
            if (!row) {
                row = globalDb.prepare('SELECT rate FROM fx_rates WHERE date <= ? AND currency = ? ORDER BY date DESC LIMIT 1').get(date, currency);
            }

            if (!row) {
                row = globalDb.prepare('SELECT rate FROM fx_rates WHERE date > ? AND currency = ? ORDER BY date ASC LIMIT 1').get(date, currency);
            }

            return row ? row.rate : null;
        };

        const rateFrom = getRateVsInr(from);
        const rateTo = getRateVsInr(to);

        if (rateFrom && rateTo) {
            return rateTo / rateFrom;
        }

        logger.error(`[CurrencyService] Historical FX error for ${from}->${to} on ${date}. Missing INR mappings. Defaulting to 1.`);
        return 1;
    }

    // Synchronous, DB-only rate lookup (no external API calls)
    getCachedRate(fromCurrency, toCurrency) {
        if (!fromCurrency || !toCurrency) return 1;
        const from = fromCurrency.toUpperCase();
        const to = toCurrency.toUpperCase();
        if (from === to) return 1;

        // Check in-memory cache first
        const cacheKey = `${from}_${to}`;
        const now = Date.now();
        if (this.cache[cacheKey] && now - this.cache[cacheKey].timestamp < this.cacheTime) {
            return this.cache[cacheKey].rate;
        }

        // Fall back to DB
        try {
            const globalDb = getGlobalDb();
            const getRateVsInr = (currency) => {
                if (currency === 'INR') return 1;
                const row = globalDb.prepare('SELECT rate FROM fx_rates WHERE currency = ? ORDER BY date DESC LIMIT 1').get(currency);
                return row ? row.rate : null;
            };

            const rateFrom = getRateVsInr(from);
            const rateTo = getRateVsInr(to);

            if (rateFrom && rateTo) {
                return rateTo / rateFrom;
            }
        } catch (err) {
            logger.warn(`[CurrencyService] getCachedRate error: ${err.message}`);
        }

        return 1;
    }
}

module.exports = new CurrencyService();
