import React from 'react';
import {
  BookOpen,
  PieChart,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Settings as SettingsIcon,
} from 'lucide-react';
import { AppSettings, NavTabId } from '../core/types';
import { HapticsService } from '../core/haptics';

export type ActiveTab = NavTabId;

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  settings: AppSettings;
}

const TAB_ICONS: Record<NavTabId, React.ElementType> = {
  dashboard: PieChart,
  journal: BookOpen,
  reconcile: RefreshCw,
  accounts: Landmark,
  reports: ShieldCheck,
  settings: SettingsIcon,
};

const TAB_SHORT_LABELS: Record<NavTabId, string> = {
  dashboard: 'Home',
  journal: 'Ledger',
  reconcile: 'Feeds',
  accounts: 'Accounts',
  reports: 'Reports',
  settings: 'Settings',
};

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  settings,
}) => {
  const isLight = settings.theme === 'light';
  const tabPosition = settings.tabPosition || 'bottom';

  // Determine which tabs to render based on user configuration
  const configuredTabs = settings.tabConfig || [
    { id: 'dashboard', label: 'Dashboard', enabled: true },
    { id: 'journal', label: 'General Ledger', enabled: true },
    { id: 'reconcile', label: 'Bank Feeds', enabled: true },
    { id: 'accounts', label: 'Accounts', enabled: true },
    { id: 'reports', label: 'Reports', enabled: true },
    { id: 'settings', label: 'Settings', enabled: true },
  ];

  // Only render enabled tabs
  const visibleTabs = configuredTabs.filter((t) => t.enabled);

  // Floating Pill navigation geometry
  const isTop = tabPosition === 'top';
  const containerClasses = isTop
    ? 'sticky top-0 z-40 pt-[calc(0.4rem+env(safe-area-inset-top,0px))] pb-1 px-3 sm:px-4 flex justify-center pointer-events-none'
    : 'fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 flex justify-center px-3 sm:px-4 pointer-events-none';

  // Apple Music & TV Floating Liquid Glass Pill Material
  const glassClasses = isLight
    ? 'bg-white/80 border-slate-200/90 text-slate-800 shadow-[0_12px_36px_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.9)]'
    : 'bg-[#121824]/80 border-white/15 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.2)]';

  return (
    <nav className={`${containerClasses} transition-all duration-300`}>
      <div
        style={{
          WebkitBackdropFilter: 'blur(30px) saturate(210%)',
          backdropFilter: 'blur(30px) saturate(210%)',
        }}
        className={`pointer-events-auto max-w-lg w-full rounded-full border px-2 py-1.5 ${glassClasses} transition-all duration-300`}
      >
        <div
          className="flex items-center justify-around w-full"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleTabs.map((tab) => {
            const Icon = TAB_ICONS[tab.id] || PieChart;
            const isActive = activeTab === tab.id;
            const label = TAB_SHORT_LABELS[tab.id] || tab.label;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  HapticsService.selection();
                  setActiveTab(tab.id);
                }}
                className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-90 ${
                  isActive
                    ? isLight
                      ? 'text-blue-600 font-semibold'
                      : 'text-sky-300 font-semibold'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-full transition-all duration-200 ${
                    isActive
                      ? isLight
                        ? 'bg-blue-600/15 text-blue-600 scale-105 shadow-xs border border-blue-500/20'
                        : 'bg-sky-500/20 text-sky-300 scale-105 shadow-[0_0_14px_rgba(56,189,248,0.35)] border border-sky-400/40'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <span
                  className={`text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 truncate max-w-full transition-colors ${
                    isActive
                      ? isLight
                        ? 'text-blue-600 font-semibold'
                        : 'text-sky-300 font-semibold'
                      : isLight
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
                {isActive && (
                  <span
                    className={`absolute bottom-0 w-1.5 h-0.5 rounded-full ${
                      isLight ? 'bg-blue-600' : 'bg-sky-400 shadow-[0_0_6px_#38bdf8]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
