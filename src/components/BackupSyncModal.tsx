import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  Globe,
  FileJson,
  Shield,
  HelpCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Account, AppDataBackup, AppSettings, Transaction } from '../core/types';
import { downloadBackupFile, parseAndValidateBackup } from '../storage/backup';
import { CloudflareSyncClient } from '../storage/cloudflare';

interface BackupSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  transactions: Transaction[];
  settings: AppSettings;
  onRestoreData: (backup: AppDataBackup) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetDemo: () => void;
  onClearAll: () => void;
}

export const BackupSyncModal: React.FC<BackupSyncModalProps> = ({
  isOpen,
  onClose,
  accounts,
  transactions,
  settings,
  onRestoreData,
  onUpdateSettings,
  onResetDemo,
  onClearAll,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'cloudflare'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloudflare sync states
  const [workerUrl, setWorkerUrl] = useState(settings.cloudSync?.workerUrl || '');
  const [secretKey, setSecretKey] = useState(settings.cloudSync?.secretKey || '');
  const [autoSync, setAutoSync] = useState(settings.cloudSync?.autoSync || false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Handle local file download
  const handleDownload = () => {
    downloadBackupFile(accounts, transactions, settings);
    setStatusMessage({
      type: 'success',
      text: 'Backup file downloaded! Keep this file safe to retrieve your wallet anytime.',
    });
  };

  // Handle local file upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = parseAndValidateBackup(content);

      if (!result.isValid || !result.data) {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Failed to read backup file.',
        });
        return;
      }

      if (
        confirm(
          `Restore backup from ${result.data.exportedAt}?\nThis will restore ${result.data.transactions.length} transactions and ${result.data.accounts.length} accounts.`
        )
      ) {
        onRestoreData(result.data);
        setStatusMessage({
          type: 'success',
          text: `Successfully restored ${result.data.transactions.length} transactions from backup file!`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Save Cloudflare configuration
  const handleSaveCloudConfig = () => {
    const updated = {
      ...settings,
      cloudSync: {
        workerUrl: workerUrl.trim(),
        secretKey: secretKey.trim(),
        autoSync,
        lastSyncedAt: settings.cloudSync?.lastSyncedAt,
      },
    };
    onUpdateSettings(updated);
    setStatusMessage({ type: 'success', text: 'Cloudflare settings saved!' });
  };

  // Test Cloudflare Worker connectivity
  const handleTestConnection = async () => {
    if (!workerUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Cloudflare Worker URL.' });
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const res = await CloudflareSyncClient.testConnection(workerUrl.trim(), secretKey.trim());
    setIsLoading(false);
    setStatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  // Push local records to Cloudflare
  const handlePushToCloud = async () => {
    if (!workerUrl.trim() || !secretKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Worker URL and Secret Key are both required to sync.' });
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const res = await CloudflareSyncClient.pushToCloud(
      workerUrl.trim(),
      secretKey.trim(),
      accounts,
      transactions,
      settings
    );
    setIsLoading(false);
    if (res.success) {
      handleSaveCloudConfig();
      setStatusMessage({ type: 'success', text: res.message });
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  // Pull records from Cloudflare
  const handlePullFromCloud = async () => {
    if (!workerUrl.trim() || !secretKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Worker URL and Secret Key are required.' });
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const res = await CloudflareSyncClient.pullFromCloud(workerUrl.trim(), secretKey.trim());
    setIsLoading(false);

    if (res.success && res.data) {
      if (
        confirm(
          `Retrieved cloud backup from ${res.data.lastSyncedAt}.\nApply ${res.data.transactions.length} transactions and ${res.data.accounts.length} accounts to this device?`
        )
      ) {
        onRestoreData({
          version: 1,
          exportedAt: res.data.lastSyncedAt || new Date().toISOString(),
          generator: 'Cloudflare Worker Sync',
          accounts: res.data.accounts,
          transactions: res.data.transactions,
          settings: res.data.settings || settings,
        });
        setStatusMessage({ type: 'success', text: res.message });
      }
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Long-Term Storage & Backup</h3>
              <p className="text-xs text-slate-400">
                Ensure your wallet data is safely preserved across devices and days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            onClick={() => {
              setActiveTab('file');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'file'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileJson className="w-4 h-4" />
            Downloadable Backup File
          </button>
          <button
            onClick={() => {
              setActiveTab('cloudflare');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'cloudflare'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Cloudflare Worker Sync
          </button>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border flex items-start gap-2 text-xs ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                : 'bg-indigo-950/30 border-indigo-500/40 text-indigo-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* ================= TAB 1: FILE BACKUP ================= */}
          {activeTab === 'file' && (
            <div className="space-y-5">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Create Downloadable Backup
                  </h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Export all your accounts, journal transactions, and balance settings into a single
                  clean JSON file. You can store it on Google Drive, USB, or your desktop.
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  Download Backup File (.json)
                </button>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Restore on a New Device or Day
                  </h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When starting a new day on another device or after clearing browser history, choose
                  your backup file to restore your entire wallet history instantly.
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Select & Restore Backup File
                </button>
              </div>

              {/* Data Reset & Demo Options */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Reset to initial sample demo data? This replaces current records.')) {
                      onResetDemo();
                      setStatusMessage({ type: 'info', text: 'Reset to demo transactions.' });
                    }
                  }}
                  className="text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Demo Data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all transactions?')) {
                      onClearAll();
                      setStatusMessage({ type: 'info', text: 'All transaction data cleared.' });
                    }
                  }}
                  className="text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Data
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 2: CLOUDFLARE SYNC ================= */}
          {activeTab === 'cloudflare' && (
            <div className="space-y-5">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Cloudflare Worker Connection
                    </h4>
                  </div>
                  {settings.cloudSync?.lastSyncedAt && (
                    <span className="text-[10px] text-slate-400">
                      Last Synced: {new Date(settings.cloudSync.lastSyncedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      Worker Endpoint URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://antigravity-finance-sync.username.workers.dev"
                      value={workerUrl}
                      onChange={(e) => setWorkerUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      Private Sync Key / Passphrase
                    </label>
                    <input
                      type="password"
                      placeholder="Your secret passphrase for your wallet"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Acts as your private key so only you can sync to your Cloudflare storage.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="autosync"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <label htmlFor="autosync" className="text-xs text-slate-300">
                      Auto-sync changes to Cloudflare Worker
                    </label>
                  </div>
                </div>

                {/* Cloud Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleTestConnection}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                  >
                    Test Connection
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handlePushToCloud}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    Push to Cloud
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handlePullFromCloud}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-700/30 transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Pull from Cloud
                  </button>
                </div>
              </div>

              {/* Quick Cloudflare Deployment Guide Accordion */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-2">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                  How to deploy your Cloudflare Worker:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>
                    Open terminal in the included <code className="text-indigo-300">worker/</code> folder.
                  </li>
                  <li>
                    Run <code className="text-indigo-300">npx wrangler deploy</code>
                  </li>
                  <li>
                    Copy the URL Cloudflare provides (e.g.{' '}
                    <code className="text-slate-300">https://antigravity-finance-sync...</code>) and paste
                    it above!
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
