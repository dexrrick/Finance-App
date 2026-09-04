import {
  Account,
  AccountBalance,
  BalanceSheet,
  EntryLeg,
  IncomeStatement,
  Transaction,
  TrialBalance,
  TrialBalanceRow,
} from './types';

/**
 * Round to 2 decimal places to avoid floating point imprecision
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Format currency with customizable symbol
 */
export function formatCurrency(amount: number, symbol = '$'): string {
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Validate that a transaction's debits and credits balance to 0.00
 */
export function validateTransaction(legs: EntryLeg[]): {
  isValid: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  error?: string;
} {
  if (!legs || legs.length < 2) {
    return {
      isValid: false,
      totalDebit: 0,
      totalCredit: 0,
      difference: 0,
      error: 'A journal transaction must have at least two legs.',
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const leg of legs) {
    if (!leg.accountId) {
      return {
        isValid: false,
        totalDebit,
        totalCredit,
        difference: 0,
        error: 'Every leg must specify an account.',
      };
    }
    if (typeof leg.amount !== 'number' || isNaN(leg.amount) || leg.amount <= 0) {
      return {
        isValid: false,
        totalDebit,
        totalCredit,
        difference: 0,
        error: 'All entry amounts must be greater than zero.',
      };
    }

    if (leg.type === 'DEBIT') {
      totalDebit += leg.amount;
    } else if (leg.type === 'CREDIT') {
      totalCredit += leg.amount;
    }
  }

  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  const difference = round2(Math.abs(totalDebit - totalCredit));

  if (difference !== 0) {
    return {
      isValid: false,
      totalDebit,
      totalCredit,
      difference,
      error: `Debits (${totalDebit.toFixed(2)}) must equal Credits (${totalCredit.toFixed(2)}). Discrepancy: ${difference.toFixed(2)}`,
    };
  }

  return {
    isValid: true,
    totalDebit,
    totalCredit,
    difference: 0,
  };
}

/**
 * Helper to build a balanced transaction from simple user inputs
 */
export function createSimpleTransaction(params: {
  date: string;
  description: string;
  mode: 'expense' | 'income' | 'transfer';
  amount: number;
  paymentAccountId: string;   // For Expense: source of funds; For Income: destination; For Transfer: source
  categoryOrTargetAccountId: string; // For Expense: expense category; For Income: revenue category; For Transfer: target
  reference?: string;
  tags?: string[];
}): Transaction {
  const { date, description, mode, amount, paymentAccountId, categoryOrTargetAccountId, reference, tags } = params;
  const roundedAmount = round2(amount);
  const now = new Date().toISOString();
  const txId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  let legs: EntryLeg[] = [];

  if (mode === 'expense') {
    // Expense: Debit Expense Account, Credit Asset/Liability (Payment Account)
    legs = [
      {
        id: 'leg-1',
        accountId: categoryOrTargetAccountId,
        type: 'DEBIT',
        amount: roundedAmount,
        memo: description,
      },
      {
        id: 'leg-2',
        accountId: paymentAccountId,
        type: 'CREDIT',
        amount: roundedAmount,
        memo: `Paid via ${paymentAccountId}`,
      },
    ];
  } else if (mode === 'income') {
    // Income: Debit Asset (Payment Account), Credit Revenue Account
    legs = [
      {
        id: 'leg-1',
        accountId: paymentAccountId,
        type: 'DEBIT',
        amount: roundedAmount,
        memo: `Received to ${paymentAccountId}`,
      },
      {
        id: 'leg-2',
        accountId: categoryOrTargetAccountId,
        type: 'CREDIT',
        amount: roundedAmount,
        memo: description,
      },
    ];
  } else if (mode === 'transfer') {
    // Transfer: Debit Destination Asset, Credit Source Asset
    legs = [
      {
        id: 'leg-1',
        accountId: categoryOrTargetAccountId,
        type: 'DEBIT',
        amount: roundedAmount,
        memo: `Transfer into ${categoryOrTargetAccountId}`,
      },
      {
        id: 'leg-2',
        accountId: paymentAccountId,
        type: 'CREDIT',
        amount: roundedAmount,
        memo: `Transfer out from ${paymentAccountId}`,
      },
    ];
  }

  return {
    id: txId,
    date,
    description,
    reference,
    tags,
    legs,
    meta: {
      simpleMode: mode,
      paymentAccountId,
      categoryAccountId: categoryOrTargetAccountId,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Calculate balances for all accounts across all transactions
 */
export function calculateAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Map<string, AccountBalance> {
  const balanceMap = new Map<string, AccountBalance>();

  for (const acc of accounts) {
    balanceMap.set(acc.id, {
      account: acc,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
    });
  }

  for (const tx of transactions) {
    for (const leg of tx.legs) {
      const record = balanceMap.get(leg.accountId);
      if (record) {
        if (leg.type === 'DEBIT') {
          record.totalDebit = round2(record.totalDebit + leg.amount);
        } else if (leg.type === 'CREDIT') {
          record.totalCredit = round2(record.totalCredit + leg.amount);
        }
      }
    }
  }

  for (const record of balanceMap.values()) {
    if (record.account.normalBalance === 'DEBIT') {
      record.balance = round2(record.totalDebit - record.totalCredit);
    } else {
      record.balance = round2(record.totalCredit - record.totalDebit);
    }
  }

  return balanceMap;
}

/**
 * Calculate Trial Balance
 */
export function generateTrialBalance(
  accounts: Account[],
  transactions: Transaction[]
): TrialBalance {
  const balances = calculateAccountBalances(accounts, transactions);
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const acc of accounts) {
    const bal = balances.get(acc.id);
    if (!bal || (bal.totalDebit === 0 && bal.totalCredit === 0)) {
      continue;
    }

    let netDebit = 0;
    let netCredit = 0;

    if (acc.normalBalance === 'DEBIT') {
      const net = bal.totalDebit - bal.totalCredit;
      if (net >= 0) {
        netDebit = round2(net);
      } else {
        netCredit = round2(-net);
      }
    } else {
      const net = bal.totalCredit - bal.totalDebit;
      if (net >= 0) {
        netCredit = round2(net);
      } else {
        netDebit = round2(-net);
      }
    }

    totalDebit = round2(totalDebit + netDebit);
    totalCredit = round2(totalCredit + netCredit);

    rows.push({
      account: acc,
      debit: netDebit,
      credit: netCredit,
    });
  }

  const difference = round2(Math.abs(totalDebit - totalCredit));

  return {
    rows,
    totalDebit,
    totalCredit,
    isBalanced: difference === 0,
    difference,
  };
}

/**
 * Generate Balance Sheet (Assets = Liabilities + Equity)
 */
export function generateBalanceSheet(
  accounts: Account[],
  transactions: Transaction[]
): BalanceSheet {
  const balances = calculateAccountBalances(accounts, transactions);

  const assets: AccountBalance[] = [];
  const liabilities: AccountBalance[] = [];
  const equity: AccountBalance[] = [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  let totalRevenue = 0;
  let totalExpense = 0;

  for (const acc of accounts) {
    const bal = balances.get(acc.id);
    if (!bal) continue;

    switch (acc.category) {
      case 'ASSET':
        assets.push(bal);
        totalAssets = round2(totalAssets + bal.balance);
        break;
      case 'LIABILITY':
        liabilities.push(bal);
        totalLiabilities = round2(totalLiabilities + bal.balance);
        break;
      case 'EQUITY':
        equity.push(bal);
        totalEquity = round2(totalEquity + bal.balance);
        break;
      case 'REVENUE':
        totalRevenue = round2(totalRevenue + bal.balance);
        break;
      case 'EXPENSE':
        totalExpense = round2(totalExpense + bal.balance);
        break;
    }
  }

  // Net Income of current period acts as addition to Retained Earnings
  const netIncome = round2(totalRevenue - totalExpense);
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity + netIncome);
  const difference = round2(Math.abs(totalAssets - totalLiabilitiesAndEquity));

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netIncome,
    totalLiabilitiesAndEquity,
    isBalanced: difference === 0,
    difference,
  };
}

/**
 * Generate Income Statement (P&L: Revenues - Expenses = Net Income)
 */
export function generateIncomeStatement(
  accounts: Account[],
  transactions: Transaction[]
): IncomeStatement {
  const balances = calculateAccountBalances(accounts, transactions);

  const revenues: AccountBalance[] = [];
  const expenses: AccountBalance[] = [];

  let totalRevenue = 0;
  let totalExpense = 0;

  for (const acc of accounts) {
    const bal = balances.get(acc.id);
    if (!bal) continue;

    if (acc.category === 'REVENUE') {
      revenues.push(bal);
      totalRevenue = round2(totalRevenue + bal.balance);
    } else if (acc.category === 'EXPENSE') {
      expenses.push(bal);
      totalExpense = round2(totalExpense + bal.balance);
    }
  }

  const netIncome = round2(totalRevenue - totalExpense);

  return {
    revenues,
    expenses,
    totalRevenue,
    totalExpense,
    netIncome,
  };
}

/**
 * Generate initial starter transactions to give user immediate, beautiful accounting data
 * Spans 1 full year with 53 balanced double-entry transactions
 */
export function getInitialDemoTransactions(): Transaction[] {
  const d = (daysAgo: number): string => {
    const date = new Date(Date.now() - daysAgo * 86400000);
    return date.toISOString().split('T')[0];
  };
  const iso = (daysAgo: number): string => {
    return new Date(Date.now() - daysAgo * 86400000).toISOString();
  };

  return [
    // --- 12 MONTHS AGO ---
    {
      id: 'tx-sample-01',
      date: d(360),
      description: 'Opening Balance for Checking Account',
      reference: 'INIT-001',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 5000.0, memo: 'Initial checking funds' },
        { id: 'leg-2', accountId: 'acc-opening-balance', type: 'CREDIT', amount: 5000.0, memo: 'Capital contribution' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-opening-balance' },
      createdAt: iso(360),
      updatedAt: iso(360),
    },
    {
      id: 'tx-sample-02',
      date: d(360),
      description: 'Opening Cash on Hand',
      reference: 'INIT-002',
      legs: [
        { id: 'leg-1', accountId: 'acc-cash', type: 'DEBIT', amount: 450.0, memo: 'Physical wallet cash' },
        { id: 'leg-2', accountId: 'acc-opening-balance', type: 'CREDIT', amount: 450.0, memo: 'Cash reserve' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-cash', categoryAccountId: 'acc-opening-balance' },
      createdAt: iso(360),
      updatedAt: iso(360),
    },
    {
      id: 'tx-sample-03',
      date: d(350),
      description: 'Month 1 Apartment Rent',
      reference: 'RENT-M01',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Wire transfer' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(350),
      updatedAt: iso(350),
    },
    {
      id: 'tx-sample-04',
      date: d(345),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M01',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(345),
      updatedAt: iso(345),
    },
    {
      id: 'tx-sample-05',
      date: d(340),
      description: 'Supermarket Groceries & Pantry',
      reference: 'GROC-01',
      legs: [
        { id: 'leg-1', accountId: 'acc-groceries', type: 'DEBIT', amount: 142.6, memo: 'Weekly produce & essentials' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 142.6, memo: 'Debit card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-groceries' },
      createdAt: iso(340),
      updatedAt: iso(340),
    },

    // --- 11 MONTHS AGO ---
    {
      id: 'tx-sample-06',
      date: d(330),
      description: 'Monthly Electricity & Water Utility',
      reference: 'UTIL-01',
      legs: [
        { id: 'leg-1', accountId: 'acc-utilities', type: 'DEBIT', amount: 118.45, memo: 'Power & water bill' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 118.45, memo: 'Auto-pay' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-utilities' },
      createdAt: iso(330),
      updatedAt: iso(330),
    },
    {
      id: 'tx-sample-07',
      date: d(325),
      description: 'Transfer to High-Yield Savings',
      legs: [
        { id: 'leg-1', accountId: 'acc-savings', type: 'DEBIT', amount: 600.0, memo: 'Emergency fund transfer' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 600.0, memo: 'Savings transfer' },
      ],
      meta: { simpleMode: 'transfer', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-savings' },
      createdAt: iso(325),
      updatedAt: iso(325),
    },
    {
      id: 'tx-sample-08',
      date: d(320),
      description: 'Month 2 Apartment Rent',
      reference: 'RENT-M02',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(320),
      updatedAt: iso(320),
    },
    {
      id: 'tx-sample-09',
      date: d(315),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M02',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(315),
      updatedAt: iso(315),
    },

    // --- 10 MONTHS AGO ---
    {
      id: 'tx-sample-10',
      date: d(305),
      description: 'Freelance Web Consulting Project',
      reference: 'INV-2025-10',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 950.0, memo: 'Client invoice paid' },
        { id: 'leg-2', accountId: 'acc-freelance', type: 'CREDIT', amount: 950.0, memo: 'Consulting income' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-freelance' },
      createdAt: iso(305),
      updatedAt: iso(305),
    },
    {
      id: 'tx-sample-11',
      date: d(300),
      description: 'High-speed Fiber Internet',
      legs: [
        { id: 'leg-1', accountId: 'acc-utilities', type: 'DEBIT', amount: 70.0, memo: 'Gigabit fiber monthly' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 70.0, memo: 'Credit card charge' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-credit-card', categoryAccountId: 'acc-utilities' },
      createdAt: iso(300),
      updatedAt: iso(300),
    },
    {
      id: 'tx-sample-12',
      date: d(295),
      description: 'Dinner & Drinks with Friends',
      legs: [
        { id: 'leg-1', accountId: 'acc-dining', type: 'DEBIT', amount: 84.5, memo: 'Italian Trattoria' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 84.5, memo: 'Visa charge' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-credit-card', categoryAccountId: 'acc-dining' },
      createdAt: iso(295),
      updatedAt: iso(295),
    },
    {
      id: 'tx-sample-13',
      date: d(290),
      description: 'Month 3 Apartment Rent',
      reference: 'RENT-M03',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Wire transfer' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(290),
      updatedAt: iso(290),
    },
    {
      id: 'tx-sample-14',
      date: d(285),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M03',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(285),
      updatedAt: iso(285),
    },
    {
      id: 'tx-sample-15',
      date: d(282),
      description: 'Credit Card Bill Payment',
      reference: 'CC-PAY-01',
      legs: [
        { id: 'leg-1', accountId: 'acc-credit-card', type: 'DEBIT', amount: 154.5, memo: 'Full statement payoff' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 154.5, memo: 'Checking auto-payment' },
      ],
      meta: { simpleMode: 'transfer', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-credit-card' },
      createdAt: iso(282),
      updatedAt: iso(282),
    },

    // --- 9 MONTHS AGO ---
    {
      id: 'tx-sample-16',
      date: d(275),
      description: 'Stock Market ETF Investment',
      reference: 'BROKER-01',
      legs: [
        { id: 'leg-1', accountId: 'acc-investments', type: 'DEBIT', amount: 500.0, memo: 'S&P 500 ETF deposit' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 500.0, memo: 'Brokerage transfer' },
      ],
      meta: { simpleMode: 'transfer', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-investments' },
      createdAt: iso(275),
      updatedAt: iso(275),
    },
    {
      id: 'tx-sample-17',
      date: d(270),
      description: 'Monthly Cloud & Software Subscriptions',
      legs: [
        { id: 'leg-1', accountId: 'acc-subscriptions', type: 'DEBIT', amount: 48.0, memo: 'GitHub, Spotify, Cloud' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 48.0, memo: 'Recurring charge' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-credit-card', categoryAccountId: 'acc-subscriptions' },
      createdAt: iso(270),
      updatedAt: iso(270),
    },
    {
      id: 'tx-sample-18',
      date: d(265),
      description: 'Foreign Book Import (Tokyo Books)',
      reference: 'AMZN-JP-192',
      legs: [
        { id: 'leg-1', accountId: 'acc-shopping', type: 'DEBIT', amount: 98.4, memo: 'Design books (JPY 15,000)' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 98.4, memo: 'Foreign purchase' },
      ],
      meta: {
        simpleMode: 'expense',
        paymentAccountId: 'acc-credit-card',
        categoryAccountId: 'acc-shopping',
        currency: 'JPY',
        originalAmount: 15000,
        exchangeRate: 0.00656,
        baseCurrency: 'USD',
      },
      createdAt: iso(265),
      updatedAt: iso(265),
    },
    {
      id: 'tx-sample-19',
      date: d(260),
      description: 'Month 4 Apartment Rent',
      reference: 'RENT-M04',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(260),
      updatedAt: iso(260),
    },
    {
      id: 'tx-sample-20',
      date: d(255),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M04',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(255),
      updatedAt: iso(255),
    },

    // --- 8 MONTHS AGO ---
    {
      id: 'tx-sample-21',
      date: d(248),
      description: 'Vehicle Gas Station Refill',
      legs: [
        { id: 'leg-1', accountId: 'acc-transport', type: 'DEBIT', amount: 56.5, memo: 'Full tank fuel' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 56.5, memo: 'Debit card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-transport' },
      createdAt: iso(248),
      updatedAt: iso(248),
    },
    {
      id: 'tx-sample-22',
      date: d(242),
      description: 'Quarterly Stock Dividend Payout',
      reference: 'DIV-Q1',
      legs: [
        { id: 'leg-1', accountId: 'acc-investments', type: 'DEBIT', amount: 92.5, memo: 'Dividend reinvestment' },
        { id: 'leg-2', accountId: 'acc-investment-income', type: 'CREDIT', amount: 92.5, memo: 'ETF dividend' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-investments', categoryAccountId: 'acc-investment-income' },
      createdAt: iso(242),
      updatedAt: iso(242),
    },
    {
      id: 'tx-sample-23',
      date: d(235),
      description: 'Pharmacy & Health Vitamins',
      legs: [
        { id: 'leg-1', accountId: 'acc-healthcare', type: 'DEBIT', amount: 65.2, memo: 'Prescriptions & wellness' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 65.2, memo: 'Debit card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-healthcare' },
      createdAt: iso(235),
      updatedAt: iso(235),
    },
    {
      id: 'tx-sample-24',
      date: d(230),
      description: 'Month 5 Apartment Rent',
      reference: 'RENT-M05',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(230),
      updatedAt: iso(230),
    },
    {
      id: 'tx-sample-25',
      date: d(225),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M05',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(225),
      updatedAt: iso(225),
    },

    // --- 7 MONTHS AGO ---
    {
      id: 'tx-sample-26',
      date: d(218),
      description: 'Live Music Concert & Entertainment',
      legs: [
        { id: 'leg-1', accountId: 'acc-entertainment', type: 'DEBIT', amount: 110.0, memo: 'Weekend tickets' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 110.0, memo: 'Credit card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-credit-card', categoryAccountId: 'acc-entertainment' },
      createdAt: iso(218),
      updatedAt: iso(218),
    },
    {
      id: 'tx-sample-27',
      date: d(212),
      description: 'Weekly Organic Grocery Market',
      legs: [
        { id: 'leg-1', accountId: 'acc-groceries', type: 'DEBIT', amount: 138.9, memo: 'Produce & groceries' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 138.9, memo: 'Checking card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-groceries' },
      createdAt: iso(212),
      updatedAt: iso(212),
    },
    {
      id: 'tx-sample-28',
      date: d(205),
      description: 'Top-up Digital Wallet (PayPal)',
      legs: [
        { id: 'leg-1', accountId: 'acc-digital-wallet', type: 'DEBIT', amount: 200.0, memo: 'Online wallet buffer' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 200.0, memo: 'Bank transfer' },
      ],
      meta: { simpleMode: 'transfer', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-digital-wallet' },
      createdAt: iso(205),
      updatedAt: iso(205),
    },
    {
      id: 'tx-sample-29',
      date: d(200),
      description: 'Month 6 Apartment Rent',
      reference: 'RENT-M06',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(200),
      updatedAt: iso(200),
    },
    {
      id: 'tx-sample-30',
      date: d(195),
      description: 'Monthly Salary Deposit + Mid-Year Bonus',
      reference: 'PAYROLL-M06-BONUS',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 4700.0, memo: 'Salary $3,200 + Bonus $1,500' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 4700.0, memo: 'Employment income' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(195),
      updatedAt: iso(195),
    },

    // --- 6 MONTHS AGO ---
    {
      id: 'tx-sample-31',
      date: d(185),
      description: 'Singapore Business Trip (Hotel & Meals)',
      reference: 'SG-EXP-44',
      legs: [
        { id: 'leg-1', accountId: 'acc-transport', type: 'DEBIT', amount: 298.5, memo: 'Hotel & transit (SGD 400.00)' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 298.5, memo: 'Corporate card' },
      ],
      meta: {
        simpleMode: 'expense',
        paymentAccountId: 'acc-credit-card',
        categoryAccountId: 'acc-transport',
        currency: 'SGD',
        originalAmount: 400.0,
        exchangeRate: 0.74625,
        baseCurrency: 'USD',
      },
      createdAt: iso(185),
      updatedAt: iso(185),
    },
    {
      id: 'tx-sample-32',
      date: d(178),
      description: 'Water & Electric Utility Bill',
      legs: [
        { id: 'leg-1', accountId: 'acc-utilities', type: 'DEBIT', amount: 135.2, memo: 'Summer AC usage' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 135.2, memo: 'Auto pay' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-utilities' },
      createdAt: iso(178),
      updatedAt: iso(178),
    },
    {
      id: 'tx-sample-33',
      date: d(170),
      description: 'Month 7 Apartment Rent',
      reference: 'RENT-M07',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(170),
      updatedAt: iso(170),
    },
    {
      id: 'tx-sample-34',
      date: d(165),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M07',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(165),
      updatedAt: iso(165),
    },

    // --- 5 MONTHS AGO ---
    {
      id: 'tx-sample-35',
      date: d(155),
      description: 'Home Office Ergonomic Monitor & Desk',
      reference: 'TECH-UPG-01',
      legs: [
        { id: 'leg-1', accountId: 'acc-shopping', type: 'DEBIT', amount: 349.99, memo: 'Ultrawide 4K monitor' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 349.99, memo: 'Visa purchase' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-credit-card', categoryAccountId: 'acc-shopping' },
      createdAt: iso(155),
      updatedAt: iso(155),
    },
    {
      id: 'tx-sample-36',
      date: d(148),
      description: 'Credit Card Full Statement Payoff',
      legs: [
        { id: 'leg-1', accountId: 'acc-credit-card', type: 'DEBIT', amount: 758.49, memo: 'Statement payment' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 758.49, memo: 'Checking payment' },
      ],
      meta: { simpleMode: 'transfer', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-credit-card' },
      createdAt: iso(148),
      updatedAt: iso(148),
    },
    {
      id: 'tx-sample-37',
      date: d(140),
      description: 'Month 8 Apartment Rent',
      reference: 'RENT-M08',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(140),
      updatedAt: iso(140),
    },
    {
      id: 'tx-sample-38',
      date: d(135),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M08',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(135),
      updatedAt: iso(135),
    },

    // --- 4 MONTHS AGO ---
    {
      id: 'tx-sample-39',
      date: d(125),
      description: 'European Client Software Dev Contract',
      reference: 'EUR-INV-89',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 1308.0, memo: 'Contract payout (EUR 1,200.00)' },
        { id: 'leg-2', accountId: 'acc-freelance', type: 'CREDIT', amount: 1308.0, memo: 'Consulting income' },
      ],
      meta: {
        simpleMode: 'income',
        paymentAccountId: 'acc-checking',
        categoryAccountId: 'acc-freelance',
        currency: 'EUR',
        originalAmount: 1200.0,
        exchangeRate: 1.09,
        baseCurrency: 'USD',
      },
      createdAt: iso(125),
      updatedAt: iso(125),
    },
    {
      id: 'tx-sample-40',
      date: d(118),
      description: 'Annual Auto Maintenance & Service',
      legs: [
        { id: 'leg-1', accountId: 'acc-transport', type: 'DEBIT', amount: 245.0, memo: 'Oil change & brake pads' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 245.0, memo: 'Mechanic invoice' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-transport' },
      createdAt: iso(118),
      updatedAt: iso(118),
    },
    {
      id: 'tx-sample-41',
      date: d(110),
      description: 'Month 9 Apartment Rent',
      reference: 'RENT-M09',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(110),
      updatedAt: iso(110),
    },
    {
      id: 'tx-sample-42',
      date: d(105),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M09',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(105),
      updatedAt: iso(105),
    },

    // --- 3 MONTHS AGO ---
    {
      id: 'tx-sample-43',
      date: d(85),
      description: 'High-Yield Savings Compound Interest',
      legs: [
        { id: 'leg-1', accountId: 'acc-savings', type: 'DEBIT', amount: 42.15, memo: 'Monthly yield' },
        { id: 'leg-2', accountId: 'acc-investment-income', type: 'CREDIT', amount: 42.15, memo: 'Interest income' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-savings', categoryAccountId: 'acc-investment-income' },
      createdAt: iso(85),
      updatedAt: iso(85),
    },
    {
      id: 'tx-sample-44',
      date: d(80),
      description: 'Month 10 Apartment Rent',
      reference: 'RENT-M10',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(80),
      updatedAt: iso(80),
    },
    {
      id: 'tx-sample-45',
      date: d(75),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M10',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(75),
      updatedAt: iso(75),
    },
    {
      id: 'tx-sample-46',
      date: d(68),
      description: 'Family Birthday Dinner at Seafood Grill',
      legs: [
        { id: 'leg-1', accountId: 'acc-dining', type: 'DEBIT', amount: 128.5, memo: 'Dinner with family' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 128.5, memo: 'Credit card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-credit-card', categoryAccountId: 'acc-dining' },
      createdAt: iso(68),
      updatedAt: iso(68),
    },

    // --- 2 MONTHS AGO (LAST MONTH / 60 DAYS) ---
    {
      id: 'tx-sample-47',
      date: d(50),
      description: 'Month 11 Apartment Rent',
      reference: 'RENT-M11',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(50),
      updatedAt: iso(50),
    },
    {
      id: 'tx-sample-48',
      date: d(45),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M11',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(45),
      updatedAt: iso(45),
    },
    {
      id: 'tx-sample-49',
      date: d(38),
      description: 'Monthly Internet & Utilities Bundle',
      legs: [
        { id: 'leg-1', accountId: 'acc-utilities', type: 'DEBIT', amount: 145.3, memo: 'Electricity & Internet' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 145.3, memo: 'Auto pay' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-utilities' },
      createdAt: iso(38),
      updatedAt: iso(38),
    },

    // --- 1 MONTH AGO (LAST MONTH / 30 DAYS) ---
    {
      id: 'tx-sample-50',
      date: d(24),
      description: 'Month 12 Apartment Rent',
      reference: 'RENT-M12',
      legs: [
        { id: 'leg-1', accountId: 'acc-housing', type: 'DEBIT', amount: 1200.0, memo: 'Monthly lease' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 1200.0, memo: 'Direct debit' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-housing' },
      createdAt: iso(24),
      updatedAt: iso(24),
    },
    {
      id: 'tx-sample-51',
      date: d(18),
      description: 'Monthly Salary Deposit',
      reference: 'PAYROLL-M12',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3200.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 3200.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: iso(18),
      updatedAt: iso(18),
    },

    // --- THIS CURRENT MONTH / PAST FEW DAYS ---
    {
      id: 'tx-sample-52',
      date: d(5),
      description: 'Weekly Organic Grocery Run',
      reference: 'GROC-CURRENT',
      legs: [
        { id: 'leg-1', accountId: 'acc-groceries', type: 'DEBIT', amount: 115.8, memo: 'Fresh vegetables & fruit' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 115.8, memo: 'Checking card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-groceries' },
      createdAt: iso(5),
      updatedAt: iso(5),
    },
    {
      id: 'tx-sample-53',
      date: d(2),
      description: 'Artisan Coffee & Lunch with Team',
      reference: 'CAFE-09',
      legs: [
        { id: 'leg-1', accountId: 'acc-dining', type: 'DEBIT', amount: 28.5, memo: 'Espresso & lunch' },
        { id: 'leg-2', accountId: 'acc-cash', type: 'CREDIT', amount: 28.5, memo: 'Cash payment' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-cash', categoryAccountId: 'acc-dining' },
      createdAt: iso(2),
      updatedAt: iso(2),
    },
  ];
}
