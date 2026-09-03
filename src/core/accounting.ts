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
 */
export function getInitialDemoTransactions(): Transaction[] {
  const today = new Date().toISOString().split('T')[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];

  return [
    // 1. Initial Opening Balance (Debit Checking $3,500, Credit Opening Balance Equity $3,500)
    {
      id: 'tx-demo-1',
      date: fiveDaysAgo,
      description: 'Opening Balance for Checking Account',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 3500.0, memo: 'Initial funds' },
        { id: 'leg-2', accountId: 'acc-opening-balance', type: 'CREDIT', amount: 3500.0, memo: 'Capital contribution' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-opening-balance' },
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    // 2. Initial Cash on hand (Debit Cash $300, Credit Opening Balance $300)
    {
      id: 'tx-demo-2',
      date: fiveDaysAgo,
      description: 'Opening Cash in Wallet',
      legs: [
        { id: 'leg-1', accountId: 'acc-cash', type: 'DEBIT', amount: 300.0, memo: 'Cash reserve' },
        { id: 'leg-2', accountId: 'acc-opening-balance', type: 'CREDIT', amount: 300.0, memo: 'Cash opening balance' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-cash', categoryAccountId: 'acc-opening-balance' },
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    // 3. Monthly Salary (Debit Checking $2,800, Credit Salary $2,800)
    {
      id: 'tx-demo-3',
      date: threeDaysAgo,
      description: 'Bi-weekly Salary Deposit',
      reference: 'PAYROLL-8821',
      legs: [
        { id: 'leg-1', accountId: 'acc-checking', type: 'DEBIT', amount: 2800.0, memo: 'Direct deposit' },
        { id: 'leg-2', accountId: 'acc-salary', type: 'CREDIT', amount: 2800.0, memo: 'Salary revenue' },
      ],
      meta: { simpleMode: 'income', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-salary' },
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    // 4. Grocery Expense (Debit Groceries $95.50, Credit Checking $95.50)
    {
      id: 'tx-demo-4',
      date: threeDaysAgo,
      description: 'Weekly Groceries at Trader Joe’s',
      legs: [
        { id: 'leg-1', accountId: 'acc-groceries', type: 'DEBIT', amount: 95.5, memo: 'Fresh groceries & produce' },
        { id: 'leg-2', accountId: 'acc-checking', type: 'CREDIT', amount: 95.5, memo: 'Debit card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-checking', categoryAccountId: 'acc-groceries' },
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    // 5. Dining out with Credit Card (Debit Dining $42.00, Credit Credit Card $42.00)
    {
      id: 'tx-demo-5',
      date: today,
      description: 'Lunch & Coffee with Team',
      legs: [
        { id: 'leg-1', accountId: 'acc-dining', type: 'DEBIT', amount: 42.0, memo: 'Ramen & Matcha' },
        { id: 'leg-2', accountId: 'acc-credit-card', type: 'CREDIT', amount: 42.0, memo: 'Visa Card' },
      ],
      meta: { simpleMode: 'expense', paymentAccountId: 'acc-credit-card', categoryAccountId: 'acc-dining' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
