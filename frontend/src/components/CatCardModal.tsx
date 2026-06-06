import { useState } from 'react';
import type { CatLeaderboardEntry, CatWithStats } from '../types';
import './CatCardModal.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

const AVATAR_COLORS = ['#1689ff','#49df64','#ff453a','#ff9500','#af52de','#ff2d55','#5ac8fa','#ffcc00'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

export function ageLabel(age: number): string {
  const n = age % 100;
  const n1 = age % 10;
  if (n >= 11 && n <= 19) return `${age} лет`;
  if (n1 === 1) return `${age} год`;
  if (n1 >= 2 && n1 <= 4) return `${age} года`;
  return `${age} лет`;
}

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

type CatData = CatLeaderboardEntry | CatWithStats;

interface Props {
  cat: CatData;
  onClose: () => void;
  onViewOwner?: (id: number) => void;
  isOwner?: boolean;
  onEdit?: (cat: CatData) => void;
  onDelete?: (id: number) => void;
}

export default function CatCardModal({ cat, onClose, onViewOwner, isOwner, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ownerId = 'owner_id' in cat ? cat.owner_id : undefined;

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
            {cat.breed && <p className="cat-card-modal__breed">{cat.breed}{cat.age ? ` · ${ageLabel(cat.age)}` : ''}</p>}
            {cat.description && <p className="cat-card-modal__desc">{cat.description}</p>}
            <div className="cat-card-modal__votes">{cat.vote_count} оценок</div>

            {onViewOwner && ownerId !== undefined && (
              <button className="cat-card-modal__owner-btn" onClick={() => { onClose(); onViewOwner(ownerId); }}>
                Профиль: {cat.owner_name}
              </button>
            )}

            {isOwner && (
              <div className="cat-card-modal__owner-actions">
                {!confirmDelete ? (
                  <>
                    <button className="cat-card-modal__edit-btn" onClick={() => { onClose(); onEdit?.(cat); }}>
                      Редактировать
                    </button>
                    <button className="cat-card-modal__delete-btn" onClick={() => setConfirmDelete(true)}>
                      Удалить
                    </button>
                  </>
                ) : (
                  <>
                    <p className="cat-card-modal__confirm-text">Удалить кота навсегда?</p>
                    <button className="cat-card-modal__delete-btn" onClick={() => { onDelete?.(cat.id); onClose(); }}>
                      Да, удалить
                    </button>
                    <button className="cat-card-modal__edit-btn" onClick={() => setConfirmDelete(false)}>
                      Отмена
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
