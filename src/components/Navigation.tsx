import React from 'react';
import {
  Wallet,
  BookOpen,
  PieChart,
  Gamepad2,
  Cloud,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Download,
  User,
  LogIn,
  LogOut,
} from 'lucide-react';
import { AppSettings, UserProfile } from '../core/types';

export type ActiveTab = 'dashboard' | 'journal' | 'accounts' | 'reports' | 'games';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenTransactionModal: (mode?: 'expense' | 'income' | 'transfer' | 'journal') => void;
  onOpenBackupModal: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  currentUser: UserProfile | null;
  settings: AppSettings;
  trialBalanceBalanced: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenTransactionModal,
  onOpenBackupModal,
  onOpenAuthModal,
  onLogout,
  currentUser,
  settings,
  trialBalanceBalanced,
}) => {
  const isCloudConfigured = Boolean(settings.cloudSync?.workerUrl && (settings.cloudSync?.secretKey || currentUser));

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-white tracking-tight">Antigravity</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Double-Entry
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span>Ledger Wallet</span>
                  {trialBalanceBalanced ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium ml-1">
                      <ShieldCheck className="w-3 h-3" /> Books Balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-400 font-medium ml-1">
                      Discrepancy
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <PieChart className="w-4 h-4" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('journal')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'journal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Journal & Ledger
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'accounts'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Landmark className="w-4 h-4" />
              Accounts
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'reports'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Statements
            </button>

            <button
              onClick={() => setActiveTab('games')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'games'
                  ? 'bg-gradient-to-r from-emerald-600 via-amber-600 to-indigo-600 text-white shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800/50'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              Minecraft Realm
              <span className="text-[10px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-400/30">
                Era {settings.realmState?.era || 1}
              </span>
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Backup & Cloud Sync button */}
            <button
              onClick={onOpenBackupModal}
              title="Cloudflare Sync & Backup"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isCloudConfigured
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {isCloudConfigured ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Cloud Sync</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Backup</span>
                </>
              )}
            </button>

            {/* User Account / Profile Badge */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 pl-1">
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60 text-xs">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                    {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden md:inline font-medium text-slate-200 truncate max-w-[100px]">
                    {currentUser.username || currentUser.email.split('@')[0]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Log Out"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}

            {/* Quick Record Button */}
            <div className="relative group">
              <button
                onClick={() => onOpenTransactionModal('expense')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-md shadow-indigo-600/30 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="font-semibold">Record</span>
              </button>

              {/* Hover Quick Select Menu */}
              <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <button
                  onClick={() => onOpenTransactionModal('expense')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-rose-300 hover:bg-slate-800/80 flex items-center gap-2"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                  Expense
                </button>
                <button
                  onClick={() => onOpenTransactionModal('income')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-emerald-300 hover:bg-slate-800/80 flex items-center gap-2"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  Income
                </button>
                <button
                  onClick={() => onOpenTransactionModal('transfer')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-sky-300 hover:bg-slate-800/80 flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                  Transfer
                </button>
                <div className="border-t border-slate-800 my-1" />
                <button
                  onClick={() => onOpenTransactionModal('journal')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-purple-300 hover:bg-slate-800/80 flex items-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                  Journal Entry (Dr / Cr)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden border-t border-slate-800/80 py-2 justify-around">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 text-[11px] ${
              activeTab === 'dashboard' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex flex-col items-center gap-1 text-[11px] ${
              activeTab === 'journal' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Journal
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex flex-col items-center gap-1 text-[11px] ${
              activeTab === 'accounts' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Landmark className="w-4 h-4" />
            Accounts
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center gap-1 text-[11px] ${
              activeTab === 'reports' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Reports
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`flex flex-col items-center gap-1 text-[11px] ${
              activeTab === 'games' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Realm
          </button>
        </div>
      </div>
    </header>
  );
};
