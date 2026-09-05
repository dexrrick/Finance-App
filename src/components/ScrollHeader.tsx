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
      setIsScrolled(y > 30);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate sticky top offset based on navigation bar position
  const topStickyClass =
    tabPosition === 'top'
      ? 'top-[calc(3.5rem+env(safe-area-inset-top,0px))]'
      : 'top-0';

  const safeAreaPadding =
    tabPosition === 'bottom'
      ? 'pt-[calc(0.45rem+env(safe-area-inset-top,0px))]'
      : 'pt-2';

  return (
    <div className={`mb-3 ${className}`}>
      {/* Pinned Sticky Header Bar: Constant height with zero layout-shift or stutter */}
      <div
        style={{
          WebkitBackdropFilter: isScrolled ? 'blur(28px) saturate(200%)' : 'none',
          backdropFilter: isScrolled ? 'blur(28px) saturate(200%)' : 'none',
        }}
        className={`sticky ${topStickyClass} z-30 transition-[background-color,border-color,box-shadow] duration-200 -mx-3 sm:-mx-6 px-3 sm:px-6 ${safeAreaPadding} ${
          isScrolled
            ? isLight
              ? 'bg-[#f4f6f8]/85 border-b border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] pb-2.5'
              : 'bg-[#121824]/85 border-b border-white/10 shadow-[0_4px_25px_rgba(0,0,0,0.4)] pb-2.5'
            : 'bg-transparent border-b border-transparent pb-1'
        }`}
      >
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto h-9">
          {/* Main Title & Icon */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 transition-all duration-200">
            {icon && (
              <div
                className={`transition-transform duration-200 shrink-0 ${
                  isScrolled ? 'scale-85 opacity-80' : 'scale-100 opacity-100'
                }`}
              >
                {icon}
              </div>
            )}

            <div className="min-w-0 flex items-center gap-2 flex-1">
              <h1
                className={`font-bold tracking-tight transition-all duration-200 truncate ${
                  isScrolled
                    ? 'text-sm sm:text-base font-semibold'
                    : 'text-xl sm:text-2xl font-bold'
                } ${isLight ? 'text-slate-900' : 'text-slate-100'}`}
              >
                {title}
              </h1>

              {badge && (
                <div
                  className={`transition-transform duration-200 shrink-0 ${
                    isScrolled ? 'scale-90' : 'scale-100'
                  }`}
                >
                  {badge}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Actions: Side-by-side with title on sm+ screens */}
          {actions && (
            <div
              className={`hidden sm:flex items-center gap-2 shrink-0 transition-opacity duration-200 ${
                isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
              }`}
            >
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Actions: Rendered directly below the title in normal scroll flow.
          Naturally scrolls off-screen without any height collapse or layout jitter */}
      {actions && (
        <div className="sm:hidden pt-2 pb-0.5 flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};
