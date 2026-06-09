import { useEffect, useState } from 'react';
import { topupStars, withdrawStars } from '../api';
import { useBalance, refreshBalance, openStarInvoice } from '../utils/balance';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import StarIcon from './StarIcon';
import './StarsModal.css';

const PACKAGES = [50, 100, 250, 500, 1000, 2500];

type Tab = 'topup' | 'withdraw';

interface Props { onClose: () => void; }

export default function StarsModal({ onClose }: Props) {
  const { balance } = useBalance();
  const [tab, setTab] = useState<Tab>('topup');
  const [amount, setAmount] = useState<string>('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const swipe = useSheetSwipe(onClose);

  useEffect(() => { refreshBalance(); }, []);

  const setPreset = (n: number) => { hapticImpact('light'); setAmount(String(n)); setError(null); setSuccess(null); };
  const switchTab = (t: Tab) => { setTab(t); setError(null); setSuccess(null); setAmount(t === 'topup' ? '100' : '100'); };

  const handleTopup = async () => {
    const n = parseInt(amount, 10);
    if (!n || n < 1) { setError('Введите сумму'); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const { invoiceLink } = await topupStars(n);
      openStarInvoice(invoiceLink, status => {
        if (status === 'paid') {
          hapticSuccess();
          setSuccess(`Баланс пополнен на ${n} ⭐`);
          refreshBalance();
        } else if (status === 'cancelled') {
          setError('Платёж отменён');
        } else if (status === 'failed') {
          setError('Платёж не прошёл');
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
      hapticError();
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    const n = parseInt(amount, 10);
    if (!n || n < 100) { setError('Минимум 100 ⭐'); return; }
    if (balance && balance.balance < n) { setError('Недостаточно баланса'); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const r = await withdrawStars(n);
      hapticSuccess();
      setSuccess(`Заявка #${r.requestId} отправлена. Звёзды поступят после одобрения админом.`);
      refreshBalance();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      let parsed = msg;
      try { parsed = (JSON.parse(msg) as { error?: string }).error ?? msg; } catch { /* not json */ }
      setError(parsed);
      hapticError();
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet stars-modal" ref={swipe.sheetRef}
        onTouchStart={swipe.handleTouchStart}
        onTouchMove={swipe.handleTouchMove}
        onTouchEnd={swipe.handleTouchEnd}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close-btn" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">Звёзды</span>
          <div style={{ width: 60 }} />
        </div>

        <div className="stars-modal__body">
          {/* Balance card */}
          <div className="stars-balance-card">
            <div className="stars-balance-card__label">Ваш баланс</div>
            <div className="stars-balance-card__value">
              <StarIcon size={28} />
              <span>{balance?.balance ?? 0}</span>
            </div>
            {balance && (balance.total_received > 0 || balance.total_spent > 0) && (
              <div className="stars-balance-card__meta">
                <span>Получено: <b>{balance.total_received}</b> ⭐</span>
                <span>Потрачено: <b>{balance.total_spent}</b> ⭐</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="stars-modal__seg">
            <button className={`stars-modal__seg-btn${tab === 'topup' ? ' stars-modal__seg-btn--active' : ''}`} onClick={() => switchTab('topup')}>Пополнить</button>
            <button className={`stars-modal__seg-btn${tab === 'withdraw' ? ' stars-modal__seg-btn--active' : ''}`} onClick={() => switchTab('withdraw')}>Вывести</button>
          </div>

          {tab === 'topup' && (
            <>
              <div className="stars-modal__presets">
                {PACKAGES.map(n => (
                  <button key={n}
                    className={`stars-preset${parseInt(amount, 10) === n ? ' stars-preset--active' : ''}`}
                    onClick={() => setPreset(n)}>
                    <StarIcon size={14} />
                    <span>{n}</span>
                  </button>
                ))}
              </div>
              <label className="stars-modal__field">
                <span>Своя сумма</span>
                <div className="stars-modal__input-wrap">
                  <StarIcon size={16} />
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={e => { setAmount(e.target.value.replace(/\D/g, '')); setError(null); setSuccess(null); }}
                    maxLength={6}
                  />
                </div>
              </label>
              {error && <p className="stars-modal__error">{error}</p>}
              {success && <p className="stars-modal__success">{success}</p>}
              <button className="stars-modal__primary" onClick={handleTopup} disabled={loading || !amount}>
                {loading ? '...' : `Пополнить на ${amount || 0} ⭐`}
              </button>
              <p className="stars-modal__hint">1 ⭐ = 1 единица баланса. Оплата происходит реальными Telegram Stars.</p>
            </>
          )}

          {tab === 'withdraw' && (
            <>
              <label className="stars-modal__field">
                <span>Сумма к выводу</span>
                <div className="stars-modal__input-wrap">
                  <StarIcon size={16} />
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={e => { setAmount(e.target.value.replace(/\D/g, '')); setError(null); setSuccess(null); }}
                    maxLength={6}
                  />
                </div>
              </label>
              <p className="stars-modal__hint">Минимум 100 ⭐. После подтверждения админом звёзды поступят в ваш аккаунт Telegram.</p>
              {error && <p className="stars-modal__error">{error}</p>}
              {success && <p className="stars-modal__success">{success}</p>}
              <button className="stars-modal__primary stars-modal__primary--withdraw" onClick={handleWithdraw} disabled={loading || !amount}>
                {loading ? '...' : 'Отправить заявку'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
