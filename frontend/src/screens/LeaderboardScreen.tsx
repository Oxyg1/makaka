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

const MEDALS = ['🥇', '🥈', '🥉'];

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
            <div style={{ fontSize: 48 }}>😿</div>
            <p>Пока нет оценённых котов в этом периоде.</p>
            <p>Начните оценивать!</p>
          </div>
        )}

        {!loading && entries.map((entry, index) => (
          <button key={entry.id} className="leaderboard__entry" onClick={() => setSelectedCat(entry)}>
            <div className="leaderboard__rank">
              {index < 3 ? MEDALS[index] : `${index + 1}`}
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
              <div className="leaderboard__avg">⭐ {entry.avg_score}</div>
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
