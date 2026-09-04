import React, { useState, useMemo, useRef } from 'react';
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
  onEditTransaction?: (tx: Transaction) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  transactions,
  settings,
  onAddAccount,
  onUpdateAccount,
  onUpdateSettings,
  onEditTransaction,
}) => {
  const currency = settings.currencySymbol || '$';
  const isLight = settings.theme === 'light';
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Column configuration
  const columnConfigs: AccountColumnConfig[] = settings.accountColumns || DEFAULT_ACCOUNT_COLUMNS;
  const activeColumns = columnConfigs.filter((c) => c.enabled);

  // Touch & Pointer live reorder state for Customize Columns modal
  const [activeDragColumnIndex, setActiveDragColumnIndex] = useState<number | null>(null);
  const columnListRef = useRef<HTMLDivElement>(null);

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

  // Touch & Pointer live reorder handlers for Customize Columns
  const handleColumnPointerDown = (index: number, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button')) return;

    setActiveDragColumnIndex(index);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
  };

  const handleColumnPointerMove = (e: React.PointerEvent) => {
    if (activeDragColumnIndex === null || !columnListRef.current) return;
    e.preventDefault();

    const rows = Array.from(
      columnListRef.current.querySelectorAll<HTMLElement>('[data-col-index]')
    );
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      // 30% threshold buffer eliminates boundary jitter
      const buffer = rect.height * 0.3;
      if (e.clientY >= rect.top + (i < activeDragColumnIndex ? buffer : 0) && e.clientY <= rect.bottom - (i > activeDragColumnIndex ? buffer : 0)) {
        if (i !== activeDragColumnIndex) {
          const updated = [...columnConfigs];
          const [moved] = updated.splice(activeDragColumnIndex, 1);
          updated.splice(i, 0, moved);

          onUpdateSettings?.({ ...settings, accountColumns: updated });
          setActiveDragColumnIndex(i);
        }
        break;
      }
    }
  };

  const handleColumnPointerUp = (e: React.PointerEvent) => {
    if (activeDragColumnIndex !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // safe fallback
      }
      setActiveDragColumnIndex(null);
    }
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
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border rounded-2xl p-5 transition-all shadow-sm ${
        isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
            isLight ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
          }`}>
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Chart of Accounts</h2>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Standard 7-category accounting classification with live debit/credit net balances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsColumnModalOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Customize Columns"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
            <span>Columns</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 !text-white text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 !text-white text-white" />
            <span className="!text-white text-white">Create Account</span>
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className={`flex p-1 rounded-xl border overflow-x-auto text-xs font-medium ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedCategory(tab.key)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                selectedCategory === tab.key
                  ? 'bg-indigo-600 !text-white text-white shadow-sm font-semibold'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search account name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 ${
              isLight ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500'
            }`}
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-900/90 border-slate-800 shadow-xl'
      }`}>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${activeColumns.length <= 3 ? 'table-fixed' : ''}`}>
            <thead>
              <tr className={`border-b font-semibold uppercase tracking-wider ${
                isLight ? 'border-slate-200 bg-slate-50/90 text-slate-700' : 'border-slate-800 bg-slate-950/60 text-slate-400'
              }`}>
                {activeColumns.map((col) => {
                  const isCompact = activeColumns.length <= 3;
                  const widthClass = isCompact
                    ? col.id === 'name'
                      ? 'w-[44%] sm:w-[46%]'
                      : col.id === 'category'
                      ? 'w-[28%] sm:w-[26%]'
                      : col.id === 'balance'
                      ? 'w-[28%] sm:w-[28%]'
                      : ''
                    : '';

                  return (
                    <th
                      key={col.id}
                      className={`py-3 px-2 sm:px-4 ${
                        col.id === 'balance' ? 'text-right' : 'text-left'
                      } ${widthClass}`}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={isLight ? 'divide-y divide-slate-100' : 'divide-y divide-slate-800/60'}>
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
                    className={`cursor-pointer transition-colors group ${
                      isLight ? 'hover:bg-slate-50/90 active:bg-slate-100' : 'hover:bg-slate-800/60 active:bg-slate-800/80'
                    }`}
                    title="Click to view recent transactions for this account"
                  >
                    {activeColumns.map((col) => {
                      switch (col.id) {
                        case 'code':
                          return (
                            <td key={col.id} className={`py-2.5 px-2 sm:px-4 font-mono font-bold truncate ${
                              isLight ? 'text-indigo-600' : 'text-indigo-300'
                            }`}>
                              {acc.code}
                            </td>
                          );
                        case 'name':
                          return (
                            <td key={col.id} className="py-2.5 px-2 sm:px-4 truncate">
                              <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <span className={`font-semibold truncate ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{acc.name}</span>
                                  {acc.isSystem && (
                                    <span
                                      title="System Account"
                                      className={`inline-flex items-center text-[10px] shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}
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
                                  className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity shrink-0 ${
                                    isLight ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-800' : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                                  }`}
                                  title="Edit Account Details"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          );
                        case 'category':
                          return (
                            <td key={col.id} className="py-2.5 px-2 sm:px-4 truncate">
                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <span className="shrink-0">{getCategoryIcon(acc.category)}</span>
                                <span className={`font-medium truncate text-[11px] sm:text-xs ${
                                  isLight ? 'text-slate-700' : 'text-slate-300'
                                }`}>
                                  {acc.category.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </td>
                          );
                        case 'normalBalance':
                          return (
                            <td key={col.id} className="py-2.5 px-2 sm:px-4">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  acc.normalBalance === 'DEBIT'
                                    ? isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : isLight ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                }`}
                              >
                                {acc.normalBalance}
                              </span>
                            </td>
                          );
                        case 'subcategory':
                          return (
                            <td key={col.id} className={`py-2.5 px-2 sm:px-4 truncate ${
                              isLight ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                              {acc.subcategory || '—'}
                            </td>
                          );
                        case 'balance':
                          return (
                            <td key={col.id} className={`py-2.5 px-2 sm:px-4 text-right font-mono font-bold text-xs sm:text-sm whitespace-nowrap ${
                              isLight ? 'text-slate-900' : 'text-slate-100'
                            }`}>
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
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 ${
            isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2">
                {formMode === 'create' ? (
                  <Plus className="w-5 h-5 text-indigo-500" />
                ) : (
                  <Pencil className="w-5 h-5 text-indigo-500" />
                )}
                <h3 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {formMode === 'create' ? 'Create Ledger Account' : 'Edit Ledger Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className={`p-1 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccountForm} className="space-y-4">
              {/* Classification */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                  isLight ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  Accounting Classification
                </label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as AccountCategory)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600' : 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500'
                  }`}
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
                  <label className={`block text-xs font-semibold uppercase tracking-wider ${
                    isLight ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    Account Code
                  </label>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded border font-bold ${
                    isLight
                      ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                      : 'text-indigo-400 bg-indigo-950/60 border-indigo-500/30'
                  }`}>
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
                  className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none ${
                    codeError
                      ? 'border-rose-500 focus:border-rose-400'
                      : isLight ? 'border-slate-300 focus:border-indigo-600' : 'border-slate-700 focus:border-indigo-500'
                  } ${isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}`}
                />
                {codeError && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-500 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}
                <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
                  Strictly enforced: {CATEGORY_LABELS[category]} accounts must start with digit &apos;{CATEGORY_CODE_PREFIX[category]}&apos;.
                </p>
              </div>

              {/* Account Name */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                  isLight ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Crypto Cold Wallet, Pet Care, Client Invoices"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600' : 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                  }`}
                />
              </div>

              {/* Subcategory */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                  isLight ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  Subcategory (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Liquid Funds, Operating Expenses, Passive Income"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600' : 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                  isLight ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about this account's purpose or usage"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600' : 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                    isLight ? 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200' : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold !text-white text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                >
                  <span className="!text-white text-white">{formMode === 'create' ? 'Create Account' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customize Columns Modal with Drag-and-Drop */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className={`border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 ${
            isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>Customize Columns</h3>
                  <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Drag items to reorder, or toggle visibility</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className={`p-1 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={columnListRef} className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {columnConfigs.map((col, idx) => (
                <div
                  key={col.id}
                  data-col-index={idx}
                  onPointerDown={(e) => handleColumnPointerDown(idx, e)}
                  onPointerMove={handleColumnPointerMove}
                  onPointerUp={handleColumnPointerUp}
                  onPointerCancel={handleColumnPointerUp}
                  style={{ touchAction: 'none' }}
                  className={`flex items-center justify-between p-3 rounded-xl border select-none transition-all duration-150 ${
                    activeDragColumnIndex === idx
                      ? isLight
                        ? 'scale-[1.03] shadow-2xl z-30 ring-2 ring-indigo-500 bg-white border-indigo-400 cursor-grabbing'
                        : 'scale-[1.03] shadow-2xl z-30 ring-2 ring-indigo-500 bg-slate-900 border-indigo-400 cursor-grabbing'
                      : isLight
                        ? 'cursor-grab hover:border-slate-300'
                        : 'cursor-grab hover:border-slate-700'
                  } ${
                    col.enabled
                      ? isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 shadow-2xs'
                        : 'bg-slate-950 border-slate-700/80 text-white'
                      : isLight
                        ? 'bg-slate-100/50 border-slate-200/60 text-slate-400'
                        : 'bg-slate-950/40 border-slate-800/50 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 pointer-events-none">
                    <span className={`p-0.5 ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`} title="Hold and drag to reorder">
                      <GripVertical className="w-4 h-4 text-indigo-500" />
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleColumn(col.id)}
                      className={`pointer-events-auto w-5 h-5 rounded-md flex items-center justify-center border transition-colors active:scale-90 ${
                        col.enabled
                          ? 'bg-indigo-600 border-indigo-500 !text-white text-white'
                          : isLight ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {col.enabled && <Check className="w-3.5 h-3.5 !text-white text-white stroke-[3]" />}
                    </button>
                    <span className="text-xs font-semibold">{col.label}</span>
                  </div>

                  <div className="flex items-center gap-1 pointer-events-auto">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveColumn(idx, 'up')}
                      className={`p-1 rounded-lg disabled:opacity-20 active:scale-95 transition-colors ${
                        isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Move left/up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === columnConfigs.length - 1}
                      onClick={() => handleMoveColumn(idx, 'down')}
                      className={`p-1 rounded-lg disabled:opacity-20 active:scale-95 transition-colors ${
                        isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Move right/down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={`flex items-center justify-between pt-3 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <button
                type="button"
                onClick={handleResetColumns}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>

              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold !text-white text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-colors active:scale-95"
              >
                <span className="!text-white text-white">Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Drilldown Activity Modal */}
      {selectedAccountForDrilldown && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className={`border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isLight ? 'border-slate-200 bg-slate-50/90' : 'border-slate-800 bg-slate-950/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                  isLight ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                }`}>
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                      isLight ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-indigo-400 bg-indigo-950/60 border-indigo-500/30'
                    }`}>
                      {selectedAccountForDrilldown.code}
                    </span>
                    <h3 className={`font-bold text-base truncate max-w-[200px] sm:max-w-xs ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}>
                      {selectedAccountForDrilldown.name}
                    </h3>
                  </div>
                  <div className={`flex items-center gap-2 text-xs mt-0.5 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>
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
                  onClick={() => setSelectedAccountForDrilldown(null)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Account Summary Strip */}
            <div className={`p-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/70 border-slate-800'
            }`}>
              <div>
                <span className={`text-[11px] uppercase tracking-wider font-semibold block ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  Current Account Balance
                </span>
                <span className={`text-xl font-bold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {formatCurrency(balances.get(selectedAccountForDrilldown.id)?.balance || 0, currency)}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-[11px] block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Normal Balance</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedAccountForDrilldown.normalBalance === 'DEBIT'
                      ? isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isLight ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {selectedAccountForDrilldown.normalBalance}
                </span>
              </div>
            </div>

            {/* Transactions List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  {showAllDrilldownTransactions ? 'All Account Activity' : 'Recent Transactions'} ({drilldownTransactions.length})
                </h4>
                {drilldownTransactions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDrilldownTransactions(!showAllDrilldownTransactions)}
                    className={`text-xs font-semibold underline flex items-center gap-1 ${
                      isLight ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-400 hover:text-indigo-300'
                    }`}
                  >
                    <span>{showAllDrilldownTransactions ? 'Show Latest 5' : `Show All (${drilldownTransactions.length})`}</span>
                    <ChevronRight className={`w-3 h-3 transition-transform ${showAllDrilldownTransactions ? '-rotate-90' : 'rotate-90'}`} />
                  </button>
                )}
              </div>

              {drilldownTransactions.length === 0 ? (
                <div className={`p-6 text-center text-xs italic rounded-2xl border ${
                  isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-slate-950/40 text-slate-500 border-slate-800/60'
                }`}>
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
                        onClick={() => onEditTransaction?.(tx)}
                        className={`p-3 border rounded-xl active:scale-[0.99] transition-all space-y-1.5 cursor-pointer group ${
                          isLight
                            ? 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50/90 shadow-2xs'
                            : 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/90'
                        }`}
                        title="Click to edit or amend this transaction"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{tx.date}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isDebit
                                  ? isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : isLight ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {isDebit ? 'DEBIT' : 'CREDIT'}
                            </span>
                            <span className={`font-mono font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {formatCurrency(legAmount, currency)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`font-semibold truncate transition-colors ${
                              isLight ? 'text-slate-900 group-hover:text-indigo-600' : 'text-slate-200 group-hover:text-indigo-300'
                            }`}>
                              {tx.description}
                            </span>
                            <Pencil className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${
                              isLight ? 'text-indigo-600' : 'text-indigo-400'
                            }`} />
                          </div>
                          {tx.meta?.currency && tx.meta.currency !== (settings.baseCurrency || 'USD') && (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                              isLight ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-indigo-400 bg-indigo-950/60 border-indigo-500/20'
                            }`}>
                              {tx.meta.currency} {tx.meta.originalAmount?.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {(relevantLeg?.memo || tx.reference) && (
                          <div className={`text-[11px] truncate ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
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
                  className={`w-full py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    isLight
                      ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                      : 'text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/60 border-indigo-500/20'
                  }`}
                >
                  <span>View More ({drilldownTransactions.length - 5} older transactions)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex items-center justify-between ${
              isLight ? 'border-slate-200 bg-slate-50/90' : 'border-slate-800 bg-slate-950/50'
            }`}>
              <button
                type="button"
                onClick={() => handleOpenEditModal(selectedAccountForDrilldown)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                  isLight
                    ? 'bg-indigo-600 hover:bg-indigo-500 !text-white text-white shadow-md shadow-indigo-600/30 active:scale-95'
                    : 'text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30'
                }`}
              >
                <Pencil className={`w-3.5 h-3.5 ${isLight ? '!text-white text-white' : ''}`} />
                <span className={isLight ? '!text-white text-white' : ''}>Edit Account</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAccountForDrilldown(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  isLight ? 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200' : 'text-white bg-slate-800 hover:bg-slate-700'
                }`}
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
