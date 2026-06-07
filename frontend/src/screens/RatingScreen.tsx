import { useState, useEffect, useCallback, useRef } from 'react';
import { getNextCat, rateCat, skipCat, resetRatings, likeCat } from '../api';
import RatingSlider from '../components/RatingSlider';
import type { CatWithStats } from '../types';
import { hapticSuccess, hapticError, hapticImpact } from '../utils/haptics';
import { ageLabel } from '../components/CatCardModal';
import './RatingScreen.css';

function PhotoCarousel({ photos, name, overlay }: { photos: string[]; name: string; overlay: React.ReactNode }) {
  const [idx, setIdx] = useState(0);
  const startX = useRef(0);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (railRef.current) railRef.current.style.transform = `translateX(-${idx * 100}%)`;
  }, [idx]);

  if (photos.length <= 1) {
    return (
      <div className="rs__photo-wrap">
        <img className="rs__photo" src={`${import.meta.env.VITE_API_URL ?? ''}${photos[0]}`}
          srcSet={`${import.meta.env.VITE_API_URL ?? ''}${photos[0].replace('/uploads/', '/uploads/thumb_')} 400w, ${import.meta.env.VITE_API_URL ?? ''}${photos[0]} 1200w`}
          sizes="(max-width:600px) 400px, 1200px" alt={name} loading="eager" />
        {overlay}
      </div>
    );
  }

  return (
    <div className="rs__photo-wrap rs__photo-wrap--carousel"
      onTouchStart={e => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const dx = startX.current - e.changedTouches[0].clientX;
        if (Math.abs(dx) > 40) setIdx(i => dx > 0 ? Math.min(photos.length - 1, i + 1) : Math.max(0, i - 1));
      }}
    >
      <div className="rs__carousel-rail" ref={railRef}>
        {photos.map((url, i) => (
          <img key={i} className="rs__photo rs__photo--slide"
            src={`${import.meta.env.VITE_API_URL ?? ''}${url}`}
            alt={`${name} ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
        ))}
      </div>
      <div className="rs__carousel-dots">
        {photos.map((_, i) => (
          <button key={i} className={`rs__dot${i === idx ? ' rs__dot--active' : ''}`} onClick={() => setIdx(i)} />
        ))}
      </div>
      {overlay}
    </div>
  );
}

const LABELS = ['','Ужас','Плохо','Так себе','Нейтрально','Неплохо','Хорошо','Отлично','Прекрасно','Великолепно','Совершенство'];

function plural(n: number, a: string, b: string, c: string) {
  const m = Math.abs(n) % 100;
  if (m >= 11 && m <= 19) return c;
  switch (m % 10) { case 1: return a; case 2: case 3: case 4: return b; default: return c; }
}

type Dir = 'up' | 'left' | null;

export default function RatingScreen() {
  const [cat, setCat] = useState<CatWithStats | null | undefined>(undefined);
  const [score, setScore] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [dir, setDir] = useState<Dir>(null);
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [liking, setLiking] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const fetchNext = useCallback(async () => {
    try {
      const next = await getNextCat();
      setCat(next ?? null);
      setScore(5); setDir(null); setSubmitting(false);
      setLiked(next?.liked_by_me ?? false);
      setLikesCount(next?.likes_count ?? 0);
      setLiking(false);
    } catch {
      setCat(null);
    }
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  const go = (d: Dir, action: () => Promise<void>) => {
    if (submitting) return;
    setSubmitting(true); setDir(d);
    setTimeout(async () => {
      try { await action(); setCount(c => c + 1); } catch { /**/ }
      setCat(undefined); await fetchNext();
    }, 300);
  };

  const handleRate = () => {
    if (!cat) return;
    go('up', async () => { await rateCat(cat.id, scoreRef.current); hapticSuccess(); });
  };

  const handleSkip = () => {
    if (!cat) return;
    go('left', async () => { await skipCat(cat.id); hapticError(); });
  };

  const handleLike = async () => {
    if (!cat || liking) return;
    hapticImpact('light');
    const next = !liked;
    setLiked(next);
    setLikesCount(n => n + (next ? 1 : -1));
    setLiking(true);
    try {
      const r = await likeCat(cat.id);
      setLiked(r.liked);
      setLikesCount(r.likes_count);
    } catch { /* keep optimistic state */ }
    finally { setLiking(false); }
  };

  if (cat === undefined) return (
    <div className="rs__state"><div className="spinner" /><p>Ищем кота...</p></div>
  );

  if (cat === null) return (
    <RateAgainScreen count={count} plural={plural} onReset={async () => {
      setCat(undefined);
      try { await resetRatings(); } catch { /* continue even if reset fails */ }
      await fetchNext();
    }} />
  );

  return (
    <div className="rs">
      {count > 0 && <div className="rs__counter">Оценено: {count}</div>}

      <div className="rs__scroll">
        <div className={`rs__card${dir ? ` rs__card--${dir}` : ''}`}>

          <PhotoCarousel
            photos={[cat.photo_url, ...(cat.extra_photos ?? [])]}
            name={cat.name}
            overlay={
              <div className="rs__overlay">
                <span className="rs__badge">#{cat.id}</span>
                <button
                  className={`rs__like-btn${liked ? ' rs__like-btn--active' : ''}`}
                  onClick={handleLike}
                  disabled={liking || submitting}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  {likesCount > 0 && <span>{likesCount}</span>}
                </button>
              </div>
            }
          />

          <div className="rs__card-body">
            <div className="rs__info">
              <h2 className="rs__name">{cat.name}</h2>
              {(cat.breed || cat.age) && (
                <p className="rs__breed">{[cat.breed, cat.age ? ageLabel(cat.age) : null].filter(Boolean).join(' · ')}</p>
              )}
              {cat.avg_score > 0 && <p className="rs__avg">★ {cat.avg_score} · {cat.vote_count} оц.</p>}
              <p className="rs__owner">от {cat.owner_name}</p>
            </div>
            {cat.description && (
              <button className="rs__desc-btn" onClick={() => setDescOpen(true)}>
                <span className="rs__desc">{cat.description}</span>
                <span className="rs__desc-more">ещё ›</span>
              </button>
            )}
            <div className="rs__footer">
              <RatingSlider value={score} onChange={setScore} disabled={submitting} />
              <p className="rs__label">{LABELS[score]}</p>
              <div className="rs__actions">
                <button className="rs__skip" onClick={handleSkip} disabled={submitting}>Пропустить</button>
                <button className="rs__rate-btn" onClick={handleRate} disabled={submitting} style={{ flex: 2 }}>
                  {submitting ? '...' : `Оценить ${score}`}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {descOpen && cat.description && (
        <div className="modal-overlay" onClick={() => setDescOpen(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div className="modal-sheet__header">
              <div style={{ width: 60 }} />
              <span className="modal-sheet__title">{cat.name}</span>
              <button className="modal-sheet__close-btn" onClick={() => setDescOpen(false)}>✕</button>
            </div>
            <div style={{ padding: '12px 20px 36px', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--text)' }}>{cat.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RateAgainScreen({ count, plural, onReset }: { count: number; plural: (n: number, a: string, b: string, c: string) => string; onReset: () => Promise<void> }) {
  const [resetting, setResetting] = useState(false);
  const handle = async () => { setResetting(true); try { await onReset(); } finally { setResetting(false); } };
  return (
    <div className="rs__state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.2">
        <ellipse cx="9" cy="6" rx="2.2" ry="2.8" /><ellipse cx="15" cy="6" rx="2.2" ry="2.8" />
        <ellipse cx="5.5" cy="10.5" rx="1.8" ry="2.4" /><ellipse cx="18.5" cy="10.5" rx="1.8" ry="2.4" />
        <path d="M12 10c-3.5 0-6 2-6 5 0 2.5 1.5 4 6 4s6-1.5 6-4c0-3-2.5-5-6-5z" />
      </svg>
      <h3>Все коты оценены!</h3>
      <p>Заходите позже — появятся новые</p>
      {count > 0 && <p className="rs__session">За сессию: {count} {plural(count,'кот','кота','котов')}</p>}
      <button className="rs__rate-btn" style={{ width: 220, flex: 'none' }} onClick={handle} disabled={resetting}>
        {resetting ? '...' : 'Оценить заново'}
      </button>
    </div>
  );
}
