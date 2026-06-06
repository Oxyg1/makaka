import type { CatLeaderboardEntry } from '../types';
import './CatCardModal.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

interface Props {
  cat: CatLeaderboardEntry;
  onClose: () => void;
  onViewOwner: (userId: number) => void;
}

const SCORE_COLORS = ['', '#FF3B30', '#FF3B30', '#FF6B35', '#FF9500', '#FFCC00', '#A8CC00', '#34C759', '#00B140', '#007AFF', '#AF52DE'];

function pluralYears(n: number): string {
  const r = n % 10;
  if (n % 100 >= 11 && n % 100 <= 14) return 'лет';
  if (r === 1) return 'год';
  if (r >= 2 && r <= 4) return 'года';
  return 'лет';
}

export default function CatCardModal({ cat, onClose, onViewOwner }: Props) {
  const scoreColor = cat.avg_score > 0 ? SCORE_COLORS[Math.round(cat.avg_score)] : '#8E8E93';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet cat-card-modal">
        <div className="modal-sheet__handle" />
        <button className="cat-card-modal__close" onClick={onClose} aria-label="Закрыть">✕</button>

        <div className="cat-card-modal__scroll">
          <div className="cat-card-modal__photo-wrap">
            <img
              className="cat-card-modal__photo"
              src={`${BASE}${cat.photo_url}`}
              srcSet={`${BASE}${cat.photo_url.replace('/uploads/', '/uploads/thumb_')} 400w, ${BASE}${cat.photo_url} 1200w`}
              sizes="(max-width: 600px) 400px, 1200px"
              alt={cat.name}
            />
            {cat.avg_score > 0 && (
              <div className="cat-card-modal__score-badge" style={{ background: scoreColor }}>
                ★ {cat.avg_score}
              </div>
            )}
          </div>

          <div className="cat-card-modal__body">
            <h2 className="cat-card-modal__name">{cat.name}</h2>

            {(cat.breed || cat.age) && (
              <p className="cat-card-modal__breed">
                {[cat.breed, cat.age ? `${cat.age} ${pluralYears(cat.age)}` : null].filter(Boolean).join(' · ')}
              </p>
            )}

            {cat.vote_count > 0 && (
              <p className="cat-card-modal__votes">{cat.vote_count} оценок</p>
            )}

            {cat.description && (
              <p className="cat-card-modal__desc">{cat.description}</p>
            )}

            <button
              className="cat-card-modal__owner-btn"
              onClick={() => { onViewOwner(cat.owner_id); onClose(); }}
            >
              <div className="cat-card-modal__owner-avatar">
                {cat.owner_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="cat-card-modal__owner-info">
                <span className="cat-card-modal__owner-label">Хозяин</span>
                <span className="cat-card-modal__owner-name">{cat.owner_name}</span>
              </div>
              <span className="cat-card-modal__owner-arrow">›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
