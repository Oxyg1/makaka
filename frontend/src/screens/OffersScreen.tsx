import { useEffect, useState, useCallback } from 'react';
import { acceptOffer, cancelOffer, confirmEscrow, declineOffer, getOffers } from '../api';
import type { AppConfig, OfferDirection } from '../types';
import FrogCard from '../components/FrogCard';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import './OffersScreen.css';

interface Props { myUserId: number | null; config: AppConfig | null; refreshKey?: number; onChanged: () => void; }

type Tab = 'in' | 'out';

export default function OffersScreen({ myUserId, config, refreshKey, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>('in');
  const [offers, setOffers] = useState<OfferDirection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOffers(await getOffers(tab)); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function act(fn: () => Promise<unknown>, success = true) {
    hapticImpact('light');
    try {
      await fn();
      if (success) hapticSuccess();
      await load();
      onChanged();
    } catch {
      hapticError();
    }
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div>
          <h1 className="screen__title">Сделки</h1>
          <p className="screen__subtitle">Входящие и исходящие офферы</p>
        </div>
      </div>

      <div className="offers__tabs">
        <button className={`offers__tab${tab === 'in' ? ' offers__tab--active' : ''}`} onClick={() => setTab('in')}>Входящие</button>
        <button className={`offers__tab${tab === 'out' ? ' offers__tab--active' : ''}`} onClick={() => setTab('out')}>Исходящие</button>
      </div>

      <div className="screen__scroll">
        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>}

        {!loading && offers.length === 0 && (
          <div className="empty">
            <div className="empty__icon">📭</div>
            <h3>Нет сделок</h3>
            <p>{tab === 'in' ? 'Никто пока не предложил вам обмен.' : 'Вы не отправляли офферов.'}</p>
          </div>
        )}

        <div className="offers__list">
          {offers.map(o => (
            <OfferCard
              key={o.id} offer={o} tab={tab} myUserId={myUserId} config={config}
              onAccept={() => act(() => acceptOffer(o.id))}
              onDecline={() => act(() => declineOffer(o.id), false)}
              onCancel={() => act(() => cancelOffer(o.id), false)}
              onConfirm={() => act(() => confirmEscrow(o.id))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer: o, tab, myUserId, config, onAccept, onDecline, onCancel, onConfirm }: {
  offer: OfferDirection; tab: Tab; myUserId: number | null; config: AppConfig | null;
  onAccept: () => void; onDecline: () => void; onCancel: () => void; onConfirm: () => void;
}) {
  const isFrom = myUserId === o.from_user_id;
  const counterparty = isFrom ? o.to_name : o.from_name;
  const counterparty_un = isFrom ? o.to_username : o.from_username;

  const myEscrowDone = isFrom ? !!o.from_escrow_at : !!o.to_escrow_at;
  const theirEscrowDone = isFrom ? !!o.to_escrow_at : !!o.from_escrow_at;

  return (
    <div className="offer-card">
      <div className="offer-card__header">
        <div className="offer-card__people">
          <div className="offer-card__avatar">{counterparty[0]?.toUpperCase()}</div>
          <div>
            <div className="offer-card__name">{counterparty}</div>
            {counterparty_un && <div className="offer-card__un">@{counterparty_un}</div>}
          </div>
        </div>
        <StatusChip status={o.status} />
      </div>

      <div className="offer-card__exchange">
        {o.from_frog_id && o.from_slug ? (
          <div className="offer-card__side">
            <div className="offer-card__side-label">{tab === 'in' ? 'Вам отдают' : 'Вы отдаёте'}</div>
            <FrogCard frog={{ id: o.from_frog_id, number: o.from_number!, model: o.from_model!, backdrop: o.from_backdrop!, pattern: o.from_pattern!, image_url: null }} size="sm" />
          </div>
        ) : (
          <div className="offer-card__side offer-card__side--stars">
            <div className="offer-card__side-label">{tab === 'in' ? 'Вам платят' : 'Вы платите'}</div>
            <div className="offer-card__stars-only">{o.stars ?? 0}⭐</div>
          </div>
        )}

        <div className="offer-card__arrow">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l4-4 4 4" /><path d="M7 5v8h10" />
            <path d="M21 15l-4 4-4-4" /><path d="M17 19v-8H7" />
          </svg>
        </div>

        <div className="offer-card__side">
          <div className="offer-card__side-label">{tab === 'in' ? 'У вас берут' : 'Вы получите'}</div>
          <FrogCard frog={{ id: o.to_frog_id, number: o.to_number, model: o.to_model, backdrop: o.to_backdrop, pattern: o.to_pattern, image_url: null }} size="sm" />
        </div>
      </div>

      {o.stars && o.from_frog_id && (
        <div className="offer-card__bonus">+ {o.stars}⭐ доплата</div>
      )}

      {o.message && <div className="offer-card__message">«{o.message}»</div>}

      {o.status === 'awaiting_escrow' && config && (
        <div className="offer-card__escrow">
          <div className="offer-card__escrow-title">Эскроу</div>
          <p className="offer-card__escrow-help">
            Передайте {isFrom && o.from_frog_id ? 'свою лягушку' : !isFrom ? 'свою лягушку' : 'звёзды'} на бот-аккаунт <b>@{config.escrow_username}</b>.
            Когда оба подтвердят — бот раздаст новым владельцам.
          </p>
          <div className="offer-card__escrow-status">
            <span className={myEscrowDone ? 'offer-card__step offer-card__step--done' : 'offer-card__step'}>
              {myEscrowDone ? '✓' : '○'} вы
            </span>
            <span className={theirEscrowDone ? 'offer-card__step offer-card__step--done' : 'offer-card__step'}>
              {theirEscrowDone ? '✓' : '○'} партнёр
            </span>
          </div>
        </div>
      )}

      <div className="offer-card__actions">
        {o.status === 'pending' && tab === 'in' && (
          <>
            <button className="btn-primary" onClick={onAccept}>Принять</button>
            <button className="btn-ghost" onClick={onDecline}>Отклонить</button>
          </>
        )}
        {o.status === 'pending' && tab === 'out' && (
          <button className="btn-ghost" onClick={onCancel}>Отозвать</button>
        )}
        {o.status === 'awaiting_escrow' && !myEscrowDone && (
          <button className="btn-primary" onClick={onConfirm}>Я передал на @{config?.escrow_username ?? 'kissedfrog'}</button>
        )}
        {o.status === 'awaiting_escrow' && myEscrowDone && !theirEscrowDone && (
          <div className="offer-card__waiting">Ждём подтверждения партнёра…</div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: OfferDirection['status'] }) {
  const map: Record<OfferDirection['status'], { label: string; cls: string }> = {
    pending: { label: 'Ожидает', cls: 'chip' },
    accepted: { label: 'Принят', cls: 'chip chip--primary' },
    awaiting_escrow: { label: 'Эскроу', cls: 'chip chip--warn' },
    declined: { label: 'Отклонён', cls: 'chip' },
    cancelled: { label: 'Отозван', cls: 'chip' },
    expired: { label: 'Просрочен', cls: 'chip' },
    completed: { label: 'Завершён', cls: 'chip chip--primary' },
  };
  const x = map[status];
  return <span className={x.cls}>{x.label}</span>;
}
