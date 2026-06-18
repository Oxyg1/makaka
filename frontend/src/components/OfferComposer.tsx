import { useEffect, useState } from 'react';
import type { Frog } from '../types';
import FrogCard from './FrogCard';
import './OfferComposer.css';

interface Props {
  toFrog: Frog;
  orderId: number | null;
  onClose: () => void;
  onSent: () => void;
  onError: (err: Error) => void;
  fetchMyInventory: () => Promise<Frog[]>;
  send: (payload: { to_frog_id: number; from_frog_id: number; message: string; order_id?: number | null }) => Promise<{ id: number }>;
}

export default function OfferComposer({ toFrog, orderId, onClose, onSent, onError, fetchMyInventory, send }: Props) {
  const [inventory, setInventory] = useState<Frog[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<Frog | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMyInventory()
      .then(list => setInventory(list.filter(f => !f.active_order_id)))
      .finally(() => setLoading(false));
  }, [fetchMyInventory]);

  const canSubmit = !!chosen && message.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      await send({
        to_frog_id: toFrog.id,
        from_frog_id: chosen!.id,
        message: message.trim(),
        order_id: orderId,
      });
      onSent();
    } catch (e) {
      onError(e as Error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Запрос на обмен</span>
          <span style={{ width: 60 }} />
        </div>
        <div className="modal-sheet__scroll">
          <div className="offer-comp__target">
            <div style={{ width: 120, flexShrink: 0 }}>
              <FrogCard frog={toFrog} size="sm" />
            </div>
            <div>
              <div className="offer-comp__target-label">Хотите получить</div>
              <div className="offer-comp__target-title">{toFrog.model}</div>
              <div className="offer-comp__target-meta">#{toFrog.number} · {toFrog.backdrop}</div>
            </div>
          </div>

          <div className="section-title">Что отдаёте</div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>
          ) : inventory.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              <p>В инвентаре нет свободных лягушек для обмена.<br />Сначала синхронизируйте инвентарь.</p>
            </div>
          ) : (
            <div className="offer-comp__grid">
              {inventory.map(f => (
                <button
                  key={f.id}
                  className={`offer-comp__pick${chosen?.id === f.id ? ' offer-comp__pick--active' : ''}`}
                  onClick={() => setChosen(chosen?.id === f.id ? null : f)}
                  type="button"
                >
                  <FrogCard frog={f} size="sm" />
                  {chosen?.id === f.id && <span className="offer-comp__pick-check">✓</span>}
                </button>
              ))}
            </div>
          )}

          <div className="section-title">Сообщение владельцу</div>
          <p className="offer-comp__hint">Без сообщения запрос почти никто не принимает. Расскажите почему именно эта лягушка вам нужна и почему вы готовы отдать свою.</p>
          <textarea
            className="field offer-comp__note"
            placeholder="Привет! Собираю сет в Lily Pad, у меня уже три. Очень не хватает твоего фона Aurora — обменяемся? Моя тоже Lily Pad, но Mint."
            value={message} onChange={e => setMessage(e.target.value)}
            maxLength={500}
          />
          <div className="offer-comp__counter">{message.length}/500</div>

          <p className="offer-comp__note-after">
            Если хозяин согласится — оба получите кнопку «Открыть чат» и договоритесь о фактической передаче в личке.
            SWAMP — это только хаб для поиска предложений, передачу делаете сами.
          </p>
        </div>
        <div className="modal-sheet__footer">
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit || sending}>
            {sending ? 'Отправляем…' : 'Отправить запрос'}
          </button>
        </div>
      </div>
    </div>
  );
}
