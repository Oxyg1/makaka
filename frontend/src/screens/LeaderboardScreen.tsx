import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';
import type { CatLeaderboardEntry } from '../types';
import CatCardModal from '../components/CatCardModal';
import StarBalanceButton from '../components/StarBalanceButton';
import { syncCatLike } from '../utils/catLikes';
import './LeaderboardScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
type Period = 'daily' | 'weekly' | 'monthly' | 'all';
const PERIOD: Record<Period, string> = { daily: 'День', weekly: 'Неделя', monthly: 'Месяц', all: 'Всё время' };
const PERIODS = Object.keys(PERIOD) as Period[];

function rankBadgeClass(i: number) {
  if (i === 0) return 'lb__badge lb__badge--gold';
  if (i === 1) return 'lb__badge lb__badge--silver';
  if (i === 2) return 'lb__badge lb__badge--bronze';
  return 'lb__badge lb__badge--num';
}

interface Props { onViewUser: (id: number) => void; }

export default function LeaderboardScreen({ onViewUser }: Props) {
  const [period, setPeriod] = useState<Period>('daily');
  const [entries, setEntries] = useState<CatLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CatLeaderboardEntry | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(period).then(es => {
      setEntries(es);
      es.forEach(e => syncCatLike(e.id, e.liked_by_me ?? false, e.likes_count ?? 0));
    }).finally(() => setLoading(false));
  }, [period]);

  const switchPeriod = (p: Period) => {
    setPeriod(p);
    setActiveIdx(PERIODS.indexOf(p));
  };

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="lb">
      <div className="lb__header">
        <div className="lb__title-row">
          <h2 className="lb__title">Лидерборд</h2>
          <StarBalanceButton />
        </div>
        <div className="lb__seg" style={{ '--seg-idx': activeIdx } as React.CSSProperties}>
          <div className="lb__seg-indicator" />
          {PERIODS.map((p) => (
            <button key={p}
              className={`lb__seg-btn${period === p ? ' lb__seg-btn--active' : ''}`}
              onClick={() => switchPeriod(p)}
            >
              {PERIOD[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="lb__body">
        {loading && <div className="lb__center"><div className="spinner" /></div>}

        {!loading && entries.length === 0 && (
          <div className="lb__empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" opacity="0.2">
              <ellipse cx="9" cy="6" rx="2.2" ry="2.8" /><ellipse cx="15" cy="6" rx="2.2" ry="2.8" />
              <ellipse cx="5.5" cy="10.5" rx="1.8" ry="2.4" /><ellipse cx="18.5" cy="10.5" rx="1.8" ry="2.4" />
              <path d="M12 10c-3.5 0-6 2-6 5 0 2.5 1.5 4 6 4s6-1.5 6-4c0-3-2.5-5-6-5z" />
            </svg>
            <p>Нет котов за этот период</p>
            <p>Начните оценивать!</p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="lb__scroll">
            {top3.length > 0 && (
              <div className="lb__podium-wrap">
                <div className="lb__podium">
                  {top3.map((e, i) => (
                    <button key={e.id} className={`lb__podium-item lb__podium-item--${i}`} onClick={() => setSelected(e)}>
                      <div className="lb__podium-photo-wrap">
                        <img className="lb__podium-photo" src={`${BASE}${e.photo_url}`} alt={e.name} />
                        <span className={rankBadgeClass(i)}>{i + 1}</span>
                      </div>
                      <div className="lb__podium-text">
                        <div className="lb__podium-text-inner">
                          <span className="lb__podium-name">{e.name}</span>
                          <span className="lb__podium-score">★ {e.avg_score}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rest.length > 0 && (
              <div className="lb__list">
                <div className="lb__glass-list">
                  {rest.map((e, i) => (
                    <button key={e.id} className="lb__row" onClick={() => setSelected(e)}>
                      <span className="lb__rank-num">{i + 4}</span>
                      <div className="lb__avatar-wrap">
                        <img className="lb__avatar" src={`${BASE}${e.photo_url}`} alt={e.name} />
                      </div>
                      <div className="lb__info">
                        <span className="lb__name">{e.name}</span>
                        {e.breed && <span className="lb__breed">{e.breed}</span>}
                        <span className="lb__owner">от {e.owner_name}</span>
                      </div>
                      <div className="lb__score">
                        <span className="lb__avg">★ {e.avg_score}</span>
                        <span className="lb__votes">{e.vote_count} оц.</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <CatCardModal cat={selected} onClose={() => setSelected(null)}
          onViewOwner={id => { setSelected(null); onViewUser(id); }} />
      )}
    </div>
  );
}
