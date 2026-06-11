import { useState } from 'react';
import { donateStars } from '../api';
import { useBalance, refreshBalance, formatStars } from '../utils/balance';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import StarIcon from './StarIcon';
import StarsModal from './StarsModal';
import Portal from './Portal';
import './SupportButton.css';

const PRESETS = [10, 50, 100, 500];

interface Props {
  recipientUserId: number;
  recipientName: string;
  context?: 'cat' | 'post';
  className?: string;
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

function splitDonation(amount: number) {
  const net = Math.round(amount * 0.7 * 10) / 10;
  return { net, commission: Math.round((amount - net) * 10) / 10 };
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
  const { net: recipientGets, commission } = splitDonation(n);
  const insufficient = balance != null && balance.balance < n;

  const handleDonate = async () => {
    if (!n || n < 1) { setError('Введите сумму'); return; }
    if (insufficient) { setNeedTopup(true); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const r = await donateStars(recipientUserId, n, `support ${context}`);
      hapticSuccess();
      setSuccess(`${recipientName} получит ${formatStars(r.received)}`);
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
    <Portal>
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet donate-sheet" ref={swipe.sheetRef}
        onTouchStart={swipe.handleTouchStart}
        onTouchMove={swipe.handleTouchMove}
        onTouchEnd={swipe.handleTouchEnd}
        onTouchCancel={swipe.handleTouchCancel}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close-btn" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Поддержать</span>
          <div style={{ width: 60 }} />
        </div>

        <div className="donate-sheet__body">
          <div className="donate-sheet__hero">
            <div className="donate-sheet__hero-icon"><StarIcon size={56} /></div>
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
              <b className="donate-sheet__break-amount">{formatStars(recipientGets)} <StarIcon size={12} /></b>
            </div>
            <div className="donate-sheet__break-row donate-sheet__break-row--muted">
              <span>Комиссия платформы (30%)</span>
              <span className="donate-sheet__break-amount">{formatStars(commission)} <StarIcon size={11} /></span>
            </div>
            <div className="donate-sheet__break-row donate-sheet__break-row--total">
              <span>Спишется с баланса</span>
              <b className="donate-sheet__break-amount">{n} <StarIcon size={13} /></b>
            </div>
            <div className="donate-sheet__balance">
              <span>Ваш баланс: <b>{formatStars(balance?.balance ?? 0)}</b></span>
              {insufficient && <span className="donate-sheet__balance-warn">не хватает {formatStars(n - (balance?.balance ?? 0))}</span>}
            </div>
          </div>

          {error && <p className="stars-modal__error">{error}</p>}
          {success && <p className="stars-modal__success">{success}</p>}

          <button className="stars-modal__primary" onClick={handleDonate} disabled={loading || !amount}>
            <span className="stars-modal__primary-content">
              {loading ? '...' : insufficient ? 'Пополнить и отправить' : <>Отправить <b>{n}</b><StarIcon size={15} /></>}
            </span>
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
