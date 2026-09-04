import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Scale,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { Account, AppSettings, Transaction } from '../core/types';
import {
  formatCurrency,
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
} from '../core/accounting';
import { exportToCSV } from '../storage/backup';

interface ReportsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  settings: AppSettings;
}

export type DateFilterMode =
  | 'all'
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'this-year'
  | 'last-year'
  | 'by-month'
  | 'by-year'
  | 'custom';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function getDaysInMonth(year: number, month1To12: number): number {
  return new Date(year, month1To12, 0).getDate();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ReportsView: React.FC<ReportsViewProps> = ({ accounts, transactions, settings }) => {
  const currency = settings.currencySymbol || '$';
  const baseCurrency = settings.baseCurrency || 'USD';
  const isLight = settings.theme === 'light';
  const [reportType, setReportType] = useState<'balance-sheet' | 'income-statement' | 'trial-balance'>(
    'balance-sheet'
  );

  // Date Filter State
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12

  const [filterMode, setFilterMode] = useState<DateFilterMode>('this-month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [customStart, setCustomStart] = useState<string>(
    `${currentYear}-${pad2(currentMonth)}-01`
  );
  const [customEnd, setCustomEnd] = useState<string>(
    now.toISOString().split('T')[0]
  );

  // Extract all available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    years.add(currentYear - 1);
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 4) {
        const y = parseInt(tx.date.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  // Compute effective date bounds & period label
  const { startDate, endDate, periodLabel } = useMemo(() => {
    let start: string | null = null;
    let end: string | null = null;
    let label = 'All Time';

    if (filterMode === 'this-month') {
      start = `${currentYear}-${pad2(currentMonth)}-01`;
      end = `${currentYear}-${pad2(currentMonth)}-${pad2(getDaysInMonth(currentYear, currentMonth))}`;
      label = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
    } else if (filterMode === 'last-month') {
      const lmYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const lmMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      start = `${lmYear}-${pad2(lmMonth)}-01`;
      end = `${lmYear}-${pad2(lmMonth)}-${pad2(getDaysInMonth(lmYear, lmMonth))}`;
      label = `${MONTH_NAMES[lmMonth - 1]} ${lmYear}`;
    } else if (filterMode === 'this-quarter') {
      const qStartMonth = Math.floor((currentMonth - 1) / 3) * 3 + 1;
      const qEndMonth = qStartMonth + 2;
      const qNum = Math.floor((currentMonth - 1) / 3) + 1;
      start = `${currentYear}-${pad2(qStartMonth)}-01`;
      end = `${currentYear}-${pad2(qEndMonth)}-${pad2(getDaysInMonth(currentYear, qEndMonth))}`;
      label = `Q${qNum} ${currentYear} (${MONTH_NAMES[qStartMonth - 1].slice(0, 3)} - ${MONTH_NAMES[qEndMonth - 1].slice(0, 3)})`;
    } else if (filterMode === 'this-year') {
      start = `${currentYear}-01-01`;
      end = `${currentYear}-12-31`;
      label = `FY ${currentYear}`;
    } else if (filterMode === 'last-year') {
      start = `${currentYear - 1}-01-01`;
      end = `${currentYear - 1}-12-31`;
      label = `FY ${currentYear - 1}`;
    } else if (filterMode === 'by-month') {
      start = `${selectedYear}-${pad2(selectedMonth)}-01`;
      end = `${selectedYear}-${pad2(selectedMonth)}-${pad2(getDaysInMonth(selectedYear, selectedMonth))}`;
      label = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    } else if (filterMode === 'by-year') {
      start = `${selectedYear}-01-01`;
      end = `${selectedYear}-12-31`;
      label = `Full Year ${selectedYear}`;
    } else if (filterMode === 'custom') {
      start = customStart || null;
      end = customEnd || null;
      if (start && end) {
        label = `${start} to ${end}`;
      } else if (start) {
        label = `From ${start}`;
      } else if (end) {
        label = `Up to ${end}`;
      } else {
        label = 'Custom Range';
      }
    }

    return { startDate: start, endDate: end, periodLabel: label };
  }, [filterMode, currentYear, currentMonth, selectedYear, selectedMonth, customStart, customEnd]);

  // Filter transactions
  // 1. Period Transactions: strictly within period (for Income Statement / P&L)
  const periodTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // 2. As-Of Transactions: cumulative from beginning up to endDate (for Balance Sheet / Trial Balance)
  const asOfTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (endDate && tx.date > endDate) return false;
      return true;
    });
  }, [transactions, endDate]);

  // Compute accounting statements
  const balanceSheet = useMemo(
    () => generateBalanceSheet(accounts, asOfTransactions),
    [accounts, asOfTransactions]
  );
  const incomeStatement = useMemo(
    () => generateIncomeStatement(accounts, periodTransactions),
    [accounts, periodTransactions]
  );
  const trialBalance = useMemo(
    () => generateTrialBalance(accounts, asOfTransactions),
    [accounts, asOfTransactions]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleCSVExport = () => {
    // Export relevant transactions based on active report
    const targetTx = reportType === 'income-statement' ? periodTransactions : asOfTransactions;
    exportToCSV(accounts, targetTx);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border rounded-2xl p-5 shadow-sm transition-all ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
            isLight ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Financial Statements</h2>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                isLight ? 'bg-slate-100 text-indigo-700 border-slate-200' : 'bg-slate-800 text-indigo-400 border-slate-700'
              }`}>
                Base: {baseCurrency}
              </span>
            </div>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Audit-ready Balance Sheet, Income Statement (P&L), and Trial Balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCSVExport}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            CSV Export
          </button>
          <button
            onClick={handlePrint}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className={`border rounded-2xl p-4 transition-all ${
        isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
      } space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Reporting Period:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as DateFilterMode)}
              className={`font-semibold text-xs px-3 py-1.5 rounded-xl border focus:outline-none focus:border-indigo-500 cursor-pointer ${
                isLight ? 'bg-slate-50 text-slate-900 border-slate-300' : 'bg-slate-800 text-white border-slate-700'
              }`}
            >
              <option value="this-month">📅 This Month</option>
              <option value="last-month">📅 Last Month</option>
              <option value="this-quarter">📊 This Quarter</option>
              <option value="this-year">📆 This Year (YTD)</option>
              <option value="last-year">📆 Last Year</option>
              <option value="by-month">🗓️ Select Month & Year</option>
              <option value="by-year">🗓️ Select Specific Year</option>
              <option value="custom">⚙️ Custom Date Range</option>
              <option value="all">🌐 All Time (Cumulative)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className={`font-bold px-2.5 py-1 rounded-lg border text-xs ${
              isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
            }`}>
              {periodLabel}
            </span>
            <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {reportType === 'income-statement' ? (
                <span>({periodTransactions.length} in period)</span>
              ) : (
                <span>({asOfTransactions.length} cumulative)</span>
              )}
            </span>
          </div>
        </div>

        {/* Conditional Sub-selectors */}
        {filterMode === 'by-month' && (
          <div className={`flex flex-wrap items-center gap-3 pt-2 p-3 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
          }`}>
            <div className="flex items-center gap-2">
              <label className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:border-indigo-500 ${
                  isLight ? 'bg-white text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-100 border-slate-700'
                }`}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:border-indigo-500 ${
                  isLight ? 'bg-white text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-100 border-slate-700'
                }`}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {filterMode === 'by-year' && (
          <div className={`flex items-center gap-3 pt-2 p-3 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
          }`}>
            <label className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Select Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:border-indigo-500 ${
                isLight ? 'bg-white text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-100 border-slate-700'
              }`}
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterMode === 'custom' && (
          <div className={`flex flex-wrap items-center gap-3 pt-2 p-3 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
          }`}>
            <div className="flex items-center gap-2">
              <label className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>From:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:border-indigo-500 ${
                  isLight ? 'bg-white text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-100 border-slate-700'
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>To:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:border-indigo-500 ${
                  isLight ? 'bg-white text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-100 border-slate-700'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Report Switcher Tabs */}
      <div className={`flex p-1 rounded-xl border max-w-md ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
        <button
          onClick={() => setReportType('balance-sheet')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            reportType === 'balance-sheet'
              ? 'bg-indigo-600 !text-white text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Balance Sheet
        </button>
        <button
          onClick={() => setReportType('income-statement')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            reportType === 'income-statement'
              ? 'bg-indigo-600 !text-white text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Income Statement (P&L)
        </button>
        <button
          onClick={() => setReportType('trial-balance')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            reportType === 'trial-balance'
              ? 'bg-indigo-600 !text-white text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Trial Balance
        </button>
      </div>

      {/* ================= 1. BALANCE SHEET ================= */}
      {reportType === 'balance-sheet' && (
        <div className={`border rounded-2xl p-6 shadow-sm space-y-6 transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
        }`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-2 ${
            isLight ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Balance Sheet</h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                As of {endDate ? endDate : 'All Time'} • Period: {periodLabel}
              </p>
            </div>
            <div>
              {balanceSheet.isBalanced ? (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
                  isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Equation Balanced (Assets = Liabilities + Equity)
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
                  isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy: {formatCurrency(balanceSheet.difference, currency)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: ASSETS */}
            <div className="space-y-4">
              <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <span className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  Assets
                </span>
                <span className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {formatCurrency(balanceSheet.totalAssets, currency)}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {balanceSheet.assets.map((item) => (
                  <div
                    key={item.account.id}
                    className={`flex justify-between py-1.5 px-2 rounded transition-colors ${
                      isLight ? 'hover:bg-slate-100/80' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                      {item.account.code} - {item.account.name}
                    </span>
                    <span className={`font-mono font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {formatCurrency(item.balance, currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className={`pt-3 border-t flex justify-between font-bold text-sm p-3 rounded-xl ${
                isLight ? 'border-slate-200 bg-slate-50 text-slate-900' : 'border-slate-800 bg-slate-950/60 text-white'
              }`}>
                <span>Total Assets</span>
                <span className={`font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {formatCurrency(balanceSheet.totalAssets, currency)}
                </span>
              </div>
            </div>

            {/* Right: LIABILITIES & EQUITY */}
            <div className="space-y-6">
              {/* Liabilities */}
              <div className="space-y-4">
                <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                  <span className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                    Liabilities
                  </span>
                  <span className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {formatCurrency(balanceSheet.totalLiabilities, currency)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {balanceSheet.liabilities.length === 0 ? (
                    <p className="text-slate-500 italic py-1">No liabilities recorded.</p>
                  ) : (
                    balanceSheet.liabilities.map((item) => (
                      <div
                        key={item.account.id}
                        className={`flex justify-between py-1.5 px-2 rounded transition-colors ${
                          isLight ? 'hover:bg-slate-100/80' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                          {item.account.code} - {item.account.name}
                        </span>
                        <span className={`font-mono font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                          {formatCurrency(item.balance, currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Equity */}
              <div className="space-y-4">
                <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                  <span className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                    Equity
                  </span>
                  <span className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {formatCurrency(balanceSheet.totalEquity + balanceSheet.netIncome, currency)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {balanceSheet.equity.map((item) => (
                    <div
                      key={item.account.id}
                      className={`flex justify-between py-1.5 px-2 rounded transition-colors ${
                        isLight ? 'hover:bg-slate-100/80' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        {item.account.code} - {item.account.name}
                      </span>
                      <span className={`font-mono font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        {formatCurrency(item.balance, currency)}
                      </span>
                    </div>
                  ))}

                  {/* Current Period Net Income */}
                  <div className={`flex justify-between py-1.5 px-2 rounded border ${
                    isLight ? 'bg-indigo-50/70 text-indigo-900 border-indigo-200' : 'bg-indigo-950/20 text-indigo-300 border-indigo-500/20'
                  }`}>
                    <span className="font-medium">Current Period Net Income / Loss</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(balanceSheet.netIncome, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Liabilities & Equity */}
              <div className={`pt-3 border-t flex justify-between font-bold text-sm p-3 rounded-xl ${
                isLight ? 'border-slate-200 bg-slate-50 text-slate-900' : 'border-slate-800 bg-slate-950/60 text-white'
              }`}>
                <span>Total Liabilities & Equity</span>
                <span className={`font-mono ${isLight ? 'text-indigo-700' : 'text-indigo-400'}`}>
                  {formatCurrency(balanceSheet.totalLiabilitiesAndEquity, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. INCOME STATEMENT (P&L) ================= */}
      {reportType === 'income-statement' && (
        <div className={`border rounded-2xl p-6 shadow-sm space-y-6 transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
        }`}>
          <div className={`pb-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Income Statement (Profit & Loss)</h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Period: {periodLabel} • Total revenues minus expenses for this timeframe
            </p>
          </div>

          <div className="space-y-6">
            {/* Revenue */}
            <div className="space-y-3">
              <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  Revenues & Gains
                </span>
                <span className={`font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {formatCurrency(incomeStatement.totalRevenue, currency)}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                {incomeStatement.revenues.length === 0 ? (
                  <p className="text-slate-500 italic py-1">No revenues logged yet.</p>
                ) : (
                  incomeStatement.revenues.map((item) => (
                    <div
                      key={item.account.id}
                      className={`flex justify-between py-1 px-2 rounded transition-colors ${
                        isLight ? 'hover:bg-slate-100/80' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        {item.account.code} - {item.account.name}
                      </span>
                      <span className={`font-mono ${isLight ? 'text-slate-900 font-semibold' : 'text-slate-200'}`}>
                        {formatCurrency(item.balance, currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expenses */}
            <div className="space-y-3">
              <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                  Operating Expenses
                </span>
                <span className={`font-mono font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                  {formatCurrency(incomeStatement.totalExpense, currency)}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                {incomeStatement.expenses.length === 0 ? (
                  <p className="text-slate-500 italic py-1">No expenses logged yet.</p>
                ) : (
                  incomeStatement.expenses.map((item) => (
                    <div
                      key={item.account.id}
                      className={`flex justify-between py-1 px-2 rounded transition-colors ${
                        isLight ? 'hover:bg-slate-100/80' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                        {item.account.code} - {item.account.name}
                      </span>
                      <span className={`font-mono ${isLight ? 'text-slate-900 font-semibold' : 'text-slate-200'}`}>
                        {formatCurrency(item.balance, currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Line: Net Profit / Loss */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between font-bold text-sm ${
                incomeStatement.netIncome >= 0
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : isLight
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}
            >
              <span>Net Income (Profit / Loss)</span>
              <span className="text-lg font-mono">
                {formatCurrency(incomeStatement.netIncome, currency)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. TRIAL BALANCE ================= */}
      {reportType === 'trial-balance' && (
        <div className={`border rounded-2xl p-6 shadow-sm space-y-6 transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
        }`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-2 ${
            isLight ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Trial Balance</h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                As of {endDate ? endDate : 'All Time'} • Double-entry debit/credit verification
              </p>
            </div>
            <div>
              {trialBalance.isBalanced ? (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${
                  isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Trial Balance Verified ($0.00 difference)
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${
                  isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Out of Balance by{' '}
                  {formatCurrency(trialBalance.difference, currency)}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b font-semibold uppercase tracking-wider ${
                  isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-slate-800 bg-slate-950/60 text-slate-400'
                }`}>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Account Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-slate-800/60'}`}>
                {trialBalance.rows.map((row) => (
                  <tr key={row.account.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'}`}>
                    <td className={`py-2.5 px-3 font-mono font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {row.account.code}
                    </td>
                    <td className={`py-2.5 px-3 font-medium ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                      {row.account.name}
                    </td>
                    <td className={`py-2.5 px-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{row.account.category}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      {row.debit > 0 ? formatCurrency(row.debit, currency) : '—'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                      {row.credit > 0 ? formatCurrency(row.credit, currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 font-bold text-sm ${
                  isLight ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-slate-700 bg-slate-950/80 text-white'
                }`}>
                  <td colSpan={3} className="py-3 px-3">
                    Total Trial Balance
                  </td>
                  <td className={`py-3 px-3 text-right font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    {formatCurrency(trialBalance.totalDebit, currency)}
                  </td>
                  <td className={`py-3 px-3 text-right font-mono ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                    {formatCurrency(trialBalance.totalCredit, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
