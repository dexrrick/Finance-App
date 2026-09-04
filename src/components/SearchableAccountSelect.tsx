import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { Account, AccountCategory } from '../core/types';

interface SearchableAccountSelectProps {
  accounts: Account[];
  value: string; // account id
  onChange: (accountId: string) => void;
  placeholder?: string;
  className?: string;
  isLight?: boolean;
}

const getCategoryBadgeClass = (category: AccountCategory, isLight: boolean = false) => {
  if (isLight) {
    switch (category) {
      case 'ASSET':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'LIABILITY':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'EQUITY':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'REVENUE':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'EXPENSE':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  }

  switch (category) {
    case 'ASSET':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'LIABILITY':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'EQUITY':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'REVENUE':
      return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    case 'EXPENSE':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
};

export const SearchableAccountSelect: React.FC<SearchableAccountSelectProps> = ({
  accounts,
  value,
  onChange,
  placeholder = 'Select account...',
  className = '',
  isLight = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === value);
  }, [accounts, value]);

  // Filter accounts based on query (checks account code, name, category, subcategory)
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return accounts;

    return accounts.filter((a) => {
      return (
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.subcategory && a.subcategory.toLowerCase().includes(q))
      );
    });
  }, [accounts, searchQuery]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Reset highlight index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredAccounts]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredAccounts.length ? prev + 1 : prev));
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredAccounts[highlightedIndex]) {
        onChange(filteredAccounts[highlightedIndex].id);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-account-item]');
      const target = items[index] as HTMLElement;
      if (target) {
        target.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-0 ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all border outline-none ${
          isLight
            ? 'bg-white border-slate-300 text-slate-800 hover:border-indigo-400 focus:border-indigo-500 shadow-sm'
            : 'bg-slate-950 border-slate-700/80 text-white hover:border-slate-600 focus:border-indigo-500 shadow-inner'
        } ${isOpen ? 'border-indigo-500 ring-1 ring-indigo-500/30' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {selectedAccount ? (
            <>
              <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 shrink-0">
                {selectedAccount.code}
              </span>
              <span className="font-medium truncate">{selectedAccount.name}</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 hidden sm:inline-block ${getCategoryBadgeClass(
                  selectedAccount.category,
                  isLight
                )}`}
              >
                {selectedAccount.category}
              </span>
            </>
          ) : (
            <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          } ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-1.5 z-50 rounded-2xl shadow-2xl border backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[280px] sm:min-w-[340px] ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 shadow-slate-400/20'
              : 'bg-slate-900/98 border-slate-700 text-white shadow-black/80'
          }`}
          style={{ maxHeight: '340px' }}
        >
          {/* Search Box Header */}
          <div
            className={`p-2.5 border-b flex items-center gap-2 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <Search className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type account # or name (e.g. 5010, food)..."
              className={`w-full bg-transparent text-xs placeholder:text-slate-500 outline-none font-medium ${
                isLight ? 'text-slate-800' : 'text-white'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className={`p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Account Options List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-slate-800/20">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((acc, index) => {
                const isSelected = acc.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={acc.id}
                    type="button"
                    data-account-item
                    onClick={() => {
                      onChange(acc.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? isLight
                          ? 'bg-indigo-50 text-indigo-900 font-semibold'
                          : 'bg-indigo-950/60 text-indigo-200 font-semibold border border-indigo-500/30'
                        : isHighlighted
                        ? isLight
                          ? 'bg-slate-100 text-slate-900'
                          : 'bg-slate-800/80 text-white'
                        : isLight
                        ? 'text-slate-700 hover:bg-slate-50'
                        : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : isLight
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {acc.code}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{acc.name}</p>
                        {acc.subcategory && (
                          <p
                            className={`text-[10px] truncate ${
                              isLight ? 'text-slate-500' : 'text-slate-500'
                            }`}
                          >
                            {acc.subcategory}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getCategoryBadgeClass(
                          acc.category,
                          isLight
                        )}`}
                      >
                        {acc.category}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                <p>No matching accounts found for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-[10px] text-slate-600 mt-1">Try searching by code (e.g. 5010) or name</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
