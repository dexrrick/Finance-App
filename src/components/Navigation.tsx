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

  // If tabPosition is top, attach to top with safe-area-inset-top
  // If tabPosition is bottom, attach to bottom with safe-area-inset-bottom
  const positionClasses =
    tabPosition === 'top'
      ? 'sticky top-0 z-40 border-b pt-[env(safe-area-inset-top,0px)] shadow-md'
      : 'fixed bottom-0 left-0 right-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(0,0,0,0.3)]';

  return (
    <nav
      className={`${positionClasses} transition-all duration-200 ${
        isLight
          ? 'bg-white/95 border-slate-200/90 text-slate-800 backdrop-blur-md'
          : 'bg-slate-900/95 border-slate-800/90 text-slate-100 backdrop-blur-md'
      }`}
    >
      <div className="max-w-xl mx-auto px-2 py-1.5">
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
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 active:scale-95 ${
                  isActive
                    ? isLight
                      ? 'text-indigo-600 font-bold'
                      : 'text-indigo-400 font-bold'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-all ${
                    isActive
                      ? isLight
                        ? 'bg-indigo-50 text-indigo-600 scale-110'
                        : 'bg-indigo-600/20 text-indigo-400 scale-110 shadow-sm'
                      : ''
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
