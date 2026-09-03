import { useState, useEffect } from 'react';
import { Account, AppDataBackup, AppSettings, Transaction } from './core/types';
import { AppDatabase } from './storage/db';
import { generateTrialBalance } from './core/accounting';
import { CloudflareSyncClient } from './storage/cloudflare';
import { Navigation, ActiveTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { JournalView } from './components/JournalView';
import { AccountsView } from './components/AccountsView';
import { ReportsView } from './components/ReportsView';
import { MiniGamesHub } from './components/games/MiniGamesHub';
import { TransactionModal } from './components/TransactionModal';
import { BackupSyncModal } from './components/BackupSyncModal';

import { evaluateTransactionImpact } from './core/gamificationEngine';

export function App() {
  const [accounts, setAccounts] = useState<Account[]>(() => AppDatabase.loadAccounts());
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    AppDatabase.loadTransactions()
  );
  const [settings, setSettings] = useState<AppSettings>(() => AppDatabase.loadSettings());

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txModalMode, setTxModalMode] = useState<'expense' | 'income' | 'transfer' | 'journal'>(
    'expense'
  );

  // Backup & Sync Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Floating Realm Reaction Toast State
  const [realmToast, setRealmToast] = useState<{ type: 'disaster' | 'success'; message: string } | null>(null);

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

    // Gamification: evaluate impact on the Living Civilization Realm
    const impact = evaluateTransactionImpact(savedTx, accounts, settings);
    setSettings(impact.updatedSettings);

    // Show floating realm toast
    setRealmToast({
      type: impact.disaster ? 'disaster' : 'success',
      message: impact.message,
    });
    setTimeout(() => {
      setRealmToast(null);
    }, 5500);

    // Optional background auto-sync to Cloudflare
    if (
      impact.updatedSettings.cloudSync?.autoSync &&
      impact.updatedSettings.cloudSync?.workerUrl &&
      impact.updatedSettings.cloudSync?.secretKey
    ) {
      CloudflareSyncClient.pushToCloud(
        impact.updatedSettings.cloudSync.workerUrl,
        impact.updatedSettings.cloudSync.secretKey,
        accounts,
        updatedTransactions,
        impact.updatedSettings
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Sticky Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTransactionModal={handleOpenTransactionModal}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        settings={settings}
        trialBalanceBalanced={trialBalance.isBalanced}
      />

      {/* Floating Realm Reaction Toast */}
      {realmToast && (
        <div className="fixed top-20 right-4 z-50 max-w-md animate-fade-in shadow-2xl">
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-medium backdrop-blur-md ${
              realmToast.type === 'disaster'
                ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
            }`}
          >
            <span>{realmToast.message}</span>
            <button
              onClick={() => {
                setRealmToast(null);
                setActiveTab('games');
              }}
              className="text-[10px] font-bold px-2 py-1 rounded bg-slate-900/80 text-white hover:bg-slate-800 shrink-0 border border-slate-700"
            >
              View Realm
            </button>
          </div>
        </div>
      )}

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

        {activeTab === 'games' && (
          <MiniGamesHub
            accounts={accounts}
            settings={settings}
            onUpdateSettings={setSettings}
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
            <span>•</span>
            <button
              onClick={() => setActiveTab('games')}
              className="hover:text-amber-400 underline transition-colors"
            >
              Play Mini-Games
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
    </div>
  );
}

export default App;

