import { useState } from 'react';
import { donateStars } from '../api';
import { useBalance, refreshBalance } from '../utils/balance';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import StarIcon from './StarIcon';
import StarsModal from './StarsModal';
import './SupportButton.css';

const PRESETS = [10, 50, 100, 500];

interface Props {
  recipientUserId: number;
  recipientName: string;
  context?: 'cat' | 'post';
  className?: string;
  /** Optional click intercept (e.g. to stop propagation on overlay buttons). */
  onActivate?: () => void;
}

export default function SupportButton({ recipientUserId, recipientName, context = 'cat', className, onActivate }: Props) {
  const [open, setOpen] = useState(false);

  const handle = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onActivate?.();
    hapticImpact('light');
    setOpen(true);
  };

  return (
    <>
      <button className={`support-btn${className ? ` ${className}` : ''}`} onClick={handle} aria-label="Поддержать">
        <StarIcon size={14} />
        <span>Поддержать</span>
      </button>
      {open && (
        <DonateSheet
          recipientUserId={recipientUserId}
          recipientName={recipientName}
          context={context}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DonateSheet({ recipientUserId, recipientName, context, onClose }: {
  recipientUserId: number; recipientName: string; context: 'cat' | 'post'; onClose: () => void;
}) {
  const { balance } = useBalance();
  const [amount, setAmount] = useState<string>('50');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needTopup, setNeedTopup] = useState(false);
  const swipe = useSheetSwipe(onClose);

  const n = parseInt(amount, 10) || 0;
  const recipientGets = Math.floor(n * 0.7);
  const commission = n - recipientGets;
  const insufficient = balance != null && balance.balance < n;

  const handleDonate = async () => {
    if (!n || n < 1) { setError('Введите сумму'); return; }
    if (insufficient) { setNeedTopup(true); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const r = await donateStars(recipientUserId, n, `support ${context}`);
      hapticSuccess();
      setSuccess(`${recipientName} получит ${r.received} ⭐`);
      refreshBalance();
      setTimeout(onClose, 1400);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      let parsed = msg;
      try { parsed = (JSON.parse(msg) as { error?: string }).error ?? msg; } catch { /* not json */ }
      setError(parsed);
      hapticError();
    }
    setLoading(false);
  };

  if (needTopup) {
    return <StarsModal onClose={() => { setNeedTopup(false); onClose(); }} />;
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet donate-sheet" ref={swipe.sheetRef}
        onTouchStart={swipe.handleTouchStart}
        onTouchMove={swipe.handleTouchMove}
        onTouchEnd={swipe.handleTouchEnd}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close-btn" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Поддержать</span>
          <div style={{ width: 60 }} />
        </div>

        <div className="donate-sheet__body">
          <div className="donate-sheet__hero">
            <div className="donate-sheet__hero-icon"><StarIcon size={40} /></div>
            <h3 className="donate-sheet__title">Поддержать {recipientName}</h3>
            <p className="donate-sheet__subtitle">Отправьте звёзды владельцу {context === 'cat' ? 'кота' : 'поста'}</p>
          </div>

          <div className="donate-sheet__presets">
            {PRESETS.map(p => (
              <button key={p}
                className={`stars-preset${n === p ? ' stars-preset--active' : ''}`}
                onClick={() => { hapticImpact('light'); setAmount(String(p)); setError(null); }}>
                <StarIcon size={14} />{p}
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

          <div className="donate-sheet__breakdown">
            <div className="donate-sheet__break-row">
              <span>Получит {recipientName}</span>
              <b>{recipientGets} ⭐</b>
            </div>
            <div className="donate-sheet__break-row donate-sheet__break-row--muted">
              <span>Комиссия платформы (30%)</span>
              <span>{commission} ⭐</span>
            </div>
            <div className="donate-sheet__break-row donate-sheet__break-row--total">
              <span>Спишется с баланса</span>
              <b>{n} ⭐</b>
            </div>
            <div className="donate-sheet__balance">
              <span>Ваш баланс: <b>{balance?.balance ?? 0} ⭐</b></span>
              {insufficient && <span className="donate-sheet__balance-warn">не хватает {n - (balance?.balance ?? 0)} ⭐</span>}
            </div>
          </div>

          {error && <p className="stars-modal__error">{error}</p>}
          {success && <p className="stars-modal__success">{success}</p>}

          <button className="stars-modal__primary" onClick={handleDonate} disabled={loading || !amount}>
            {loading ? '...' : insufficient ? 'Пополнить и отправить' : `Отправить ${n} ⭐`}
          </button>
        </div>
      </div>
    </div>
  );
}
