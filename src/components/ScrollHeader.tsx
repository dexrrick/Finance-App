import React, { useState, useEffect } from 'react';

interface ScrollHeaderProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  isLight: boolean;
  tabPosition?: 'top' | 'bottom';
  className?: string;
}

/**
 * iOS-style Collapsible Large Title Navigation Header.
 * - When at the top: Displays original large title and action buttons.
 * - When scrolled down: Pins only the main title at the top, transitions to a compact font,
 *   and hides action buttons.
 * - When scrolled back up: Smoothly returns to original title size and displays buttons.
 */
export const ScrollHeader: React.FC<ScrollHeaderProps> = ({
  title,
  icon,
  badge,
  actions,
  isLight,
  tabPosition = 'bottom',
  className = '',
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setIsScrolled(y > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate sticky top offset based on navigation bar position
  const topStickyClass = tabPosition === 'top' ? 'top-14' : 'top-0';

  return (
    <div
      className={`sticky ${topStickyClass} z-30 transition-all duration-300 -mx-3 sm:-mx-6 px-3 sm:px-6 mb-3 ${
        isScrolled
          ? isLight
            ? 'bg-[#f4f6f8]/92 border-b border-slate-200/90 shadow-xs backdrop-blur-md py-2.5'
            : 'bg-[#121824]/92 border-b border-[#263447]/90 shadow-xs backdrop-blur-md py-2.5'
          : 'bg-transparent border-b border-transparent py-2'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
        {/* Left side: Icon + Title + Badge */}
        <div className="flex items-center gap-2.5 min-w-0 transition-all duration-300">
          {icon && (
            <div
              className={`transition-all duration-300 shrink-0 ${
                isScrolled ? 'scale-85 opacity-80' : 'scale-100 opacity-100'
              }`}
            >
              {icon}
            </div>
          )}

          <div className="min-w-0 flex items-center gap-2">
            <h1
              className={`font-bold tracking-tight transition-all duration-300 truncate ${
                isScrolled
                  ? 'text-sm sm:text-base font-semibold'
                  : 'text-xl sm:text-2xl font-bold'
              } ${isLight ? 'text-slate-900' : 'text-slate-100'}`}
            >
              {title}
            </h1>

            {badge && (
              <div
                className={`transition-all duration-300 shrink-0 ${
                  isScrolled ? 'scale-90' : 'scale-100'
                }`}
              >
                {badge}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Action Buttons (Visible at top, smoothly hidden when scrolled) */}
        {actions && (
          <div
            className={`flex items-center gap-2 shrink-0 transition-all duration-300 transform ${
              isScrolled
                ? 'opacity-0 pointer-events-none scale-90 translate-x-2 invisible w-0 overflow-hidden'
                : 'opacity-100 pointer-events-auto scale-100 translate-x-0 visible'
            }`}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
