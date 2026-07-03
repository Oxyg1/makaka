// Магазин «Монет»: пакеты за Telegram Stars + произвольная сумма (1⭐ = 1 монета).
// Покупка: бэкенд создаёт инвойс (XTR) → открываем через tg.openInvoice,
// зачисление делает вебхук бота (идемпотентно), клиент просто обновляет баланс.

import { useEffect, useState } from 'react';
import { getCoinBalance, getCoinCatalog, purchaseCoins, purchaseCoinsCustom } from '../../api';
import type { CoinPack } from '../../types';
import { hapticImpact, hapticSuccess, hapticError } from '../../utils/haptics';
import { useSheetSwipe } from '../../utils/useSheetSwipe';
import Coin, { Star } from './Coin';
import './games.css';

interface Props {
  onClose: () => void;
  onBalance: (n: number) => void;
}

type TgInvoice = { openInvoice?: (url: string, cb?: (status: string) => void) => void };

export default function CoinShop({ onClose, onBalance }: Props) {
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [custom, setCustom] = useState<{ min: number; max: number }>({ min: 50, max: 100000 });
  const [customVal, setCustomVal] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const { sheetRef, overlayRef, swipeHandlers } = useSheetSwipe(onClose);

  useEffect(() => {
    getCoinCatalog()
      .then(c => {
        setPacks(c.packs);
        setEnabled(c.payments_enabled);
        if (c.custom) setCustom(c.custom);
      })
      .catch(() => setPacks([]))
      .finally(() => setLoading(false));
  }, []);

  async function openInvoice(link: string) {
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
  }

  async function buy(pack: CoinPack) {
    hapticImpact('medium');
    setBuying(pack.id); setMsg('');
    try {
      const { link } = await purchaseCoins(pack.id);
      await openInvoice(link);
    } catch (e) {
      hapticError();
      setMsg((e as Error).message);
    } finally {
      setBuying(null);
    }
  }

  async function buyCustom() {
    const n = Math.floor(Number(customVal));
    if (!Number.isFinite(n) || n < custom.min || n > custom.max) {
      hapticError();
      setMsg(`Введите сумму от ${custom.min} до ${custom.max.toLocaleString('ru-RU')}`);
      return;
    }
    hapticImpact('medium');
    setBuying('custom'); setMsg('');
    try {
      const { link } = await purchaseCoinsCustom(n);
      await openInvoice(link);
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

          {!loading && packs.map(p => {
            // скидка: насколько дешевле, чем базовый курс 1⭐ = 1 монета
            const discount = Math.round((1 - p.stars / p.coins) * 100);
            return (
              <button key={p.id} className="shop-pack" onClick={() => buy(p)} disabled={buying !== null}>
                <span className="shop-pack__coins">
                  <Coin size={26} /> {p.coins.toLocaleString('ru-RU')}
                  {discount > 0 && <span className="shop-pack__bonus">−{discount}%</span>}
                </span>
                <span className="shop-pack__stars">{buying === p.id ? '…' : <><Star size={15} /> {p.stars.toLocaleString('ru-RU')}</>}</span>
              </button>
            );
          })}

          {!loading && (
            <div className="shop-custom">
              <div className="shop-custom__label">Своя сумма · 1 <Star size={12} /> = 1 <Coin size={12} /></div>
              <div className="shop-custom__row">
                <input
                  className="field"
                  type="number"
                  inputMode="numeric"
                  placeholder={`от ${custom.min} монет`}
                  min={custom.min}
                  max={custom.max}
                  value={customVal}
                  onChange={e => setCustomVal(e.target.value)}
                />
                <button
                  className="shop-custom__buy"
                  onClick={buyCustom}
                  disabled={buying !== null || !customVal.trim()}
                >
                  {buying === 'custom' ? '…' : <><Star size={14} /> {Number(customVal) > 0 ? Math.floor(Number(customVal)).toLocaleString('ru-RU') : 'Купить'}</>}
                </button>
              </div>
            </div>
          )}

          {msg && <p className="shop-note" style={{ color: 'var(--primary)' }}>{msg}</p>}
          {!enabled && !loading && (
            <p className="shop-note">Платежи ещё настраиваются — загляните позже.</p>
          )}
          <p className="shop-note">
            Оплата через Telegram Stars. Монеты — игровая валюта SWAMP: бусты,
            ускорения и улучшения в играх. Зарабатывать монеты можно и бесплатно — играя.
          </p>
        </div>
      </div>
    </div>
  );
}
