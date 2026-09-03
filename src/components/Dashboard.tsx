import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Scale,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  BookOpen,
  ChevronRight,
  Sparkles,
  Flame,
} from 'lucide-react';
import { Account, AppSettings, Transaction } from '../core/types';
import {
  calculateAccountBalances,
  formatCurrency,
  generateBalanceSheet,
  generateIncomeStatement,
} from '../core/accounting';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  settings: AppSettings;
  onOpenTransactionModal: (mode?: 'expense' | 'income' | 'transfer' | 'journal') => void;
  onSelectTransactionToEdit: (tx: Transaction) => void;
  onNavigateToTab: (tab: 'dashboard' | 'journal' | 'accounts' | 'reports' | 'games') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  accounts,
  transactions,
  settings,
  onOpenTransactionModal,
  onSelectTransactionToEdit,
  onNavigateToTab,
}) => {
  const currency = settings.currencySymbol || '$';

  // Compute balance sheet & income statement
  const balanceSheet = generateBalanceSheet(accounts, transactions);
  const incomeStatement = generateIncomeStatement(accounts, transactions);
  const balances = calculateAccountBalances(accounts, transactions);

  const netWorth = balanceSheet.totalAssets - balanceSheet.totalLiabilities;

  // Liquid assets (cash, checking, savings)
  const liquidCashAccounts = accounts.filter(
    (a) => a.category === 'ASSET' && (a.subcategory?.includes('Cash') || a.subcategory?.includes('Bank'))
  );
  const totalLiquid = liquidCashAccounts.reduce((sum, acc) => {
    return sum + (balances.get(acc.id)?.balance || 0);
  }, 0);

  // Recent 5 transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Top spending expense accounts
  const expenseBreakdown = accounts
    .filter((a) => a.category === 'EXPENSE')
    .map((a) => ({
      account: a,
      balance: balances.get(a.id)?.balance || 0,
    }))
    .filter((item) => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const maxExpense = expenseBreakdown[0]?.balance || 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Streak & Accounting Equation Status */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Accounting Equation Status
              </h2>
              {balanceSheet.isBalanced ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Perfect Balance
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <AlertCircle className="w-3.5 h-3.5" /> Discrepancy
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Assets ({formatCurrency(balanceSheet.totalAssets, currency)}) = Liabilities (
              {formatCurrency(balanceSheet.totalLiabilities, currency)}) + Equity & Earnings (
              {formatCurrency(balanceSheet.totalEquity + balanceSheet.netIncome, currency)})
            </p>
          </div>
        </div>

        {/* Gamification / Streak Pill */}
        <div
          onClick={() => onNavigateToTab('games')}
          className="flex items-center gap-3 bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/60 px-3.5 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.02] shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-300">
                {settings.gamification?.streakDays || 1} Day Streak
              </span>
              <span className="text-[10px] text-slate-400">
                • {settings.gamification?.xp || 100} XP
              </span>
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              Play Ledger Mini-Games <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Net Worth</span>
            <Wallet className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-bold font-mono tracking-tight ${
                netWorth >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrency(netWorth, currency)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Total Assets minus Total Liabilities
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Total Assets */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Assets</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              {formatCurrency(balanceSheet.totalAssets, currency)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Liquid Cash: {formatCurrency(totalLiquid, currency)}
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Total Liabilities */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Liabilities</span>
            <CreditCard className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
              {formatCurrency(balanceSheet.totalLiabilities, currency)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Credit cards, loans, payables
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Net Cash Flow / Income */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Period Net Income</span>
            {incomeStatement.netIncome >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-bold font-mono tracking-tight ${
                incomeStatement.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(incomeStatement.netIncome, currency)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>In: {formatCurrency(incomeStatement.totalRevenue, currency)}</span>
            <span>Out: {formatCurrency(incomeStatement.totalExpense, currency)}</span>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Quick Actions:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenTransactionModal('expense')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
            Add Expense
          </button>
          <button
            onClick={() => onOpenTransactionModal('income')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-all"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            Add Income
          </button>
          <button
            onClick={() => onOpenTransactionModal('transfer')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 text-sky-300 text-xs font-medium transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            Transfer Funds
          </button>
          <button
            onClick={() => onOpenTransactionModal('journal')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 text-xs font-medium transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            Journal Entry (Dr / Cr)
          </button>
        </div>
      </div>

      {/* Main Grid: Recent Transactions & Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Transactions */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Recent Ledger Transactions
            </h3>
            <button
              onClick={() => onNavigateToTab('journal')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No transactions recorded yet. Click <strong>Record</strong> to post your first entry!
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentTransactions.map((tx) => {
                const totalAmount =
                  tx.legs
                    .filter((l) => l.type === 'DEBIT')
                    .reduce((sum, l) => sum + l.amount, 0) || 0;

                const isIncome = tx.meta?.simpleMode === 'income';
                const isExpense = tx.meta?.simpleMode === 'expense';
                const isTransfer = tx.meta?.simpleMode === 'transfer';

                return (
                  <div
                    key={tx.id}
                    onClick={() => onSelectTransactionToEdit(tx)}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isExpense
                            ? 'bg-rose-500/20 text-rose-400'
                            : isTransfer
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : isExpense ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : isTransfer ? (
                          <RefreshCw className="w-4 h-4" />
                        ) : (
                          <Scale className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                            {tx.description}
                          </p>
                          {tx.meta?.simpleMode ? (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {tx.meta.simpleMode}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Journal
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tx.date} • {tx.legs.length} legs
                          {tx.reference && ` • Ref: ${tx.reference}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <span
                        className={`text-sm font-bold font-mono ${
                          isIncome
                            ? 'text-emerald-400'
                            : isExpense
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {isExpense ? '-' : isIncome ? '+' : ''}
                        {formatCurrency(totalAmount, currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Top Expense Categories & Account Overview */}
        <div className="space-y-6">
          {/* Top Spending Categories */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
              <span>Top Expense Outflows</span>
              <span className="text-xs text-slate-400 font-normal">By Category</span>
            </h3>

            {expenseBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No expense transactions recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {expenseBreakdown.map(({ account, balance }) => {
                  const pct = Math.min(100, Math.round((balance / maxExpense) * 100));
                  return (
                    <div key={account.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300 truncate max-w-[160px]">
                          {account.name}
                        </span>
                        <span className="font-mono font-semibold text-rose-400">
                          {formatCurrency(balance, currency)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account Quick Balances */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Liquid Balances</h3>
              <button
                onClick={() => onNavigateToTab('accounts')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Chart of Accounts
              </button>
            </div>

            <div className="space-y-2">
              {liquidCashAccounts.slice(0, 4).map((acc) => {
                const bal = balances.get(acc.id)?.balance || 0;
                return (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs"
                  >
                    <span className="text-slate-300 font-medium truncate">{acc.name}</span>
                    <span className="font-mono font-bold text-slate-100">
                      {formatCurrency(bal, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
