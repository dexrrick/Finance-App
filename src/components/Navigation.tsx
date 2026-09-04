import React from 'react';
import {
  BookOpen,
  PieChart,
  Cloud,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Download,
  LogIn,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  Layers,
} from 'lucide-react';
import { AppSettings, UserProfile } from '../core/types';

export type ActiveTab = 'dashboard' | 'journal' | 'reconcile' | 'accounts' | 'reports';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenTransactionModal: (mode?: 'expense' | 'income' | 'transfer' | 'journal') => void;
  onOpenBackupModal: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
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
  onToggleTheme,
  currentUser,
  settings,
  trialBalanceBalanced,
}) => {
  const isLight = settings.theme === 'light';
  const isCloudConfigured = Boolean(
    settings.cloudSync?.workerUrl && (settings.cloudSync?.secretKey || currentUser)
  );

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-200 ${
        isLight
          ? 'bg-white/95 border-b border-slate-200/90 shadow-sm backdrop-blur-md'
          : 'bg-slate-900/95 border-b border-slate-800/90 shadow-lg backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Executive Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 text-left group focus:outline-none"
            >
              {/* Refined Geometric Emblem */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm tracking-widest border transition-all ${
                  isLight
                    ? 'bg-slate-900 text-white border-slate-800 shadow-sm'
                    : 'bg-slate-800/90 text-white border-slate-700 shadow'
                }`}
              >
                AG
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold text-base tracking-tight ${
                      isLight ? 'text-slate-900' : 'text-slate-100'
                    }`}
                  >
                    Antigravity
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                      isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Ledger
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    Double-Entry Core
                  </span>
                  <span className={isLight ? 'text-slate-300' : 'text-slate-700'}>•</span>
                  {trialBalanceBalanced ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Discrepancy
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Navigation Tabs (Desktop) - Executive & Clean */}
          <nav
            className={`hidden md:flex items-center gap-1 p-1 rounded-xl border ${
              isLight
                ? 'bg-slate-100/90 border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            {[
              { id: 'dashboard', label: 'Dashboard', icon: PieChart },
              { id: 'journal', label: 'General Ledger', icon: BookOpen },
              { id: 'reconcile', label: 'Bank Feeds', icon: RefreshCw },
              { id: 'accounts', label: 'Chart of Accounts', icon: Landmark },
              { id: 'reports', label: 'Statements', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? isLight
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-semibold'
                        : 'bg-slate-800 text-white shadow-sm border border-slate-700 font-semibold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Day / Night Mode Switcher */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={isLight ? 'Switch to Night Mode (Dark)' : 'Switch to Day Mode (Light)'}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {isLight ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="hidden lg:inline text-[11px]">Day</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-300" />
                  <span className="hidden lg:inline text-[11px]">Night</span>
                </>
              )}
            </button>

            {/* Cloud Sync & Backup Button */}
            <button
              type="button"
              onClick={onOpenBackupModal}
              title="Cloudflare Sync & Backup"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isCloudConfigured
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isCloudConfigured ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Synced</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 opacity-60" />
                  <span className="hidden sm:inline">Backup</span>
                </>
              )}
            </button>

            {/* User Profile / Auth Gate */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 pl-1">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
                    isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-800'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center text-[10px] font-bold">
                    {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden md:inline font-medium truncate max-w-[90px]">
                    {currentUser.username || currentUser.email.split('@')[0]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign Out"
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isLight
                      ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200'
                      : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800 border-transparent hover:border-slate-700'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isLight
                    ? 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-500 shadow-md'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {/* Primary Action Button: Record Transaction */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => onOpenTransactionModal('expense')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 ${
                  isLight
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record</span>
              </button>

              {/* Hover Quick Select Menu */}
              <div
                className={`absolute right-0 mt-1 w-44 rounded-xl shadow-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-900 border-slate-800 text-slate-100'
                }`}
              >
                <button
                  onClick={() => onOpenTransactionModal('expense')}
                  className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${
                    isLight ? 'hover:bg-slate-50 text-rose-600' : 'hover:bg-slate-800/80 text-rose-400'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Expense
                </button>
                <button
                  onClick={() => onOpenTransactionModal('income')}
                  className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${
                    isLight ? 'hover:bg-slate-50 text-emerald-600' : 'hover:bg-slate-800/80 text-emerald-400'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Income
                </button>
                <button
                  onClick={() => onOpenTransactionModal('transfer')}
                  className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${
                    isLight ? 'hover:bg-slate-50 text-sky-600' : 'hover:bg-slate-800/80 text-sky-400'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Transfer
                </button>
                <div
                  className={`border-t my-1 ${
                    isLight ? 'border-slate-100' : 'border-slate-800'
                  }`}
                />
                <button
                  onClick={() => onOpenTransactionModal('journal')}
                  className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${
                    isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Journal Entry (Dr / Cr)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div
        className={`md:hidden border-t px-2 py-1.5 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}
      >
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { id: 'dashboard', label: 'Home', icon: PieChart },
            { id: 'journal', label: 'Ledger', icon: BookOpen },
            { id: 'reconcile', label: 'Feed', icon: RefreshCw },
            { id: 'accounts', label: 'Accts', icon: Landmark },
            { id: 'reports', label: 'Reports', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex flex-col items-center py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  isActive
                    ? isLight
                      ? 'text-slate-900 font-bold bg-slate-200/70'
                      : 'text-white font-bold bg-slate-800/80'
                    : isLight
                    ? 'text-slate-500'
                    : 'text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
