import { useState } from 'react';
import type { CatLeaderboardEntry } from '../types';
import './CatCardModal.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

const AVATAR_COLORS = ['#1689ff','#49df64','#ff453a','#ff9500','#af52de','#ff2d55','#5ac8fa','#ffcc00'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

export function Avatar({ name, photoUrl, size = 48 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  if (photoUrl && !err) {
    return <img src={photoUrl} onError={() => setErr(true)} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, color: '#fff', flexShrink: 0 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

interface Props { cat: CatLeaderboardEntry; onClose: () => void; onViewOwner: (id: number) => void; }

export default function CatCardModal({ cat, onClose, onViewOwner }: Props) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet cat-card-modal">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close-btn" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">{cat.name}</span>
          <div style={{ width: 60 }} />
        </div>
        <div className="cat-card-modal__scroll">
          <div className="cat-card-modal__photo-wrap">
            <img className="cat-card-modal__photo" src={`${BASE}${cat.photo_url}`} alt={cat.name} />
            {cat.avg_score > 0 && (
              <div className="cat-card-modal__score">★ {cat.avg_score}</div>
            )}
          </div>
          <div className="cat-card-modal__body">
            <h2 className="cat-card-modal__name">{cat.name}</h2>
            {cat.breed && <p className="cat-card-modal__breed">{cat.breed}{cat.age ? ` · ${cat.age} лет` : ''}</p>}
            {cat.description && <p className="cat-card-modal__desc">{cat.description}</p>}
            <div className="cat-card-modal__votes">{cat.vote_count} оценок</div>
            <button className="cat-card-modal__owner-btn" onClick={() => { onClose(); onViewOwner(cat.owner_id); }}>
              Профиль: {cat.owner_name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
