type TgWebApp = {
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
};

function tg(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

export function isHapticsEnabled(): boolean {
  return localStorage.getItem('haptics') !== 'false';
}

export function setHapticsEnabled(enabled: boolean): void {
  localStorage.setItem('haptics', String(enabled));
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  if (!isHapticsEnabled()) return;
  tg()?.HapticFeedback?.impactOccurred(style);
}

export function hapticSelection(): void {
  if (!isHapticsEnabled()) return;
  tg()?.HapticFeedback?.selectionChanged();
}

export function hapticSuccess(): void {
  if (!isHapticsEnabled()) return;
  tg()?.HapticFeedback?.notificationOccurred('success');
}

export function hapticError(): void {
  if (!isHapticsEnabled()) return;
  tg()?.HapticFeedback?.notificationOccurred('error');
}
