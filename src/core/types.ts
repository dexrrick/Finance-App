export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  code: string;           // E.g., "1010", "2010", "4010", "5010"
  name: string;           // E.g., "Cash on Hand", "Credit Card", "Salary", "Food & Dining"
  category: AccountCategory;
  subcategory?: string;   // E.g., "Current Assets", "Operating Expense"
  description?: string;
  normalBalance: NormalBalance;
  isSystem?: boolean;
  isActive: boolean;
  icon?: string;
}

export interface EntryLeg {
  id: string;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;         // Positive number rounded to 2 decimal places
  memo?: string;
}

export interface Transaction {
  id: string;
  date: string;           // YYYY-MM-DD
  description: string;
  reference?: string;     // Receipt #, Check #, Invoice #
  tags?: string[];
  legs: EntryLeg[];       // Sum(DEBIT) must equal Sum(CREDIT)
  meta?: {
    simpleMode?: 'expense' | 'income' | 'transfer' | 'journal';
    paymentAccountId?: string;
    categoryAccountId?: string;
    reconciledFromLineId?: string;
    memo?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalance {
  account: Account;
  totalDebit: number;
  totalCredit: number;
  balance: number;        // Calculated according to normal balance
}

export interface TrialBalanceRow {
  account: Account;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
}

export interface BalanceSheet {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;      // Current period retained earnings (Revenue - Expense)
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
}

export interface IncomeStatement {
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
}
export interface BudgetConfig {
  dailyDiscretionaryBudget: number;    // E.g. $50
  monthlyDiscretionaryBudget: number;  // E.g. $1,500
  essentialAccountCodes: string[];     // E.g. ['5010', '5030', '5040', '5090', '2010', '2110']
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: UserProfile;
}

export interface BankStatementLine {
  id: string;
  date: string;
  description: string;
  amount: number; // positive = Money In / Inflow, negative = Money Out / Spent
  status: 'unreconciled' | 'reconciled' | 'ignored';
  matchedRuleId?: string;
  suggestedAccountId?: string;
  suggestedPayee?: string;
  reconciledTxId?: string;
}

export interface BankRule {
  id: string;
  name: string;
  pattern: string; // e.g. "salary", "uber", "walmart"
  condition: 'contains' | 'equals' | 'starts_with';
  direction: 'any' | 'inflow' | 'outflow';
  targetAccountId: string; // Account code e.g. "4010", "5010"
  defaultPayee?: string;
}

export interface AppSettings {
  currencySymbol: string;
  dateFormat: string;
  enableSound: boolean;
  theme?: 'dark' | 'light';
  auth?: {
    user: UserProfile | null;
    token: string | null;
    isGuest?: boolean;
  };
  cloudSync?: {
    workerUrl: string;
    secretKey: string;
    autoSync: boolean;
    lastSyncedAt?: string;
  };
  budgetConfig?: BudgetConfig;
  bankRules?: BankRule[];
}

export interface AppDataBackup {
  version: number;
  exportedAt: string;
  generator: string;
  accounts: Account[];
  transactions: Transaction[];
  settings: AppSettings;
}

