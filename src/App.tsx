import { useState, useEffect } from 'react';
import { Account, AppDataBackup, AppSettings, Transaction, UserProfile, NavTabId } from './core/types';
import { AppDatabase } from './storage/db';
import { generateTrialBalance } from './core/accounting';
import { GoogleAuthService } from './storage/googleAuth';
import { GoogleDriveSyncService } from './storage/googleDrive';
import { Navigation, ActiveTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { JournalView } from './components/JournalView';
import { AccountsView } from './components/AccountsView';
import { ReportsView } from './components/ReportsView';
import { BankReconciliationView } from './components/BankReconciliationView';
import { SettingsView } from './components/SettingsView';
import { TransactionModal } from './components/TransactionModal';
import { FloatingRecordButton } from './components/FloatingRecordButton';

export function App() {
  const [accounts, setAccounts] = useState<Account[]>(() => AppDatabase.loadAccounts());
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    AppDatabase.loadTransactions()
  );
  const [settings, setSettings] = useState<AppSettings>(() => AppDatabase.loadSettings());

  // User Authentication State (Native Google Account or Guest)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    GoogleAuthService.getCurrentUser()
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txModalMode, setTxModalMode] = useState<'expense' | 'income' | 'transfer' | 'journal'>('expense');

  // Synchronize state changes to local-first database
  useEffect(() => {
    AppDatabase.saveAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    AppDatabase.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    AppDatabase.saveSettings(settings);
  }, [settings]);

  // Sync global body theme for Day / Night mode
  useEffect(() => {
    const isLight = settings.theme === 'light';
    document.body.className = isLight ? 'theme-light' : 'theme-dark';
  }, [settings.theme]);

  // Dynamic Font Size Scaling (System Default vs. Custom Scale)
  useEffect(() => {
    const size = settings.fontSize || 'default';
    if (size === 'small') {
      document.documentElement.style.fontSize = '14px';
    } else if (size === 'normal') {
      document.documentElement.style.fontSize = '16px';
    } else if (size === 'large') {
      document.documentElement.style.fontSize = '18.4px';
    } else if (size === 'xlarge') {
      document.documentElement.style.fontSize = '20.8px';
    } else {
      // 'default' follows system font size
      document.documentElement.style.fontSize = '';
    }
  }, [settings.fontSize]);

  // Auto-Sync to Google Drive when transactions or accounts change
  useEffect(() => {
    if (!settings.googleSync?.autoSync || !currentUser) return;
    const timer = setTimeout(() => {
      GoogleDriveSyncService.backupToGoogleDrive(accounts, transactions, settings);
    }, 4000);
    return () => clearTimeout(timer);
  }, [transactions, accounts, settings.googleSync?.autoSync, currentUser]);

  // Check trial balance for books balance verification
  const trialBalance = generateTrialBalance(accounts, transactions);

  // Open modal for new transaction
  const handleOpenTransactionModal = (
    mode: 'expense' | 'income' | 'transfer' | 'journal' = 'expense'
  ) => {
    setEditingTx(null);
    setTxModalMode(mode);
    setIsTxModalOpen(true);
  };

  // Open modal for editing existing transaction
  const handleSelectTransactionToEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setTxModalMode((tx.meta?.simpleMode as 'expense' | 'income' | 'transfer' | 'journal') || 'journal');
    setIsTxModalOpen(true);
  };

  // Undo state for updated transaction
  const [undoUpdateInfo, setUndoUpdateInfo] = useState<{ prevTx: Transaction; currentTx: Transaction } | null>(null);

  // Save transaction (Create or Update)
  const handleSaveTransaction = (savedTx: Transaction) => {
    let updatedTransactions: Transaction[];
    if (editingTx) {
      setUndoUpdateInfo({ prevTx: editingTx, currentTx: savedTx });
      updatedTransactions = transactions.map((t) => (t.id === savedTx.id ? savedTx : t));
    } else {
      updatedTransactions = [savedTx, ...transactions];
    }
    setTransactions(updatedTransactions);
  };

  // Undo transaction update
  const handleUndoUpdate = () => {
    if (undoUpdateInfo) {
      setTransactions(transactions.map((t) => (t.id === undoUpdateInfo.currentTx.id ? undoUpdateInfo.prevTx : t)));
      setUndoUpdateInfo(null);
    }
  };

  // Helper: When transactions are deleted in Ledger, mark associated bank feed items as unreconciled so they show up in Feeds again
  const syncUnreconcileBankFeedSession = (deletedTxs: Transaction[]) => {
    try {
      const raw = localStorage.getItem('finance_bank_feed_session_v2');
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session?.statementLines || !Array.isArray(session.statementLines)) return;

      const deletedIds = new Set(deletedTxs.map((t) => t.id));
      const deletedLineIds = new Set(
        deletedTxs
          .map((t) => t.meta?.reconciledFromLineId)
          .filter((id): id is string => Boolean(id))
      );

      let changed = false;
      session.statementLines = session.statementLines.map((line: any) => {
        if (
          line.status === 'reconciled' &&
          (deletedIds.has(line.reconciledTxId) || deletedLineIds.has(line.id))
        ) {
          changed = true;
          return {
            ...line,
            status: 'unreconciled',
            reconciledTxId: undefined,
          };
        }
        return line;
      });

      if (changed) {
        localStorage.setItem('finance_bank_feed_session_v2', JSON.stringify(session));
      }
    } catch (e) {
      console.warn('Could not sync bank feed session on tx deletion', e);
    }
  };

  // Helper: When transactions are restored via Undo in Ledger, re-mark associated bank feed items as reconciled
  const syncRestoreBankFeedSession = (restoredTxs: Transaction[]) => {
    try {
      const raw = localStorage.getItem('finance_bank_feed_session_v2');
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session?.statementLines || !Array.isArray(session.statementLines)) return;

      let changed = false;
      session.statementLines = session.statementLines.map((line: any) => {
        const matchingTx = restoredTxs.find(
          (t) =>
            (t.meta?.reconciledFromLineId && t.meta.reconciledFromLineId === line.id) ||
            line.reconciledTxId === t.id
        );
        if (matchingTx && line.status === 'unreconciled') {
          changed = true;
          return {
            ...line,
            status: 'reconciled',
            reconciledTxId: matchingTx.id,
          };
        }
        return line;
      });

      if (changed) {
        localStorage.setItem('finance_bank_feed_session_v2', JSON.stringify(session));
      }
    } catch (e) {
      console.warn('Could not sync bank feed session on tx restore', e);
    }
  };

  // Delete single transaction
  const handleDeleteTransaction = (txId: string) => {
    const deletedTx = transactions.find((t) => t.id === txId);
    const updated = transactions.filter((t) => t.id !== txId);
    setTransactions(updated);
    if (deletedTx) {
      syncUnreconcileBankFeedSession([deletedTx]);
    }
  };

  // Delete multiple transactions
  const handleDeleteMultipleTransactions = (txIds: string[]) => {
    const deletedTxs = transactions.filter((t) => txIds.includes(t.id));
    const updated = transactions.filter((t) => !txIds.includes(t.id));
    setTransactions(updated);
    if (deletedTxs.length > 0) {
      syncUnreconcileBankFeedSession(deletedTxs);
    }
  };

  // Restore deleted transactions
  const handleRestoreTransactions = (txsToRestore: Transaction[]) => {
    const restoredMap = new Map<string, Transaction>();
    transactions.forEach((t) => restoredMap.set(t.id, t));
    txsToRestore.forEach((t) => restoredMap.set(t.id, t));
    const merged = Array.from(restoredMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setTransactions(merged);
    syncRestoreBankFeedSession(txsToRestore);
  };

  // Add custom account to Chart of Accounts
  const handleAddAccount = (newAcc: Account) => {
    setAccounts([...accounts, newAcc]);
  };

  // Update existing account in Chart of Accounts
  const handleUpdateAccount = (updatedAcc: Account) => {
    setAccounts(accounts.map((a) => (a.id === updatedAcc.id ? updatedAcc : a)));
  };

  // Restore entire data from file or Google backup
  const handleRestoreData = (backup: AppDataBackup) => {
    setAccounts(backup.accounts);
    setTransactions(backup.transactions);
    if (backup.settings) {
      setSettings(backup.settings);
    }
  };

  // Save Reconciled Transactions from Bank Feed
  const handleSaveReconciledTransactions = (newTxs: Transaction[]) => {
    const updated = [...newTxs, ...transactions];
    setTransactions(updated);
  };

  const isLight = settings.theme === 'light';
  const tabPosition = settings.tabPosition || 'bottom';
  const mainPadding =
    tabPosition === 'bottom'
      ? 'pt-3 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]'
      : 'pt-2 pb-12';

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isLight ? 'bg-[#f4f6f8] text-slate-900' : 'bg-[#121824] text-slate-100'
      }`}
    >
      {/* If Tab Position is configured as Top, render here */}
      {tabPosition === 'top' && (
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settings={settings}
        />
      )}

      {/* Main App Body - Without Top App Name Bar */}
      <main className={`flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 ${mainPadding}`}>
        {activeTab === 'dashboard' && (
          <Dashboard
            accounts={accounts}
            transactions={transactions}
            settings={settings}
            onOpenTransactionModal={handleOpenTransactionModal}
            onSelectTransactionToEdit={handleSelectTransactionToEdit}
            onNavigateToTab={(tab) => setActiveTab(tab as NavTabId)}
            onUpdateSettings={setSettings}
          />
        )}

        {activeTab === 'journal' && (
          <JournalView
            transactions={transactions}
            accounts={accounts}
            settings={settings}
            onEditTransaction={handleSelectTransactionToEdit}
            onDeleteTransaction={handleDeleteTransaction}
            onDeleteMultipleTransactions={handleDeleteMultipleTransactions}
            onRestoreTransactions={handleRestoreTransactions}
            undoUpdateInfo={undoUpdateInfo}
            onUndoUpdate={handleUndoUpdate}
            onOpenNewTransaction={() => handleOpenTransactionModal('journal')}
          />
        )}

        {activeTab === 'reconcile' && (
          <BankReconciliationView
            accounts={accounts}
            transactions={transactions}
            settings={settings}
            onSaveTransactions={handleSaveReconciledTransactions}
            onUpdateSettings={setSettings}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            transactions={transactions}
            settings={settings}
            onAddAccount={handleAddAccount}
            onUpdateAccount={handleUpdateAccount}
            onUpdateSettings={setSettings}
            onEditTransaction={handleSelectTransactionToEdit}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            accounts={accounts}
            transactions={transactions}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={setSettings}
            currentUser={currentUser}
            onUpdateUser={setCurrentUser}
            accounts={accounts}
            transactions={transactions}
            onRestoreData={handleRestoreData}
            trialBalanceBalanced={trialBalance.isBalanced}
          />
        )}
      </main>

      {/* Floating Action Button (+ Record) at Bottom Right */}
      <FloatingRecordButton
        onOpenModal={handleOpenTransactionModal}
        tabPosition={tabPosition}
        theme={settings.theme}
      />

      {/* If Tab Position is configured as Bottom (default), render here */}
      {tabPosition === 'bottom' && (
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settings={settings}
        />
      )}

      {/* Transaction Entry & Edit Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        accounts={accounts}
        onSave={handleSaveTransaction}
        editingTransaction={editingTx}
        initialMode={txModalMode}
        currencySymbol={settings.currencySymbol || '$'}
        baseCurrency={settings.baseCurrency || 'USD'}
        theme={settings.theme}
      />
    </div>
  );
}

export default App;
