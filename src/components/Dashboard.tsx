import React, { useState, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Scale,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  BookOpen,
  ChevronRight,
  Sparkles,
  Sliders,
  X,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  GripVertical,
} from 'lucide-react';
import { Account, AppSettings, DashboardCardConfig, DashboardCardId, Transaction } from '../core/types';
import {
  calculateAccountBalances,
  formatCurrency,
  generateBalanceSheet,
  generateIncomeStatement,
} from '../core/accounting';
import { DEFAULT_DASHBOARD_CARDS } from '../storage/db';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  settings: AppSettings;
  onOpenTransactionModal: (mode?: 'expense' | 'income' | 'transfer' | 'journal') => void;
  onSelectTransactionToEdit: (tx: Transaction) => void;
  onNavigateToTab: (tab: 'dashboard' | 'journal' | 'accounts' | 'reports' | 'settings') => void;
  onUpdateSettings?: (settings: AppSettings) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  accounts,
  transactions,
  settings,
  onOpenTransactionModal,
  onSelectTransactionToEdit,
  onNavigateToTab,
  onUpdateSettings,
}) => {
  const currency = settings.currencySymbol || '$';
  const isLight = settings.theme === 'light';
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

  // Load cards config
  const cardsConfig: DashboardCardConfig[] = settings.dashboardCards || DEFAULT_DASHBOARD_CARDS;

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

  // Recent 6 transactions
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

  // Handlers for customizing cards
  const handleToggleCard = (cardId: DashboardCardId) => {
    const updated = cardsConfig.map((c) => (c.id === cardId ? { ...c, enabled: !c.enabled } : c));
    onUpdateSettings?.({ ...settings, dashboardCards: updated });
  };

  const handleMoveCardUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...cardsConfig];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onUpdateSettings?.({ ...settings, dashboardCards: updated });
  };

  const handleMoveCardDown = (index: number) => {
    if (index >= cardsConfig.length - 1) return;
    const updated = [...cardsConfig];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onUpdateSettings?.({ ...settings, dashboardCards: updated });
  };

  const handleResetCards = () => {
    onUpdateSettings?.({ ...settings, dashboardCards: DEFAULT_DASHBOARD_CARDS });
  };

  // Touch & Pointer live reorder state for Customize Cards modal
  const [activeDragCardIndex, setActiveDragCardIndex] = useState<number | null>(null);
  const cardListRef = useRef<HTMLDivElement>(null);

  const handleCardPointerDown = (index: number, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button')) return;

    setActiveDragCardIndex(index);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    if (activeDragCardIndex === null || !cardListRef.current) return;
    e.preventDefault();

    const rows = Array.from(
      cardListRef.current.querySelectorAll<HTMLElement>('[data-card-index]')
    );
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const buffer = rect.height * 0.3;
      if (e.clientY >= rect.top + (i < activeDragCardIndex ? buffer : 0) && e.clientY <= rect.bottom - (i > activeDragCardIndex ? buffer : 0)) {
        if (i !== activeDragCardIndex) {
          const updated = [...cardsConfig];
          const [moved] = updated.splice(activeDragCardIndex, 1);
          updated.splice(i, 0, moved);

          onUpdateSettings?.({ ...settings, dashboardCards: updated });
          setActiveDragCardIndex(i);
        }
        break;
      }
    }
  };

  const handleCardPointerUp = (e: React.PointerEvent) => {
    if (activeDragCardIndex !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // safe fallback
      }
      setActiveDragCardIndex(null);
    }
  };

  // Helper render functions
  const renderEquationStatus = () => (
    <div
      key="equation_status"
      className={`border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm transition-all ${
        isLight
          ? 'bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/80 border-indigo-100 text-slate-900'
          : 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800 text-white shadow-xl'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
            isLight
              ? 'bg-indigo-100/70 border-indigo-200 text-indigo-600'
              : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
          }`}
        >
          <Scale className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-sm sm:text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Accounting Equation Status
            </h2>
            {balanceSheet.isBalanced ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isLight
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                <CheckCircle2 className="w-3 h-3" /> Balanced
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isLight
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                <AlertCircle className="w-3 h-3" /> Discrepancy
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Assets ({formatCurrency(balanceSheet.totalAssets, currency)}) = Liabilities (
            {formatCurrency(balanceSheet.totalLiabilities, currency)}) + Equity & Net Income (
            {formatCurrency(balanceSheet.totalEquity + balanceSheet.netIncome, currency)})
          </p>
        </div>
      </div>
    </div>
  );

  const renderNetWorth = () => (
    <div key="net_worth" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-lg">
      <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
        <span>Net Worth</span>
        <Wallet className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="mt-2.5">
        <span className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>
          {formatCurrency(netWorth, currency)}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400">
        Total Assets − Total Liabilities
      </div>
    </div>
  );

  const renderTotalAssets = () => (
    <div key="total_assets" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-lg">
      <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
        <span>Total Assets</span>
        <TrendingUp className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="mt-2.5">
        <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tracking-tight">
          {formatCurrency(balanceSheet.totalAssets, currency)}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400">
        Liquid Cash: {formatCurrency(totalLiquid, currency)}
      </div>
    </div>
  );

  const renderTotalLiabilities = () => (
    <div key="total_liabilities" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-lg">
      <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
        <span>Total Liabilities</span>
        <CreditCard className="w-4 h-4 text-rose-400" />
      </div>
      <div className="mt-2.5">
        <span className="text-xl sm:text-2xl font-bold font-mono text-rose-400 tracking-tight">
          {formatCurrency(balanceSheet.totalLiabilities, currency)}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400">
        Credit cards & personal loans
      </div>
    </div>
  );

  const renderNetIncome = () => (
    <div key="net_income" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-lg">
      <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
        <span>Period Net Income</span>
        {incomeStatement.netIncome >= 0 ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-rose-400" />
        )}
      </div>
      <div className="mt-2.5">
        <span className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${incomeStatement.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCurrency(incomeStatement.netIncome, currency)}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
        <span>In: {formatCurrency(incomeStatement.totalRevenue, currency)}</span>
        <span>Out: {formatCurrency(incomeStatement.totalExpense, currency)}</span>
      </div>
    </div>
  );

  const renderQuickActions = () => (
    <div
      key="quick_actions"
      className={`border rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2.5 transition-all ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
          : 'bg-slate-900/70 border-slate-800/80 text-slate-200'
      }`}
    >
      <span className={`text-xs font-semibold flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        Quick Actions:
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onOpenTransactionModal('expense')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
            isLight
              ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
              : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/30 text-rose-300'
          }`}
        >
          <ArrowDownLeft className="w-3 h-3 text-rose-500" />
          Expense
        </button>
        <button
          onClick={() => onOpenTransactionModal('income')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
            isLight
              ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
              : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <ArrowUpRight className="w-3 h-3 text-emerald-500" />
          Income
        </button>
        <button
          onClick={() => onOpenTransactionModal('transfer')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
            isLight
              ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700'
              : 'bg-sky-950/40 hover:bg-sky-900/50 border-sky-500/30 text-sky-300'
          }`}
        >
          <RefreshCw className="w-3 h-3 text-sky-500" />
          Transfer
        </button>
        <button
          onClick={() => onOpenTransactionModal('journal')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
            isLight
              ? 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700'
              : 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-300'
          }`}
        >
          <BookOpen className="w-3 h-3 text-purple-500" />
          Journal
        </button>
      </div>
    </div>
  );

  const renderRecentTransactions = () => (
    <div key="recent_transactions" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3.5">
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
        <div className="py-8 text-center text-slate-500 text-xs">
          No transactions recorded yet. Tap <strong>+</strong> to post your first entry!
        </div>
      ) : (
        <div className="space-y-2">
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
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
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
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : isExpense ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : isTransfer ? (
                      <RefreshCw className="w-3.5 h-3.5" />
                    ) : (
                      <Scale className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                      {tx.description}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {tx.date} • {tx.legs.length} legs
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isIncome ? 'text-emerald-400' : isExpense ? 'text-rose-400' : 'text-slate-200'
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
  );

  const renderExpenseBreakdown = () => (
    <div key="expense_breakdown" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
        <span>Top Expense Outflows</span>
        <span className="text-xs text-slate-400 font-normal">By Category</span>
      </h3>

      {expenseBreakdown.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">
          No expense transactions recorded yet.
        </p>
      ) : (
        <div className="space-y-2.5">
          {expenseBreakdown.map(({ account, balance }) => {
            const pct = Math.min(100, Math.round((balance / maxExpense) * 100));
            return (
              <div key={account.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 truncate max-w-[160px]">
                    {account.name}
                  </span>
                  <span className="font-mono font-semibold text-rose-400 text-xs">
                    {formatCurrency(balance, currency)}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
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
  );

  const renderLiquidCash = () => (
    <div key="liquid_cash" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Liquid Cash Balances</h3>
        <button
          onClick={() => onNavigateToTab('accounts')}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
        >
          Accounts
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
  );

  // Card dispatcher mapping
  const cardRendererMap: Record<DashboardCardId, () => React.ReactNode> = {
    equation_status: renderEquationStatus,
    net_worth: renderNetWorth,
    total_assets: renderTotalAssets,
    total_liabilities: renderTotalLiabilities,
    net_income: renderNetIncome,
    quick_actions: renderQuickActions,
    recent_transactions: renderRecentTransactions,
    expense_breakdown: renderExpenseBreakdown,
    liquid_cash: renderLiquidCash,
  };

  // Metric cards set
  const metricCardIds = new Set<DashboardCardId>(['net_worth', 'total_assets', 'total_liabilities', 'net_income']);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Bar with Customize Cards Action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            Financial Dashboard
          </h1>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Overview of balances, net worth & cash flow
          </p>
        </div>

        <button
          onClick={() => setIsCustomizeModalOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 shadow-sm'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Customize Cards</span>
        </button>
      </div>

      {/* Render Cards according to custom user ordering and enabled status */}
      <div className="space-y-4">
        {/* Metric Cards Grid Container if any metric cards are enabled */}
        {cardsConfig.some((c) => metricCardIds.has(c.id) && c.enabled) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cardsConfig
              .filter((c) => metricCardIds.has(c.id) && c.enabled)
              .map((c) => cardRendererMap[c.id]())}
          </div>
        )}

        {/* Non-metric Cards rendered in user-configured sequence */}
        {cardsConfig
          .filter((c) => !metricCardIds.has(c.id) && c.enabled)
          .map((c) => cardRendererMap[c.id]())}
      </div>

      {/* Customize Cards Modal */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Customize Display Cards</h3>
                <p className="text-xs text-slate-400">Drag items to reorder, or toggle cards on your Home screen</p>
              </div>
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={cardListRef} className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {cardsConfig.map((card, idx) => (
                <div
                  key={card.id}
                  data-card-index={idx}
                  onPointerDown={(e) => handleCardPointerDown(idx, e)}
                  onPointerMove={handleCardPointerMove}
                  onPointerUp={handleCardPointerUp}
                  onPointerCancel={handleCardPointerUp}
                  style={{ touchAction: 'none' }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs select-none transition-all duration-150 ${
                    activeDragCardIndex === idx
                      ? 'scale-[1.03] shadow-2xl z-30 ring-2 ring-indigo-500 bg-slate-800 border-indigo-400 cursor-grabbing'
                      : 'cursor-grab hover:border-slate-600'
                  } ${
                    card.enabled
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                      : 'opacity-50 bg-slate-950/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2 pointer-events-none">
                    <span className="text-slate-500 hover:text-slate-300 p-0.5" title="Hold and drag to reorder">
                      <GripVertical className="w-4 h-4 text-indigo-400" />
                    </span>
                    <span className="w-4 font-mono text-[10px] text-slate-500">#{idx + 1}</span>
                    <span className="font-medium">{card.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveCardUp(idx)}
                      title="Move Up"
                      className="p-1 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-30 active:scale-95"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === cardsConfig.length - 1}
                      onClick={() => handleMoveCardDown(idx)}
                      title="Move Down"
                      className="p-1 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-30 active:scale-95"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleCard(card.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors active:scale-95 ${
                        card.enabled
                          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {card.enabled ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Shown</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={handleResetCards}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
