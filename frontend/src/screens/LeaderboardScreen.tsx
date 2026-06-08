import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';
import type { CatLeaderboardEntry } from '../types';
import CatCardModal from '../components/CatCardModal';
import './LeaderboardScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
type Period = 'daily' | 'weekly' | 'monthly' | 'all';
const PERIOD: Record<Period, string> = { daily: 'День', weekly: 'Неделя', monthly: 'Месяц', all: 'Всё время' };

interface Props { onViewUser: (id: number) => void; }

export default function LeaderboardScreen({ onViewUser }: Props) {
  const [period, setPeriod] = useState<Period>('daily');
  const [entries, setEntries] = useState<CatLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<CatLeaderboardEntry | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    getLeaderboard(period)
      .then(data => { setEntries(data); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [period, retry]);

  return (
    <div className="lb">
      <div className="lb__header">
        <h2>Лидерборд</h2>
        <div className="lb__seg">
          {(Object.keys(PERIOD) as Period[]).map(p => (
            <button key={p} className={`lb__seg-btn${period === p ? ' lb__seg-btn--active' : ''}`} onClick={() => setPeriod(p)}>
              {PERIOD[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="lb__list">
        {loading && <div className="lb__center"><div className="spinner" /></div>}

        {!loading && loadError && (
          <div className="lb__empty">
            <p>Не удалось загрузить лидерборд</p>
            <button className="lb__seg-btn" style={{ marginTop: 8 }} onClick={() => setRetry(n => n + 1)}>Повторить</button>
          </div>
        )}

        {!loading && !loadError && entries.length === 0 && (
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

        {!loading && entries.map((e, i) => (
          <button key={e.id} className="lb__entry" onClick={() => setSelected(e)}>
            <div className={`lb__rank lb__rank--${i < 3 ? ['gold','silver','bronze'][i] : 'num'}`}>{i + 1}</div>
            <img className="lb__photo" src={`${BASE}${e.photo_url}`} alt={e.name} />
            <div className="lb__info">
              <div className="lb__cat-name">{e.name}</div>
              {e.breed && <div className="lb__breed">{e.breed}</div>}
              <div className="lb__owner">от {e.owner_name}</div>
            </div>
            <div className="lb__score">
              <div className="lb__avg">★ {e.avg_score}</div>
              <div className="lb__votes">{e.vote_count} оц.</div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <CatCardModal cat={selected} onClose={() => setSelected(null)}
          onViewOwner={id => { setSelected(null); onViewUser(id); }} />
      )}
    </div>
  );
}
