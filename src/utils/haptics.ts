/**
 * Safe haptic feedback triggers for mobile devices.
 * Uses Web Vibration API when available (supported in Chrome/Android and PWAs, gracefully no-op on Safari/iOS browsers).
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' = 'light') {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    switch (type) {
      case 'selection':
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate(35);
        break;
      case 'success':
        navigator.vibrate([10, 50, 15]);
        break;
      case 'warning':
        navigator.vibrate([20, 60, 20, 60, 20]);
        break;
    }
  } catch {
    // Ignore unsupported environment
  }
}
