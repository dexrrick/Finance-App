import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Moon,
  Sun,
  CloudUpload,
  CloudDownload,
  FileSpreadsheet,
  Download,
  Upload,
  LogOut,
  CheckCircle2,
  Sliders,
  Type,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  Check,
  AlertCircle,
  ExternalLink,
  Globe,
  Lock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Account, AppDataBackup, AppSettings, FontSizePreference, NavTabId, TabConfigItem, TabPositionPreference, Transaction, UserProfile } from '../core/types';
import { GoogleAuthService } from '../storage/googleAuth';
import { GoogleDriveSyncService } from '../storage/googleDrive';
import { CurrencyService, SUPPORTED_CURRENCIES } from '../core/currencyService';
import { getInitialDemoTransactions } from '../core/accounting';
import { DEFAULT_ACCOUNTS } from '../core/accounts';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  currentUser: UserProfile | null;
  onUpdateUser: (user: UserProfile | null) => void;
  accounts: Account[];
  transactions: Transaction[];
  onRestoreData: (backup: AppDataBackup) => void;
  trialBalanceBalanced: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  currentUser,
  onUpdateUser,
  accounts,
  transactions,
  onRestoreData,
  trialBalanceBalanced,
}) => {
  const isLight = settings.theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const detectedDeviceCurrency = CurrencyService.detectDeviceCurrency();
  const [selectedBaseCurrency, setSelectedBaseCurrency] = useState<string>(
    settings.baseCurrency || detectedDeviceCurrency.code
  );
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);
  const [isSampleConfirmOpen, setIsSampleConfirmOpen] = useState(false);
  const [isRefreshingFx, setIsRefreshingFx] = useState(false);
  const [fxStatusMsg, setFxStatusMsg] = useState<string | null>(null);

  const handleConfirmLoadSample = () => {
    const sampleTxs = getInitialDemoTransactions();
    onRestoreData({
      version: 1,
      exportedAt: new Date().toISOString(),
      generator: 'sample_ledger_50_generator',
      accounts: accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS,
      transactions: sampleTxs,
      settings: settings,
    });
    setIsSampleConfirmOpen(false);
    showNotification('success', 'Loaded 53 realistic sample transactions spanning 1 full year!');
  };

  const handleConfirmLockBaseCurrency = () => {
    const currencyInfo = CurrencyService.getCurrencyInfo(selectedBaseCurrency);
    onUpdateSettings({
      ...settings,
      baseCurrency: selectedBaseCurrency,
      currencySymbol: currencyInfo.symbol,
      baseCurrencyLocked: true,
    });
    setIsLockConfirmOpen(false);
    showNotification('success', `Base reporting currency locked to ${selectedBaseCurrency} (${currencyInfo.symbol})`);
  };

  const handleRefreshFx = async () => {
    setIsRefreshingFx(true);
    setFxStatusMsg(null);
    try {
      const res = await CurrencyService.fetchLatestRates(settings.baseCurrency || 'USD', true);
      if (res.success) {
        setFxStatusMsg(`Rates updated (${res.date}) via Frankfurter API`);
        showNotification('success', 'Exchange rates refreshed successfully.');
      } else {
        showNotification('error', res.error || 'Failed to refresh rates.');
      }
    } finally {
      setIsRefreshingFx(false);
    }
  };

  // Real Google Sign In (OAuth 2.0 / Google Identity Services)
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await GoogleAuthService.signInWithGoogle();

      if (res.success && res.user) {
        onUpdateUser(res.user);
        onUpdateSettings({
          ...settings,
          auth: { user: res.user, token: res.token || 'google-oauth-token', isGuest: false },
        });
        showNotification('success', `Signed in as ${res.user.email}`);
      } else {
        showNotification('error', res.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Google Sign Out
  const handleGoogleSignOut = () => {
    GoogleAuthService.signOut();
    onUpdateUser(null);
    onUpdateSettings({
      ...settings,
      auth: { user: null, token: null, isGuest: true },
    });
    showNotification('success', 'Signed out of Google account.');
  };

  // Backup to Google Drive
  const handleBackupToGoogleDrive = async () => {
    const res = await GoogleDriveSyncService.backupToGoogleDrive(accounts, transactions, settings);
    if (res.success) {
      showNotification('success', res.message);
      if (res.timestamp) {
        onUpdateSettings({
          ...settings,
          googleSync: { autoSync: settings.googleSync?.autoSync || false, lastSyncedAt: res.timestamp },
        });
      }
    } else {
      showNotification('error', res.message);
    }
  };

  // Restore from Google Drive
  const handleRestoreFromGoogleDrive = async () => {
    const res = await GoogleDriveSyncService.restoreFromGoogleDrive();
    if (res.success && res.backup) {
      onRestoreData(res.backup);
      showNotification('success', res.message);
    } else {
      showNotification('error', res.message);
    }
  };

  // Import JSON File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const backup: AppDataBackup = JSON.parse(text);
        if (!backup.accounts || !backup.transactions) {
          showNotification('error', 'Invalid backup file format.');
          return;
        }
        onRestoreData(backup);
        showNotification('success', `Restored ${backup.accounts.length} accounts & ${backup.transactions.length} entries!`);
      } catch {
        showNotification('error', 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Tab Customization: Toggle Tab Enabled
  const handleToggleTab = (tabId: NavTabId) => {
    const currentTabs = settings.tabConfig || [];
    const updated = currentTabs.map((t) => (t.id === tabId ? { ...t, enabled: !t.enabled } : t));
    onUpdateSettings({ ...settings, tabConfig: updated });
  };

  // Tab Customization: Move Tab Up
  const handleMoveTabUp = (index: number) => {
    if (index <= 0) return;
    const currentTabs = [...(settings.tabConfig || [])];
    const temp = currentTabs[index];
    currentTabs[index] = currentTabs[index - 1];
    currentTabs[index - 1] = temp;
    onUpdateSettings({ ...settings, tabConfig: currentTabs });
  };

  // Tab Customization: Move Tab Down
  const handleMoveTabDown = (index: number) => {
    const currentTabs = [...(settings.tabConfig || [])];
    if (index >= currentTabs.length - 1) return;
    const temp = currentTabs[index];
    currentTabs[index] = currentTabs[index + 1];
    currentTabs[index + 1] = temp;
    onUpdateSettings({ ...settings, tabConfig: currentTabs });
  };

  // Tab Customization: Position
  const handleTabPositionChange = (position: TabPositionPreference) => {
    onUpdateSettings({ ...settings, tabPosition: position });
    showNotification('success', `Navigation bar moved to ${position}.`);
  };

  // Font Size
  const handleFontSizeChange = (size: FontSizePreference) => {
    onUpdateSettings({ ...settings, fontSize: size });
  };

  // Theme Toggle
  const handleThemeToggle = (theme: 'dark' | 'light') => {
    onUpdateSettings({ ...settings, theme });
  };

  const fontOptions: { id: FontSizePreference; label: string; desc: string }[] = [
    { id: 'default', label: 'System Default', desc: 'Matches device font size' },
    { id: 'small', label: 'Small', desc: '87.5% scale' },
    { id: 'normal', label: 'Normal', desc: '100% standard' },
    { id: 'large', label: 'Large', desc: '115% comfortable' },
    { id: 'xlarge', label: 'Extra Large', desc: '130% high visibility' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-medium border flex items-center gap-2.5 backdrop-blur-md animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/50 text-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Hidden File Input for JSON Restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            App Settings
          </h1>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Customize navigation, backups, display & account
          </p>
        </div>
        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
          v1.0.0
        </span>
      </div>

      {/* SECTION 1: GOOGLE ACCOUNT & NATIVE AUTH */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800 shadow-md'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-sm">
              G
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Google Account
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {currentUser ? 'Connected with Google Account' : 'Sign in to enable native Google Drive backup'}
              </p>
            </div>
          </div>
          {currentUser && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
            </span>
          )}
        </div>

        {currentUser ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 !text-white text-white flex items-center justify-center font-bold text-base shadow">
                {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'G'}
              </div>
              <div>
                <p className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {currentUser.displayName || currentUser.username}
                </p>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {currentUser.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleGoogleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="pt-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-sm transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.27V6.58H1.26A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.26 5.42l4.02-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>
          </div>
        )}
      </div>

      {/* SECTION 2: GOOGLE DRIVE BACKUP & LOCAL DATA */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800 shadow-md'
      }`}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-sm">
            <CloudUpload className="w-4 h-4" />
          </div>
          <div>
            <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              Google Native Backup & Data
            </h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Sync your wallet snapshot to Google Drive or local storage
            </p>
          </div>
        </div>

        {/* Auto-Sync Toggle */}
        <div className="flex items-center justify-between py-2 mb-3 border-b border-slate-800/40">
          <div>
            <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              Auto-Sync to Google Drive
            </span>
            <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Automatically upload updates whenever transactions change
            </p>
          </div>
          <button
            type="button"
            disabled={!currentUser}
            onClick={() =>
              onUpdateSettings({
                ...settings,
                googleSync: {
                  ...settings.googleSync,
                  autoSync: !settings.googleSync?.autoSync,
                },
              })
            }
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.googleSync?.autoSync && currentUser ? 'bg-emerald-600' : 'bg-slate-700'
            } ${!currentUser ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`w-4 h-4 rounded-full bg-white transition-transform block absolute top-1 ${
                settings.googleSync?.autoSync && currentUser ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Google Drive 1-Click Sync Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
          <button
            onClick={handleBackupToGoogleDrive}
            className={`flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
              currentUser
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow'
                : 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-400 border-slate-700'
            }`}
            disabled={!currentUser}
          >
            <CloudUpload className="w-4 h-4" />
            <span>Backup to Google Drive</span>
          </button>

          <button
            onClick={handleRestoreFromGoogleDrive}
            className={`flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
              currentUser
                ? 'bg-indigo-600 hover:bg-indigo-500 !text-white text-white border-indigo-500 shadow'
                : 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-400 border-slate-700'
            }`}
            disabled={!currentUser}
          >
            <CloudDownload className="w-4 h-4" />
            <span>Restore from Google Drive</span>
          </button>
        </div>

        {settings.googleSync?.lastSyncedAt && (
          <div className="text-center mb-3">
            <p className="text-[11px] text-slate-400">
              Last Google Drive backup: <strong className="text-emerald-400">{settings.googleSync.lastSyncedAt}</strong>
            </p>
            {GoogleDriveSyncService.getDriveFileInfo().webViewLink && (
              <a
                href={GoogleDriveSyncService.getDriveFileInfo().webViewLink!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open backup on Google Drive</span>
              </a>
            )}
          </div>
        )}

        {/* Local Device Backups */}
        <div className="pt-3 border-t border-slate-800/40">
          <p className="text-[11px] font-medium text-slate-400 mb-2">Local Device Files:</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => GoogleDriveSyncService.exportLocalJsonBackup(accounts, transactions, settings)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium border transition-colors ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium border transition-colors ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>

            <button
              onClick={() => GoogleDriveSyncService.exportLedgerCsv(transactions, accounts)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium border transition-colors ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Sample Dataset (50 Transactions across 1 Year) */}
          <div className="mt-3.5 pt-3 border-t border-slate-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400">Sample Dataset:</span>
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                Testing & Demo
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSampleConfirmOpen(true)}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                isLight
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm'
                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load 50 Sample Transactions (1-Year Spread)</span>
            </button>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              Populates your general ledger with 53 balanced double-entry transactions spanning 12 months with salaries, rent, groceries, utilities, and foreign currency entries.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: BASE REPORTING CURRENCY & LIVE FX RATES (FRANKFURTER API) */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800 shadow-md'
      }`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-sm">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Base Reporting Currency & FX Rates
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Functional accounting currency and public European Central Bank FX rates
              </p>
            </div>
          </div>

          <button
            onClick={handleRefreshFx}
            disabled={isRefreshingFx}
            title="Refresh exchange rates from Frankfurter"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFx ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isRefreshingFx ? 'Fetching...' : 'Refresh Rates'}</span>
          </button>
        </div>

        {fxStatusMsg && (
          <p className="text-[11px] text-emerald-400 font-medium mb-3">
            ✓ {fxStatusMsg}
          </p>
        )}

        {/* Currency Display / One-time Selection */}
        {settings.baseCurrencyLocked ? (
          <div className="space-y-2">
            <div className={`flex items-center justify-between p-3 rounded-xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {settings.baseCurrency || 'USD'}
                </span>
                <div>
                  <p className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    {CurrencyService.getCurrencyInfo(settings.baseCurrency || 'USD').name} ({settings.currencySymbol || '$'})
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Primary ledger reporting currency
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <Lock className="w-3 h-3" />
                <span>Locked</span>
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed px-1">
              Base currency is permanently locked to maintain historical balance consistency. You can record transactions in foreign currencies (e.g. EUR, SGD, JPY, GBP) which will convert automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Select Base Currency:</span>
              <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                Detected from phone: {detectedDeviceCurrency.code} ({detectedDeviceCurrency.symbol})
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={selectedBaseCurrency}
                onChange={(e) => setSelectedBaseCurrency(e.target.value)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-slate-950 border-slate-700 text-white'
                }`}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsLockConfirmOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold !text-white text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Set & Lock Currency</span>
              </button>
            </div>

            <p className="text-[11px] text-amber-400/90 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
              <strong>Important:</strong> You can only set your Base Currency <strong>one time</strong>. Make sure this matches the primary currency in which you want your financial statements and balances calculated.
            </p>
          </div>
        )}
      </div>

      {/* Base Currency One-Time Lock Warning Modal */}
      {isLockConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Permanent Base Currency Decision</h3>
                <p className="text-xs text-slate-400">Please review before locking</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to set <strong className="text-indigo-400">{selectedBaseCurrency} ({CurrencyService.getCurrencyInfo(selectedBaseCurrency).name})</strong> as your permanent Base Currency?
            </p>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <p>• All general ledger entries, net worth, and financial reports will be consolidated in <strong>{selectedBaseCurrency}</strong>.</p>
              <p>• <strong>This choice cannot be changed later</strong> to protect against historical balance distortions.</p>
              <p>• You can still record expenses and income in any foreign currency at any time using live FX conversion.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLockConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLockBaseCurrency}
                className="px-4 py-2 rounded-xl text-xs font-bold !text-white text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Confirm & Lock Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sample 50 Transactions Confirmation Modal */}
      {isSampleConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Load 50 Sample Transactions</h3>
                <p className="text-xs text-slate-400">1-Year Realistic Accounting History</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will populate your general ledger with <strong>53 balanced double-entry transactions</strong> spanning the past 12 months.
            </p>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <p>• <strong>12-Month Spread:</strong> Monthly salaries, rents, utilities, groceries, and dining.</p>
              <p>• <strong>Multi-Currency:</strong> Includes foreign EUR consulting income, SGD business travel, and JPY purchases.</p>
              <p>• <strong>Balanced Books:</strong> All debits and credits balance to 0.00.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSampleConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLoadSample}
                className="px-4 py-2 rounded-xl text-xs font-bold !text-white text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Sample Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: NAVIGATION BAR CUSTOMIZATION (POSITION, SHOW/HIDE & REORDER) */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800 shadow-md'
      }`}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-sm">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              Navigation Bar & Tabs
            </h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Customize position, arrange order, or hide unused tabs
            </p>
          </div>
        </div>

        {/* Tab Position Switch */}
        <div className="mb-4 pb-3 border-b border-slate-800/40">
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Navigation Bar Position:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleTabPositionChange('bottom')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                (settings.tabPosition || 'bottom') === 'bottom'
                  ? 'bg-indigo-600 !text-white text-white border-indigo-500 shadow-md font-semibold'
                  : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Bottom Bar (Mobile)</span>
            </button>

            <button
              onClick={() => handleTabPositionChange('top')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                settings.tabPosition === 'top'
                  ? 'bg-indigo-600 !text-white text-white border-indigo-500 shadow-md font-semibold'
                  : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Top Bar</span>
            </button>
          </div>
        </div>

        {/* Tab Ordering & Visibility List */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Configure & Reorder Tabs:
          </label>
          <div className="space-y-2">
            {(settings.tabConfig || []).map((tab, idx) => {
              const isSettingsTab = tab.id === 'settings';
              const isDashboardTab = tab.id === 'dashboard';

              return (
                <div
                  key={tab.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                    tab.enabled
                      ? isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700 text-slate-200'
                      : 'opacity-50 bg-slate-900/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 font-mono text-[10px] text-slate-500">#{idx + 1}</span>
                    <span className="font-medium">{tab.label}</span>
                    {isSettingsTab && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400">Locked</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Move Up Button */}
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveTabUp(idx)}
                      title="Move Up"
                      className="p-1 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-700/50"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down Button */}
                    <button
                      disabled={idx === (settings.tabConfig || []).length - 1}
                      onClick={() => handleMoveTabDown(idx)}
                      title="Move Down"
                      className="p-1 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-700/50"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Visibility Switch (User can hide tabs e.g. Reports) */}
                    {!isSettingsTab && !isDashboardTab && (
                      <button
                        onClick={() => handleToggleTab(tab.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                          tab.enabled
                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {tab.enabled ? (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Shown</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: FONT SIZE ADJUSTMENT */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800 shadow-md'
      }`}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-sm">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              Font Size & Typography
            </h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Select your preferred text scaling for easier reading
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {fontOptions.map((opt) => {
            const isSelected = (settings.fontSize || 'default') === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleFontSizeChange(opt.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-500 shadow-sm font-semibold'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className={`text-[10px] ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                    {opt.desc}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 5: THEME & COLOR SCHEME */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800 shadow-md'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold text-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Appearance & Theme
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Switch between Day (Light) and Night (Dark) mode
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleThemeToggle('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isLight ? 'bg-amber-500 text-white border-amber-600 shadow' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              <span>Day</span>
            </button>
            <button
              onClick={() => handleThemeToggle('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                !isLight ? 'bg-indigo-600 !text-white text-white border-indigo-500 shadow' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-200" />
              <span>Night</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 6: SYSTEM STATUS & ABOUT */}
      <div className={`p-4 sm:p-5 rounded-2xl border text-center text-xs space-y-2 ${
        isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-950/60 border-slate-800 text-slate-400'
      }`}>
        <div className="flex items-center justify-center gap-2 font-medium">
          {trialBalanceBalanced ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Accounting Equation Balanced (Assets = Liabilities + Equity)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-rose-400">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Accounting Discrepancy Detected</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          Finance Ledger • v1.0.0 • Multi-Platform Offline First
        </p>
      </div>
    </div>
  );
};
