import { DEFAULT_ACCOUNTS } from '../core/accounts';
import { getInitialDemoTransactions } from '../core/accounting';
import { Account, AccountColumnConfig, AppSettings, DashboardCardConfig, Transaction } from '../core/types';
import { CurrencyService } from '../core/currencyService';

const STORAGE_KEY_ACCOUNTS = 'agy_wallet_accounts_v1';
const STORAGE_KEY_TRANSACTIONS = 'agy_wallet_transactions_v1';
const STORAGE_KEY_SETTINGS = 'agy_wallet_settings_v1';

const detectedCurrency = CurrencyService.detectDeviceCurrency();

export const DEFAULT_DASHBOARD_CARDS: DashboardCardConfig[] = [
  { id: 'equation_status', label: 'Accounting Equation Status', enabled: true },
  { id: 'net_worth', label: 'Net Worth Card', enabled: true },
  { id: 'total_assets', label: 'Total Assets Card', enabled: true },
  { id: 'total_liabilities', label: 'Total Liabilities Card', enabled: true },
  { id: 'net_income', label: 'Period Net Income Card', enabled: true },
  { id: 'quick_actions', label: 'Quick Actions Bar', enabled: true },
  { id: 'recent_transactions', label: 'Recent Transactions List', enabled: true },
  { id: 'expense_breakdown', label: 'Top Expenses Breakdown', enabled: true },
  { id: 'liquid_cash', label: 'Liquid Cash & Accounts', enabled: true },
];

export const DEFAULT_ACCOUNT_COLUMNS: AccountColumnConfig[] = [
  { id: 'name', label: 'Account Name', enabled: true },
  { id: 'category', label: 'Category', enabled: true },
  { id: 'balance', label: 'Current Balance', enabled: true },
  { id: 'code', label: 'Account Code', enabled: false },
  { id: 'subcategory', label: 'Subcategory', enabled: false },
  { id: 'normalBalance', label: 'Normal Balance (Dr/Cr)', enabled: false },
];

export const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: detectedCurrency.symbol,
  baseCurrency: detectedCurrency.code,
  baseCurrencyLocked: false,
  dateFormat: 'YYYY-MM-DD',
  enableSound: true,
  theme: 'dark',
  fontSize: 'default',
  tabPosition: 'bottom',
  tabConfig: [
    { id: 'dashboard', label: 'Dashboard', enabled: true },
    { id: 'journal', label: 'General Ledger', enabled: true },
    { id: 'reconcile', label: 'Bank Feeds', enabled: true },
    { id: 'accounts', label: 'Accounts', enabled: true },
    { id: 'reports', label: 'Reports', enabled: true },
    { id: 'settings', label: 'Settings', enabled: true },
  ],
  dashboardCards: DEFAULT_DASHBOARD_CARDS,
  accountColumns: DEFAULT_ACCOUNT_COLUMNS,
  googleSync: {
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
        let tabConfig = parsed.tabConfig;
        if (!Array.isArray(tabConfig) || tabConfig.length === 0) {
          tabConfig = DEFAULT_SETTINGS.tabConfig;
        } else {
          const existingIds = new Set(tabConfig.map((t: { id: string }) => t.id));
          DEFAULT_SETTINGS.tabConfig?.forEach((dt) => {
            if (!existingIds.has(dt.id)) {
              tabConfig.push(dt);
            }
          });
        }

        let dashboardCards = parsed.dashboardCards;
        if (!Array.isArray(dashboardCards) || dashboardCards.length === 0) {
          dashboardCards = DEFAULT_SETTINGS.dashboardCards;
        } else {
          const existingCardIds = new Set(dashboardCards.map((c: { id: string }) => c.id));
          DEFAULT_SETTINGS.dashboardCards?.forEach((dc) => {
            if (!existingCardIds.has(dc.id)) {
              dashboardCards.push(dc);
            }
          });
        }

        let accountColumns = parsed.accountColumns;
        if (!Array.isArray(accountColumns) || accountColumns.length === 0) {
          accountColumns = DEFAULT_SETTINGS.accountColumns;
        } else {
          const existingColIds = new Set(accountColumns.map((c: { id: string }) => c.id));
          DEFAULT_SETTINGS.accountColumns?.forEach((dc) => {
            if (!existingColIds.has(dc.id)) {
              accountColumns.push(dc);
            }
          });
        }

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          baseCurrency: parsed.baseCurrency || detectedCurrency.code,
          currencySymbol: parsed.currencySymbol || detectedCurrency.symbol,
          baseCurrencyLocked: parsed.baseCurrencyLocked ?? false,
          tabConfig,
          dashboardCards,
          accountColumns,
          googleSync: {
            ...DEFAULT_SETTINGS.googleSync,
            ...(parsed.googleSync || {}),
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
