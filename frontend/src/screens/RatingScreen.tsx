import { useState, useEffect, useCallback, useRef } from 'react';
import { getNextCat, rateCat, skipCat, resetRatings, likeCat } from '../api';
import type { CatWithStats } from '../types';
import { hapticSuccess, hapticError, hapticImpact } from '../utils/haptics';
import './RatingScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

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
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const fetchNext = useCallback(async () => {
    const next = await getNextCat();
    setCat(next ?? null);
    setScore(5); setDir(null); setSubmitting(false);
    setLiked(next?.liked_by_me ?? false);
    setLikesCount(next?.likes_count ?? 0);
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

  const handleLike = () => {
    if (!cat) return;
    hapticImpact('light');
    const next = !liked;
    setLiked(next);
    setLikesCount(n => n + (next ? 1 : -1));
    likeCat(cat.id).then(r => { setLiked(r.liked); setLikesCount(r.likes_count); }).catch(() => {
      setLiked(!next); setLikesCount(n => n + (next ? -1 : 1));
    });
  };

  const handleScore = (n: number) => {
    hapticImpact('light');
    setScore(n);
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
      {count > 0 && <div className="rs__counter">{count}</div>}

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
            <div className="rs__photo-overlay">
              <span className="rs__badge">#{cat.id}</span>
              <button className={`rs__like-btn${liked ? ' rs__like-btn--active' : ''}`} onClick={handleLike}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {likesCount > 0 && <span>{likesCount}</span>}
              </button>
            </div>
          </div>

          <div className="rs__body">
            <div className="rs__meta">
              <h2 className="rs__name">{cat.name}</h2>
              {(cat.breed || cat.age) && (
                <p className="rs__breed">{[cat.breed, cat.age ? `${cat.age} ${plural(cat.age,'год','года','лет')}` : null].filter(Boolean).join(' · ')}</p>
              )}
            </div>

            <div className="rs__rating-section">
              <p className="rs__question">Насколько хорош этот котик?</p>
              <p className="rs__hint">Оцени от 1 до 10</p>

              <div className="rs__numbers">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    className={`rs__num${score === n ? ' rs__num--active' : ''}`}
                    onClick={() => handleScore(n)}
                    disabled={submitting}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className="rs__actions">
              <button className="rs__skip" onClick={handleSkip} disabled={submitting}>Пропустить</button>
              <button className="rs__rate-btn" onClick={handleRate} disabled={submitting}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {submitting ? '...' : 'Оценить'}
              </button>
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
