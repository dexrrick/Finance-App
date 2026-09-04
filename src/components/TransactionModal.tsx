import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Scale,
  ArrowRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Account, EntryLeg, Transaction } from '../core/types';
import { formatCurrency, round2, validateTransaction } from '../core/accounting';
import { CurrencyService, SUPPORTED_CURRENCIES } from '../core/currencyService';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSave: (tx: Transaction) => void;
  editingTransaction?: Transaction | null;
  initialMode?: 'expense' | 'income' | 'transfer' | 'journal';
  currencySymbol: string;
  baseCurrency?: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onSave,
  editingTransaction,
  initialMode = 'expense',
  currencySymbol,
  baseCurrency = 'USD',
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
  const [showReference, setShowReference] = useState<boolean>(false);

  // Simple Mode State
  const [amount, setAmount] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [categoryAccountId, setCategoryAccountId] = useState<string>('');
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState<boolean>(false);
  const [pendingTxToSave, setPendingTxToSave] = useState<Transaction | null>(null);

  // Multi-Currency State
  const [selectedCurrency, setSelectedCurrency] = useState<string>(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [isEditingRate, setIsEditingRate] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>('1.0');
  const [isManualRate, setIsManualRate] = useState<boolean>(false);

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
      setShowReference(Boolean(editingTransaction.reference));

      // Multi-currency initialization
      if (editingTransaction.meta?.currency) {
        setSelectedCurrency(editingTransaction.meta.currency);
        const rate = editingTransaction.meta.exchangeRate || 1.0;
        setExchangeRate(rate);
        setCustomRateInput(rate.toString());
        setIsManualRate(editingTransaction.meta.currency !== baseCurrency);
      } else {
        setSelectedCurrency(baseCurrency);
        setExchangeRate(1.0);
        setCustomRateInput('1.0');
        setIsManualRate(false);
      }

      const isSimple = editingTransaction.meta?.simpleMode && editingTransaction.meta.simpleMode !== 'journal';
      if (isSimple && editingTransaction.legs.length === 2) {
        setIsAdvanced(false);
        setSimpleMode(editingTransaction.meta?.simpleMode as 'expense' | 'income' | 'transfer');
        // Use original foreign amount if present, else base amount
        const displayAmt = editingTransaction.meta?.originalAmount !== undefined
          ? editingTransaction.meta.originalAmount.toString()
          : editingTransaction.legs[0].amount.toString();
        setAmount(displayAmt);
        setPaymentAccountId(editingTransaction.meta?.paymentAccountId || '');
        setCategoryAccountId(editingTransaction.meta?.categoryAccountId || '');
      } else {
        setIsAdvanced(true);
      }

      const editRate = editingTransaction.meta?.exchangeRate || 1.0;
      const isForeign = Boolean(editingTransaction.meta?.currency && editingTransaction.meta.currency !== baseCurrency);
      setLegs(
        editingTransaction.legs.map((leg) => ({
          ...leg,
          amount: isForeign ? round2(leg.amount / editRate) : leg.amount,
          id: leg.id || 'leg-' + Math.random().toString(36).substring(2, 7),
        }))
      );
    } else {
      // New transaction defaults
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setReference('');
      setShowReference(false);
      setAmount('');
      setSelectedCurrency(baseCurrency);
      setExchangeRate(1.0);
      setCustomRateInput('1.0');
      setIsManualRate(false);
      setIsEditingRate(false);

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
  }, [isOpen, editingTransaction, initialMode, baseCurrency]);

  const handleCurrencyChange = (newCurr: string) => {
    setSelectedCurrency(newCurr);
    setIsEditingRate(false);
    if (newCurr === baseCurrency) {
      setExchangeRate(1.0);
      setCustomRateInput('1.0');
      setIsManualRate(false);
    } else {
      const conv = CurrencyService.convert(1, newCurr, baseCurrency);
      setExchangeRate(conv.rate);
      setCustomRateInput(conv.rate.toString());
      setIsManualRate(false);
    }
  };

  const handleCustomRateChange = (val: string) => {
    setCustomRateInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setExchangeRate(parsed);
      setIsManualRate(true);
    }
  };

  const handleResetRate = () => {
    const conv = CurrencyService.convert(1, selectedCurrency, baseCurrency);
    setExchangeRate(conv.rate);
    setCustomRateInput(conv.rate.toString());
    setIsManualRate(false);
  };

  // Convert simple state to legs for preview or when switching to advanced (in selectedCurrency)
  const generateLegsFromSimple = (amtNum: number): EntryLeg[] => {
    const effectiveAmt = round2(amtNum);
    if (simpleMode === 'expense') {
      return [
        {
          id: 'leg-1',
          accountId: categoryAccountId,
          type: 'DEBIT',
          amount: effectiveAmt,
          memo: description || 'Expense',
        },
        {
          id: 'leg-2',
          accountId: paymentAccountId,
          type: 'CREDIT',
          amount: effectiveAmt,
          memo: 'Payment method',
        },
      ];
    } else if (simpleMode === 'income') {
      return [
        {
          id: 'leg-1',
          accountId: paymentAccountId,
          type: 'DEBIT',
          amount: effectiveAmt,
          memo: 'Deposit account',
        },
        {
          id: 'leg-2',
          accountId: categoryAccountId,
          type: 'CREDIT',
          amount: effectiveAmt,
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
          amount: effectiveAmt,
          memo: 'Transferred into',
        },
        {
          id: 'leg-2',
          accountId: paymentAccountId,
          type: 'CREDIT',
          amount: effectiveAmt,
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
        amount: selectedCurrency === baseCurrency ? round2(l.amount) : round2(l.amount * exchangeRate),
      })),
      meta: isAdvanced
        ? {
            simpleMode: 'journal',
            currency: selectedCurrency,
            originalAmount: round2(currentLegsToValidate[0]?.amount || 0),
            exchangeRate: exchangeRate,
            baseCurrency: baseCurrency,
          }
        : {
            simpleMode,
            paymentAccountId,
            categoryAccountId,
            currency: selectedCurrency,
            originalAmount: parseFloat(amount) || 0,
            exchangeRate: exchangeRate,
            baseCurrency: baseCurrency,
          },
      createdAt: editingTransaction?.createdAt || now,
      updatedAt: now,
    };

    if (editingTransaction) {
      setPendingTxToSave(finalizedTx);
      setIsUpdateConfirmOpen(true);
    } else {
      onSave(finalizedTx);
      onClose();
    }
  };

  const handleConfirmUpdate = () => {
    if (pendingTxToSave) {
      onSave(pendingTxToSave);
      setIsUpdateConfirmOpen(false);
      setPendingTxToSave(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-sm sm:text-base">
              {editingTransaction ? 'Edit Transaction' : isAdvanced ? 'Debit & Credit Entry' : 'Record Transaction'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Mode Button */}
            <button
              type="button"
              onClick={isAdvanced ? handleSwitchToSimple : handleSwitchToAdvanced}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isAdvanced ? 'Simple' : 'Debit & Credit'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
          {/* ================= SIMPLE MODE ================= */}
          {!isAdvanced ? (
            <div className="space-y-3.5">
              {/* Type Switcher */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSimpleMode('expense');
                    setCategoryAccountId(expenseAccounts[0]?.id || '');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    simpleMode === 'expense'
                      ? 'bg-rose-600 text-white shadow-sm'
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
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    simpleMode === 'income'
                      ? 'bg-emerald-600 text-white shadow-sm'
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
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    simpleMode === 'transfer'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Transfer
                </button>
              </div>

              {/* Amount Input with Multi-Currency Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Amount
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-2 text-slate-400 font-bold text-sm">
                      {CurrencyService.getCurrencyInfo(selectedCurrency).symbol}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-base font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Currency Selector Dropdown */}
                  <select
                    value={selectedCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-white focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compact Foreign Currency Conversion Chip */}
                {selectedCurrency !== baseCurrency && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-500/30">
                    <span className="text-slate-300">
                      ≈ <strong className="text-emerald-400 font-mono">{currencySymbol}{(round2((parseFloat(amount) || 0) * exchangeRate)).toFixed(2)}</strong> ({baseCurrency})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingRate(!isEditingRate)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline"
                    >
                      {isEditingRate ? 'Done' : `Rate: ${exchangeRate}`}
                    </button>
                  </div>
                )}

                {selectedCurrency !== baseCurrency && isEditingRate && (
                  <div className="flex items-center gap-2 mt-1.5 p-2 rounded-lg bg-slate-950 border border-indigo-500/20">
                    <span className="text-[10px] text-slate-400 shrink-0">Custom Rate:</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={customRateInput}
                      onChange={(e) => handleCustomRateChange(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleResetRate}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Description & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Groceries, Salary, Lunch"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Account Dropdowns */}
              <div className="grid grid-cols-2 gap-2.5">
                {simpleMode === 'expense' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        value={categoryAccountId}
                        onChange={(e) => setCategoryAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 truncate"
                      >
                        {expenseAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Paid With
                      </label>
                      <select
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 truncate"
                      >
                        {paymentSources.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {simpleMode === 'income' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        value={categoryAccountId}
                        onChange={(e) => setCategoryAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 truncate"
                      >
                        {revenueAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Deposit To
                      </label>
                      <select
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 truncate"
                      >
                        {assetAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {simpleMode === 'transfer' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Transfer From
                      </label>
                      <select
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 truncate"
                      >
                        {assetAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Transfer To
                      </label>
                      <select
                        value={categoryAccountId}
                        onChange={(e) => setCategoryAccountId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 truncate"
                      >
                        {assetAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Optional Reference / Invoice # (Collapsible) */}
              <div className="pt-0.5">
                {showReference || reference ? (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Receipt # or invoice note (optional)"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReference('');
                        setShowReference(false);
                      }}
                      title="Remove note"
                      className="text-slate-500 hover:text-slate-300 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReference(true)}
                    className="text-[11px] text-slate-500 hover:text-indigo-400 font-medium transition-colors"
                  >
                    + Add Receipt / Note (Optional)
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ================= ADVANCED DEBIT / CREDIT JOURNAL MODE ================= */
            <div className="space-y-3.5">
              {/* Description & Date Grid for Advanced Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Description / Memo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Monthly Salary, Rent, Adjustments"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Multi-Currency Selector for Debit & Credit Mode */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-400">Currency:</label>
                    <select
                      value={selectedCurrency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) - {c.name}
                        </option>
                      ))}
                    </select>
                    {selectedCurrency !== baseCurrency && (
                      <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        Multi-Currency ({selectedCurrency})
                      </span>
                    )}
                  </div>

                  {selectedCurrency !== baseCurrency && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span>Rate: 1 {selectedCurrency} = {exchangeRate} {baseCurrency}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingRate(!isEditingRate)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
                      >
                        {isEditingRate ? 'Done' : 'Adjust Rate'}
                      </button>
                    </div>
                  )}
                </div>

                {selectedCurrency !== baseCurrency && isEditingRate && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 shrink-0">Custom Rate:</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={customRateInput}
                      onChange={(e) => handleCustomRateChange(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleResetRate}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Journal Legs</span>
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
                {legs.map((leg, index) => {
                  const currSymbol = CurrencyService.getCurrencyInfo(selectedCurrency).symbol;
                  const convertedAmt = round2((leg.amount || 0) * exchangeRate);

                  return (
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

                      {/* Amount with Dual Currency Display */}
                      <div className="w-32 relative">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-semibold">
                          {currSymbol}
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs font-mono font-medium text-white focus:outline-none focus:border-indigo-500 text-right"
                        />
                        {selectedCurrency !== baseCurrency && (leg.amount || 0) > 0 && (
                          <div className="text-[10px] text-emerald-400 font-mono text-right pr-1 pt-0.5 truncate">
                            ≈ {currencySymbol}{convertedAmt.toFixed(2)}
                          </div>
                        )}
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
                  );
                })}
              </div>

              {/* Balancing Status Bar with Dual Currency Output */}
              <div
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  validation.isValid
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {validation.isValid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-semibold">Balanced! Debit equals Credit.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        Out of balance by{' '}
                        <strong>
                          {formatCurrency(validation.difference, CurrencyService.getCurrencyInfo(selectedCurrency).symbol)}
                        </strong>
                        {selectedCurrency !== baseCurrency && (
                          <span className="ml-1 text-[11px] text-rose-300">
                            (≈ {currencySymbol}{(round2(validation.difference * exchangeRate)).toFixed(2)})
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 font-mono text-xs text-right">
                  <div>
                    <span>Debits: {formatCurrency(validation.totalDebit, CurrencyService.getCurrencyInfo(selectedCurrency).symbol)}</span>
                    {selectedCurrency !== baseCurrency && (
                      <span className="text-[10px] text-emerald-400 ml-1">
                        (≈ {currencySymbol}{(round2(validation.totalDebit * exchangeRate)).toFixed(2)})
                      </span>
                    )}
                  </div>
                  <div>
                    <span>Credits: {formatCurrency(validation.totalCredit, CurrencyService.getCurrencyInfo(selectedCurrency).symbol)}</span>
                    {selectedCurrency !== baseCurrency && (
                      <span className="text-[10px] text-emerald-400 ml-1">
                        (≈ {currencySymbol}{(round2(validation.totalCredit * exchangeRate)).toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional Reference / Invoice # for Advanced Mode */}
              <div className="pt-0.5">
                {showReference || reference ? (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Receipt # or invoice note (optional)"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReference('');
                        setShowReference(false);
                      }}
                      title="Remove note"
                      className="text-slate-500 hover:text-slate-300 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReference(true)}
                    className="text-[11px] text-slate-500 hover:text-indigo-400 font-medium transition-colors"
                  >
                    + Add Receipt / Note (Optional)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validation.isValid}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl shadow-lg transition-all ${
                validation.isValid
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>
                {editingTransaction
                  ? 'Update Entry'
                  : isAdvanced
                  ? 'Post Journal Entry'
                  : simpleMode === 'expense'
                  ? 'Save Expense'
                  : simpleMode === 'income'
                  ? 'Save Income'
                  : 'Save Transfer'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Update Confirmation Modal */}
        {isUpdateConfirmOpen && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Confirm Update Entry</h4>
                  <p className="text-xs text-slate-300">
                    Are you sure you want to update this transaction? Changes will modify the general ledger balances.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUpdateConfirmOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpdate}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow transition-all active:scale-95"
                >
                  Confirm Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
