import React, { useState, useMemo } from 'react';
import {
  Upload,
  CheckCircle2,
  FileText,
  ArrowRight,
  Zap,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ClipboardList,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Account, AppSettings, BankRule, BankStatementLine, Transaction } from '../core/types';
import { BankStatementParser, ColumnMapping } from '../core/bankStatementParser';
import { BankRulesEngine, DEFAULT_BANK_RULES } from '../core/bankRulesEngine';
import { formatCurrency } from '../core/accounting';

interface BankReconciliationViewProps {
  accounts: Account[];
  settings: AppSettings;
  onSaveTransactions: (transactions: Transaction[]) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}

export const BankReconciliationView: React.FC<BankReconciliationViewProps> = ({
  accounts,
  settings,
  onSaveTransactions,
  onUpdateSettings,
}) => {
  const currency = settings.currencySymbol || '$';
  const rules = settings.bankRules || DEFAULT_BANK_RULES;

  // Selected Bank Account in our Ledger to reconcile against (Defaults to 1010 Checking)
  const bankAccounts = useMemo(() => {
    return accounts.filter(
      (a) => a.category === 'ASSET' && (a.code.startsWith('10') || a.subcategory?.includes('Cash') || a.subcategory?.includes('Bank'))
    );
  }, [accounts]);

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(() => {
    const checking = bankAccounts.find((a) => a.code === '1010');
    return checking ? checking.id : bankAccounts[0]?.id || accounts[0]?.id || '';
  });

  // Statement lines and raw file memory
  const [statementLines, setStatementLines] = useState<BankStatementLine[]>([]);
  const [rawCSVText, setRawCSVText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  // Modals
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isColumnMapperOpen, setIsColumnMapperOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Column Mapping state
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    headerRowIndex: 0,
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
  });
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');

  // Manual categorization form state per line
  const [manualAccountMap, setManualAccountMap] = useState<Record<string, string>>({});
  const [manualPayeeMap, setManualPayeeMap] = useState<Record<string, string>>({});
  const [rememberRuleMap, setRememberRuleMap] = useState<Record<string, boolean>>({});

  // Filter for view
  const [filterStatus, setFilterStatus] = useState<'all' | 'unreconciled' | 'reconciled'>('unreconciled');

  // New custom rule state
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleAccountId, setNewRuleAccountId] = useState('5010');
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDirection, setNewRuleDirection] = useState<'any' | 'inflow' | 'outflow'>('any');

  // Handle CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      setRawCSVText(content);
      processCSVContent(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadDemoCSV = () => {
    const demoCSV = BankStatementParser.generateDemoBankCSV();
    setUploadedFileName('Demo_Bank_Statement_March_2026.csv');
    setRawCSVText(demoCSV);
    processCSVContent(demoCSV);
  };

  const handleApplyPastedText = () => {
    if (!pastedText.trim()) return;
    setUploadedFileName('Pasted_Bank_Statement.csv');
    setRawCSVText(pastedText);
    processCSVContent(pastedText);
    setIsPasteModalOpen(false);
  };

  const processCSVContent = (csvText: string, customMap?: Partial<ColumnMapping>) => {
    const { lines, headers, rawRows, warnings } = BankStatementParser.parseCSV(csvText, customMap);
    setDetectedHeaders(headers);
    setSampleRows(rawRows);
    setUploadWarnings(warnings);

    if (customMap) {
      setColumnMapping((prev) => ({ ...prev, ...customMap }));
    } else {
      const autoMap = BankStatementParser.detectColumnMapping(headers);
      setColumnMapping(autoMap);
      if (autoMap.inflowCol !== undefined && autoMap.inflowCol !== -1) {
        setAmountMode('split');
      } else {
        setAmountMode('single');
      }
    }

    if (lines.length === 0 && warnings.length > 0) {
      // Auto-open column mapper so user can correct the mapping immediately
      setIsColumnMapperOpen(true);
    }

    // Apply bank rules to automatically detect matches
    const processed = lines.map((line) => {
      const matched = BankRulesEngine.findMatchingRule(line.description, line.amount, rules);
      if (matched) {
        const targetAcc = accounts.find((a) => a.code === matched.targetAccountId);
        return {
          ...line,
          matchedRuleId: matched.id,
          suggestedAccountId: targetAcc ? targetAcc.id : undefined,
          suggestedPayee: matched.defaultPayee,
        };
      }
      return line;
    });

    setStatementLines(processed);
  };

  const handleApplyCustomMapping = () => {
    if (!rawCSVText) return;
    const mappingToUse: Partial<ColumnMapping> = {
      dateCol: columnMapping.dateCol,
      descCol: columnMapping.descCol,
      amountCol: amountMode === 'single' ? columnMapping.amountCol : undefined,
      inflowCol: amountMode === 'split' ? columnMapping.inflowCol : undefined,
      outflowCol: amountMode === 'split' ? columnMapping.outflowCol : undefined,
    };
    processCSVContent(rawCSVText, mappingToUse);
    setIsColumnMapperOpen(false);
  };

  // Reconcile a single statement line (1-click OK)
  const handleReconcileLine = (line: BankStatementLine) => {
    const targetAccountId =
      line.suggestedAccountId ||
      manualAccountMap[line.id] ||
      (line.amount > 0 ? accounts.find((a) => a.code === '4010')?.id : accounts.find((a) => a.code === '5010')?.id) ||
      accounts[0].id;

    const payee = manualPayeeMap[line.id] || line.suggestedPayee || line.description;
    const shouldRemember = rememberRuleMap[line.id];

    // Generate balanced double-entry transaction
    const newTx = BankRulesEngine.createDoubleEntryTransaction(
      line,
      targetAccountId,
      selectedBankAccountId,
      payee
    );

    // Save transaction to system
    onSaveTransactions([newTx]);

    // If user checked "Remember rule", save it into settings
    if (shouldRemember && !line.matchedRuleId) {
      const targetAcc = accounts.find((a) => a.id === targetAccountId);
      if (targetAcc) {
        const cleanPattern = line.description.toLowerCase().split(/[\s,#0-9]+/)[0] || line.description.toLowerCase();
        const newRule: BankRule = {
          id: 'rule-' + Date.now(),
          name: `${payee} Rule`,
          pattern: cleanPattern,
          condition: 'contains',
          direction: line.amount > 0 ? 'inflow' : 'outflow',
          targetAccountId: targetAcc.code,
          defaultPayee: payee,
        };
        onUpdateSettings({
          ...settings,
          bankRules: [...rules, newRule],
        });
      }
    }

    // Mark line reconciled
    setStatementLines((prev) =>
      prev.map((l) => (l.id === line.id ? { ...l, status: 'reconciled', reconciledTxId: newTx.id } : l))
    );
  };

  // 1-Click "Accept All Matched"
  const handleAcceptAllMatched = () => {
    const matchedUnreconciled = statementLines.filter((l) => l.status === 'unreconciled' && l.suggestedAccountId);
    if (matchedUnreconciled.length === 0) return;

    const generatedTxs: Transaction[] = [];

    matchedUnreconciled.forEach((line) => {
      const tx = BankRulesEngine.createDoubleEntryTransaction(
        line,
        line.suggestedAccountId!,
        selectedBankAccountId,
        line.suggestedPayee
      );
      generatedTxs.push(tx);
    });

    onSaveTransactions(generatedTxs);

    const reconciledIds = new Set(matchedUnreconciled.map((l) => l.id));
    setStatementLines((prev) =>
      prev.map((l) => (reconciledIds.has(l.id) ? { ...l, status: 'reconciled' } : l))
    );

    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  // Create new rule
  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePattern.trim() || !newRuleAccountId) return;

    const targetAcc = accounts.find((a) => a.id === newRuleAccountId || a.code === newRuleAccountId);
    const ruleName = newRuleName.trim() || `Auto-Rule: ${newRulePattern}`;

    const newRule: BankRule = {
      id: 'rule-' + Date.now(),
      name: ruleName,
      pattern: newRulePattern.trim().toLowerCase(),
      condition: 'contains',
      direction: newRuleDirection,
      targetAccountId: targetAcc ? targetAcc.code : '5010',
      defaultPayee: ruleName,
    };

    onUpdateSettings({
      ...settings,
      bankRules: [...rules, newRule],
    });

    setNewRulePattern('');
    setNewRuleName('');
  };

  const handleDeleteRule = (ruleId: string) => {
    onUpdateSettings({
      ...settings,
      bankRules: rules.filter((r) => r.id !== ruleId),
    });
  };

  // Metrics
  const totalCount = statementLines.length;
  const reconciledCount = statementLines.filter((l) => l.status === 'reconciled').length;
  const unreconciledCount = totalCount - reconciledCount;
  const matchedCount = statementLines.filter((l) => l.status === 'unreconciled' && l.suggestedAccountId).length;
  const percentComplete = totalCount > 0 ? Math.round((reconciledCount / totalCount) * 100) : 0;

  // Filtered lines to display
  const displayedLines = statementLines.filter((l) => {
    if (filterStatus === 'unreconciled') return l.status === 'unreconciled';
    if (filterStatus === 'reconciled') return l.status === 'reconciled';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Bank Account Selection Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Bank Feed & Reconciliation</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
              Xero-Style Match
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Import monthly bank statements, automatically match transactions with rules, and approve with 1-click [OK].
          </p>
        </div>

        {/* Bank Account Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Reconciling:</span>
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                  {acc.code} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          {detectedHeaders.length > 0 && (
            <button
              type="button"
              onClick={() => setIsColumnMapperOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Map Columns</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsRulesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Bank Rules ({rules.length})</span>
          </button>
        </div>
      </div>

      {/* Warnings / Fallback Banner */}
      {uploadWarnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 text-xs text-amber-200 flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">File Notice: </span>
              <span>{uploadWarnings.join(' ')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsColumnMapperOpen(true)}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-bold shrink-0"
          >
            Adjust Column Mapping
          </button>
        </div>
      )}

      {/* Upload Dropzone & Demo Action */}
      {statementLines.length === 0 ? (
        <div className="bg-slate-900 border-2 border-dashed border-slate-700/80 rounded-3xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">Upload Bank Statement (CSV)</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
            Upload exported statements from Chase, Bank of America, HSBC, DBS, Revolut, PayPal, or any bank. We will auto-detect your salary, rent, and expenses.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label className="cursor-pointer px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Select Bank CSV File</span>
              <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              type="button"
              onClick={() => setIsPasteModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
            >
              <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
              <span>Paste CSV Text</span>
            </button>

            <span className="text-xs text-slate-500">or</span>

            <button
              type="button"
              onClick={handleLoadDemoCSV}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Demo Statement (March 2026)</span>
            </button>
          </div>
        </div>
      ) : (
        /* Reconciliation Control & Progress Dashboard */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Statement Progress: {reconciledCount} of {totalCount} Reconciled ({percentComplete}%)
                </span>
                {percentComplete === 100 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Fully Reconciled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {uploadedFileName && <span className="text-slate-300 font-mono font-medium mr-2">{uploadedFileName}</span>}
                {matchedCount} lines matched automated bank rules ready for instant confirmation.
              </p>
            </div>

            {/* Actions: Accept All Matched & Import Another */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {matchedCount > 0 && (
                <button
                  type="button"
                  onClick={handleAcceptAllMatched}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                  <span>Accept All Matched ({matchedCount})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsColumnMapperOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
                title="Adjust Column Mapping"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </button>

              <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New File</span>
                <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                type="button"
                onClick={() => {
                  setStatementLines([]);
                  setRawCSVText('');
                  setUploadedFileName('');
                  setUploadWarnings([]);
                }}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                title="Clear current statement"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${percentComplete}%` }}
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 font-medium">Show:</span>
            <button
              onClick={() => setFilterStatus('unreconciled')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'unreconciled'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Needs Review ({unreconciledCount})
            </button>
            <button
              onClick={() => setFilterStatus('reconciled')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'reconciled'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Reconciled ({reconciledCount})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({totalCount})
            </button>
          </div>
        </div>
      )}

      {/* ================= XERO-STYLE TWO-COLUMN RECONCILIATION TABLE ================= */}
      {displayedLines.length > 0 && (
        <div className="space-y-3">
          {displayedLines.map((line) => {
            const isReconciled = line.status === 'reconciled';
            const matchedRule = rules.find((r) => r.id === line.matchedRuleId);
            const isInflow = line.amount > 0;
            const absAmount = Math.abs(line.amount);

            // Suggested Account or user selection
            const activeAccountId =
              manualAccountMap[line.id] ||
              line.suggestedAccountId ||
              (isInflow ? accounts.find((a) => a.code === '4010')?.id : accounts.find((a) => a.code === '5010')?.id) ||
              accounts[0]?.id ||
              '';

            const activeAccount = accounts.find((a) => a.id === activeAccountId);
            const activePayee = manualPayeeMap[line.id] || line.suggestedPayee || line.description;
            const rememberThis = Boolean(rememberRuleMap[line.id]);

            return (
              <div
                key={line.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isReconciled
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                    : line.suggestedAccountId
                    ? 'bg-slate-900 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                  {/* LEFT SIDE: Bank Statement Line */}
                  <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col justify-between space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-mono font-medium text-slate-400">{line.date}</span>
                        <h4 className="font-semibold text-sm text-white mt-0.5 break-words">
                          {line.description}
                        </h4>
                      </div>
                      {/* Amount: Spent vs Received */}
                      <div className="text-right shrink-0">
                        <span
                          className={`text-base font-bold font-mono ${
                            isInflow ? 'text-emerald-400' : 'text-slate-100'
                          }`}
                        >
                          {isInflow ? '+' : '-'}
                          {formatCurrency(absAmount, currency)}
                        </span>
                        <p className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
                          {isInflow ? 'Received (In)' : 'Spent (Out)'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Raw Bank Narrative</span>
                    </div>
                  </div>

                  {/* RIGHT SIDE: Antigravity Match & 1-Click Action */}
                  <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between space-y-3 bg-slate-950/40">
                    {isReconciled ? (
                      /* Already Reconciled State */
                      <div className="flex items-center justify-between h-full">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Reconciled into Double-Entry Ledger</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">Recorded ✓</span>
                      </div>
                    ) : (
                      /* Unreconciled Match / Categorize Card */
                      <>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          {/* Rule Matched Badge */}
                          {line.suggestedAccountId ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                              <Zap className="w-3.5 h-3.5 fill-emerald-400" />
                              <span>Rule Matched: {matchedRule?.name || 'Smart Suggestion'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                              <span>Select Offsetting Account:</span>
                            </div>
                          )}

                          <span className="text-[10px] text-slate-500">
                            {isInflow ? 'Creates: Dr Bank / Cr Revenue' : 'Creates: Dr Expense / Cr Bank'}
                          </span>
                        </div>

                        {/* Input Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Account Picker */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase">Account</label>
                            <select
                              value={activeAccountId}
                              onChange={(e) =>
                                setManualAccountMap({ ...manualAccountMap, [line.id]: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-medium focus:border-indigo-500 focus:outline-none"
                            >
                              {accounts
                                .filter((a) => a.category === (isInflow ? 'REVENUE' : 'EXPENSE') || a.category === 'ASSET' || a.category === 'LIABILITY')
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name} ({a.category})
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Normalized Payee */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase">Payee / Entity</label>
                            <input
                              type="text"
                              value={activePayee}
                              onChange={(e) => setManualPayeeMap({ ...manualPayeeMap, [line.id]: e.target.value })}
                              placeholder="Clean payee name"
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-medium focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Bottom Row: Remember checkbox & 1-Click OK Button */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                          {!line.suggestedAccountId ? (
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                              <input
                                type="checkbox"
                                checked={rememberThis}
                                onChange={(e) =>
                                  setRememberRuleMap({ ...rememberRuleMap, [line.id]: e.target.checked })
                                }
                                className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                              />
                              <span>Remember rule for future statements</span>
                            </label>
                          ) : (
                            <div className="text-[11px] text-emerald-400 font-mono">
                              Ready to post: {activeAccount?.name}
                            </div>
                          )}

                          {/* THE FAMOUS 1-CLICK OK BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleReconcileLine(line)}
                            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 ${
                              line.suggestedAccountId
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>✓ OK</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MANUAL COLUMN MAPPER MODAL ================= */}
      {isColumnMapperOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Bank CSV Column Mapping</h3>
                  <p className="text-xs text-slate-400">Match your bank's columns to the ledger fields</p>
                </div>
              </div>
              <button
                onClick={() => setIsColumnMapperOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {detectedHeaders.length === 0 ? (
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400">
                Please upload a CSV file or paste CSV text first.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Column Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  {/* Date Column */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Date Column</label>
                    <select
                      value={columnMapping.dateCol}
                      onChange={(e) => setColumnMapping({ ...columnMapping, dateCol: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      {detectedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          Col {i + 1}: {h || `(Column ${i + 1})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description Column */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Description / Payee Column</label>
                    <select
                      value={columnMapping.descCol}
                      onChange={(e) => setColumnMapping({ ...columnMapping, descCol: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      {detectedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          Col {i + 1}: {h || `(Column ${i + 1})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount Mode Switcher */}
                  <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-semibold text-slate-300 block">Amount Format</label>
                    <div className="flex items-center gap-4 text-xs text-slate-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="amountMode"
                          checked={amountMode === 'single'}
                          onChange={() => setAmountMode('single')}
                          className="text-indigo-600 focus:ring-0"
                        />
                        <span>Single Signed Amount column (+/-)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="amountMode"
                          checked={amountMode === 'split'}
                          onChange={() => setAmountMode('split')}
                          className="text-indigo-600 focus:ring-0"
                        />
                        <span>Separate Debit & Credit columns</span>
                      </label>
                    </div>
                  </div>

                  {amountMode === 'single' ? (
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Amount Column</label>
                      <select
                        value={columnMapping.amountCol ?? 2}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, amountCol: parseInt(e.target.value, 10) })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        {detectedHeaders.map((h, i) => (
                          <option key={i} value={i}>
                            Col {i + 1}: {h || `(Column ${i + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">Money In / Credit Column</label>
                        <select
                          value={columnMapping.inflowCol ?? -1}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, inflowCol: parseInt(e.target.value, 10) })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                        >
                          <option value={-1}>(None)</option>
                          {detectedHeaders.map((h, i) => (
                            <option key={i} value={i}>
                              Col {i + 1}: {h || `(Column ${i + 1})`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">Money Out / Debit Column</label>
                        <select
                          value={columnMapping.outflowCol ?? -1}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, outflowCol: parseInt(e.target.value, 10) })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                        >
                          <option value={-1}>(None)</option>
                          {detectedHeaders.map((h, i) => (
                            <option key={i} value={i}>
                              Col {i + 1}: {h || `(Column ${i + 1})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Raw Preview Table */}
                {sampleRows.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      File Preview (First 3 Rows)
                    </span>
                    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
                          <tr>
                            {detectedHeaders.map((h, i) => (
                              <th key={i} className="p-2 border-r border-slate-800 last:border-0 whitespace-nowrap">
                                {h || `Col ${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {sampleRows.slice(0, 3).map((r, ri) => (
                            <tr key={ri}>
                              {r.map((c, ci) => (
                                <td key={ci} className="p-2 border-r border-slate-800/60 last:border-0 whitespace-nowrap">
                                  {c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsColumnMapperOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomMapping}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    Apply & Re-Parse File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PASTE RAW CSV TEXT MODAL ================= */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Paste Bank Statement CSV Text</h3>
              </div>
              <button onClick={() => setIsPasteModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Open your CSV file in Notepad or Excel, copy all rows (Ctrl+A then Ctrl+C), and paste below:
            </p>

            <textarea
              rows={10}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Date,Description,Amount&#10;2026-03-01,EMPLOYER SALARY DIRECT DEP,5000.00&#10;2026-03-02,WHOLE FOODS GROCERIES,-120.50"
              className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyPastedText}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Parse & Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BANK RULES MANAGER MODAL ================= */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <SettingsIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Bank Automation Rules</h3>
              </div>
              <button onClick={() => setIsRulesModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            {/* Create New Rule Form */}
            <form onSubmit={handleCreateRule} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-white block">Add New Automation Rule</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gym Membership"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">If Contains</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. fitness"
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">Assign Account</label>
                  <select
                    value={newRuleAccountId}
                    onChange={(e) => setNewRuleAccountId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  Save Rule
                </button>
              </div>
            </form>

            {/* List of Active Rules */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 block">Active Bank Rules ({rules.length})</span>
              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                {rules.map((rule) => {
                  const targetAcc = accounts.find((a) => a.code === rule.targetAccountId || a.id === rule.targetAccountId);
                  return (
                    <div key={rule.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-white">{rule.name}</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          If narrative contains <span className="font-mono text-amber-300">"{rule.pattern}"</span> →
                          Assign <span className="font-mono text-indigo-300">{targetAcc ? `${targetAcc.code} ${targetAcc.name}` : rule.targetAccountId}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
