type TG = { HapticFeedback?: { impactOccurred: (s: string) => void; notificationOccurred: (s: string) => void; selectionChanged: () => void } };

function tg() { return (window as unknown as { Telegram?: { WebApp?: TG } }).Telegram?.WebApp; }

export function isHapticsEnabled() { return localStorage.getItem('haptics') !== 'false'; }
export function setHapticsEnabled(v: boolean) { localStorage.setItem('haptics', v ? 'true' : 'false'); }

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (isHapticsEnabled()) tg()?.HapticFeedback?.impactOccurred(style);
}
export function hapticSelection() { if (isHapticsEnabled()) tg()?.HapticFeedback?.selectionChanged(); }
export function hapticSuccess() { if (isHapticsEnabled()) tg()?.HapticFeedback?.notificationOccurred('success'); }
export function hapticError() { if (isHapticsEnabled()) tg()?.HapticFeedback?.notificationOccurred('error'); }
