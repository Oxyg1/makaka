import { useState, useEffect, useCallback, useRef } from 'react';
import { getNextCat, rateCat, skipCat, resetRatings } from '../api';
import RatingSlider from '../components/RatingSlider';
import type { CatWithStats } from '../types';
import { hapticSuccess, hapticError } from '../utils/haptics';
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
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const fetchNext = useCallback(async () => {
    const next = await getNextCat();
    setCat(next ?? null); setScore(5); setDir(null); setSubmitting(false);
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

  const handleRate = () => { if (!cat) return; go('up', async () => { await rateCat(cat.id, scoreRef.current); hapticSuccess(); }); };
  const handleSkip = () => { if (!cat) return; go('left', async () => { await skipCat(cat.id); hapticError(); }); };

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
      <div className={`rs__scroll`}>
        <div className={`rs__card${dir ? ` rs__card--${dir}` : ''}`}>
          <img className="rs__photo"
            src={`${BASE}${cat.photo_url}`}
            srcSet={`${BASE}${cat.photo_url.replace('/uploads/','/uploads/thumb_')} 400w, ${BASE}${cat.photo_url} 1200w`}
            sizes="(max-width:600px) 400px, 1200px"
            alt={cat.name} loading="eager"
          />
          <div className="rs__card-body">
            <div className="rs__info">
              <h2 className="rs__name">{cat.name}</h2>
              {(cat.breed || cat.age) && (
                <p className="rs__breed">{[cat.breed, cat.age ? `${cat.age} ${plural(cat.age,'год','года','лет')}` : null].filter(Boolean).join(' · ')}</p>
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
                <button className="btn-primary" onClick={handleRate} disabled={submitting} style={{ flex: 2 }}>
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
      <button className="btn-primary" style={{ marginTop: 8, maxWidth: 220 }} onClick={handle} disabled={resetting}>
        {resetting ? '...' : 'Оценить заново'}
      </button>
    </div>
  );
}
