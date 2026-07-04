import { useEffect, useState } from 'react';
import { TonConnectUIProvider, useTonConnectUI } from '@tonconnect/ui-react';
import { getWalletChallenge, getLinkedWallets, linkWallet, unlinkWallet } from '../api';
import { hapticSuccess, hapticError, hapticImpact } from '../utils/haptics';
import './WalletLink.css';

const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

function shortAddr(a: string): string {
  const tail = a.includes(':') ? a.split(':')[1] : a;
  return tail.length > 10 ? `${tail.slice(0, 4)}…${tail.slice(-4)}` : tail;
}

// Провайдер живёт здесь же (а не в main.tsx): весь @tonconnect/ui-react
// подгружается lazy-чанком только когда открыт Профиль.
export default function WalletLink() {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <WalletLinkInner />
    </TonConnectUIProvider>
  );
}

function WalletLinkInner() {
  const [tonConnectUI] = useTonConnectUI();
  const [linked, setLinked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    getLinkedWallets().then(rows => setLinked(rows.map(r => r.address))).catch(() => {});
  }, []);

  // когда кошелёк подключился с ton_proof — отправляем на бэкенд
  useEffect(() => {
    const unsub = tonConnectUI.onStatusChange(async w => {
      const tp = w?.connectItems?.tonProof;
      if (!w || !tp || !('proof' in tp)) return;
      setBusy(true); setMsg(''); setErr(false);
      try {
        const r = await linkWallet({
          address: w.account.address,
          public_key: w.account.publicKey,
          wallet_state_init: w.account.walletStateInit,
          proof: tp.proof,
        });
        setLinked(l => Array.from(new Set([...l, r.address])));
        hapticSuccess(); setMsg('Кошелёк привязан ✓');
      } catch (e) {
        setMsg((e as Error).message); setErr(true); hapticError();
      } finally {
        setBusy(false);
      }
    });
    return () => unsub();
  }, [tonConnectUI]);

  async function connect() {
    hapticImpact('light');
    setMsg(''); setErr(false);
    try {
      if (tonConnectUI.connected) await tonConnectUI.disconnect();
      const { payload } = await getWalletChallenge();
      tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: payload } });
      await tonConnectUI.openModal();
    } catch (e) {
      setMsg((e as Error).message); setErr(true);
    }
  }

  async function remove(addr: string) {
    hapticImpact('light');
    try { await unlinkWallet(addr); setLinked(l => l.filter(a => a !== addr)); }
    catch { /* ignore */ }
  }

  return (
    <div className="wallet-link">
      {linked.map(a => (
        <div key={a} className="wallet-link__row">
          <span className="wallet-link__icon">👛</span>
          <span className="wallet-link__addr">{shortAddr(a)}</span>
          <button className="wallet-link__remove" onClick={() => remove(a)} aria-label="Отвязать">×</button>
        </div>
      ))}
      <button className="btn-ghost" onClick={connect} disabled={busy} style={{ width: '100%' }}>
        {busy ? 'Проверяем…' : linked.length ? 'Привязать ещё кошелёк' : 'Привязать кошелёк (TON)'}
      </button>
      {msg && <div className={err ? 'wallet-link__msg wallet-link__msg--err' : 'wallet-link__msg'}>{msg}</div>}
      <p className="wallet-link__hint">Подтвердите владение подписью — жабки с кошелька попадут в инвентарь, а в топе холдеров будет ваш профиль.</p>
    </div>
  );
}
