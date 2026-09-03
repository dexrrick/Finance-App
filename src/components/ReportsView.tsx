import React, { useState } from 'react';
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

export const ReportsView: React.FC<ReportsViewProps> = ({ accounts, transactions, settings }) => {
  const currency = settings.currencySymbol || '$';
  const [reportType, setReportType] = useState<'balance-sheet' | 'income-statement' | 'trial-balance'>(
    'balance-sheet'
  );

  const balanceSheet = generateBalanceSheet(accounts, transactions);
  const incomeStatement = generateIncomeStatement(accounts, transactions);
  const trialBalance = generateTrialBalance(accounts, transactions);

  const handlePrint = () => {
    window.print();
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
            <h2 className="text-lg font-bold text-white tracking-tight">Financial Statements</h2>
            <p className="text-xs text-slate-400">
              Audit-ready Balance Sheet, Income Statement (P&L), and Trial Balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(accounts, transactions)}
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
              <p className="text-xs text-slate-400">As of {new Date().toLocaleDateString()}</p>
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
            <p className="text-xs text-slate-400">Total revenues minus expenses</p>
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
                Double-entry verification checking that total debits equal total credits
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
