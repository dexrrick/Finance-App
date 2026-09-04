import React, { useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, RefreshCw, BookOpen, X } from 'lucide-react';
import { TabPositionPreference } from '../core/types';

interface FloatingRecordButtonProps {
  onOpenModal: (mode: 'expense' | 'income' | 'transfer' | 'journal') => void;
  tabPosition?: TabPositionPreference;
}

export const FloatingRecordButton: React.FC<FloatingRecordButtonProps> = ({
  onOpenModal,
  tabPosition = 'bottom',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Position safely above the bottom tab bar + iOS home indicator safe area
  const containerStyle = {
    bottom:
      tabPosition === 'bottom'
        ? 'calc(5.25rem + env(safe-area-inset-bottom, 0px))'
        : 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
  };

  const handleSelect = (mode: 'expense' | 'income' | 'transfer' | 'journal') => {
    setIsOpen(false);
    onOpenModal(mode);
  };

  return (
    <div
      style={containerStyle}
      className="fixed right-4 z-50 flex flex-col items-end pointer-events-none"
    >
      <div className="pointer-events-auto flex flex-col items-end">
      {/* Expanded Quick Action Popover */}
      {isOpen && (
        <div className="mb-3 flex flex-col items-end gap-2 animate-fade-in">
          {/* Backdrop dismiss */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs -z-10"
            onClick={() => setIsOpen(false)}
          />

          <button
            onClick={() => handleSelect('journal')}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-800/95 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
          >
            <span>Journal Entry (Dr / Cr)</span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => handleSelect('transfer')}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-800/95 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
          >
            <span>Transfer Funds</span>
            <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => handleSelect('income')}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-800/95 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
          >
            <span>Record Income</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => handleSelect('expense')}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-800/95 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
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
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Add Transaction"
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-200 active:scale-90 ${
          isOpen
            ? 'bg-slate-800 border-2 border-slate-600 rotate-90'
            : 'bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/40'
        }`}
      >
        {isOpen ? <X className="w-6 h-6 text-slate-300" /> : <Plus className="w-7 h-7 stroke-[2.5]" />}
      </button>
      </div>
    </div>
  );
};
