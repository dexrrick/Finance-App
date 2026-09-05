import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Search,
  Download,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Square,
  CheckCircle2,
  X
} from 'lucide-react';
import { Account, AppSettings, Transaction } from '../core/types';
import { formatCurrency } from '../core/accounting';
import { GoogleDriveSyncService } from '../storage/googleDrive';
import { ScrollHeader } from './ScrollHeader';
import { useScrollLock } from '../core/useScrollLock';

interface JournalViewProps {
  transactions: Transaction[];
  accounts: Account[];
  settings: AppSettings;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onDeleteMultipleTransactions?: (txIds: string[]) => void;
  onRestoreTransactions?: (txs: Transaction[]) => void;
  onOpenNewTransaction: () => void;
  undoUpdateInfo?: { prevTx: Transaction; currentTx: Transaction } | null;
  onUndoUpdate?: () => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  transactions,
  accounts,
  settings,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteMultipleTransactions,
  onRestoreTransactions,
  onOpenNewTransaction,
  undoUpdateInfo,
  onUndoUpdate,
}) => {
  const currency = settings.currencySymbol || '$';
  const isLight = settings.theme === 'light';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());

  // Multi-selection state
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Deletion confirmation modal state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [txIdsToDelete, setTxIdsToDelete] = useState<string[]>([]);

  // Suspend background scrolling when delete confirmation modal is open
  useScrollLock(isDeleteConfirmOpen);

  // 1-time Undo deletion backup state
  const [deletedBackup, setDeletedBackup] = useState<Transaction[] | null>(null);
  const [undoDeleteTimer, setUndoDeleteTimer] = useState<number | null>(null);

  // Account lookup map
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  // Toggle row expansion
  const toggleExpand = (id: string) => {
    setExpandedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTxIds(new Set(transactions.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedTxIds(new Set());
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !searchTerm ||
          tx.description.toLowerCase().includes(q) ||
          tx.date.includes(q) ||
          (tx.reference && tx.reference.toLowerCase().includes(q)) ||
          tx.legs.some((l) => {
            const acc = accountMap.get(l.accountId);
            return (
              acc?.name.toLowerCase().includes(q) ||
              acc?.code.includes(q) ||
              (l.memo && l.memo.toLowerCase().includes(q))
            );
          });

        if (!matchesSearch) return false;

        if (selectedAccountId !== 'ALL') {
          const hasAccount = tx.legs.some((l) => l.accountId === selectedAccountId);
          if (!hasAccount) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, selectedAccountId, accountMap]);

  // Selection toggle
  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  // Delete initiation
  const promptDeleteSingle = (txId: string) => {
    setTxIdsToDelete([txId]);
    setIsDeleteConfirmOpen(true);
  };

  const promptDeleteSelected = () => {
    if (selectedTxIds.size === 0) return;
    setTxIdsToDelete(Array.from(selectedTxIds));
    setIsDeleteConfirmOpen(true);
  };

  // Confirm delete execution
  const handleConfirmDelete = () => {
    const toDelete = transactions.filter((t) => txIdsToDelete.includes(t.id));
    setDeletedBackup(toDelete);

    if (onDeleteMultipleTransactions) {
      onDeleteMultipleTransactions(txIdsToDelete);
    } else {
      txIdsToDelete.forEach((id) => onDeleteTransaction(id));
    }

    setSelectedTxIds(new Set());
    setIsDeleteConfirmOpen(false);
    setTxIdsToDelete([]);

    // Auto-clear undo after 8 seconds
    if (undoDeleteTimer) window.clearTimeout(undoDeleteTimer);
    const timer = window.setTimeout(() => {
      setDeletedBackup(null);
    }, 8000);
    setUndoDeleteTimer(timer);
  };

  // Undo delete
  const handleUndoDelete = () => {
    if (deletedBackup && onRestoreTransactions) {
      onRestoreTransactions(deletedBackup);
      setDeletedBackup(null);
      if (undoDeleteTimer) window.clearTimeout(undoDeleteTimer);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* 1-Time Undo Deletion Toast */}
      {deletedBackup && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold border flex items-center gap-3 backdrop-blur-md animate-fade-in ${
          isLight ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50' : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}>
          <span>Deleted {deletedBackup.length} entry{deletedBackup.length > 1 ? 's' : ''}</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 !text-white text-white shadow font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5 !text-white" />
            <span>Undo / Restore</span>
          </button>
          <button
            type="button"
            onClick={() => setDeletedBackup(null)}
            className={`p-1 ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1-Time Undo Update Toast */}
      {undoUpdateInfo && onUndoUpdate && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold border flex items-center gap-3 backdrop-blur-md animate-fade-in ${
          isLight ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50' : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}>
          <span>Transaction updated</span>
          <button
            type="button"
            onClick={onUndoUpdate}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 !text-white text-white shadow font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5 !text-white" />
            <span>Undo Changes</span>
          </button>
        </div>
      )}

      {/* Header Bar with iOS-style Scroll Collapse */}
      <ScrollHeader
        title="General Ledger"
        isLight={isLight}
        tabPosition={settings.tabPosition}
        icon={
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border ${
              isLight
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => GoogleDriveSyncService.exportLedgerCsv(transactions, accounts)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="font-semibold !text-white">New Entry</span>
            </button>
          </div>
        }
      />

      {/* Search & Filter Bar */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-3 gap-3 border rounded-2xl p-3 transition-all ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/60 border-slate-800/80'
        }`}
      >
        <div className="sm:col-span-2 relative">
          <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            placeholder="Search description, reference, date, accounts, or memo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                : 'bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500'
            }`}
          />
        </div>

        <div>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-900'
                : 'bg-slate-950 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">All Accounts (Full Ledger)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Multi-Select Bar & Expand/Collapse controls */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium"
          >
            {selectedTxIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>Select All</span>
          </button>
          <span>•</span>
          <span>
            <strong>{filteredTransactions.length}</strong> entries
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" /> Expand
          </button>
          <span>•</span>
          <button
            onClick={collapseAll}
            className="hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Collapse
          </button>
        </div>
      </div>

      {/* Journal Entries List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No journal transactions match your current filter.
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isExpanded = expandedTxIds.has(tx.id);
            const isSelected = selectedTxIds.has(tx.id);
            const totalDebits = tx.legs
              .filter((l) => l.type === 'DEBIT')
              .reduce((sum, l) => sum + l.amount, 0);

            return (
              <div
                key={tx.id}
                className={`border rounded-2xl overflow-hidden shadow-md transition-all ${
                  isLight
                    ? isSelected
                      ? 'bg-white border-indigo-500 shadow-indigo-100'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    : isSelected
                    ? 'border-indigo-500/70 bg-slate-900'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/90'
                }`}
              >
                {/* Transaction Summary Header */}
                <div
                  onClick={() => toggleExpand(tx.id)}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    {/* Checkbox for multi-select */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectTx(tx.id);
                      }}
                      className={`mt-0.5 sm:mt-0 p-1 rounded ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-500" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      className={`mt-0.5 sm:mt-0 p-1 rounded ${
                        isLight ? 'bg-slate-100 text-slate-500 hover:text-slate-800' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}>
                          {tx.date}
                        </span>
                        <h4 className={`font-semibold text-xs sm:text-sm truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                          {tx.description}
                        </h4>
                        {tx.meta?.simpleMode && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/20">
                            {tx.meta.simpleMode}
                          </span>
                        )}
                        {tx.meta?.currency && tx.meta.currency !== (settings.baseCurrency || 'USD') && tx.meta.originalAmount && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {tx.meta.currency} {tx.meta.originalAmount.toFixed(2)}
                          </span>
                        )}
                        {tx.reference && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Ref: {tx.reference}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{tx.legs.length} legs</span>
                        <span>•</span>
                        <span className="text-indigo-300 font-mono font-medium">
                          {formatCurrency(totalDebits, currency)}
                          {tx.meta?.currency && tx.meta.currency !== (settings.baseCurrency || 'USD') && tx.meta.exchangeRate && (
                            <span className="text-[10px] text-slate-500 font-normal ml-1.5">
                              (1 {tx.meta.currency} = {tx.meta.exchangeRate} {settings.baseCurrency || 'USD'})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Edit and Delete) */}
                  <div
                    className="flex items-center gap-2 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onEditTransaction(tx)}
                      title="Edit Entry"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 border border-slate-700 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => promptDeleteSingle(tx.id)}
                      title="Delete Entry"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Debit & Credit Table */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/60 p-3 overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-medium pb-1.5">
                          <th className="pb-1.5 w-20">Type</th>
                          <th className="pb-1.5 w-16">Account</th>
                          <th className="pb-1.5">Account Name</th>
                          <th className="pb-1.5">Memo</th>
                          <th className="pb-1.5 text-right w-24">Debit</th>
                          <th className="pb-1.5 text-right w-24">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {tx.legs.map((leg) => {
                          const acc = accountMap.get(leg.accountId);
                          const isDebit = leg.type === 'DEBIT';

                          return (
                            <tr key={leg.id} className="hover:bg-slate-900/40">
                              <td className="py-1.5">
                                <span
                                  className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    isDebit
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  }`}
                                >
                                  {leg.type}
                                </span>
                              </td>
                              <td className="py-1.5 font-mono text-slate-400">
                                {acc?.code || '---'}
                              </td>
                              <td className="py-1.5 text-slate-200 font-medium">
                                {acc?.name || leg.accountId}
                              </td>
                              <td className="py-1.5 text-slate-400 italic">
                                {leg.memo || '—'}
                              </td>
                              <td className="py-1.5 text-right font-mono text-slate-200">
                                {isDebit ? formatCurrency(leg.amount, currency) : '—'}
                              </td>
                              <td className="py-1.5 text-right font-mono text-slate-200">
                                {!isDebit ? formatCurrency(leg.amount, currency) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedTxIds.size > 0 && (
        <div
          style={{
            bottom:
              settings.tabPosition === 'top'
                ? 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
                : 'calc(5.25rem + env(safe-area-inset-bottom, 0px))',
          }}
          className={`fixed left-1/2 -translate-x-1/2 z-50 border rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md animate-fade-in ${
            isLight
              ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50'
              : 'bg-slate-900/95 border-slate-700 text-white shadow-black/60'
          }`}
        >
          <span className={`text-xs font-bold whitespace-nowrap ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {selectedTxIds.size} Selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedTxIds(new Set())}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
              isLight
                ? 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
            }`}
          >
            Deselect
          </button>
          <button
            type="button"
            onClick={promptDeleteSelected}
            className="px-3.5 py-1 text-xs font-bold !text-white text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-md flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5 !text-white text-white" />
            <span className="!text-white text-white">Delete Selected</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => {
              setIsDeleteConfirmOpen(false);
              setTxIdsToDelete([]);
            }}
          />
          <div className={`relative z-10 border rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 animate-modal-pop ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-slate-900 border-slate-700 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>Confirm Deletion</h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Are you sure you want to delete {txIdsToDelete.length} transaction{txIdsToDelete.length > 1 ? 's' : ''}?
                  All corresponding ledger balances will be recalculated.
                </p>
              </div>
            </div>

            <div className={`flex justify-end gap-2 pt-2 border-t ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setTxIdsToDelete([]);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isLight
                    ? 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                    : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold !text-white text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow transition-all active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
