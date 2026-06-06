import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';
import type { CatLeaderboardEntry } from '../types';
import CatCardModal from '../components/CatCardModal';
import './LeaderboardScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'День',
  weekly: 'Неделя',
  monthly: 'Месяц',
};

const RANK_COLORS = ['leaderboard__rank--gold', 'leaderboard__rank--silver', 'leaderboard__rank--bronze'];

interface Props {
  onViewUser: (id: number) => void;
}

export default function LeaderboardScreen({ onViewUser }: Props) {
  const [period, setPeriod] = useState<Period>('daily');
  const [entries, setEntries] = useState<CatLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<CatLeaderboardEntry | null>(null);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(period)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="leaderboard">
      <div className="leaderboard__header">
        <h2>Лидерборд</h2>
        <div className="leaderboard__tabs" role="tablist">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              className={`leaderboard__tab${period === p ? ' leaderboard__tab--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="leaderboard__list">
        {loading && (
          <div className="leaderboard__empty">
            <div className="leaderboard__spinner" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="leaderboard__empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" opacity="0.25">
              <ellipse cx="9" cy="6" rx="2.2" ry="2.8" />
              <ellipse cx="15" cy="6" rx="2.2" ry="2.8" />
              <ellipse cx="5.5" cy="10.5" rx="1.8" ry="2.4" />
              <ellipse cx="18.5" cy="10.5" rx="1.8" ry="2.4" />
              <path d="M12 10c-3.5 0-6 2-6 5 0 2.5 1.5 4 6 4s6-1.5 6-4c0-3-2.5-5-6-5z" />
            </svg>
            <p>Пока нет оценённых котов в этом периоде.</p>
            <p>Начните оценивать!</p>
          </div>
        )}

        {!loading && entries.map((entry, index) => (
          <button key={entry.id} className="leaderboard__entry" onClick={() => setSelectedCat(entry)}>
            <div className={`leaderboard__rank${index < 3 ? ' ' + RANK_COLORS[index] : ''}`}>
              {index + 1}
            </div>
            <img
              className="leaderboard__photo"
              src={`${BASE}${entry.photo_url}`}
              alt={entry.name}
            />
            <div className="leaderboard__info">
              <div className="leaderboard__cat-name">{entry.name}</div>
              {entry.breed && <div className="leaderboard__cat-breed">{entry.breed}</div>}
              <div className="leaderboard__cat-owner">от {entry.owner_name}</div>
            </div>
            <div className="leaderboard__score">
              <div className="leaderboard__avg">★ {entry.avg_score}</div>
              <div className="leaderboard__votes">{entry.vote_count} оценок</div>
            </div>
          </button>
        ))}
      </div>

      {selectedCat && (
        <CatCardModal
          cat={selectedCat}
          onClose={() => setSelectedCat(null)}
          onViewOwner={id => { setSelectedCat(null); onViewUser(id); }}
        />
      )}
    </div>
  );
}
