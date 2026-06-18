import { useEffect, useState } from 'react';
import type { Frog, AppConfig } from '../types';
import { getFrog, getInventory, createOffer } from '../api';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import FrogCard from './FrogCard';
import OfferComposer from './OfferComposer';
import OrderComposer from './OrderComposer';
import './FrogDetailModal.css';

interface Props {
  frogId: number;
  myUserId: number | null;
  config: AppConfig | null;
  onClose: () => void;
  onCreatedOffer?: () => void;
  onCreatedOrder?: () => void;
}

function rarityLabel(r: number | null | undefined): string {
  if (r === null || r === undefined) return '';
  return `${(r * 100).toFixed(1)}%`;
}
function rarityClass(r: number | null | undefined): string {
  if (r === null || r === undefined) return 'rarity-mark';
  if (r < 0.1) return 'rarity-mark rarity-mark--leg';
  if (r < 0.25) return 'rarity-mark rarity-mark--epic';
  if (r < 0.5) return 'rarity-mark rarity-mark--rare';
  return 'rarity-mark';
}

export default function FrogDetailModal({ frogId, myUserId, onClose, onCreatedOffer, onCreatedOrder }: Props) {
  const [frog, setFrog] = useState<Frog | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOffer, setShowOffer] = useState(false);
  const [showOrder, setShowOrder] = useState(false);

  useEffect(() => { getFrog(frogId).then(setFrog).catch(() => setFrog(null)).finally(() => setLoading(false)); }, [frogId]);

  const isMine = !!frog && frog.owner_id === myUserId;

  function openChat(username: string) {
    hapticImpact('medium');
    const url = `https://t.me/${username}`;
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">Лягушка</span>
          <span style={{ width: 60 }} />
        </div>
        <div className="modal-sheet__scroll">
          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>}
          {!loading && !frog && <div className="empty"><div className="empty__icon">🐸</div><h3>Не найдено</h3></div>}
          {frog && (
            <>
              <div className="frog-detail__hero">
                <FrogCard frog={frog} size="lg" />
              </div>
              <h2 className="frog-detail__name">{frog.model}</h2>
              <p className="frog-detail__sub">#{frog.number}</p>

              <div className="frog-detail__attrs">
                <Attr label="Модель" value={frog.model} rarity={frog.model_rarity} />
                <Attr label="Фон" value={frog.backdrop} rarity={frog.backdrop_rarity} />
                <Attr label="Узор" value={frog.pattern} rarity={frog.pattern_rarity} />
              </div>

              <div className="frog-detail__owner">
                <div className="frog-detail__owner-label">Владелец</div>
                {frog.owner_name ? (
                  <div className="frog-detail__owner-row">
                    <div className="frog-detail__avatar">{frog.owner_name[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="frog-detail__owner-name">{frog.owner_name}</div>
                      {frog.owner_un && <div className="frog-detail__owner-un">@{frog.owner_un}</div>}
                    </div>
                    {frog.owner_un && !isMine && (
                      <button className="btn-ghost frog-detail__chat-btn" onClick={() => openChat(frog.owner_un!)}>
                        Чат
                      </button>
                    )}
                  </div>
                ) : frog.owner_username ? (
                  <div className="frog-detail__owner-row">
                    <div className="frog-detail__avatar">@</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="frog-detail__owner-name">@{frog.owner_username}</div>
                      <div className="frog-detail__owner-un">Ещё не заходил в SWAMP</div>
                    </div>
                  </div>
                ) : (
                  <div className="frog-detail__owner-un">Владелец неизвестен</div>
                )}
              </div>
            </>
          )}
        </div>

        {frog && !loading && (
          <div className="modal-sheet__footer">
            {isMine ? (
              frog.active_order_id ? (
                <button className="btn-ghost" disabled>На обмене</button>
              ) : (
                <button className="btn-primary" onClick={() => { hapticImpact('light'); setShowOrder(true); }}>
                  Открыть обмен
                </button>
              )
            ) : (
              <button
                className="btn-primary"
                disabled={!frog.owner_id}
                onClick={() => { hapticImpact('light'); setShowOffer(true); }}
              >
                {frog.owner_id ? 'Предложить обмен' : 'Владелец не в SWAMP'}
              </button>
            )}
          </div>
        )}

        {frog && showOffer && frog.owner_id && (
          <OfferComposer
            toFrog={frog}
            orderId={frog.active_order_id ?? null}
            onClose={() => setShowOffer(false)}
            onSent={() => { hapticSuccess(); setShowOffer(false); onCreatedOffer?.(); onClose(); }}
            onError={() => hapticError()}
            fetchMyInventory={getInventory}
            send={createOffer}
          />
        )}
        {frog && showOrder && (
          <OrderComposer
            frog={frog}
            onClose={() => setShowOrder(false)}
            onCreated={() => { hapticSuccess(); setShowOrder(false); onCreatedOrder?.(); onClose(); }}
          />
        )}
      </div>
    </div>
  );
}

function Attr({ label, value, rarity }: { label: string; value: string; rarity?: number | null }) {
  return (
    <div className="frog-detail__attr">
      <div className="frog-detail__attr-label">{label}</div>
      <div className="frog-detail__attr-row">
        <span className="frog-detail__attr-value">{value}</span>
        {rarity !== undefined && rarity !== null && (
          <span className={rarityClass(rarity)}>{rarityLabel(rarity)}</span>
        )}
      </div>
    </div>
  );
}
