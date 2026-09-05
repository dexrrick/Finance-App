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
      : 'fixed bottom-0 left-0 right-0 z-40 border-t pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))]';

  // iOS Liquid Glass styling
  const glassClasses = isLight
    ? 'bg-white/85 border-slate-200/90 text-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]'
    : 'bg-[#121824]/85 border-[#263447]/90 text-slate-100 shadow-[0_-10px_35px_rgba(0,0,0,0.5)]';

  return (
    <nav
      style={{
        WebkitBackdropFilter: 'blur(24px) saturate(190%)',
        backdropFilter: 'blur(24px) saturate(190%)',
      }}
      className={`${positionClasses} ${glassClasses} transition-all duration-300`}
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
                      ? 'text-blue-600 font-semibold'
                      : 'text-sky-400 font-semibold'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? isLight
                        ? 'bg-blue-500/15 text-blue-600 scale-105 shadow-sm'
                        : 'bg-sky-500/15 text-sky-400 scale-105 shadow-[0_0_12px_rgba(56,189,248,0.25)] border border-sky-400/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 truncate max-w-full transition-colors ${
                    isActive
                      ? isLight
                        ? 'text-blue-600 font-semibold'
                        : 'text-sky-400 font-medium'
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
