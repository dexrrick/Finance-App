import React, { useState } from 'react';
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
} from 'lucide-react';
import { Account, AccountCategory, AppSettings, Transaction } from '../core/types';
import { calculateAccountBalances, formatCurrency } from '../core/accounting';
import { getNormalBalance } from '../core/accounts';

interface AccountsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  settings: AppSettings;
  onAddAccount: (acc: Account) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  transactions,
  settings,
  onAddAccount,
}) => {
  const currency = settings.currencySymbol || '$';
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New account form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AccountCategory>('EXPENSE');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');

  const balances = calculateAccountBalances(accounts, transactions);

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

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert('Code and Name are required.');
      return;
    }

    if (accounts.some((a) => a.code === code.trim())) {
      alert(`Account with code ${code.trim()} already exists!`);
      return;
    }

    const newAcc: Account = {
      id: 'acc-' + Date.now(),
      code: code.trim(),
      name: name.trim(),
      category,
      subcategory: subcategory.trim() || undefined,
      description: description.trim() || undefined,
      normalBalance: getNormalBalance(category),
      isSystem: false,
      isActive: true,
    };

    onAddAccount(newAcc);
    setIsAddModalOpen(false);
    setCode('');
    setName('');
    setSubcategory('');
    setDescription('');
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
    }
  };

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
              Standard 5-category accounting classification with live debit/credit net balances
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Account
        </button>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs font-medium">
          {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'All (All 5 Categories)' : cat}
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
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Account Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Normal Balance</th>
                <th className="py-3 px-4">Subcategory / Info</th>
                <th className="py-3 px-4 text-right">Current Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAccounts.map((acc) => {
                const bal = balances.get(acc.id);
                const balanceVal = bal?.balance || 0;

                return (
                  <tr key={acc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                      {acc.code}
                    </td>
                    <td className="py-3 px-4">
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
                      {acc.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{acc.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {getCategoryIcon(acc.category)}
                        <span className="font-medium text-slate-300">{acc.category}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-4 text-slate-400">
                      {acc.subcategory || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm text-slate-100">
                      {formatCurrency(balanceVal, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Create Ledger Account</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Account Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1050, 5120"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Classification
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AccountCategory)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ASSET">ASSET (Dr)</option>
                    <option value="LIABILITY">LIABILITY (Cr)</option>
                    <option value="EQUITY">EQUITY (Cr)</option>
                    <option value="REVENUE">REVENUE (Cr)</option>
                    <option value="EXPENSE">EXPENSE (Dr)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
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

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Subcategory (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Digital Assets, Operating Expenses"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about this account's purpose"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30"
                >
                  Add Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
