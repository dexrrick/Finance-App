import { useState, useEffect } from 'react';
import { Account, AppDataBackup, AppSettings, Transaction, UserProfile } from './core/types';
import { AppDatabase } from './storage/db';
import { generateTrialBalance } from './core/accounting';
import { CloudflareSyncClient } from './storage/cloudflare';
import { AuthService } from './storage/auth';
import { Navigation, ActiveTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { JournalView } from './components/JournalView';
import { AccountsView } from './components/AccountsView';
import { ReportsView } from './components/ReportsView';
import { BankReconciliationView } from './components/BankReconciliationView';
import { TransactionModal } from './components/TransactionModal';
import { BackupSyncModal } from './components/BackupSyncModal';
import { AuthModal } from './components/AuthModal';

export function App() {
  const [accounts, setAccounts] = useState<Account[]>(() => AppDatabase.loadAccounts());
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    AppDatabase.loadTransactions()
  );
  const [settings, setSettings] = useState<AppSettings>(() => AppDatabase.loadSettings());

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => AuthService.getCurrentSession().user);
  const [authToken, setAuthToken] = useState<string | null>(() => AuthService.getCurrentSession().token);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(
    () => !AuthService.getCurrentSession().user && !AppDatabase.loadSettings().auth?.isGuest
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txModalMode, setTxModalMode] = useState<'expense' | 'income' | 'transfer' | 'journal'>(
    'expense'
  );

  // Backup & Sync Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

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

  // Save transaction (Create or Update)
  const handleSaveTransaction = (savedTx: Transaction) => {
    let updatedTransactions: Transaction[];

    if (editingTx) {
      updatedTransactions = transactions.map((t) => (t.id === savedTx.id ? savedTx : t));
    } else {
      updatedTransactions = [savedTx, ...transactions];
    }

    setTransactions(updatedTransactions);

    // Optional background auto-sync to Cloudflare
    if (
      settings.cloudSync?.autoSync &&
      settings.cloudSync?.workerUrl &&
      settings.cloudSync?.secretKey
    ) {
      CloudflareSyncClient.pushToCloud(
        settings.cloudSync.workerUrl,
        settings.cloudSync.secretKey,
        accounts,
        updatedTransactions,
        settings
      ).catch((err) => {
        console.warn('Auto-sync background warning:', err);
      });
    }
  };

  // Delete transaction
  const handleDeleteTransaction = (txId: string) => {
    const updated = transactions.filter((t) => t.id !== txId);
    setTransactions(updated);
  };

  // Add custom account to Chart of Accounts
  const handleAddAccount = (newAcc: Account) => {
    setAccounts([...accounts, newAcc]);
  };

  // Restore entire data from file or cloud backup
  const handleRestoreData = (backup: AppDataBackup) => {
    setAccounts(backup.accounts);
    setTransactions(backup.transactions);
    if (backup.settings) {
      setSettings(backup.settings);
    }
  };

  // Reset to initial demo data
  const handleResetDemo = () => {
    const res = AppDatabase.resetToDemo();
    setAccounts(res.accounts);
    setTransactions(res.transactions);
    setSettings(res.settings);
  };

  // Clear all data
  const handleClearAll = () => {
    const res = AppDatabase.clearAll();
    setAccounts(res.accounts);
    setTransactions(res.transactions);
    setSettings(res.settings);
  };

  // Save Reconciled Transactions from Bank Feed (Batch or Single)
  const handleSaveReconciledTransactions = (newTxs: Transaction[]) => {
    const updated = [...newTxs, ...transactions];
    setTransactions(updated);

    // Optional background auto-sync to Cloudflare
    if (
      settings.cloudSync?.autoSync &&
      settings.cloudSync?.workerUrl &&
      (settings.cloudSync?.secretKey || authToken)
    ) {
      CloudflareSyncClient.pushToCloud(
        settings.cloudSync.workerUrl,
        settings.cloudSync.secretKey || authToken || '',
        accounts,
        updated,
        settings
      ).catch(() => {});
    }
  };

  // Authentication Handlers
  const handleAuthSuccess = (user: UserProfile, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    setIsAuthModalOpen(false);

    const updatedSettings: AppSettings = {
      ...settings,
      auth: { user, token, isGuest: false },
    };
    setSettings(updatedSettings);

    // Auto-pull user's remote cloud vault if Cloudflare is configured
    if (updatedSettings.cloudSync?.workerUrl) {
      CloudflareSyncClient.pullFromCloud(updatedSettings.cloudSync.workerUrl, token)
        .then((res) => {
          if (res.success && res.data) {
            setAccounts(res.data.accounts);
            setTransactions(res.data.transactions);
            if (res.data.settings) setSettings(res.data.settings);
          }
        })
        .catch(() => {});
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    setCurrentUser(null);
    setAuthToken(null);
    setSettings((prev) => ({
      ...prev,
      auth: { user: null, token: null, isGuest: false },
    }));
    setIsAuthModalOpen(true);
  };

  const handleContinueAsGuest = () => {
    setIsAuthModalOpen(false);
    setSettings((prev) => ({
      ...prev,
      auth: { user: null, token: null, isGuest: true },
    }));
  };

  // Toggle Day / Night Theme
  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    const updated: AppSettings = {
      ...settings,
      theme: nextTheme,
    };
    setSettings(updated);
  };

  const isLight = settings.theme === 'light';

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#080c14] text-slate-100'
      }`}
    >
      {/* Top Sticky Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTransactionModal={handleOpenTransactionModal}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onToggleTheme={handleToggleTheme}
        currentUser={currentUser}
        settings={settings}
        trialBalanceBalanced={trialBalance.isBalanced}
      />

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            accounts={accounts}
            transactions={transactions}
            settings={settings}
            onOpenTransactionModal={handleOpenTransactionModal}
            onSelectTransactionToEdit={handleSelectTransactionToEdit}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'journal' && (
          <JournalView
            transactions={transactions}
            accounts={accounts}
            settings={settings}
            onEditTransaction={handleSelectTransactionToEdit}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenNewTransaction={() => handleOpenTransactionModal('journal')}
          />
        )}

        {activeTab === 'reconcile' && (
          <BankReconciliationView
            accounts={accounts}
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
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            accounts={accounts}
            transactions={transactions}
            settings={settings}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Antigravity Double-Entry Ledger Wallet • Deployable on <strong>GitHub Pages</strong> &{' '}
            <strong>Cloudflare Workers</strong>
          </p>
          <div className="flex items-center gap-3 text-slate-400">
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="hover:text-indigo-400 underline transition-colors"
            >
              Backup & Sync
            </button>
          </div>
        </div>
      </footer>

      {/* Transaction Entry & Edit Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        accounts={accounts}
        onSave={handleSaveTransaction}
        editingTransaction={editingTx}
        initialMode={txModalMode}
        currencySymbol={settings.currencySymbol || '$'}
      />

      {/* Backup & Cloudflare Sync Modal */}
      <BackupSyncModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        accounts={accounts}
        transactions={transactions}
        settings={settings}
        onRestoreData={handleRestoreData}
        onUpdateSettings={setSettings}
        onResetDemo={handleResetDemo}
        onClearAll={handleClearAll}
      />

      {/* Bank-Grade Authentication & Vault Gate Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        onContinueAsGuest={handleContinueAsGuest}
        workerUrl={settings.cloudSync?.workerUrl}
      />
    </div>
  );
}

export default App;

