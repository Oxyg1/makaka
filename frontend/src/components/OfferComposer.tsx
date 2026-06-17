import { useEffect, useState } from 'react';
import type { AppConfig, Frog } from '../types';
import FrogCard from './FrogCard';
import './OfferComposer.css';

interface Props {
  toFrog: Frog;
  orderId: number | null;
  config: AppConfig | null;
  onClose: () => void;
  onSent: () => void;
  onError: (err: Error) => void;
  fetchMyInventory: () => Promise<Frog[]>;
  send: (payload: { to_frog_id: number; from_frog_id?: number | null; stars?: number | null; message?: string; order_id?: number | null }) => Promise<{ id: number }>;
}

export default function OfferComposer({ toFrog, orderId, config, onClose, onSent, onError, fetchMyInventory, send }: Props) {
  const [inventory, setInventory] = useState<Frog[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<Frog | null>(null);
  const [stars, setStars] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMyInventory()
      .then(list => setInventory(list.filter(f => !f.active_order_id)))
      .finally(() => setLoading(false));
  }, [fetchMyInventory]);

  const handleSubmit = async () => {
    if (!chosen && !stars) return;
    setSending(true);
    try {
      await send({
        to_frog_id: toFrog.id,
        from_frog_id: chosen?.id ?? null,
        stars: stars ? Number(stars) : null,
        message: message.trim() || undefined,
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
          <span className="modal-sheet__title">Предложить обмен</span>
          <button className="modal-sheet__action" onClick={handleSubmit} disabled={(!chosen && !stars) || sending}>Отпр.</button>
        </div>
        <div className="modal-sheet__scroll">
          <div className="offer-comp__target">
            <div className="offer-comp__target-label">За эту лягушку:</div>
            <div className="offer-comp__target-card">
              <FrogCard frog={toFrog} size="sm" />
            </div>
          </div>

          <div className="section-title">Ваше предложение</div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>
          ) : inventory.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              <p>Нет свободных лягушек для обмена. Можете предложить только звёзды.</p>
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

          <div className="section-title">+ Звёзды (необязательно)</div>
          <input
            className="field"
            type="number" inputMode="numeric"
            placeholder="например, 100"
            value={stars}
            onChange={e => setStars(e.target.value)}
            min={0}
          />

          <div className="section-title">Сообщение</div>
          <textarea
            className="field"
            placeholder="Опишите предложение"
            value={message} onChange={e => setMessage(e.target.value)}
            maxLength={280}
          />

          {config && (
            <p className="offer-comp__note">
              Если оба согласятся, оба отправят лягушек на <b>@{config.escrow_username}</b>, после чего бот раздаст их новым владельцам.
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            <button className="btn-primary" onClick={handleSubmit} disabled={(!chosen && !stars) || sending}>
              {sending ? 'Отправляем…' : 'Отправить оффер'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
