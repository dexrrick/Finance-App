export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

const STORAGE_KEY_FX_CACHE = 'finance_fx_rates_cache_v1';
const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v1/latest';
const FRANKFURTER_API_FALLBACK = 'https://api.frankfurter.app/latest';

interface FxRateCache {
  base: string;
  date: string;
  timestamp: number;
  rates: Record<string, number>;
}

export class CurrencyService {
  /**
   * Detect user's home currency based on phone locale / browser navigator
   */
  static detectDeviceCurrency(): CurrencyInfo {
    try {
      const locale = (navigator.languages && navigator.languages[0]) || navigator.language || 'en-US';
      const parts = locale.split(/[-_]/);
      const region = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase();

      const regionMap: Record<string, string> = {
        MY: 'MYR',
        SG: 'SGD',
        US: 'USD',
        GB: 'GBP',
        UK: 'GBP',
        JP: 'JPY',
        AU: 'AUD',
        CA: 'CAD',
        CH: 'CHF',
        CN: 'CNY',
        HK: 'HKD',
        IN: 'INR',
        ID: 'IDR',
        KR: 'KRW',
        TH: 'THB',
        PH: 'PHP',
        NZ: 'NZD',
        BR: 'BRL',
        MX: 'MXN',
        NO: 'NOK',
        SE: 'SEK',
        DK: 'DKK',
        PL: 'PLN',
        TR: 'TRY',
        ZA: 'ZAR',
        // Eurozone common countries
        DE: 'EUR',
        FR: 'EUR',
        IT: 'EUR',
        ES: 'EUR',
        NL: 'EUR',
        BE: 'EUR',
        AT: 'EUR',
        PT: 'EUR',
        FI: 'EUR',
        IE: 'EUR',
        GR: 'EUR',
      };

      const matchedCode = regionMap[region];
      if (matchedCode) {
        const found = SUPPORTED_CURRENCIES.find((c) => c.code === matchedCode);
        if (found) return found;
      }
    } catch (e) {
      console.warn('Could not detect device currency locale', e);
    }

    // Default fallback
    return { code: 'USD', symbol: '$', name: 'US Dollar' };
  }

  /**
   * Get cached exchange rates from localStorage
   */
  static getCachedRates(baseCurrency: string): FxRateCache | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FX_CACHE);
      if (raw) {
        const parsed: FxRateCache = JSON.parse(raw);
        if (parsed && parsed.base === baseCurrency) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading FX rates cache', e);
    }
    return null;
  }

  /**
   * Fetch latest exchange rates from Frankfurter API
   */
  static async fetchLatestRates(
    baseCurrency: string,
    forceRefresh = false
  ): Promise<{
    success: boolean;
    rates: Record<string, number>;
    date: string;
    fromCache: boolean;
    error?: string;
  }> {
    const cached = this.getCachedRates(baseCurrency);
    const ONE_HOUR = 60 * 60 * 1000;

    // Use cache if fresh and not forced
    if (!forceRefresh && cached && Date.now() - cached.timestamp < ONE_HOUR) {
      return {
        success: true,
        rates: cached.rates,
        date: cached.date,
        fromCache: true,
      };
    }

    // Fetch from Frankfurter API
    try {
      let res = await fetch(`${FRANKFURTER_API_URL}?base=${encodeURIComponent(baseCurrency)}`, {
        signal: AbortSignal.timeout(6000),
      }).catch(() => null);

      if (!res || !res.ok) {
        // Fallback endpoint
        res = await fetch(`${FRANKFURTER_API_FALLBACK}?base=${encodeURIComponent(baseCurrency)}`, {
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        const rates: Record<string, number> = {
          ...data.rates,
          [baseCurrency]: 1.0,
        };

        const cacheData: FxRateCache = {
          base: baseCurrency,
          date: data.date || new Date().toISOString().split('T')[0],
          timestamp: Date.now(),
          rates,
        };

        try {
          localStorage.setItem(STORAGE_KEY_FX_CACHE, JSON.stringify(cacheData));
        } catch (storageErr) {
          console.warn('Could not cache FX rates in localStorage', storageErr);
        }

        return {
          success: true,
          rates,
          date: cacheData.date,
          fromCache: false,
        };
      }
    } catch (apiErr: unknown) {
      console.warn('Frankfurter API fetch failed, checking cached rates', apiErr);
    }

    // Return stale cache if available
    if (cached) {
      return {
        success: true,
        rates: cached.rates,
        date: cached.date,
        fromCache: true,
      };
    }

    return {
      success: false,
      rates: { [baseCurrency]: 1.0 },
      date: new Date().toISOString().split('T')[0],
      fromCache: false,
      error: 'Unable to fetch exchange rates. Using default 1:1 conversion.',
    };
  }

  /**
   * Convert an amount between currencies using cached rates or custom rate
   */
  static convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    customRate?: number
  ): { convertedAmount: number; rate: number } {
    if (fromCurrency === toCurrency) {
      return { convertedAmount: amount, rate: 1.0 };
    }

    if (customRate && customRate > 0) {
      const converted = Math.round(amount * customRate * 100) / 100;
      return { convertedAmount: converted, rate: customRate };
    }

    // Lookup cached rate
    const cache = this.getCachedRates(toCurrency);
    if (cache && cache.rates) {
      const rateTo = cache.rates[fromCurrency]; // e.g. base = USD, from = EUR: rate is USD/EUR or EUR/USD
      if (rateTo && rateTo > 0) {
        const rate = 1 / rateTo;
        const converted = Math.round(amount * rate * 100) / 100;
        return { convertedAmount: converted, rate: Math.round(rate * 10000) / 10000 };
      }
    }

    // Check inverse cache
    const inverseCache = this.getCachedRates(fromCurrency);
    if (inverseCache && inverseCache.rates) {
      const rate = inverseCache.rates[toCurrency];
      if (rate && rate > 0) {
        const converted = Math.round(amount * rate * 100) / 100;
        return { convertedAmount: converted, rate: Math.round(rate * 10000) / 10000 };
      }
    }

    // Fallback 1:1 if no rates found
    return { convertedAmount: amount, rate: 1.0 };
  }

  /**
   * Helper to get currency info
   */
  static getCurrencyInfo(code: string): CurrencyInfo {
    const found = SUPPORTED_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
    return found || { code: code.toUpperCase(), symbol: code, name: code };
  }
}
