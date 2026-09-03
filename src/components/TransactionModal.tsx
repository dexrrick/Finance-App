import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Scale,
  ArrowRight,
  HelpCircle,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Account, EntryLeg, Transaction } from '../core/types';
import { formatCurrency, round2, validateTransaction } from '../core/accounting';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSave: (tx: Transaction) => void;
  editingTransaction?: Transaction | null;
  initialMode?: 'expense' | 'income' | 'transfer' | 'journal';
  currencySymbol: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onSave,
  editingTransaction,
  initialMode = 'expense',
  currencySymbol,
}) => {
  // Mode: simple (expense, income, transfer) vs advanced journal (debit/credit)
  const [isAdvanced, setIsAdvanced] = useState<boolean>(initialMode === 'journal');
  const [simpleMode, setSimpleMode] = useState<'expense' | 'income' | 'transfer'>(
    initialMode === 'journal' ? 'expense' : initialMode
  );

  // Common metadata
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  // Simple Mode State
  const [amount, setAmount] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [categoryAccountId, setCategoryAccountId] = useState<string>('');

  // Advanced Journal Legs State
  const [legs, setLegs] = useState<EntryLeg[]>([
    { id: 'leg-1', accountId: '', type: 'DEBIT', amount: 0, memo: '' },
    { id: 'leg-2', accountId: '', type: 'CREDIT', amount: 0, memo: '' },
  ]);

  // Account groupings
  const assetAccounts = accounts.filter((a) => a.category === 'ASSET' && a.isActive);
  const liabilityAccounts = accounts.filter((a) => a.category === 'LIABILITY' && a.isActive);
  const revenueAccounts = accounts.filter((a) => a.category === 'REVENUE' && a.isActive);
  const expenseAccounts = accounts.filter((a) => a.category === 'EXPENSE' && a.isActive);
  const equityAccounts = accounts.filter((a) => a.category === 'EQUITY' && a.isActive);

  // Payment account candidates (Assets like Cash/Bank + Credit Cards)
  const paymentSources = [...assetAccounts, ...liabilityAccounts];

  // Initialize form when opening or editing
  useEffect(() => {
    if (!isOpen) return;

    if (editingTransaction) {
      setDate(editingTransaction.date);
      setDescription(editingTransaction.description);
      setReference(editingTransaction.reference || '');

      const isSimple = editingTransaction.meta?.simpleMode && editingTransaction.meta.simpleMode !== 'journal';
      if (isSimple && editingTransaction.legs.length === 2) {
        setIsAdvanced(false);
        setSimpleMode(editingTransaction.meta?.simpleMode as 'expense' | 'income' | 'transfer');
        setAmount(editingTransaction.legs[0].amount.toString());
        setPaymentAccountId(editingTransaction.meta?.paymentAccountId || '');
        setCategoryAccountId(editingTransaction.meta?.categoryAccountId || '');
      } else {
        setIsAdvanced(true);
      }

      setLegs(
        editingTransaction.legs.map((leg) => ({
          ...leg,
          id: leg.id || 'leg-' + Math.random().toString(36).substring(2, 7),
        }))
      );
    } else {
      // New transaction defaults
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setReference('');
      setAmount('');

      const defaultExpenseAcc = expenseAccounts[0]?.id || '';
      const defaultRevenueAcc = revenueAccounts[0]?.id || '';
      const defaultPaymentAcc = assetAccounts[0]?.id || paymentSources[0]?.id || '';
      const defaultTransferDest = assetAccounts[1]?.id || assetAccounts[0]?.id || '';

      if (initialMode === 'journal') {
        setIsAdvanced(true);
        setLegs([
          { id: 'leg-1', accountId: defaultExpenseAcc, type: 'DEBIT', amount: 0, memo: '' },
          { id: 'leg-2', accountId: defaultPaymentAcc, type: 'CREDIT', amount: 0, memo: '' },
        ]);
      } else {
        setIsAdvanced(false);
        setSimpleMode(initialMode);
        if (initialMode === 'expense') {
          setCategoryAccountId(defaultExpenseAcc);
          setPaymentAccountId(defaultPaymentAcc);
        } else if (initialMode === 'income') {
          setCategoryAccountId(defaultRevenueAcc);
          setPaymentAccountId(defaultPaymentAcc);
        } else if (initialMode === 'transfer') {
          setPaymentAccountId(defaultPaymentAcc);
          setCategoryAccountId(defaultTransferDest);
        }
      }
    }
  }, [isOpen, editingTransaction, initialMode]);

  // Convert simple state to legs for preview or when switching to advanced
  const generateLegsFromSimple = (amtNum: number): EntryLeg[] => {
    if (simpleMode === 'expense') {
      return [
        {
          id: 'leg-1',
          accountId: categoryAccountId,
          type: 'DEBIT',
          amount: amtNum,
          memo: description || 'Expense',
        },
        {
          id: 'leg-2',
          accountId: paymentAccountId,
          type: 'CREDIT',
          amount: amtNum,
          memo: 'Payment method',
        },
      ];
    } else if (simpleMode === 'income') {
      return [
        {
          id: 'leg-1',
          accountId: paymentAccountId,
          type: 'DEBIT',
          amount: amtNum,
          memo: 'Deposit account',
        },
        {
          id: 'leg-2',
          accountId: categoryAccountId,
          type: 'CREDIT',
          amount: amtNum,
          memo: description || 'Income earned',
        },
      ];
    } else {
      // Transfer
      return [
        {
          id: 'leg-1',
          accountId: categoryAccountId,
          type: 'DEBIT',
          amount: amtNum,
          memo: 'Transferred into',
        },
        {
          id: 'leg-2',
          accountId: paymentAccountId,
          type: 'CREDIT',
          amount: amtNum,
          memo: 'Transferred from',
        },
      ];
    }
  };

  const handleSwitchToAdvanced = () => {
    const numAmt = parseFloat(amount) || 0;
    const derived = generateLegsFromSimple(numAmt);
    setLegs(derived);
    setIsAdvanced(true);
  };

  const handleSwitchToSimple = () => {
    // If there are 2 legs, try to guess the mode
    if (legs.length === 2) {
      const debitLeg = legs.find((l) => l.type === 'DEBIT');
      const creditLeg = legs.find((l) => l.type === 'CREDIT');
      if (debitLeg && creditLeg && debitLeg.amount === creditLeg.amount) {
        setAmount(debitLeg.amount.toString());
      }
    }
    setIsAdvanced(false);
  };

  // Leg manipulation for Advanced Mode
  const handleLegChange = (index: number, field: keyof EntryLeg, value: unknown) => {
    const updated = [...legs];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setLegs(updated);
  };

  const handleAddLeg = (defaultType: 'DEBIT' | 'CREDIT' = 'DEBIT') => {
    setLegs([
      ...legs,
      {
        id: 'leg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        accountId: '',
        type: defaultType,
        amount: 0,
        memo: '',
      },
    ]);
  };

  const handleRemoveLeg = (index: number) => {
    if (legs.length <= 2) return;
    setLegs(legs.filter((_, i) => i !== index));
  };

  // Validation
  const currentLegsToValidate = isAdvanced
    ? legs
    : generateLegsFromSimple(parseFloat(amount) || 0);

  const validation = validateTransaction(currentLegsToValidate);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      alert('Please enter a description for this transaction.');
      return;
    }

    if (!isAdvanced) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('Please enter a valid amount greater than zero.');
        return;
      }
      if (!paymentAccountId || !categoryAccountId) {
        alert('Please select both accounts for this transaction.');
        return;
      }
      if (simpleMode === 'transfer' && paymentAccountId === categoryAccountId) {
        alert('Transfer source and destination accounts must be different.');
        return;
      }
    }

    if (!validation.isValid) {
      alert(validation.error || 'Transaction does not balance.');
      return;
    }

    const txId = editingTransaction ? editingTransaction.id : 'tx-' + Date.now();
    const now = new Date().toISOString();

    const finalizedTx: Transaction = {
      id: txId,
      date,
      description: description.trim(),
      reference: reference.trim() || undefined,
      legs: currentLegsToValidate.map((l) => ({
        ...l,
        amount: round2(l.amount),
      })),
      meta: isAdvanced
        ? { simpleMode: 'journal' }
        : {
            simpleMode,
            paymentAccountId,
            categoryAccountId,
          },
      createdAt: editingTransaction?.createdAt || now,
      updatedAt: now,
    };

    onSave(finalizedTx);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {editingTransaction ? 'Edit Transaction' : 'Record Transaction'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAdvanced
                  ? 'Double-entry Journal Mode (Direct Debit & Credit)'
                  : 'Standard Income & Expense Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Mode Button */}
            <button
              type="button"
              onClick={isAdvanced ? handleSwitchToSimple : handleSwitchToAdvanced}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isAdvanced ? 'Simple Mode' : 'Debit & Credit Mode'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
          {/* Top Row: Date, Description, Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Description / Payee
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Trader Joe's Groceries, Monthly Salary, Rent"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Reference code / receipt */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Reference / Invoice / Receipt # <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., INV-0041, Check #102, #REC-884"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* ================= SIMPLE MODE ================= */}
          {!isAdvanced ? (
            <div className="space-y-4">
              {/* Type Switcher */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSimpleMode('expense');
                    setCategoryAccountId(expenseAccounts[0]?.id || '');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    simpleMode === 'expense'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimpleMode('income');
                    setCategoryAccountId(revenueAccounts[0]?.id || '');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    simpleMode === 'income'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimpleMode('transfer');
                    setCategoryAccountId(assetAccounts[1]?.id || assetAccounts[0]?.id || '');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    simpleMode === 'transfer'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Transfer
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-medium">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-lg font-semibold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Account Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {simpleMode === 'expense' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Expense Category (Debit)
                      </label>
                      <select
                        value={categoryAccountId}
                        onChange={(e) => setCategoryAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {expenseAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Paid From (Credit)
                      </label>
                      <select
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {paymentSources.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {simpleMode === 'income' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Income Category (Credit)
                      </label>
                      <select
                        value={categoryAccountId}
                        onChange={(e) => setCategoryAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {revenueAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Deposited To (Debit)
                      </label>
                      <select
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {assetAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {simpleMode === 'transfer' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Transfer From (Credit)
                      </label>
                      <select
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {assetAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Transfer To (Debit)
                      </label>
                      <select
                        value={categoryAccountId}
                        onChange={(e) => setCategoryAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {assetAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Live Accounting Double-Entry Preview Box */}
              <div className="bg-slate-950/80 border border-indigo-500/20 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Double-Entry Journal Preview
                  </span>
                  <button
                    type="button"
                    onClick={handleSwitchToAdvanced}
                    className="text-[11px] text-slate-400 hover:text-indigo-300 underline"
                  >
                    Edit directly in Debit & Credit
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                      Debit (Dr)
                    </span>
                    <p className="font-medium text-slate-200 mt-0.5 truncate">
                      {accounts.find((a) => a.id === (simpleMode === 'expense' ? categoryAccountId : paymentAccountId))?.name || 'Select Account'}
                    </p>
                    <p className="text-emerald-400 font-mono font-bold mt-1">
                      {formatCurrency(parseFloat(amount) || 0, currencySymbol)}
                    </p>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                      Credit (Cr)
                    </span>
                    <p className="font-medium text-slate-200 mt-0.5 truncate">
                      {accounts.find((a) => a.id === (simpleMode === 'expense' ? paymentAccountId : categoryAccountId))?.name || 'Select Account'}
                    </p>
                    <p className="text-sky-400 font-mono font-bold mt-1">
                      {formatCurrency(parseFloat(amount) || 0, currencySymbol)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= ADVANCED DEBIT / CREDIT JOURNAL MODE ================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  <span>Each transaction must have balanced Debits and Credits.</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddLeg('DEBIT')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-lg border border-indigo-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
              </div>

              {/* Legs Table */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {legs.map((leg, index) => (
                  <div
                    key={leg.id}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-950/90 border border-slate-800 rounded-xl"
                  >
                    {/* Dr / Cr Toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLegChange(index, 'type', 'DEBIT')}
                        className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          leg.type === 'DEBIT'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        DEBIT
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLegChange(index, 'type', 'CREDIT')}
                        className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          leg.type === 'CREDIT'
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        CREDIT
                      </button>
                    </div>

                    {/* Account Selector */}
                    <div className="flex-1 min-w-[180px]">
                      <select
                        value={leg.accountId}
                        onChange={(e) => handleLegChange(index, 'accountId', e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Select Account --</option>
                        <optgroup label="Assets (1000s)">
                          {assetAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Liabilities (2000s)">
                          {liabilityAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Equity (3000s)">
                          {equityAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Revenue / Income (4000s)">
                          {revenueAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Expenses (5000s)">
                          {expenseAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Amount */}
                    <div className="w-28 relative">
                      <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-semibold">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={leg.amount || ''}
                        onChange={(e) =>
                          handleLegChange(index, 'amount', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-xs font-mono font-medium text-white focus:outline-none focus:border-indigo-500 text-right"
                      />
                    </div>

                    {/* Line Memo */}
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Line memo (optional)"
                        value={leg.memo || ''}
                        onChange={(e) => handleLegChange(index, 'memo', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Remove button */}
                    {legs.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLeg(index)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-colors self-center"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Balancing Status Bar */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  validation.isValid
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {validation.isValid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold">Balanced! Debit equals Credit.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>
                        Out of balance by{' '}
                        <strong>{formatCurrency(validation.difference, currencySymbol)}</strong>
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span>Debits: {formatCurrency(validation.totalDebit, currencySymbol)}</span>
                  <span>Credits: {formatCurrency(validation.totalCredit, currencySymbol)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validation.isValid}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg shadow-lg transition-all ${
                validation.isValid
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>{editingTransaction ? 'Update Entry' : 'Post Journal Entry'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
