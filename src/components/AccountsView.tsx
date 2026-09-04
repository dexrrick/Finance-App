import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Plus,
  Search,
  Check,
  X,
  Scale,
  CreditCard,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronRight,
  FileText,
  GripVertical,
  Pencil,
  AlertTriangle,
  Coins,
  Percent,
} from 'lucide-react';
import { Account, AccountCategory, AccountColumnConfig, AccountColumnId, AppSettings, Transaction } from '../core/types';
import { calculateAccountBalances, formatCurrency } from '../core/accounting';
import {
  getNormalBalance,
  CATEGORY_CODE_PREFIX,
  CATEGORY_LABELS,
  isValidAccountCode,
  getSuggestedNextAccountCode,
} from '../core/accounts';
import { DEFAULT_ACCOUNT_COLUMNS } from '../storage/db';

interface AccountsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  settings: AppSettings;
  onAddAccount: (acc: Account) => void;
  onUpdateAccount?: (acc: Account) => void;
  onUpdateSettings?: (settings: AppSettings) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  transactions,
  settings,
  onAddAccount,
  onUpdateAccount,
  onUpdateSettings,
}) => {
  const currency = settings.currencySymbol || '$';
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Column configuration
  const columnConfigs: AccountColumnConfig[] = settings.accountColumns || DEFAULT_ACCOUNT_COLUMNS;
  const activeColumns = columnConfigs.filter((c) => c.enabled);

  // Drag & drop state for Customize Columns modal
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(null);

  // Account Form Modal state (for Create & Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AccountCategory>('EXPENSE');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [codeError, setCodeError] = useState('');

  // Drilldown Modal state
  const [selectedAccountForDrilldown, setSelectedAccountForDrilldown] = useState<Account | null>(null);
  const [showAllDrilldownTransactions, setShowAllDrilldownTransactions] = useState<boolean>(false);

  const balances = calculateAccountBalances(accounts, transactions);

  const drilldownTransactions = useMemo(() => {
    if (!selectedAccountForDrilldown) return [];
    return transactions
      .filter((t) => t.legs.some((l) => l.accountId === selectedAccountForDrilldown.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedAccountForDrilldown, transactions]);

  const displayedDrilldownTransactions = useMemo(() => {
    return showAllDrilldownTransactions ? drilldownTransactions : drilldownTransactions.slice(0, 5);
  }, [showAllDrilldownTransactions, drilldownTransactions]);

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    if (selectedCategory !== 'ALL' && acc.category !== selectedCategory) return false;
    if (
      searchTerm &&
      !acc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !acc.code.includes(searchTerm)
    ) {
      return false;
    }
    return true;
  });

  const handleToggleColumn = (id: AccountColumnId) => {
    if (!onUpdateSettings) return;
    const current = [...columnConfigs];
    const target = current.find((c) => c.id === id);
    if (!target) return;

    const enabledCount = current.filter((c) => c.enabled).length;
    if (target.enabled && enabledCount <= 1) {
      alert('At least one column must remain visible.');
      return;
    }

    const updated = current.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c));
    onUpdateSettings({
      ...settings,
      accountColumns: updated,
    });
  };

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    if (!onUpdateSettings) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const current = [...columnConfigs];
    if (targetIndex < 0 || targetIndex >= current.length) return;

    const temp = current[index];
    current[index] = current[targetIndex];
    current[targetIndex] = temp;

    onUpdateSettings({
      ...settings,
      accountColumns: current,
    });
  };

  // Drag & Drop handlers for Customize Columns
  const handleColumnDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColumnIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnIndex !== index) {
      setDragOverColumnIndex(index);
    }
  };

  const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedColumnIndex === null || draggedColumnIndex === targetIndex) {
      setDraggedColumnIndex(null);
      setDragOverColumnIndex(null);
      return;
    }

    const updated = [...columnConfigs];
    const [moved] = updated.splice(draggedColumnIndex, 1);
    updated.splice(targetIndex, 0, moved);

    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        accountColumns: updated,
      });
    }

    setDraggedColumnIndex(null);
    setDragOverColumnIndex(null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnIndex(null);
    setDragOverColumnIndex(null);
  };

  const handleResetColumns = () => {
    if (!onUpdateSettings) return;
    onUpdateSettings({
      ...settings,
      accountColumns: DEFAULT_ACCOUNT_COLUMNS,
    });
  };

  // Open modal in Create mode
  const handleOpenCreateModal = () => {
    setFormMode('create');
    setEditingAccount(null);
    const initialCategory: AccountCategory =
      selectedCategory !== 'ALL' ? (selectedCategory as AccountCategory) : 'EXPENSE';
    setCategory(initialCategory);
    setCode(getSuggestedNextAccountCode(initialCategory, accounts));
    setName('');
    setSubcategory('');
    setDescription('');
    setCodeError('');
    setIsFormModalOpen(true);
  };

  // Open modal in Edit mode
  const handleOpenEditModal = (acc: Account) => {
    setFormMode('edit');
    setEditingAccount(acc);
    setCategory(acc.category);
    setCode(acc.code);
    setName(acc.name);
    setSubcategory(acc.subcategory || '');
    setDescription(acc.description || '');
    setCodeError('');
    setIsFormModalOpen(true);
  };

  const handleCategoryChange = (newCat: AccountCategory) => {
    setCategory(newCat);
    setCodeError('');
    if (formMode === 'create') {
      setCode(getSuggestedNextAccountCode(newCat, accounts));
    } else if (editingAccount && !isValidAccountCode(code, newCat)) {
      setCode(getSuggestedNextAccountCode(newCat, accounts));
    }
  };

  // Form submit handler (both create and edit)
  const handleSaveAccountForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    const cleanName = name.trim();

    if (!cleanCode || !cleanName) {
      setCodeError('Account Code and Name are required.');
      return;
    }

    const expectedPrefix = CATEGORY_CODE_PREFIX[category];
    if (!cleanCode.startsWith(expectedPrefix)) {
      setCodeError(
        `${CATEGORY_LABELS[category]} account code must start with '${expectedPrefix}' (e.g. ${expectedPrefix}010, ${expectedPrefix}020).`
      );
      return;
    }

    // Check code uniqueness
    const duplicate = accounts.find(
      (a) => a.code.toLowerCase() === cleanCode.toLowerCase() && (formMode === 'create' || a.id !== editingAccount?.id)
    );
    if (duplicate) {
      setCodeError(`Account code '${cleanCode}' is already used by "${duplicate.name}".`);
      return;
    }

    if (formMode === 'create') {
      const newAcc: Account = {
        id: 'acc-' + Date.now(),
        code: cleanCode,
        name: cleanName,
        category,
        subcategory: subcategory.trim() || undefined,
        description: description.trim() || undefined,
        normalBalance: getNormalBalance(category),
        isSystem: false,
        isActive: true,
      };
      onAddAccount(newAcc);
    } else if (formMode === 'edit' && editingAccount) {
      const updatedAcc: Account = {
        ...editingAccount,
        code: cleanCode,
        name: cleanName,
        category,
        subcategory: subcategory.trim() || undefined,
        description: description.trim() || undefined,
        normalBalance: getNormalBalance(category),
      };
      if (onUpdateAccount) {
        onUpdateAccount(updatedAcc);
      }
      if (selectedAccountForDrilldown?.id === updatedAcc.id) {
        setSelectedAccountForDrilldown(updatedAcc);
      }
    }

    setIsFormModalOpen(false);
  };

  const getCategoryIcon = (cat: AccountCategory) => {
    switch (cat) {
      case 'ASSET':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'LIABILITY':
        return <CreditCard className="w-4 h-4 text-rose-400" />;
      case 'EQUITY':
        return <Scale className="w-4 h-4 text-amber-400" />;
      case 'REVENUE':
        return <ArrowUpRight className="w-4 h-4 text-sky-400" />;
      case 'EXPENSE':
        return <ArrowDownLeft className="w-4 h-4 text-purple-400" />;
      case 'OTHER_INCOME':
        return <Coins className="w-4 h-4 text-teal-400" />;
      case 'OTHER_EXPENSE':
        return <Percent className="w-4 h-4 text-orange-400" />;
    }
  };

  const CATEGORY_TABS: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Categories' },
    { key: 'ASSET', label: '1 • Asset' },
    { key: 'LIABILITY', label: '2 • Liability' },
    { key: 'EQUITY', label: '3 • Equity' },
    { key: 'REVENUE', label: '4 • Revenue' },
    { key: 'EXPENSE', label: '5 • Expense' },
    { key: 'OTHER_INCOME', label: '6 • Other Income' },
    { key: 'OTHER_EXPENSE', label: '7 • Other Expense' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Chart of Accounts</h2>
            <p className="text-xs text-slate-400">
              Standard 7-category accounting classification with live debit/credit net balances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsColumnModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm"
            title="Customize Columns"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>Columns</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Account
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs font-medium">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedCategory(tab.key)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                selectedCategory === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search account name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                {activeColumns.map((col) => (
                  <th
                    key={col.id}
                    className={`py-3 px-4 ${col.id === 'balance' ? 'text-right' : 'text-left'}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAccounts.map((acc) => {
                const bal = balances.get(acc.id);
                const balanceVal = bal?.balance || 0;

                return (
                  <tr
                    key={acc.id}
                    onClick={() => {
                      setSelectedAccountForDrilldown(acc);
                      setShowAllDrilldownTransactions(false);
                    }}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors group active:bg-slate-800/80"
                    title="Click to view recent transactions for this account"
                  >
                    {activeColumns.map((col) => {
                      switch (col.id) {
                        case 'code':
                          return (
                            <td key={col.id} className="py-3 px-4 font-mono font-bold text-indigo-300">
                              {acc.code}
                            </td>
                          );
                        case 'name':
                          return (
                            <td key={col.id} className="py-3 px-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-200">{acc.name}</span>
                                  {acc.isSystem && (
                                    <span
                                      title="System Account"
                                      className="inline-flex items-center text-[10px] text-slate-500"
                                    >
                                      <Shield className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(acc);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-opacity"
                                  title="Edit Account Details"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          );
                        case 'category':
                          return (
                            <td key={col.id} className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                {getCategoryIcon(acc.category)}
                                <span className="font-medium text-slate-300">{acc.category}</span>
                              </div>
                            </td>
                          );
                        case 'normalBalance':
                          return (
                            <td key={col.id} className="py-3 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  acc.normalBalance === 'DEBIT'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                }`}
                              >
                                {acc.normalBalance}
                              </span>
                            </td>
                          );
                        case 'subcategory':
                          return (
                            <td key={col.id} className="py-3 px-4 text-slate-400">
                              {acc.subcategory || '—'}
                            </td>
                          );
                        case 'balance':
                          return (
                            <td key={col.id} className="py-3 px-4 text-right font-mono font-bold text-sm text-slate-100">
                              {formatCurrency(balanceVal, currency)}
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Form Modal (Create & Edit) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {formMode === 'create' ? (
                  <Plus className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Pencil className="w-5 h-5 text-indigo-400" />
                )}
                <h3 className="font-bold text-white text-base">
                  {formMode === 'create' ? 'Create Ledger Account' : 'Edit Ledger Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccountForm} className="space-y-4">
              {/* Classification */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Accounting Classification
                </label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as AccountCategory)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ASSET">1 • ASSET (Debit normal)</option>
                  <option value="LIABILITY">2 • LIABILITY (Credit normal)</option>
                  <option value="EQUITY">3 • EQUITY (Credit normal)</option>
                  <option value="REVENUE">4 • OPERATING REVENUE (Credit normal)</option>
                  <option value="EXPENSE">5 • OPERATING EXPENSE (Debit normal)</option>
                  <option value="OTHER_INCOME">6 • OTHER INCOME (Credit normal)</option>
                  <option value="OTHER_EXPENSE">7 • OTHER EXPENSE (Debit normal)</option>
                </select>
              </div>

              {/* Code and Prefix enforcement */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Account Code
                  </label>
                  <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                    Prefix: {CATEGORY_CODE_PREFIX[category]}xxx
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${CATEGORY_CODE_PREFIX[category]}010`}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeError('');
                  }}
                  className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none ${
                    codeError
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-slate-700 focus:border-indigo-500'
                  }`}
                />
                {codeError && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Strictly enforced: {CATEGORY_LABELS[category]} accounts must start with digit &apos;{CATEGORY_CODE_PREFIX[category]}&apos;.
                </p>
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Crypto Cold Wallet, Pet Care, Client Invoices"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Subcategory (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Liquid Funds, Operating Expenses, Passive Income"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about this account's purpose or usage"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30"
                >
                  {formMode === 'create' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customize Columns Modal with Drag-and-Drop */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Customize Columns</h3>
                  <p className="text-xs text-slate-400">Drag items to reorder, or toggle visibility</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {columnConfigs.map((col, idx) => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleColumnDragStart(e, idx)}
                  onDragOver={(e) => handleColumnDragOver(e, idx)}
                  onDrop={(e) => handleColumnDrop(e, idx)}
                  onDragEnd={handleColumnDragEnd}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                    draggedColumnIndex === idx ? 'opacity-30 border-dashed border-indigo-400 scale-[0.98]' : ''
                  } ${
                    dragOverColumnIndex === idx ? 'ring-2 ring-indigo-500 bg-indigo-950/40 border-indigo-500' : ''
                  } ${
                    col.enabled
                      ? 'bg-slate-950 border-slate-700/80 text-white'
                      : 'bg-slate-950/40 border-slate-800/50 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-500 hover:text-slate-300 cursor-grab p-0.5" title="Drag to reorder">
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleColumn(col.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        col.enabled
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {col.enabled && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-xs font-semibold">{col.label}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveColumn(idx, 'up')}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Move left/up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === columnConfigs.length - 1}
                      onClick={() => handleMoveColumn(idx, 'down')}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Move right/down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetColumns}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>

              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Drilldown Activity Modal */}
      {selectedAccountForDrilldown && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                      {selectedAccountForDrilldown.code}
                    </span>
                    <h3 className="font-bold text-white text-base truncate max-w-[200px] sm:max-w-xs">
                      {selectedAccountForDrilldown.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{selectedAccountForDrilldown.category}</span>
                    {selectedAccountForDrilldown.subcategory && (
                      <>
                        <span>•</span>
                        <span>{selectedAccountForDrilldown.subcategory}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(selectedAccountForDrilldown)}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Edit Account Details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setSelectedAccountForDrilldown(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Account Summary Strip */}
            <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Current Account Balance
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatCurrency(balances.get(selectedAccountForDrilldown.id)?.balance || 0, currency)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Normal Balance</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedAccountForDrilldown.normalBalance === 'DEBIT'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {selectedAccountForDrilldown.normalBalance}
                </span>
              </div>
            </div>

            {/* Transactions List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {showAllDrilldownTransactions ? 'All Account Activity' : 'Recent Transactions'} ({drilldownTransactions.length})
                </h4>
                {drilldownTransactions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDrilldownTransactions(!showAllDrilldownTransactions)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline flex items-center gap-1"
                  >
                    <span>{showAllDrilldownTransactions ? 'Show Latest 5' : `Show All (${drilldownTransactions.length})`}</span>
                    <ChevronRight className={`w-3 h-3 transition-transform ${showAllDrilldownTransactions ? '-rotate-90' : 'rotate-90'}`} />
                  </button>
                )}
              </div>

              {drilldownTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-2xl border border-slate-800/60">
                  No transactions recorded under this account yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedDrilldownTransactions.map((tx) => {
                    const relevantLeg = tx.legs.find((l) => l.accountId === selectedAccountForDrilldown.id);
                    const isDebit = relevantLeg?.type === 'DEBIT';
                    const legAmount = relevantLeg?.amount || 0;

                    return (
                      <div
                        key={tx.id}
                        className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl hover:border-slate-700 transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-slate-400">{tx.date}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isDebit
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {isDebit ? 'DEBIT' : 'CREDIT'}
                            </span>
                            <span className="font-mono font-bold text-sm text-white">
                              {formatCurrency(legAmount, currency)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 truncate">{tx.description}</span>
                          {tx.meta?.currency && tx.meta.currency !== (settings.baseCurrency || 'USD') && (
                            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/20">
                              {tx.meta.currency} {tx.meta.originalAmount?.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {(relevantLeg?.memo || tx.reference) && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {tx.reference && <span className="mr-2">Ref: {tx.reference}</span>}
                            {relevantLeg?.memo && <span>{relevantLeg.memo}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {drilldownTransactions.length > 5 && !showAllDrilldownTransactions && (
                <button
                  type="button"
                  onClick={() => setShowAllDrilldownTransactions(true)}
                  className="w-full py-2.5 px-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/60 rounded-xl border border-indigo-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>View More ({drilldownTransactions.length - 5} older transactions)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleOpenEditModal(selectedAccountForDrilldown)}
                className="px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Account</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAccountForDrilldown(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
