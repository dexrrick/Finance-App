import { BankStatementLine } from './types';

export interface ColumnMapping {
  dateCol: number;
  descCol: number;
  amountCol?: number;
  inflowCol?: number;
  outflowCol?: number;
}

export class BankStatementParser {
  /**
   * Parse CSV content into BankStatementLine array
   */
  static parseCSV(csvContent: string): { lines: BankStatementLine[]; warnings: string[] } {
    const warnings: string[] = [];
    const rawLines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length < 2) {
      return { lines: [], warnings: ['CSV file must have a header row and at least one data row.'] };
    }

    // Determine delimiter (comma, semicolon, or tab)
    const firstLine = rawLines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const parseRow = (rowStr: string): string[] => {
      const result: string[] = [];
      let inQuotes = false;
      let cur = '';

      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseRow(firstLine).map((h) => h.toLowerCase());
    const mapping = this.detectColumnMapping(headers);

    if (mapping.dateCol === -1 || mapping.descCol === -1) {
      warnings.push('Could not auto-detect Date and Description columns. Falling back to first columns.');
    }

    const dateCol = mapping.dateCol !== -1 ? mapping.dateCol : 0;
    const descCol = mapping.descCol !== -1 ? mapping.descCol : 1;

    const parsedLines: BankStatementLine[] = [];

    for (let rowIdx = 1; rowIdx < rawLines.length; rowIdx++) {
      const row = parseRow(rawLines[rowIdx]);
      if (row.length <= Math.max(dateCol, descCol)) continue;

      const rawDate = row[dateCol] || '';
      const rawDesc = row[descCol] || '';

      let amount = 0;

      if (mapping.amountCol !== undefined && mapping.amountCol !== -1 && row[mapping.amountCol]) {
        amount = this.parseAmount(row[mapping.amountCol]);
      } else if (mapping.inflowCol !== undefined && mapping.outflowCol !== undefined) {
        const inflow = mapping.inflowCol !== -1 ? this.parseAmount(row[mapping.inflowCol] || '0') : 0;
        const outflow = mapping.outflowCol !== -1 ? this.parseAmount(row[mapping.outflowCol] || '0') : 0;
        amount = inflow > 0 ? inflow : -Math.abs(outflow);
      } else {
        // Search remaining numeric column
        for (let c = 0; c < row.length; c++) {
          if (c !== dateCol && c !== descCol) {
            const val = this.parseAmount(row[c]);
            if (!isNaN(val) && val !== 0) {
              amount = val;
              break;
            }
          }
        }
      }

      if (isNaN(amount) || amount === 0) continue;

      const normalizedDate = this.normalizeDate(rawDate);

      parsedLines.push({
        id: 'bank-line-' + rowIdx + '-' + Date.now(),
        date: normalizedDate,
        description: rawDesc || 'Bank Transaction',
        amount,
        status: 'unreconciled',
      });
    }

    return { lines: parsedLines, warnings };
  }

  /**
   * Auto-detect header column positions
   */
  private static detectColumnMapping(headers: string[]): ColumnMapping {
    let dateCol = -1;
    let descCol = -1;
    let amountCol = -1;
    let inflowCol = -1;
    let outflowCol = -1;

    headers.forEach((h, idx) => {
      const col = h.replace(/[^a-z0-9]/g, '');

      // Date
      if (['date', 'transdate', 'transactiondate', 'postdate', 'postingdate', 'valuedate'].includes(col)) {
        if (dateCol === -1) dateCol = idx;
      }
      // Description
      else if (
        ['description', 'desc', 'payee', 'narrative', 'memo', 'details', 'name', 'particulars'].includes(col)
      ) {
        if (descCol === -1) descCol = idx;
      }
      // Amount (single signed column)
      else if (['amount', 'netamount', 'sum', 'total'].includes(col)) {
        if (amountCol === -1) amountCol = idx;
      }
      // Inflow / Credit
      else if (['credit', 'inflow', 'deposit', 'cr', 'received'].includes(col)) {
        inflowCol = idx;
      }
      // Outflow / Debit
      else if (['debit', 'outflow', 'withdrawal', 'dr', 'spent', 'paidout'].includes(col)) {
        outflowCol = idx;
      }
    });

    return { dateCol, descCol, amountCol, inflowCol, outflowCol };
  }

  /**
   * Clean and parse currency string
   */
  private static parseAmount(str: string): number {
    if (!str) return 0;
    let cleaned = str.trim().replace(/[$€£¥]/g, '');

    // Check accounting negative: (100.50) -> -100.50
    let isNegative = false;
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      isNegative = true;
      cleaned = cleaned.substring(1, cleaned.length - 1);
    } else if (cleaned.startsWith('-')) {
      isNegative = true;
      cleaned = cleaned.substring(1);
    }

    // Remove thousands commas
    cleaned = cleaned.replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  }

  /**
   * Normalize various date strings into YYYY-MM-DD
   */
  private static normalizeDate(dateStr: string): string {
    const trimmed = (dateStr || '').trim();
    if (!trimmed) return new Date().toISOString().split('T')[0];

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // MM/DD/YYYY or DD/MM/YYYY
    const slashParts = trimmed.split(/[/.-]/);
    if (slashParts.length === 3) {
      let [p1, p2, p3] = slashParts;
      if (p3.length === 4) {
        // P3 is year
        const year = p3;
        const month = p1.padStart(2, '0');
        const day = p2.padStart(2, '0');
        return `${year}-${month}-${day}`;
      } else if (p1.length === 4) {
        // P1 is year
        return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      }
    }

    // Try standard Date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  }

  /**
   * Generate a realistic monthly bank CSV for instant testing
   */
  static generateDemoBankCSV(): string {
    return `Date,Description,Amount
2026-03-01,GLOBAL TECH CORP DIRECT DEP SALARY,5200.00
2026-03-02,WHOLE FOODS MKT #1088 SAN FRANCISCO,-94.50
2026-03-03,AVALON BAY APARTMENTS MONTHLY RENT,-1850.00
2026-03-04,STARBUCKS STORE #28441 COFFEE,-6.75
2026-03-05,UBER TRIP PENDING RIDE,-24.80
2026-03-06,WALMART SUPERCENTER GROCERIES,-112.30
2026-03-07,CONEDISON ELECTRIC UTILITY BILL,-85.40
2026-03-08,NETFLIX.COM DIGITAL SUBSCRIPTION,-19.99
2026-03-09,SHELL OIL GAS STATION PETROL,-48.20
2026-03-10,FREELANCE DESIGN INVOICE PAYMENT,950.00
2026-03-11,SPOTIFY USA MONTHLY AUDIO,-11.99
2026-03-12,CITY WATER AND SEWER UTILITY,-42.10`;
  }
}
