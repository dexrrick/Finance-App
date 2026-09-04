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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Financial Statements</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                Base: {baseCurrency}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Audit-ready Balance Sheet, Income Statement (P&L), and Trial Balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCSVExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            CSV Export
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
            <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Reporting Period:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as DateFilterMode)}
              className="bg-slate-800 text-white font-semibold text-xs px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
            <span className="font-bold text-white bg-indigo-950/60 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30 text-xs">
              {periodLabel}
            </span>
            <span className="text-[11px] text-slate-400">
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
          <div className="flex flex-wrap items-center gap-3 pt-2 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-800 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-800 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
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
          <div className="flex items-center gap-3 pt-2 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
            <label className="text-xs text-slate-400">Select Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-800 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
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
          <div className="flex flex-wrap items-center gap-3 pt-2 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">From:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-800 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">To:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-800 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 max-w-md">
        <button
          onClick={() => setReportType('balance-sheet')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            reportType === 'balance-sheet'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Balance Sheet
        </button>
        <button
          onClick={() => setReportType('income-statement')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            reportType === 'income-statement'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Income Statement (P&L)
        </button>
        <button
          onClick={() => setReportType('trial-balance')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            reportType === 'trial-balance'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Trial Balance
        </button>
      </div>

      {/* ================= 1. BALANCE SHEET ================= */}
      {reportType === 'balance-sheet' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div>
              <h3 className="text-base font-bold text-white">Balance Sheet</h3>
              <p className="text-xs text-slate-400">
                As of {endDate ? endDate : 'All Time'} • Period: {periodLabel}
              </p>
            </div>
            <div>
              {balanceSheet.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Equation Balanced (Assets = Liabilities + Equity)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy: {formatCurrency(balanceSheet.difference, currency)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: ASSETS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                  Assets
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {formatCurrency(balanceSheet.totalAssets, currency)}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {balanceSheet.assets.map((item) => (
                  <div key={item.account.id} className="flex justify-between py-1.5 px-2 rounded hover:bg-slate-800/40">
                    <span className="text-slate-300">
                      {item.account.code} - {item.account.name}
                    </span>
                    <span className="font-mono text-slate-100 font-medium">
                      {formatCurrency(item.balance, currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between font-bold text-sm bg-slate-950/60 p-3 rounded-xl">
                <span className="text-white">Total Assets</span>
                <span className="text-emerald-400 font-mono">
                  {formatCurrency(balanceSheet.totalAssets, currency)}
                </span>
              </div>
            </div>

            {/* Right: LIABILITIES & EQUITY */}
            <div className="space-y-6">
              {/* Liabilities */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-sm font-bold text-rose-400 uppercase tracking-wider">
                    Liabilities
                  </span>
                  <span className="text-sm font-bold text-white font-mono">
                    {formatCurrency(balanceSheet.totalLiabilities, currency)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {balanceSheet.liabilities.length === 0 ? (
                    <p className="text-slate-500 italic py-1">No liabilities recorded.</p>
                  ) : (
                    balanceSheet.liabilities.map((item) => (
                      <div key={item.account.id} className="flex justify-between py-1.5 px-2 rounded hover:bg-slate-800/40">
                        <span className="text-slate-300">
                          {item.account.code} - {item.account.name}
                        </span>
                        <span className="font-mono text-slate-100 font-medium">
                          {formatCurrency(item.balance, currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Equity */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                    Equity
                  </span>
                  <span className="text-sm font-bold text-white font-mono">
                    {formatCurrency(balanceSheet.totalEquity + balanceSheet.netIncome, currency)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {balanceSheet.equity.map((item) => (
                    <div key={item.account.id} className="flex justify-between py-1.5 px-2 rounded hover:bg-slate-800/40">
                      <span className="text-slate-300">
                        {item.account.code} - {item.account.name}
                      </span>
                      <span className="font-mono text-slate-100 font-medium">
                        {formatCurrency(item.balance, currency)}
                      </span>
                    </div>
                  ))}

                  {/* Current Period Net Income */}
                  <div className="flex justify-between py-1.5 px-2 rounded bg-indigo-950/20 text-indigo-300 border border-indigo-500/20">
                    <span className="font-medium">Current Period Net Income / Loss</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(balanceSheet.netIncome, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Liabilities & Equity */}
              <div className="pt-3 border-t border-slate-800 flex justify-between font-bold text-sm bg-slate-950/60 p-3 rounded-xl">
                <span className="text-white">Total Liabilities & Equity</span>
                <span className="text-indigo-400 font-mono">
                  {formatCurrency(balanceSheet.totalLiabilitiesAndEquity, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. INCOME STATEMENT (P&L) ================= */}
      {reportType === 'income-statement' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-base font-bold text-white">Income Statement (Profit & Loss)</h3>
            <p className="text-xs text-slate-400">
              Period: {periodLabel} • Total revenues minus expenses for this timeframe
            </p>
          </div>

          <div className="space-y-6">
            {/* Revenue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Revenues & Gains
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(incomeStatement.totalRevenue, currency)}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                {incomeStatement.revenues.length === 0 ? (
                  <p className="text-slate-500 italic py-1">No revenues logged yet.</p>
                ) : (
                  incomeStatement.revenues.map((item) => (
                    <div key={item.account.id} className="flex justify-between py-1 px-2 rounded hover:bg-slate-800/40">
                      <span className="text-slate-300">
                        {item.account.code} - {item.account.name}
                      </span>
                      <span className="font-mono text-slate-200">
                        {formatCurrency(item.balance, currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expenses */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Operating Expenses
                </span>
                <span className="font-mono font-bold text-rose-400">
                  {formatCurrency(incomeStatement.totalExpense, currency)}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                {incomeStatement.expenses.length === 0 ? (
                  <p className="text-slate-500 italic py-1">No expenses logged yet.</p>
                ) : (
                  incomeStatement.expenses.map((item) => (
                    <div key={item.account.id} className="flex justify-between py-1 px-2 rounded hover:bg-slate-800/40">
                      <span className="text-slate-300">
                        {item.account.code} - {item.account.name}
                      </span>
                      <span className="font-mono text-slate-200">
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
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
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
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div>
              <h3 className="text-base font-bold text-white">Trial Balance</h3>
              <p className="text-xs text-slate-400">
                As of {endDate ? endDate : 'All Time'} • Double-entry debit/credit verification
              </p>
            </div>
            <div>
              {trialBalance.isBalanced ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Trial Balance Verified ($0.00 difference)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Out of Balance by{' '}
                  {formatCurrency(trialBalance.difference, currency)}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Account Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trialBalance.rows.map((row) => (
                  <tr key={row.account.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                      {row.account.code}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">
                      {row.account.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{row.account.category}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                      {row.debit > 0 ? formatCurrency(row.debit, currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sky-400">
                      {row.credit > 0 ? formatCurrency(row.credit, currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 font-bold bg-slate-950/80 text-sm">
                  <td colSpan={3} className="py-3 px-3 text-white">
                    Total Trial Balance
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400">
                    {formatCurrency(trialBalance.totalDebit, currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sky-400">
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
