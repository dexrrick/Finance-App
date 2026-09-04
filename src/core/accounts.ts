import { Account, AccountCategory, NormalBalance } from './types';

export function getNormalBalance(category: AccountCategory): NormalBalance {
  switch (category) {
    case 'ASSET':
    case 'EXPENSE':
    case 'OTHER_EXPENSE':
      return 'DEBIT';
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
    case 'OTHER_INCOME':
      return 'CREDIT';
  }
}

export const CATEGORY_CODE_PREFIX: Record<AccountCategory, string> = {
  ASSET: '1',
  LIABILITY: '2',
  EQUITY: '3',
  REVENUE: '4',
  EXPENSE: '5',
  OTHER_INCOME: '6',
  OTHER_EXPENSE: '7',
};

export const CATEGORY_LABELS: Record<AccountCategory, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue (Operating)',
  EXPENSE: 'Expense (Operating)',
  OTHER_INCOME: 'Other Income',
  OTHER_EXPENSE: 'Other Expense',
};

export function isValidAccountCode(code: string, category: AccountCategory): boolean {
  const prefix = CATEGORY_CODE_PREFIX[category];
  return typeof code === 'string' && code.trim().startsWith(prefix);
}

export function getSuggestedNextAccountCode(category: AccountCategory, accounts: Account[]): string {
  const prefix = CATEGORY_CODE_PREFIX[category];
  const matchingCodes = accounts
    .filter((a) => a.category === category && a.code && a.code.startsWith(prefix))
    .map((a) => parseInt(a.code, 10))
    .filter((n) => !isNaN(n));

  if (matchingCodes.length === 0) {
    return `${prefix}010`;
  }

  const maxCode = Math.max(...matchingCodes);
  // Suggest next in increments of 10
  const next = Math.floor(maxCode / 10) * 10 + 10;
  return next.toString();
}

export const DEFAULT_ACCOUNTS: Account[] = [
  // 1000s: ASSETS (Debit normal)
  {
    id: 'acc-cash',
    code: '1010',
    name: 'Cash in Hand',
    category: 'ASSET',
    subcategory: 'Liquid Cash',
    description: 'Physical cash and pocket money',
    normalBalance: 'DEBIT',
    isSystem: true,
    isActive: true,
    icon: 'Banknote',
  },
  {
    id: 'acc-checking',
    code: '1020',
    name: 'Bank Checking Account',
    category: 'ASSET',
    subcategory: 'Bank Accounts',
    description: 'Main checking account for daily expenses',
    normalBalance: 'DEBIT',
    isSystem: true,
    isActive: true,
    icon: 'Building2',
  },
  {
    id: 'acc-savings',
    code: '1030',
    name: 'Savings Account',
    category: 'ASSET',
    subcategory: 'Bank Accounts',
    description: 'Emergency fund and high-yield savings',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'PiggyBank',
  },
  {
    id: 'acc-digital-wallet',
    code: '1040',
    name: 'Digital Wallet (PayPal / Apple Pay)',
    category: 'ASSET',
    subcategory: 'Digital Funds',
    description: 'E-wallets and online payment services',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'Smartphone',
  },
  {
    id: 'acc-investments',
    code: '1110',
    name: 'Investments & Stocks',
    category: 'ASSET',
    subcategory: 'Investments',
    description: 'Stock brokerage, ETFs, and portfolio value',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'TrendingUp',
  },

  // 2000s: LIABILITIES (Credit normal)
  {
    id: 'acc-credit-card',
    code: '2010',
    name: 'Credit Card',
    category: 'LIABILITY',
    subcategory: 'Revolving Credit',
    description: 'Primary credit card account',
    normalBalance: 'CREDIT',
    isSystem: true,
    isActive: true,
    icon: 'CreditCard',
  },
  {
    id: 'acc-personal-loan',
    code: '2110',
    name: 'Personal Loan / Debt',
    category: 'LIABILITY',
    subcategory: 'Loans Payable',
    description: 'Personal loans or money owed to others',
    normalBalance: 'CREDIT',
    isSystem: false,
    isActive: true,
    icon: 'FileText',
  },

  // 3000s: EQUITY (Credit normal)
  {
    id: 'acc-opening-balance',
    code: '3010',
    name: 'Opening Balance Equity',
    category: 'EQUITY',
    subcategory: 'Initial Capital',
    description: 'Initial net worth when starting books',
    normalBalance: 'CREDIT',
    isSystem: true,
    isActive: true,
    icon: 'Scale',
  },
  {
    id: 'acc-retained-earnings',
    code: '3020',
    name: 'Retained Earnings',
    category: 'EQUITY',
    subcategory: 'Accumulated Profit',
    description: 'Accumulated net income over past periods',
    normalBalance: 'CREDIT',
    isSystem: true,
    isActive: true,
    icon: 'Award',
  },

  // 4000s: REVENUE / INCOME (Credit normal)
  {
    id: 'acc-salary',
    code: '4010',
    name: 'Salary & Wages',
    category: 'REVENUE',
    subcategory: 'Earned Income',
    description: 'Primary job employment salary',
    normalBalance: 'CREDIT',
    isSystem: true,
    isActive: true,
    icon: 'Briefcase',
  },
  {
    id: 'acc-freelance',
    code: '4020',
    name: 'Freelance & Consulting',
    category: 'REVENUE',
    subcategory: 'Business Income',
    description: 'Contract work and side projects',
    normalBalance: 'CREDIT',
    isSystem: false,
    isActive: true,
    icon: 'Laptop',
  },

  // 5000s: EXPENSES (Debit normal)
  {
    id: 'acc-groceries',
    code: '5010',
    name: 'Groceries & Supermarket',
    category: 'EXPENSE',
    subcategory: 'Living Essentials',
    description: 'Food ingredients, home cooking supplies',
    normalBalance: 'DEBIT',
    isSystem: true,
    isActive: true,
    icon: 'ShoppingBag',
  },
  {
    id: 'acc-dining',
    code: '5020',
    name: 'Dining & Restaurants',
    category: 'EXPENSE',
    subcategory: 'Food & Dining',
    description: 'Cafes, takeout, dining out with friends',
    normalBalance: 'DEBIT',
    isSystem: true,
    isActive: true,
    icon: 'Utensils',
  },
  {
    id: 'acc-housing',
    code: '5030',
    name: 'Rent & Housing',
    category: 'EXPENSE',
    subcategory: 'Housing',
    description: 'Monthly rent, mortgage payments, HOA',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'Home',
  },
  {
    id: 'acc-utilities',
    code: '5040',
    name: 'Utilities & Internet',
    category: 'EXPENSE',
    subcategory: 'Housing',
    description: 'Electricity, water, gas, home fiber internet',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'Zap',
  },
  {
    id: 'acc-transport',
    code: '5050',
    name: 'Transport & Fuel',
    category: 'EXPENSE',
    subcategory: 'Transportation',
    description: 'Public transit, gas, parking, rideshare',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'Car',
  },
  {
    id: 'acc-shopping',
    code: '5060',
    name: 'Shopping & Electronics',
    category: 'EXPENSE',
    subcategory: 'Personal',
    description: 'Clothing, gadgets, household items',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'ShoppingBag',
  },
  {
    id: 'acc-entertainment',
    code: '5070',
    name: 'Entertainment & Fun',
    category: 'EXPENSE',
    subcategory: 'Leisure',
    description: 'Movies, gaming, events, hobbies',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'Gamepad2',
  },
  {
    id: 'acc-subscriptions',
    code: '5080',
    name: 'Subscriptions & Software',
    category: 'EXPENSE',
    subcategory: 'Recurring Services',
    description: 'Cloud services, streaming, mobile plans',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'Calendar',
  },
  {
    id: 'acc-healthcare',
    code: '5090',
    name: 'Health & Medical',
    category: 'EXPENSE',
    subcategory: 'Healthcare',
    description: 'Doctor visits, pharmacy, wellness',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'HeartPulse',
  },
  {
    id: 'acc-misc-expense',
    code: '5990',
    name: 'Miscellaneous Expense',
    category: 'EXPENSE',
    subcategory: 'Other',
    description: 'Uncategorized daily miscellaneous costs',
    normalBalance: 'DEBIT',
    isSystem: true,
    isActive: true,
    icon: 'Layers',
  },

  // 6000s: OTHER INCOME (Credit normal - non-operating)
  {
    id: 'acc-investment-income',
    code: '6010',
    name: 'Dividends & Interest',
    category: 'OTHER_INCOME',
    subcategory: 'Passive Income',
    description: 'Interest from savings, fixed deposits, and dividend payouts',
    normalBalance: 'CREDIT',
    isSystem: false,
    isActive: true,
    icon: 'Coins',
  },
  {
    id: 'acc-other-income',
    code: '6020',
    name: 'Other Income',
    category: 'OTHER_INCOME',
    subcategory: 'Miscellaneous',
    description: 'Gifts, refunds, cashbacks, FX gains, other non-operating revenue',
    normalBalance: 'CREDIT',
    isSystem: false,
    isActive: true,
    icon: 'Gift',
  },

  // 7000s: OTHER EXPENSES (Debit normal - non-operating)
  {
    id: 'acc-bank-fees',
    code: '7010',
    name: 'Bank Fees & Service Charges',
    category: 'OTHER_EXPENSE',
    subcategory: 'Banking & Finance',
    description: 'Account maintenance fees, ATM charges, wire transfer fees',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'CreditCard',
  },
  {
    id: 'acc-interest-expense',
    code: '7020',
    name: 'Interest & Finance Charges',
    category: 'OTHER_EXPENSE',
    subcategory: 'Finance Charges',
    description: 'Interest paid on credit cards, overdrafts, or loans',
    normalBalance: 'DEBIT',
    isSystem: false,
    isActive: true,
    icon: 'Percent',
  },
];
