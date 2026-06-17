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

function rarityBadge(r: number | null | undefined): string {
  if (r === null || r === undefined) return '';
  const pct = (r * 100).toFixed(1);
  return `${pct}%`;
}

function rarityClass(r: number | null | undefined): string {
  if (r === null || r === undefined) return 'rarity-mark';
  if (r < 0.1) return 'rarity-mark rarity-mark--leg';
  if (r < 0.25) return 'rarity-mark rarity-mark--epic';
  if (r < 0.5) return 'rarity-mark rarity-mark--rare';
  return 'rarity-mark';
}

export default function FrogDetailModal({ frogId, myUserId, config, onClose, onCreatedOffer, onCreatedOrder }: Props) {
  const [frog, setFrog] = useState<Frog | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOffer, setShowOffer] = useState(false);
  const [showOrder, setShowOrder] = useState(false);

  useEffect(() => { getFrog(frogId).then(setFrog).catch(() => setFrog(null)).finally(() => setLoading(false)); }, [frogId]);

  const isMine = !!frog && frog.owner_id === myUserId;

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
              <div className="frog-detail__attrs">
                <Attr label="Модель" value={frog.model} rarity={frog.model_rarity} />
                <Attr label="Фон" value={frog.backdrop} rarity={frog.backdrop_rarity} />
                <Attr label="Узор" value={frog.pattern} rarity={frog.pattern_rarity} />
                <Attr label="Номер" value={`#${frog.number}`} />
              </div>
              <div className="frog-detail__owner">
                <div className="frog-detail__owner-label">Владелец</div>
                {frog.owner_name ? (
                  <div className="frog-detail__owner-row">
                    <div className="frog-detail__avatar">{frog.owner_name[0]?.toUpperCase()}</div>
                    <div>
                      <div className="frog-detail__owner-name">{frog.owner_name}</div>
                      {frog.owner_un && <div className="frog-detail__owner-un">@{frog.owner_un}</div>}
                    </div>
                  </div>
                ) : frog.owner_username ? (
                  <div className="frog-detail__owner-row">
                    <div className="frog-detail__avatar">@</div>
                    <div>
                      <div className="frog-detail__owner-name">@{frog.owner_username}</div>
                      <div className="frog-detail__owner-un">Не зарегистрирован в SWAMP</div>
                    </div>
                  </div>
                ) : (
                  <div className="frog-detail__owner-un">Владелец неизвестен</div>
                )}
              </div>

              <div className="frog-detail__actions">
                {isMine ? (
                  frog.active_order_id ? (
                    <div className="chip chip--primary">Уже на маркете</div>
                  ) : (
                    <button className="btn-primary" onClick={() => { hapticImpact('light'); setShowOrder(true); }}>
                      Выставить на маркет
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

              {showOffer && frog.owner_id && (
                <OfferComposer
                  toFrog={frog}
                  orderId={frog.active_order_id ?? null}
                  config={config}
                  onClose={() => setShowOffer(false)}
                  onSent={() => { hapticSuccess(); setShowOffer(false); onCreatedOffer?.(); onClose(); }}
                  onError={() => hapticError()}
                  fetchMyInventory={getInventory}
                  send={createOffer}
                />
              )}
              {showOrder && (
                <OrderComposer
                  frog={frog}
                  onClose={() => setShowOrder(false)}
                  onCreated={() => { hapticSuccess(); setShowOrder(false); onCreatedOrder?.(); onClose(); }}
                />
              )}
            </>
          )}
        </div>
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
          <span className={rarityClass(rarity)}>{rarityBadge(rarity)}</span>
        )}
      </div>
    </div>
  );
}
