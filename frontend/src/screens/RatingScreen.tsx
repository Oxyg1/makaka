import { useState, useEffect, useCallback, useRef } from 'react';
import { getNextCat, rateCat, skipCat } from '../api';
import RatingSlider from '../components/RatingSlider';
import type { CatWithStats } from '../types';
import { hapticSuccess, hapticError } from '../utils/haptics';
import './RatingScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
const SCORE_LABELS = ['', 'Ужас', 'Плохо', 'Так себе', 'Нейтрально', 'Неплохо', 'Хорошо', 'Отлично', 'Прекрасно', 'Великолепно', 'Совершенство'];

type ExitDir = 'left' | 'up' | null;

export default function RatingScreen() {
  const [cat, setCat] = useState<CatWithStats | null | undefined>(undefined);
  const [score, setScore] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [exitDir, setExitDir] = useState<ExitDir>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const fetchNext = useCallback(async () => {
    const next = await getNextCat();
    setCat(next ?? null);
    setScore(5);
    setExitDir(null);
    setSubmitting(false);
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  const animateOut = (dir: ExitDir, action: () => Promise<void>) => {
    if (submitting) return;
    setSubmitting(true);
    setExitDir(dir);
    setTimeout(async () => {
      try {
        await action();
        setSessionCount(c => c + 1);
      } catch {
        // ignore
      }
      setCat(undefined);
      await fetchNext();
    }, 320);
  };

  const handleRate = () => {
    if (!cat || submitting) return;
    animateOut('up', async () => {
      await rateCat(cat.id, scoreRef.current);
      hapticSuccess();
    });
  };

  const handleSkip = () => {
    if (!cat || submitting) return;
    animateOut('left', async () => {
      await skipCat(cat.id);
      hapticError();
    });
  };

  if (cat === undefined) {
    return (
      <div className="rating-screen__loading">
        <div className="rating-screen__spinner" />
        <p>Ищем кота...</p>
      </div>
    );
  }

  if (cat === null) {
    return (
      <div className="rating-screen__empty">
        <svg className="rating-screen__empty-icon" width="72" height="72" viewBox="0 0 24 24" fill="currentColor" opacity="0.25">
          <ellipse cx="9" cy="6" rx="2.2" ry="2.8" />
          <ellipse cx="15" cy="6" rx="2.2" ry="2.8" />
          <ellipse cx="5.5" cy="10.5" rx="1.8" ry="2.4" />
          <ellipse cx="18.5" cy="10.5" rx="1.8" ry="2.4" />
          <path d="M12 10c-3.5 0-6 2-6 5 0 2.5 1.5 4 6 4s6-1.5 6-4c0-3-2.5-5-6-5z" />
        </svg>
        <h3>Все коты оценены!</h3>
        <p>Вы оценили всех доступных котов. Заходите завтра — будут новые!</p>
        {sessionCount > 0 && (
          <p className="rating-screen__session-done">За эту сессию вы оценили {sessionCount} {pluralCats(sessionCount)}</p>
        )}
      </div>
    );
  }

  const thumbUrl = cat.photo_url.replace('/uploads/', '/uploads/thumb_');

  return (
    <div className="rating-screen">
      {sessionCount > 0 && (
        <div className="rating-screen__counter">
          Оценено: {sessionCount}
        </div>
      )}

      <div className={`rating-screen__card${exitDir ? ` rating-screen__card--exit-${exitDir}` : ''}`}>
        <div className="rating-screen__photo-wrap">
          <img
            className="rating-screen__photo"
            src={`${BASE}${cat.photo_url}`}
            srcSet={`${BASE}${thumbUrl} 400w, ${BASE}${cat.photo_url} 1200w`}
            sizes="(max-width: 600px) 400px, 1200px"
            alt={cat.name}
            loading="eager"
          />
          <div className="rating-screen__photo-overlay">
            <h2 className="rating-screen__name">{cat.name}</h2>
            {(cat.breed || cat.age) && (
              <p className="rating-screen__breed">
                {[cat.breed, cat.age ? `${cat.age} ${pluralYears(cat.age)}` : null].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="rating-screen__meta">от {cat.owner_name}</p>
          </div>
        </div>

        {cat.description && (
          <p className="rating-screen__desc">{cat.description}</p>
        )}

        {cat.vote_count > 0 && (
          <p className="rating-screen__avg">
            Средняя оценка: <strong>{cat.avg_score}</strong> ({cat.vote_count} {pluralVotes(cat.vote_count)})
          </p>
        )}
      </div>

      <div className="rating-screen__footer">
        <p className="rating-screen__score-label">{SCORE_LABELS[score]}</p>
        <RatingSlider value={score} onChange={setScore} disabled={submitting} />
        <div className="rating-screen__actions">
          <button
            className="btn-skip"
            onClick={handleSkip}
            disabled={submitting}
            aria-label="Пропустить"
          >
            Пропустить
          </button>
          <button
            className="btn-primary btn-rate"
            onClick={handleRate}
            disabled={submitting}
          >
            {submitting ? '...' : `Оценить ${score}/10`}
          </button>
        </div>
      </div>
    </div>
  );
}

function pluralCats(n: number): string {
  const r = n % 10;
  if (n % 100 >= 11 && n % 100 <= 14) return 'котов';
  if (r === 1) return 'кота';
  if (r >= 2 && r <= 4) return 'кота';
  return 'котов';
}

function pluralYears(n: number): string {
  const r = n % 10;
  if (n % 100 >= 11 && n % 100 <= 14) return 'лет';
  if (r === 1) return 'год';
  if (r >= 2 && r <= 4) return 'года';
  return 'лет';
}

function pluralVotes(n: number): string {
  const r = n % 10;
  if (n % 100 >= 11 && n % 100 <= 14) return 'оценок';
  if (r === 1) return 'оценка';
  if (r >= 2 && r <= 4) return 'оценки';
  return 'оценок';
}
