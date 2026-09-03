import React from 'react';
import { Account, AppSettings } from '../../core/types';
import { RealmWorld } from './RealmWorld';

interface MiniGamesHubProps {
  accounts: Account[];
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export const MiniGamesHub: React.FC<MiniGamesHubProps> = ({
  settings,
  onUpdateSettings,
}) => {
  return (
    <div className="space-y-6 pb-12">
      <RealmWorld
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        currencySymbol={settings.currencySymbol || '$'}
      />
    </div>
  );
};
