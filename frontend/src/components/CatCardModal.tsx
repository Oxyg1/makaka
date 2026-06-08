import { useState } from 'react';
import { likeCat } from '../api';
import type { CatLeaderboardEntry, CatWithStats } from '../types';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import './CatCardModal.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

const AVATAR_COLORS = ['#7c6df9','#49df64','#ff453a','#ff9500','#af52de','#ff2d55','#5ac8fa','#ffcc00'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

export function ageLabel(age: number): string {
  const n = age % 100, n1 = age % 10;
  if (n >= 11 && n <= 19) return `${age} лет`;
  if (n1 === 1) return `${age} год`;
  if (n1 >= 2 && n1 <= 4) return `${age} года`;
  return `${age} лет`;
}

export function Avatar({ name, photoUrl, size = 48 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  if (photoUrl && !err) {
    return <img src={photoUrl} onError={() => setErr(true)} width={size} height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />;
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
  onLike?: (id: number, liked: boolean, count: number) => void;
}

export default function CatCardModal({ cat, onClose, onViewOwner, isOwner, onEdit, onDelete, onLike }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liked, setLiked] = useState(cat.liked_by_me ?? false);
  const [likesCount, setLikesCount] = useState(cat.likes_count ?? 0);
  const [liking, setLiking] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const swipe = useSheetSwipe(onClose);

  const photos = [cat.photo_url, ...(cat.extra_photos ?? [])];
  const ownerId = 'owner_id' in cat ? cat.owner_id : undefined;

  const handleLike = async () => {
    if (liking) return;
    const next = !liked;
    setLiked(next);
    setLikesCount(n => n + (next ? 1 : -1));
    setLiking(true);
    try {
      const r = await likeCat(cat.id);
      setLiked(r.liked);
      setLikesCount(r.likes_count);
      onLike?.(cat.id, r.liked, r.likes_count);
    } catch { /* keep optimistic */ }
    finally { setLiking(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet cat-card-modal" ref={swipe.sheetRef}
        onTouchStart={swipe.handleTouchStart}
        onTouchMove={swipe.handleTouchMove}
        onTouchEnd={swipe.handleTouchEnd}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close-btn" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">{cat.name}</span>
          <div style={{ width: 60 }} />
        </div>

        <div className="cat-card-modal__scroll">
          {/* Photo */}
          <div className="cat-card-modal__photo-wrap">
            <img className="cat-card-modal__photo"
              src={`${BASE}${photos[photoIdx]}`} alt={cat.name} />

            {/* Top overlay: #id + like */}
            <div className="cat-card-modal__overlay">
              <span className="cat-card-modal__badge">#{cat.id}</span>
              <button
                className={`cat-card-modal__like-btn${liked ? ' cat-card-modal__like-btn--active' : ''}`}
                onClick={handleLike} disabled={liking}
              >
                <svg width="13" height="13" viewBox="0 0 24 24"
                  fill={liked ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {likesCount > 0 && <span>{likesCount}</span>}
              </button>
            </div>

            {/* Score bottom-right */}
            {cat.avg_score > 0 && (
              <div className="cat-card-modal__score">★ {cat.avg_score}</div>
            )}

            {/* Carousel dots */}
            {photos.length > 1 && (
              <div className="cat-card-modal__dots">
                {photos.map((_, i) => (
                  <button key={i}
                    className={`cat-card-modal__dot${i === photoIdx ? ' cat-card-modal__dot--active' : ''}`}
                    onClick={() => setPhotoIdx(i)} />
                ))}
              </div>
            )}
          </div>

          {/* Info body */}
          <div className="cat-card-modal__body">
            <h2 className="cat-card-modal__name">{cat.name}</h2>
            {(cat.breed || cat.age) && (
              <p className="cat-card-modal__breed">
                {[cat.breed, cat.age ? ageLabel(cat.age) : null].filter(Boolean).join(' · ')}
              </p>
            )}
            {cat.description && (
              <p className="cat-card-modal__desc">{cat.description}</p>
            )}
            <div className="cat-card-modal__meta">
              <span className="cat-card-modal__votes">{cat.vote_count} {cat.vote_count === 1 ? 'оценка' : 'оценок'}</span>
              <span className="cat-card-modal__owner-tag">от {cat.owner_name}</span>
            </div>

            {onViewOwner && ownerId !== undefined && (
              <button className="cat-card-modal__owner-btn"
                onClick={() => { onClose(); onViewOwner(ownerId); }}>
                Профиль: {cat.owner_name}
              </button>
            )}

            {isOwner && (
              <div className="cat-card-modal__owner-actions">
                {!confirmDelete ? (
                  <>
                    <button className="cat-card-modal__edit-btn"
                      onClick={() => { onClose(); onEdit?.(cat); }}>Редактировать</button>
                    <button className="cat-card-modal__delete-btn"
                      onClick={() => setConfirmDelete(true)}>Удалить</button>
                  </>
                ) : (
                  <>
                    <p className="cat-card-modal__confirm-text">Удалить кота навсегда?</p>
                    <button className="cat-card-modal__delete-btn"
                      onClick={() => { onDelete?.(cat.id); onClose(); }}>Да, удалить</button>
                    <button className="cat-card-modal__edit-btn"
                      onClick={() => setConfirmDelete(false)}>Отмена</button>
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
