import { DEFAULT_ACCOUNTS } from '../core/accounts';
import { getInitialDemoTransactions } from '../core/accounting';
import { Account, AppSettings, Transaction } from '../core/types';

const STORAGE_KEY_ACCOUNTS = 'agy_wallet_accounts_v1';
const STORAGE_KEY_TRANSACTIONS = 'agy_wallet_transactions_v1';
const STORAGE_KEY_SETTINGS = 'agy_wallet_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: '$',
  dateFormat: 'YYYY-MM-DD',
  enableSound: true,
  theme: 'dark',
  cloudSync: {
    workerUrl: '',
    secretKey: '',
    autoSync: false,
  },
  budgetConfig: {
    dailyDiscretionaryBudget: 50,
    monthlyDiscretionaryBudget: 1500,
    essentialAccountCodes: ['5010', '5030', '5040', '5090', '2010', '2110'],
  },
};


export class AppDatabase {
  static loadAccounts(): Account[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load accounts from storage, using defaults', e);
    }
    this.saveAccounts(DEFAULT_ACCOUNTS);
    return DEFAULT_ACCOUNTS;
  }

  static saveAccounts(accounts: Account[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    } catch (e) {
      console.error('Failed to save accounts to storage', e);
    }
  }

  static loadTransactions(): Transaction[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load transactions from storage', e);
    }
    const initial = getInitialDemoTransactions();
    this.saveTransactions(initial);
    return initial;
  }

  static saveTransactions(transactions: Transaction[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed to save transactions to storage', e);
    }
  }

  static loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          cloudSync: {
            ...DEFAULT_SETTINGS.cloudSync,
            ...(parsed.cloudSync || {}),
          },
        };
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    this.saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  static resetToDemo(): { accounts: Account[]; transactions: Transaction[]; settings: AppSettings } {
    const accounts = [...DEFAULT_ACCOUNTS];
    const transactions = getInitialDemoTransactions();
    const settings = { ...DEFAULT_SETTINGS };

    this.saveAccounts(accounts);
    this.saveTransactions(transactions);
    this.saveSettings(settings);

    return { accounts, transactions, settings };
  }

  static clearAll(): { accounts: Account[]; transactions: Transaction[]; settings: AppSettings } {
    const accounts = [...DEFAULT_ACCOUNTS];
    const transactions: Transaction[] = [];
    const settings = { ...DEFAULT_SETTINGS };

    this.saveAccounts(accounts);
    this.saveTransactions(transactions);
    this.saveSettings(settings);

    return { accounts, transactions, settings };
  }
}
