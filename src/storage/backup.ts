import { Account, AppDataBackup, AppSettings, Transaction } from '../core/types';

/**
 * Trigger download of a JSON backup file in the browser
 */
export function downloadBackupFile(
  accounts: Account[],
  transactions: Transaction[],
  settings: AppSettings
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `finance-wallet-backup-${timestamp}.json`;

  const backupData: AppDataBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    generator: 'Finance Accounting Wallet v1.0',
    accounts,
    transactions,
    settings,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate and restore backup data from a JSON string or file content
 */
export function parseAndValidateBackup(jsonString: string): {
  isValid: boolean;
  data?: AppDataBackup;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Backup file is not a valid JSON object.' };
    }

    if (!Array.isArray(parsed.accounts)) {
      return { isValid: false, error: 'Backup missing valid accounts list.' };
    }

    if (!Array.isArray(parsed.transactions)) {
      return { isValid: false, error: 'Backup missing valid transactions list.' };
    }

    // Validate accounts minimum structure
    for (const acc of parsed.accounts) {
      if (!acc.id || !acc.name || !acc.category || !acc.normalBalance) {
        return { isValid: false, error: `Invalid account format found: ${acc.name || acc.id}` };
      }
    }

    // Validate transactions minimum structure
    for (const tx of parsed.transactions) {
      if (!tx.id || !tx.date || !Array.isArray(tx.legs)) {
        return { isValid: false, error: `Invalid transaction format found: ${tx.id || tx.description}` };
      }
    }

    return {
      isValid: true,
      data: parsed as AppDataBackup,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { isValid: false, error: `JSON Parse error: ${errorMsg}` };
  }
}

/**
 * Export General Ledger and Transactions to CSV format
 */
export function exportToCSV(accounts: Account[], transactions: Transaction[]): void {
  const accountMap = new Map<string, Account>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  const headers = [
    'Date',
    'Transaction ID',
    'Description',
    'Reference',
    'Account Code',
    'Account Name',
    'Account Category',
    'Debit Amount',
    'Credit Amount',
    'Memo',
  ];

  const rows: string[][] = [headers];

  for (const tx of transactions) {
    for (const leg of tx.legs) {
      const acc = accountMap.get(leg.accountId);
      const accCode = acc ? acc.code : '';
      const accName = acc ? acc.name : leg.accountId;
      const accCategory = acc ? acc.category : '';
      const debit = leg.type === 'DEBIT' ? leg.amount.toFixed(2) : '';
      const credit = leg.type === 'CREDIT' ? leg.amount.toFixed(2) : '';

      rows.push([
        `"${tx.date}"`,
        `"${tx.id}"`,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        `"${(tx.reference || '').replace(/"/g, '""')}"`,
        `"${accCode}"`,
        `"${accName.replace(/"/g, '""')}"`,
        `"${accCategory}"`,
        debit,
        credit,
        `"${(leg.memo || '').replace(/"/g, '""')}"`,
      ]);
    }
  }

  const csvContent = rows.map((e) => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.href = url;
  link.download = `finance-ledger-export-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
