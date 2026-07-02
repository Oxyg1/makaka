// Магазин «Монет»: пакеты за Telegram Stars.
// Покупка: бэкенд создаёт инвойс (XTR) → открываем через tg.openInvoice,
// зачисление делает вебхук бота (идемпотентно), клиент просто обновляет баланс.

import { useEffect, useState } from 'react';
import { getCoinBalance, getCoinCatalog, purchaseCoins } from '../../api';
import type { CoinPack } from '../../types';
import { hapticImpact, hapticSuccess, hapticError } from '../../utils/haptics';
import { useSheetSwipe } from '../../utils/useSheetSwipe';
import Coin from './Coin';
import './games.css';

interface Props {
  onClose: () => void;
  onBalance: (n: number) => void;
}

type TgInvoice = { openInvoice?: (url: string, cb?: (status: string) => void) => void };

export default function CoinShop({ onClose, onBalance }: Props) {
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const { sheetRef, overlayRef, swipeHandlers } = useSheetSwipe(onClose);

  useEffect(() => {
    getCoinCatalog()
      .then(c => { setPacks(c.packs); setEnabled(c.payments_enabled); })
      .catch(() => setPacks([]))
      .finally(() => setLoading(false));
  }, []);

  async function buy(pack: CoinPack) {
    hapticImpact('medium');
    setBuying(pack.id); setMsg('');
    try {
      const { link } = await purchaseCoins(pack.id);
      const tg = (window as unknown as { Telegram?: { WebApp?: TgInvoice } }).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(link, async status => {
          if (status === 'paid') {
            hapticSuccess();
            setMsg('Оплата прошла! Монеты зачисляются…');
            // вебхук зачисляет за секунды — перепроверим баланс пару раз
            for (const delay of [1200, 3000, 6000]) {
              await new Promise(r => setTimeout(r, delay));
              try { onBalance((await getCoinBalance()).balance); } catch { /* ignore */ }
            }
          }
        });
      } else {
        window.open(link, '_blank');
      }
    } catch (e) {
      hapticError();
      setMsg((e as Error).message);
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet" ref={sheetRef} {...swipeHandlers}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">Магазин Монет</span>
          <span style={{ width: 60 }} />
        </div>
        <div className="modal-sheet__scroll">
          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>}

          {!loading && packs.map(p => (
            <button key={p.id} className="shop-pack" onClick={() => buy(p)} disabled={buying !== null}>
              <span className="shop-pack__coins"><Coin size={26} /> {p.coins.toLocaleString('ru-RU')} Монет</span>
              <span className="shop-pack__stars">{buying === p.id ? '…' : <>⭐ {p.stars}</>}</span>
            </button>
          ))}

          {msg && <p className="shop-note" style={{ color: 'var(--primary)' }}>{msg}</p>}
          {!enabled && !loading && (
            <p className="shop-note">Платежи ещё настраиваются — загляните позже.</p>
          )}
          <p className="shop-note">
            Оплата через Telegram Stars. Монеты — игровая валюта SWAMP: бусты в играх,
            ускорения и улучшения. Зарабатывать монеты можно и бесплатно — играя.
          </p>
        </div>
      </div>
    </div>
  );
}
