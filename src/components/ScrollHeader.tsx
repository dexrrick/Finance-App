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
  const topStickyClass =
    tabPosition === 'top'
      ? 'top-[calc(3.5rem+env(safe-area-inset-top,0px))]'
      : 'top-0';

  const safeAreaPadding =
    tabPosition === 'bottom'
      ? 'pt-[calc(0.6rem+env(safe-area-inset-top,0px))]'
      : 'pt-2.5';

  return (
    <div
      style={{
        WebkitBackdropFilter: isScrolled ? 'blur(24px) saturate(190%)' : 'none',
        backdropFilter: isScrolled ? 'blur(24px) saturate(190%)' : 'none',
      }}
      className={`sticky ${topStickyClass} z-30 transition-all duration-300 -mx-3 sm:-mx-6 px-3 sm:px-6 mb-3 ${safeAreaPadding} ${
        isScrolled
          ? isLight
            ? 'bg-[#f4f6f8]/85 border-b border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] pb-2.5'
            : 'bg-[#121824]/85 border-b border-white/10 shadow-[0_4px_25px_rgba(0,0,0,0.4)] pb-2.5'
          : 'bg-transparent border-b border-transparent pb-2'
      } ${className}`}
    >
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between max-w-5xl mx-auto transition-all duration-300 ${
        isScrolled ? 'gap-0 sm:gap-3' : 'gap-2.5 sm:gap-3'
      }`}>
        {/* Top Row on mobile, Left side on desktop: Icon + Title + Badge */}
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
              className={`font-bold tracking-tight transition-all duration-300 ${
                isScrolled
                  ? 'text-sm sm:text-base font-semibold truncate'
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

        {/* Action Buttons: Sub-row below title on mobile, right side on desktop. Smoothly collapsed when scrolled */}
        {actions && (
          <div
            className={`flex items-center gap-2 shrink-0 transition-all duration-300 ease-in-out ${
              isScrolled
                ? 'opacity-0 pointer-events-none -mt-1 max-h-0 scale-95 overflow-hidden invisible'
                : 'opacity-100 pointer-events-auto scale-100 max-h-20 visible'
            }`}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
