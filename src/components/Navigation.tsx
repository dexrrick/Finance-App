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

  // Position classes: Top or Bottom with safe-area insets
  const positionClasses =
    tabPosition === 'top'
      ? 'sticky top-0 z-40 border-b pt-[env(safe-area-inset-top,0px)] shadow-md'
      : 'fixed bottom-0 left-0 right-0 z-40 border-t pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_30px_rgba(0,0,0,0.35)]';

  // iOS Liquid Glass styling
  const glassClasses = isLight
    ? 'bg-white/70 border-black/[0.06] text-slate-800 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/60 before:via-black/15'
    : 'bg-[#080c14]/70 border-white/[0.08] text-slate-100 backdrop-blur-2xl supports-[backdrop-filter]:bg-[#080c14]/65 before:via-white/20';

  return (
    <nav
      className={`${positionClasses} ${glassClasses} relative transition-all duration-300 before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:to-transparent`}
    >
      <div className="max-w-xl mx-auto px-2 pt-1.5 pb-0.5">
        <div
          className="flex items-center justify-around"
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
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 active:scale-90 ${
                  isActive
                    ? isLight
                      ? 'text-indigo-600 font-semibold'
                      : 'text-white font-semibold'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? isLight
                        ? 'bg-indigo-500/15 text-indigo-600 scale-105 shadow-sm'
                        : 'bg-white/[0.12] text-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.15)] border border-white/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 truncate max-w-full transition-colors ${
                    isActive
                      ? isLight
                        ? 'text-indigo-600 font-semibold'
                        : 'text-white font-medium'
                      : isLight
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
                {isActive && (
                  <span
                    className={`absolute bottom-0 w-1 h-1 rounded-full ${
                      isLight ? 'bg-indigo-600' : 'bg-indigo-400 shadow-[0_0_6px_#818cf8]'
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
