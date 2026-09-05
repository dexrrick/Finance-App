import React, { useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, RefreshCw, BookOpen, X } from 'lucide-react';
import { TabPositionPreference } from '../core/types';
import { HapticsService } from '../core/haptics';

interface FloatingRecordButtonProps {
  onOpenModal: (mode: 'expense' | 'income' | 'transfer' | 'journal') => void;
  tabPosition?: TabPositionPreference;
  theme?: 'dark' | 'light';
}

export const FloatingRecordButton: React.FC<FloatingRecordButtonProps> = ({
  onOpenModal,
  tabPosition = 'bottom',
  theme = 'dark',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isLight = theme === 'light';

  // Position safely above the bottom tab bar + iOS home indicator safe area
  const containerStyle = {
    bottom:
      tabPosition === 'bottom'
        ? 'calc(5.25rem + env(safe-area-inset-bottom, 0px))'
        : 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
  };

  const handleSelect = (mode: 'expense' | 'income' | 'transfer' | 'journal') => {
    HapticsService.selection();
    setIsOpen(false);
    onOpenModal(mode);
  };

  const handleToggle = () => {
    HapticsService.impact('light');
    setIsOpen(!isOpen);
  };

  const popoverButtonClass = `flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-2xl text-xs font-semibold backdrop-blur-2xl transition-all active:scale-95 ${
    isLight
      ? 'bg-white/90 hover:bg-white text-slate-800 border-slate-200/90 shadow-[0_8px_25px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]'
      : 'bg-[#161f2e]/90 hover:bg-[#1e2a3e] text-slate-100 border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]'
  }`;

  return (
    <div
      style={containerStyle}
      className="fixed right-4 z-50 flex flex-col items-end pointer-events-none"
    >
      <div className="pointer-events-auto flex flex-col items-end">
      {/* Expanded Quick Action Popover */}
      {isOpen && (
        <div className="mb-3 flex flex-col items-end gap-2 animate-fade-in-fast gpu-layer">
          {/* Backdrop dismiss - fully transparent */}
          <div
            className="fixed inset-0 bg-transparent -z-10"
            onClick={() => setIsOpen(false)}
          />

          <button
            onClick={() => handleSelect('journal')}
            className={popoverButtonClass}
          >
            <span>Journal Entry (Dr / Cr)</span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => handleSelect('transfer')}
            className={popoverButtonClass}
          >
            <span>Transfer Funds</span>
            <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => handleSelect('income')}
            className={popoverButtonClass}
          >
            <span>Record Income</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => handleSelect('expense')}
            className={popoverButtonClass}
          >
            <span>Record Expense</span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={handleToggle}
        aria-label="Add Transaction"
        className={`w-14 h-14 rounded-full flex items-center justify-center !text-white text-white shadow-2xl transition-all duration-200 active:scale-90 ${
          isOpen
            ? 'bg-slate-800/90 border border-white/20 rotate-90 shadow-xl backdrop-blur-md'
            : 'bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 border border-white/25 shadow-[0_10px_30px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.35)]'
        }`}
      >
        {isOpen ? <X className="w-6 h-6 text-slate-300" /> : <Plus className="w-7 h-7 stroke-[2.5] !text-white text-white stroke-white" />}
      </button>
      </div>
    </div>
  );
};
