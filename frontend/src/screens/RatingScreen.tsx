import { useState, useEffect, useCallback, useRef } from 'react';
import { getNextCat, rateCat, skipCat, resetRatings, likeCat } from '../api';
import RatingSlider from '../components/RatingSlider';
import type { CatWithStats } from '../types';
import { hapticSuccess, hapticError, hapticImpact } from '../utils/haptics';
import { ageLabel } from '../components/CatCardModal';
import './RatingScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
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
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const fetchNext = useCallback(async () => {
    const next = await getNextCat();
    setCat(next ?? null);
    setScore(5); setDir(null); setSubmitting(false);
    setLiked(next?.liked_by_me ?? false);
    setLikesCount(next?.likes_count ?? 0);
    setLiking(false);
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
      await resetRatings();
      fetchNext();
    }} />
  );

  return (
    <div className="rs">
      {count > 0 && <div className="rs__counter">Оценено: {count}</div>}

      <div className="rs__scroll">
        <div className={`rs__card${dir ? ` rs__card--${dir}` : ''}`}>

          <div className="rs__photo-wrap">
            <img
              className="rs__photo"
              src={`${BASE}${cat.photo_url}`}
              srcSet={`${BASE}${cat.photo_url.replace('/uploads/', '/uploads/thumb_')} 400w, ${BASE}${cat.photo_url} 1200w`}
              sizes="(max-width:600px) 400px, 1200px"
              alt={cat.name} loading="eager"
            />
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
          </div>

          <div className="rs__card-body">
            <div className="rs__info">
              <h2 className="rs__name">{cat.name}</h2>
              {(cat.breed || cat.age) && (
                <p className="rs__breed">{[cat.breed, cat.age ? ageLabel(cat.age) : null].filter(Boolean).join(' · ')}</p>
              )}
              {cat.avg_score > 0 && <p className="rs__avg">★ {cat.avg_score} · {cat.vote_count} оц.</p>}
              <p className="rs__owner">от {cat.owner_name}</p>
            </div>
            {cat.description && <p className="rs__desc">{cat.description}</p>}
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
      <button className="rs__rate-btn" style={{ maxWidth: 220 }} onClick={handle} disabled={resetting}>
        {resetting ? '...' : 'Оценить заново'}
      </button>
    </div>
  );
}
