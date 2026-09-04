import { BankStatementLine } from './types';

export interface ColumnMapping {
  headerRowIndex: number;
  dateCol: number;
  descCol: number;
  amountCol?: number;
  inflowCol?: number;
  outflowCol?: number;
}

export class BankStatementParser {
  /**
   * RFC 4180 State Machine CSV Matrix Parser
   * Correctly handles:
   * - Multi-line descriptions with embedded newlines within quotes
   * - Escaped double quotes ("")
   * - Different delimiters (comma, semicolon, tab)
   */
  static parseCSVMatrix(content: string): string[][] {
    const clean = content.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    // Detect delimiter
    let delimiter = ',';
    const firstNonEmptyLine = clean.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
    if (firstNonEmptyLine.includes('\t')) delimiter = '\t';
    else if (firstNonEmptyLine.includes(';') && !firstNonEmptyLine.includes(',')) delimiter = ';';

    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const nextChar = clean[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        currentCell = '';
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        // Normalize embedded newline inside quotes into space for clean payee names
        if (inQuotes && (char === '\r' || char === '\n')) {
          currentCell += ' ';
        } else {
          currentCell += char;
        }
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Find the true Header Row (skips bank metadata preamble lines like Account Number, Available Balance)
   */
  static findHeaderRow(matrix: string[][]): { headerRowIndex: number; headers: string[] } {
    let bestScore = -1;
    let bestIndex = 0;
    let bestHeaders: string[] = [];

    const keywords = [
      'date',
      'time',
      'post',
      'desc',
      'payee',
      'narrative',
      'particular',
      'memo',
      'detail',
      'merchant',
      'remark',
      'amount',
      'debit',
      'credit',
      'withdrawal',
      'deposit',
      'spent',
      'received',
      'inflow',
      'outflow',
    ];

    const maxScan = Math.min(matrix.length, 25);
    for (let i = 0; i < maxScan; i++) {
      const row = matrix[i];
      if (row.length < 2) continue;

      let score = 0;
      row.forEach((cell) => {
        const lower = cell.toLowerCase().trim();
        keywords.forEach((kw) => {
          if (lower.includes(kw)) score += 3;
        });
      });

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
        bestHeaders = row;
      }
    }

    if (bestScore <= 0 && matrix.length > 0) {
      return { headerRowIndex: 0, headers: matrix[0] };
    }

    return { headerRowIndex: bestIndex, headers: bestHeaders };
  }

  /**
   * Parse CSV content into BankStatementLine array
   */
  static parseCSV(
    csvContent: string,
    customMapping?: Partial<ColumnMapping>
  ): {
    lines: BankStatementLine[];
    headers: string[];
    rawRows: string[][];
    warnings: string[];
    detectedCurrency?: string | null;
    detectedCurrencyReason?: string | null;
  } {
    const warnings: string[] = [];
    const matrix = this.parseCSVMatrix(csvContent);

    if (matrix.length < 2) {
      return {
        lines: [],
        headers: [],
        rawRows: [],
        warnings: ['CSV file appears empty or has fewer than 2 rows.'],
        detectedCurrency: null,
        detectedCurrencyReason: null,
      };
    }

    const { headerRowIndex, headers } = this.findHeaderRow(matrix);

    const detectedMapping = this.detectColumnMapping(headers, headerRowIndex);
    const mapping: ColumnMapping = {
      ...detectedMapping,
      ...customMapping,
      headerRowIndex: customMapping?.headerRowIndex ?? headerRowIndex,
    };

    const dateCol = mapping.dateCol;
    const descCol = mapping.descCol;

    const parsedLines: BankStatementLine[] = [];
    const sampleRows: string[][] = [];

    for (let r = mapping.headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (row.length < 2) continue;
      if (sampleRows.length < 5) sampleRows.push(row);

      const rawDate = row[dateCol] || '';
      const rawDesc = (row[descCol] || '').replace(/\s+/g, ' ').trim();

      let amount = 0;

      // 1. Separate Inflow / Outflow or Deposits / Withdrawals
      if (
        (mapping.inflowCol !== undefined && mapping.inflowCol !== -1) ||
        (mapping.outflowCol !== undefined && mapping.outflowCol !== -1)
      ) {
        const inflow =
          mapping.inflowCol !== undefined && mapping.inflowCol !== -1 ? this.parseAmount(row[mapping.inflowCol] || '0') : 0;
        const outflow =
          mapping.outflowCol !== undefined && mapping.outflowCol !== -1 ? this.parseAmount(row[mapping.outflowCol] || '0') : 0;

        if (Math.abs(inflow) > 0) {
          amount = Math.abs(inflow);
        } else if (Math.abs(outflow) > 0) {
          amount = -Math.abs(outflow);
        }
      }
      // 2. Single amount column
      else if (mapping.amountCol !== undefined && mapping.amountCol !== -1 && row[mapping.amountCol]) {
        amount = this.parseAmount(row[mapping.amountCol]);
      } else {
        // Fallback: search remaining columns for numbers
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
        id: 'bank-line-' + r + '-' + Date.now(),
        date: normalizedDate,
        description: rawDesc || 'Bank Transaction',
        amount,
        status: 'unreconciled',
      });
    }

    if (parsedLines.length === 0) {
      warnings.push(
        `Found ${matrix.length} rows, but could not detect valid transaction amounts. Try adjusting the column mapping manually.`
      );
    }

    const { currency: detectedCurrency, reason: detectedCurrencyReason } = this.detectCurrency(
      csvContent,
      headers,
      sampleRows
    );

    return {
      lines: parsedLines,
      headers,
      rawRows: sampleRows,
      warnings,
      detectedCurrency,
      detectedCurrencyReason,
    };
  }

  /**
   * Auto-detect currency from CSV headers, preamble lines, dedicated columns, or cell values
   */
  static detectCurrency(
    csvContent: string,
    headers: string[],
    sampleRows: string[][]
  ): { currency: string | null; reason: string | null } {
    const KNOWN_CODES = [
      'USD', 'EUR', 'GBP', 'MYR', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF',
      'CNY', 'HKD', 'INR', 'IDR', 'KRW', 'THB', 'PHP', 'NZD', 'BRL',
      'MXN', 'NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'ZAR'
    ];

    // 1. Check for dedicated currency column
    const curColIdx = headers.findIndex((h) =>
      /^(currency|ccy|cur|curr)$/i.test(h.trim())
    );
    if (curColIdx !== -1 && sampleRows.length > 0) {
      for (const row of sampleRows) {
        const val = (row[curColIdx] || '').trim().toUpperCase();
        if (KNOWN_CODES.includes(val)) {
          return { currency: val, reason: `from "${headers[curColIdx]}" column` };
        }
      }
    }

    // 2. Check headers for currency codes/symbols in parentheses or text
    for (const h of headers) {
      for (const code of KNOWN_CODES) {
        const regex = new RegExp(`[\\(\\[\\s_-]${code}[\\)\\]\\s_-]|^${code}[\\s_-]|[\\s_-]${code}$`, 'i');
        if (regex.test(h)) {
          return { currency: code, reason: `from header "${h}"` };
        }
      }
      if (/\(RM\)|RM\b/i.test(h)) return { currency: 'MYR', reason: `from header "${h}"` };
      if (/S\$/i.test(h)) return { currency: 'SGD', reason: `from header "${h}"` };
      if (/€/i.test(h)) return { currency: 'EUR', reason: `from header "${h}"` };
      if (/£/i.test(h)) return { currency: 'GBP', reason: `from header "${h}"` };
      if (/¥/i.test(h)) return { currency: 'JPY', reason: `from header "${h}"` };
    }

    // 3. Check preamble metadata (first 25 lines of raw CSV)
    const preambleLines = csvContent.split(/\r?\n/).slice(0, 25);
    for (const line of preambleLines) {
      const match = line.match(/currency(?:\s*code)?\s*[:=,]\s*"?([A-Za-z]{3})"?/i);
      if (match && match[1]) {
        const code = match[1].toUpperCase();
        if (KNOWN_CODES.includes(code)) {
          return { currency: code, reason: `from statement metadata ("${line.trim().slice(0, 35)}")` };
        }
      }
    }

    // 4. Check sample amount cell values
    for (const row of sampleRows) {
      for (const cell of row) {
        const trimmed = (cell || '').trim();
        for (const code of KNOWN_CODES) {
          if (new RegExp(`^${code}\\s*\\d|\\d\\s*${code}$`, 'i').test(trimmed)) {
            return { currency: code, reason: `from cell "${trimmed}"` };
          }
        }
        if (/^RM\s*\d/i.test(trimmed)) return { currency: 'MYR', reason: `from cell "${trimmed}"` };
        if (/^S\$\s*\d/i.test(trimmed)) return { currency: 'SGD', reason: `from cell "${trimmed}"` };
        if (/^€\s*\d/i.test(trimmed)) return { currency: 'EUR', reason: `from cell "${trimmed}"` };
        if (/^£\s*\d/i.test(trimmed)) return { currency: 'GBP', reason: `from cell "${trimmed}"` };
      }
    }

    return { currency: null, reason: null };
  }

  /**
   * Auto-detect header column indices
   */
  static detectColumnMapping(headers: string[], headerRowIndex = 0): ColumnMapping {
    let dateCol = -1;
    let descCol = -1;
    let amountCol = -1;
    let inflowCol = -1;
    let outflowCol = -1;

    headers.forEach((h, idx) => {
      const lower = h.toLowerCase().trim();

      // Date
      if (
        (lower.includes('date') || lower.includes('posted') || lower.includes('time')) &&
        !lower.includes('value') && // prefer Transaction Date over Value Date if both exist
        dateCol === -1
      ) {
        dateCol = idx;
      }
      // Inflow / Deposit / Credit
      else if (
        lower.includes('deposit') ||
        lower.includes('credit') ||
        lower.includes('inflow') ||
        lower.includes('paid in') ||
        lower.includes('money in') ||
        lower.includes('received')
      ) {
        inflowCol = idx;
      }
      // Outflow / Withdrawal / Debit
      else if (
        lower.includes('withdrawal') ||
        lower.includes('debit') ||
        lower.includes('outflow') ||
        lower.includes('paid out') ||
        lower.includes('money out') ||
        lower.includes('charge') ||
        lower.includes('spent')
      ) {
        outflowCol = idx;
      }
      // Description / Payee
      else if (
        (lower.includes('desc') ||
          lower.includes('payee') ||
          lower.includes('narrative') ||
          lower.includes('memo') ||
          lower.includes('detail') ||
          lower.includes('merchant') ||
          lower.includes('particular') ||
          lower.includes('remark') ||
          lower.includes('name')) &&
        descCol === -1
      ) {
        descCol = idx;
      }
      // Amount (single column)
      else if (
        (lower.includes('amount') || lower.includes('total') || lower.includes('sum') || lower.includes('net')) &&
        !lower.includes('balance') &&
        amountCol === -1
      ) {
        amountCol = idx;
      }
    });

    // Fallbacks if not matched
    if (dateCol === -1) {
      headers.forEach((h, idx) => {
        if (h.toLowerCase().includes('date') && dateCol === -1) dateCol = idx;
      });
    }
    if (dateCol === -1) dateCol = 0;
    if (descCol === -1) descCol = Math.min(2, headers.length - 1);

    if (inflowCol === -1 && outflowCol === -1 && amountCol === -1) {
      amountCol = Math.min(3, headers.length - 1);
    }

    return { headerRowIndex, dateCol, descCol, amountCol, inflowCol, outflowCol };
  }

  /**
   * Parse amounts with currency signs, commas, and negative signs
   */
  static parseAmount(str: string): number {
    if (!str) return 0;
    let cleaned = str.trim();

    // Strip currency symbols and letters
    cleaned = cleaned.replace(/[$€£¥SGD|USD|EUR|GBP|AUD]/gi, '').trim();

    // Check accounting parentheses: (100.50) -> -100.50
    let isNegative = false;
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      isNegative = true;
      cleaned = cleaned.substring(1, cleaned.length - 1);
    } else if (cleaned.startsWith('-') || cleaned.endsWith('-')) {
      isNegative = true;
      cleaned = cleaned.replace(/-/g, '');
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Handle European numbers: 1.234,56 -> 1234.56
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.indexOf(',') > cleaned.indexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      const parts = cleaned.split(',');
      if (parts[parts.length - 1].length === 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    cleaned = cleaned.replace(/\s+/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  }

  /**
   * Normalize any international date into YYYY-MM-DD
   */
  static normalizeDate(dateStr: string): string {
    const trimmed = (dateStr || '').trim();
    if (!trimmed) return new Date().toISOString().split('T')[0];

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
      return trimmed.replace(/\//g, '-');
    }

    // DD/MM/YYYY or MM/DD/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (slashMatch) {
      let [, p1, p2, p3] = slashMatch;
      let year = p3.length === 2 ? '20' + p3 : p3;
      let day = p1.padStart(2, '0');
      let month = p2.padStart(2, '0');
      // Standard Singapore/UK format: DD/MM/YYYY
      return `${year}-${month}-${day}`;
    }

    // Standard JavaScript Date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return new Date().toISOString().split('T')[0];
  }

  /**
   * Sample Demo Statement
   */
  static generateDemoBankCSV(): string {
    return `Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
03/09/2026,03/09/2026,"FAST PAYMENT via PayNow-Mobile to MIXX ANX",29.88,
03/09/2026,03/09/2026,"PAYMENT/TRANSFER via PayNow-DBSS from LIM KHAI",,28.00
20/08/2026,20/08/2026,"IBG GIRO Aug 2026 Salary IN.CORP GLOBAL PTE",,"3,998.50"
19/08/2026,19/08/2026,"CCRD-Credit Card Payment to Citibank","1,280.57",
16/08/2026,17/08/2026,"STASHAWAY SA-CR-AW4Q8R9V OTHR StashAway","1,000.00",
12/08/2026,12/08/2026,"BONUS INTEREST 360 SALARY BONUS",,13.69
30/08/2026,31/08/2026,"NETS QR ENG KEE CHICKEN WINGS",5.20,
31/08/2026,31/08/2026,"INTEREST CREDIT",,0.74`;
  }
}
