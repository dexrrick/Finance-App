import { useEffect } from 'react';

/**
 * Custom hook to lock/suspend background body scrolling when a modal or window is open in front.
 * Restores original overflow and touch-action upon unmount or when lock is released.
 */
export function useScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isLocked]);
}
