import { BankRule, BankStatementLine, EntryLeg, Transaction } from './types';

export const DEFAULT_BANK_RULES: BankRule[] = [
  {
    id: 'rule-salary',
    name: 'Salary & Payroll Inflow',
    pattern: 'salary',
    condition: 'contains',
    direction: 'inflow',
    targetAccountId: '4010', // Revenue: Salary
    defaultPayee: 'Employer Payroll',
  },
  {
    id: 'rule-payroll',
    name: 'Direct Deposit Payroll',
    pattern: 'payroll',
    condition: 'contains',
    direction: 'inflow',
    targetAccountId: '4010',
    defaultPayee: 'Payroll Deposit',
  },
  {
    id: 'rule-interest-credit',
    name: 'Bank Account Interest Credit',
    pattern: 'interest',
    condition: 'contains',
    direction: 'inflow',
    targetAccountId: '4030', // Revenue: Interest & Dividends
    defaultPayee: 'Bank Interest',
  },
  {
    id: 'rule-credit-card-pmt',
    name: 'Credit Card Bill Payment',
    pattern: 'credit card',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '2010', // Liability: Credit Card
    defaultPayee: 'Credit Card Payment',
  },
  {
    id: 'rule-citibank',
    name: 'Citibank Card Payment',
    pattern: 'citibank',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '2010', // Liability: Credit Card
    defaultPayee: 'Citibank Credit Card',
  },
  {
    id: 'rule-nets-food',
    name: 'NETS QR Merchant Purchase',
    pattern: 'nets qr',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5010', // Expense: Groceries & Food
    defaultPayee: 'NETS Merchant',
  },
  {
    id: 'rule-rent',
    name: 'Rent & Housing Lease',
    pattern: 'rent',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5030', // Expense: Rent
    defaultPayee: 'Landlord / Property Mgmt',
  },
  {
    id: 'rule-groceries-wm',
    name: 'Walmart Supercenter',
    pattern: 'walmart',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5010', // Expense: Groceries
    defaultPayee: 'Walmart',
  },
  {
    id: 'rule-groceries-general',
    name: 'Supermarket & Groceries',
    pattern: 'supermarket',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5010',
    defaultPayee: 'Supermarket',
  },
  {
    id: 'rule-groceries-wf',
    name: 'Whole Foods Market',
    pattern: 'whole foods',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5010',
    defaultPayee: 'Whole Foods Market',
  },
  {
    id: 'rule-transport-uber',
    name: 'Uber Rides & Transit',
    pattern: 'uber',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5050', // Expense: Transport
    defaultPayee: 'Uber',
  },
  {
    id: 'rule-transport-petrol',
    name: 'Fuel & Gas Station',
    pattern: 'shell',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5050',
    defaultPayee: 'Shell Fuel',
  },
  {
    id: 'rule-utilities-electric',
    name: 'Electricity & Utilities',
    pattern: 'electric',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5040', // Expense: Utilities
    defaultPayee: 'Electric Utility Co.',
  },
  {
    id: 'rule-utilities-water',
    name: 'Water & Waste Utility',
    pattern: 'water',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5040',
    defaultPayee: 'Municipal Water Board',
  },
  {
    id: 'rule-dining-cafe',
    name: 'Starbucks & Coffee',
    pattern: 'starbucks',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5060', // Expense: Dining
    defaultPayee: 'Starbucks Coffee',
  },
  {
    id: 'rule-entertainment-netflix',
    name: 'Netflix Subscription',
    pattern: 'netflix',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5070', // Expense: Entertainment
    defaultPayee: 'Netflix',
  },
  {
    id: 'rule-entertainment-spotify',
    name: 'Spotify Music',
    pattern: 'spotify',
    condition: 'contains',
    direction: 'outflow',
    targetAccountId: '5070',
    defaultPayee: 'Spotify',
  },
];

export class BankRulesEngine {
  /**
   * Find the first matching bank rule for a statement line
   */
  static findMatchingRule(
    description: string,
    amount: number,
    rules: BankRule[] = DEFAULT_BANK_RULES
  ): BankRule | null {
    const text = (description || '').toLowerCase();
    const isInflow = amount > 0;

    for (const rule of rules) {
      // Check direction filter
      if (rule.direction === 'inflow' && !isInflow) continue;
      if (rule.direction === 'outflow' && isInflow) continue;

      const pattern = rule.pattern.toLowerCase();
      let isMatch = false;

      if (rule.condition === 'equals') {
        isMatch = text === pattern;
      } else if (rule.condition === 'starts_with') {
        isMatch = text.startsWith(pattern);
      } else {
        // contains
        isMatch = text.includes(pattern);
      }

      if (isMatch) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Build a balanced Double-Entry Transaction from a bank statement line
   */
  static createDoubleEntryTransaction(
    line: BankStatementLine,
    offsetAccountId: string,
    bankAccountId: string,
    customPayee?: string,
    customMemo?: string,
    feedCurrency?: string,
    baseCurrency?: string,
    exchangeRate?: number
  ): Transaction {
    const absAmount = Math.round(Math.abs(line.amount) * 100) / 100;
    const payee = customPayee || line.suggestedPayee || line.description;
    const memo = customMemo || `Reconciled from bank statement: ${line.description}`;
    const isInflow = line.amount > 0;

    const rate = exchangeRate || 1.0;
    const curr = feedCurrency || baseCurrency || 'USD';
    const base = baseCurrency || 'USD';
    const isForeign = curr !== base;
    const effectiveBaseAmt = isForeign ? Math.round(absAmount * rate * 100) / 100 : absAmount;

    let legs: EntryLeg[] = [];

    if (isInflow) {
      // Money In: Debit Bank (Asset increases), Credit Revenue / Offset (Income increases)
      legs = [
        {
          id: 'leg-' + Date.now() + '-1',
          accountId: bankAccountId,
          type: 'DEBIT',
          amount: effectiveBaseAmt,
        },
        {
          id: 'leg-' + Date.now() + '-2',
          accountId: offsetAccountId,
          type: 'CREDIT',
          amount: effectiveBaseAmt,
        },
      ];
    } else {
      // Money Out: Debit Expense / Offset (Expense increases), Credit Bank (Asset decreases)
      legs = [
        {
          id: 'leg-' + Date.now() + '-1',
          accountId: offsetAccountId,
          type: 'DEBIT',
          amount: effectiveBaseAmt,
        },
        {
          id: 'leg-' + Date.now() + '-2',
          accountId: bankAccountId,
          type: 'CREDIT',
          amount: effectiveBaseAmt,
        },
      ];
    }

    const nowIso = new Date().toISOString();

    return {
      id: 'tx-rec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      date: line.date,
      description: payee,
      legs,
      tags: ['bank-reconciled'],
      meta: {
        simpleMode: isInflow ? 'income' : 'expense',
        reconciledFromLineId: line.id,
        memo,
        currency: curr,
        originalAmount: absAmount,
        exchangeRate: rate,
        baseCurrency: base,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }
}
