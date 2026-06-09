import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getBalance, type Balance } from '../api';

/** Format a star amount: integer as-is, fractional with up to 1 decimal. */
export function formatStars(n: number | null | undefined): string {
  if (n == null) return '0';
  if (Number.isInteger(n)) return n.toString();
  return (Math.round(n * 10) / 10).toFixed(1);
}

let current: Balance | null = null;
const subs = new Set<() => void>();
let inFlight: Promise<Balance> | null = null;

function notify() { subs.forEach(fn => fn()); }

export function setBalance(b: Balance) {
  current = b;
  notify();
}

export async function refreshBalance(): Promise<Balance | null> {
  if (inFlight) return inFlight;
  inFlight = getBalance().then(b => { setBalance(b); return b; }).catch(() => null as unknown as Balance).finally(() => { inFlight = null; });
  return inFlight;
}

export function useBalance(): { balance: Balance | null; refresh: () => Promise<Balance | null> } {
  const subscribe = useCallback((cb: () => void) => { subs.add(cb); return () => subs.delete(cb); }, []);
  const get = () => current;
  const b = useSyncExternalStore(subscribe, get, get);
  useEffect(() => { if (!current) refreshBalance(); }, []);
  return { balance: b, refresh: refreshBalance };
}

type TgWebApp = {
  openInvoice?: (url: string, cb?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
  openLink?: (url: string) => void;
};

export function openStarInvoice(invoiceLink: string, onDone?: (status: string) => void) {
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  if (tg?.openInvoice) {
    tg.openInvoice(invoiceLink, status => {
      if (status === 'paid') refreshBalance();
      onDone?.(status);
    });
  } else if (tg?.openLink) {
    tg.openLink(invoiceLink);
  } else {
    window.open(invoiceLink, '_blank');
  }
}
