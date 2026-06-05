import { useState, useEffect, useCallback } from 'react';
import { getNextCat, rateCat } from '../api';
import StarRating from '../components/StarRating';
import type { CatWithStats } from '../types';
import './RatingScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
const SCORE_LABELS = ['', '😿 Ужас', '😿 Плохо', '😕 Так себе', '😐 Нейтрально', '🙂 Неплохо', '😊 Хорошо', '😺 Отлично', '😻 Прекрасно', '🌟 Великолепно', '👑 Совершенство'];

export default function RatingScreen() {
  const [cat, setCat] = useState<CatWithStats | null | undefined>(undefined);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchNext = useCallback(async () => {
    setCat(undefined);
    setScore(0);
    const next = await getNextCat();
    setCat(next ?? null);
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  const handleRate = async () => {
    if (!cat || score === 0 || submitting) return;
    setSubmitting(true);
    try {
      await rateCat(cat.id, score);
      await fetchNext();
    } catch {
      setSubmitting(false);
    }
  };

  if (cat === undefined) {
    return (
      <div className="rating-screen__loading">
        <p>Загружаем кота...</p>
      </div>
    );
  }

  if (cat === null) {
    return (
      <div className="rating-screen__empty">
        <div style={{ fontSize: 64 }}>😺</div>
        <h3>Котов больше нет!</h3>
        <p>Вы оценили всех доступных котов.</p>
        <p>Заходите позже или добавьте своего кота!</p>
      </div>
    );
  }

  return (
    <div className="rating-screen">
      <img
        className="rating-screen__photo"
        src={`${BASE}${cat.photo_url}`}
        alt={cat.name}
      />
      <div className="rating-screen__body">
        <h2 className="rating-screen__name">{cat.name}</h2>
        {(cat.breed || cat.age) && (
          <p className="rating-screen__breed">
            {[cat.breed, cat.age ? `${cat.age} лет` : null].filter(Boolean).join(' · ')}
          </p>
        )}
        {cat.description && <p className="rating-screen__desc">{cat.description}</p>}
        <p className="rating-screen__meta">от {cat.owner_name}</p>
      </div>
      <div className="rating-screen__footer">
        <StarRating value={score} onChange={setScore} disabled={submitting} />
        <p className="rating-screen__score-label">{SCORE_LABELS[score]}</p>
        <button
          className="btn-primary"
          onClick={handleRate}
          disabled={score === 0 || submitting}
        >
          {submitting ? 'Отправляем...' : score === 0 ? 'Выберите оценку' : `Оценить на ${score}`}
        </button>
      </div>
    </div>
  );
}
