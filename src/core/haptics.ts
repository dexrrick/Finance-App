import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Safe, cross-platform haptic feedback utility.
 * Works natively on iOS & Android via Capacitor, with graceful fallback to Web Vibration API.
 */
class HapticFeedbackService {
  private isNativeAvailable: boolean = true;

  /**
   * Light selection click (ideal for tab navigation, toggle switches, segment controls)
   */
  async selection(): Promise<void> {
    try {
      if (this.isNativeAvailable) {
        await Haptics.selectionChanged();
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      this.isNativeAvailable = false;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(10);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Physical impact sensation (light, medium, heavy)
   */
  async impact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
    try {
      const capStyle =
        style === 'heavy'
          ? ImpactStyle.Heavy
          : style === 'medium'
          ? ImpactStyle.Medium
          : ImpactStyle.Light;

      await Haptics.impact({ style: capStyle });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          const ms = style === 'heavy' ? 30 : style === 'medium' ? 20 : 12;
          navigator.vibrate(ms);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Success notification pulse (saving transactions, balancing accounts)
   */
  async success(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([15, 60, 20]);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Warning / Error notification pulse
   */
  async error(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([25, 40, 25, 40, 35]);
        } catch {
          // ignore
        }
      }
    }
  }
}

export const HapticsService = new HapticFeedbackService();
