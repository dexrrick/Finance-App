import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Download,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { Account, AppSettings, Transaction } from '../core/types';
import { formatCurrency } from '../core/accounting';
import { exportToCSV } from '../storage/backup';

interface JournalViewProps {
  transactions: Transaction[];
  accounts: Account[];
  settings: AppSettings;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onOpenNewTransaction: () => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  transactions,
  accounts,
  settings,
  onEditTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
}) => {
  const currency = settings.currencySymbol || '$';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());

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
        // Search filter
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

        // Account filter
        if (selectedAccountId !== 'ALL') {
          const hasAccount = tx.legs.some((l) => l.accountId === selectedAccountId);
          if (!hasAccount) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, selectedAccountId, accountMap]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">General Journal & Ledger</h2>
            <p className="text-xs text-slate-400">
              Complete chronological audit trail with multi-leg debit and credit entries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(accounts, transactions)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            Export CSV
          </button>
          <button
            onClick={onOpenNewTransaction}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search description, reference, account, or memo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Account Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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

      {/* Expand / Collapse controls & Result Count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Showing <strong>{filteredTransactions.length}</strong> journal entries
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={expandAll}
            className="hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" /> Expand All Legs
          </button>
          <span>•</span>
          <button
            onClick={collapseAll}
            className="hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Collapse All
          </button>
        </div>
      </div>

      {/* Journal Entries List */}
      <div className="space-y-4">
        {filteredTransactions.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
            No journal transactions match your current filter.
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isExpanded = expandedTxIds.has(tx.id);
            const totalDebits = tx.legs
              .filter((l) => l.type === 'DEBIT')
              .reduce((sum, l) => sum + l.amount, 0);

            return (
              <div
                key={tx.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all"
              >
                {/* Transaction Summary Header */}
                <div
                  onClick={() => toggleExpand(tx.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <button
                      type="button"
                      className="mt-0.5 sm:mt-0 p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {tx.date}
                        </span>
                        <h4 className="font-semibold text-sm text-slate-100 truncate">
                          {tx.description}
                        </h4>
                        {tx.meta?.simpleMode && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/20">
                            {tx.meta.simpleMode}
                          </span>
                        )}
                        {tx.reference && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Ref: {tx.reference}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>{tx.legs.length} Entry Legs</span>
                        <span>•</span>
                        <span className="text-indigo-300">
                          Balanced at {formatCurrency(totalDebits, currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
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
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${tx.description}"?`)) {
                          onDeleteTransaction(tx.id);
                        }
                      }}
                      title="Delete Entry"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Debit & Credit Table */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/60 p-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-medium pb-2">
                          <th className="pb-2 w-24">Type</th>
                          <th className="pb-2 w-20">Account</th>
                          <th className="pb-2">Account Name</th>
                          <th className="pb-2">Memo</th>
                          <th className="pb-2 text-right w-28">Debit</th>
                          <th className="pb-2 text-right w-28">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {tx.legs.map((leg) => {
                          const acc = accountMap.get(leg.accountId);
                          const isDebit = leg.type === 'DEBIT';

                          return (
                            <tr key={leg.id} className="hover:bg-slate-900/40">
                              <td className="py-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isDebit
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  }`}
                                >
                                  {leg.type}
                                </span>
                              </td>
                              <td className="py-2 font-mono text-slate-400">
                                {acc?.code || '---'}
                              </td>
                              <td className="py-2 text-slate-200 font-medium">
                                {acc?.name || leg.accountId}
                                <span className="text-slate-500 text-[10px] ml-1.5">
                                  ({acc?.category})
                                </span>
                              </td>
                              <td className="py-2 text-slate-400 italic">
                                {leg.memo || '—'}
                              </td>
                              <td className="py-2 text-right font-mono font-semibold text-emerald-400">
                                {isDebit ? formatCurrency(leg.amount, currency) : '—'}
                              </td>
                              <td className="py-2 text-right font-mono font-semibold text-sky-400">
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
    </div>
  );
};
