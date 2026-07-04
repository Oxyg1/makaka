// Лидерборд игры: подиум топ-3 (переиспользуем стили подиума холдеров)
// + список до топ-100 + строка «вы».

import { useEffect, useState } from 'react';
import { getLeaderboard } from '../../api';
import type { GameId, LeaderboardData } from '../../types';
import { useSheetSwipe } from '../../utils/useSheetSwipe';
import { SkelPodium, SkelRow } from '../Skeleton';
import { fmt } from './economy';
import './games.css';

const TITLES: Record<GameId, string> = {
  merge: 'Мерж — лидеры',
  mosquito: 'Комары — лидеры',
  clicker: 'Кликер — лидеры',
};

export default function LeaderboardSheet({ game, onClose }: { game: GameId; onClose: () => void }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { sheetRef, overlayRef, swipeHandlers } = useSheetSwipe(onClose);

  useEffect(() => {
    getLeaderboard(game).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [game]);

  const top3 = data?.top.slice(0, 3) ?? [];
  const rest = data?.top.slice(3) ?? [];

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet" ref={sheetRef} {...swipeHandlers}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">{TITLES[game]}</span>
          <span style={{ width: 60 }} />
        </div>
        <div className="modal-sheet__scroll">
          {loading && (
            <>
              <SkelPodium />
              {Array.from({ length: 4 }, (_, i) => <SkelRow key={i} />)}
            </>
          )}

          {!loading && data && data.me.rank !== null && (
            <div className="lb-me">
              <span>Вы: <b>{fmt(data.me.score)}</b> очков</span>
              <span className="lb-me__rank">#{data.me.rank}</span>
            </div>
          )}

          {!loading && (!data || data.top.length === 0) && (
            <div className="empty" style={{ padding: 32 }}>
              <div className="empty__icon">🏆</div>
              <h3>Пока никто не играл</h3>
              <p>Станьте первым в топе!</p>
            </div>
          )}

          {top3.length > 0 && (
            <div className="podium">
              {top3.map((e, i) => (
                <div key={e.telegram_id} className={`podium__item podium__item--${i}`} style={{ '--i': i } as React.CSSProperties}>
                  {i === 0 && <span className="podium__crown">👑</span>}
                  <div className="podium__photo-wrap">
                    <div className="podium__photo">
                      {e.photo_url ? <img src={e.photo_url} alt="" /> : <span>{(e.name ?? e.username ?? '?')[0]?.toUpperCase()}</span>}
                    </div>
                    <span className="podium__rank">{i + 1}</span>
                  </div>
                  <span className="podium__name">{e.name ?? e.username ?? '—'}</span>
                  <span className="podium__count">{fmt(e.score)}</span>
                  <span className="podium__pedestal" />
                </div>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="whales__list">
              {rest.map((e, i) => (
                <div key={e.telegram_id} className="whale-row" style={{ '--i': i } as React.CSSProperties}>
                  <div className="whale-row__rank">{i + 4}</div>
                  <div className="whale-row__avatar">
                    {e.photo_url ? <img src={e.photo_url} alt="" /> : <span>{(e.name ?? e.username ?? '?')[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="whale-row__info">
                    <div className="whale-row__name">{e.name ?? e.username ?? '—'}</div>
                    {e.username && <div className="whale-row__un">@{e.username}</div>}
                  </div>
                  <div className="whale-row__count">
                    <div className="whale-row__count-value">{fmt(e.score)}</div>
                    <div className="whale-row__count-label">очков</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
