import { useEffect, useState, useCallback } from 'react';
import { acceptOffer, cancelOffer, declineOffer, getOffers } from '../api';
import type { OfferDirection } from '../types';
import FrogCard from '../components/FrogCard';
import { SkelCard } from '../components/Skeleton';
import { hapticImpact, hapticSuccess, hapticError, hapticSelection } from '../utils/haptics';
import './TradesScreen.css';

interface Props {
  myUserId: number | null;
  refreshKey?: number;
  onChanged: () => void;
  /** внутри таба «Трейд»: без своего заголовка и нижнего отступа */
  embedded?: boolean;
}

type Tab = 'in' | 'out';

export default function TradesScreen({ myUserId, refreshKey, onChanged, embedded }: Props) {
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
    try { await fn(); if (success) hapticSuccess(); await load(); onChanged(); }
    catch { hapticError(); }
  }

  return (
    <div className={`screen${embedded ? ' screen--embedded' : ''}`}>
      <header className="trades__header">
        {!embedded && <h1 className="screen__title">Сделки</h1>}
        <p className="screen__subtitle">Запросы на обмен — входящие и исходящие</p>
        <div className="trades__tabs seg" style={{ '--seg-idx': tab === 'in' ? 0 : 1, '--seg-n': 2 } as React.CSSProperties}>
          <span className="seg__indicator" />
          <button className={`trades__tab seg__btn${tab === 'in' ? ' seg__btn--active' : ''}`} onClick={() => { hapticSelection(); setTab('in'); }}>Входящие</button>
          <button className={`trades__tab seg__btn${tab === 'out' ? ' seg__btn--active' : ''}`} onClick={() => { hapticSelection(); setTab('out'); }}>Исходящие</button>
        </div>
      </header>

      <div className="screen__scroll">
        {loading && (
          <div className="trades__list" style={{ paddingTop: 8 }}>
            <SkelCard height={190} /><SkelCard height={190} /><SkelCard height={190} />
          </div>
        )}

        {!loading && offers.length === 0 && (
          <div className="empty">
            <div className="empty__icon">📭</div>
            <h3>Пока тихо</h3>
            <p>{tab === 'in' ? 'Никто не предложил вам обмен.' : 'Вы пока никому не отправляли запросов.'}</p>
          </div>
        )}

        <div className="trades__list">
          {offers.map(o => (
            <TradeCard
              key={o.id} offer={o} tab={tab} myUserId={myUserId}
              onAccept={() => act(() => acceptOffer(o.id))}
              onDecline={() => act(() => declineOffer(o.id), false)}
              onCancel={() => act(() => cancelOffer(o.id), false)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TradeCard({ offer: o, tab, myUserId, onAccept, onDecline, onCancel }: {
  offer: OfferDirection; tab: Tab; myUserId: number | null;
  onAccept: () => void; onDecline: () => void; onCancel: () => void;
}) {
  const iAmFrom = myUserId === o.from_user_id;
  const counterparty = iAmFrom ? { name: o.to_name, un: o.to_username, photo: o.to_photo }
                                : { name: o.from_name, un: o.from_username, photo: o.from_photo };

  function openChat() {
    if (!counterparty.un) return;
    hapticImpact('medium');
    const url = `https://t.me/${counterparty.un}`;
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
  }

  return (
    <div className="trade-card">
      <div className="trade-card__header">
        <div className="trade-card__people">
          <div className="trade-card__avatar">{counterparty.name[0]?.toUpperCase()}</div>
          <div>
            <div className="trade-card__name">{counterparty.name}</div>
            {counterparty.un && <div className="trade-card__un">@{counterparty.un}</div>}
          </div>
        </div>
        <StatusChip status={o.status} />
      </div>

      <div className="trade-card__exchange">
        <div className="trade-card__side">
          <div className="trade-card__side-label">{tab === 'in' ? 'Вам отдают' : 'Вы отдаёте'}</div>
          <FrogCard frog={{ id: o.from_frog_id, number: o.from_number, model: o.from_model, backdrop: o.from_backdrop, pattern: o.from_pattern, image_url: null, center_color: o.from_center_color, edge_color: o.from_edge_color, pattern_color: o.from_pattern_color }} size="sm" hideLabel />
        </div>

        <div className="trade-card__arrow">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
          </svg>
        </div>

        <div className="trade-card__side">
          <div className="trade-card__side-label">{tab === 'in' ? 'Берут у вас' : 'Вы хотите'}</div>
          <FrogCard frog={{ id: o.to_frog_id, number: o.to_number, model: o.to_model, backdrop: o.to_backdrop, pattern: o.to_pattern, image_url: null, center_color: o.to_center_color, edge_color: o.to_edge_color, pattern_color: o.to_pattern_color }} size="sm" hideLabel />
        </div>
      </div>

      {o.message && <div className="trade-card__message">«{o.message}»</div>}

      <div className="trade-card__actions">
        {o.status === 'pending' && tab === 'in' && (
          <>
            <button className="btn-ghost" onClick={onDecline}>Отклонить</button>
            <button className="btn-primary" onClick={onAccept}>Принять</button>
          </>
        )}
        {o.status === 'pending' && tab === 'out' && (
          <button className="btn-ghost" onClick={onCancel}>Отозвать</button>
        )}
        {o.status === 'accepted' && (
          <button className="btn-primary" onClick={openChat} disabled={!counterparty.un}>
            {counterparty.un ? `Открыть чат с @${counterparty.un}` : 'У партнёра нет username'}
          </button>
        )}
      </div>

      {o.status === 'accepted' && (
        <p className="trade-card__hint">
          Договоритесь в личке: кто кому первый отправляет лягушку, по какому маркету пройдёт передача. SWAMP сделку не проводит.
        </p>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: OfferDirection['status'] }) {
  const map: Record<OfferDirection['status'], { l: string; cls: string }> = {
    pending: { l: 'Ожидает', cls: 'chip' },
    accepted: { l: 'Принят', cls: 'chip chip--primary' },
    declined: { l: 'Отклонён', cls: 'chip' },
    cancelled: { l: 'Отозван', cls: 'chip' },
  };
  const x = map[status];
  return <span className={x.cls}>{x.l}</span>;
}
