import { useState, useEffect } from 'react';
import { getMyCats } from '../api';
import type { CatWithStats } from '../types';
import './MyCatsScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

export default function MyCatsScreen() {
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyCats()
      .then(setCats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mycats">
      <h2>Мои коты</h2>

      {loading && <p style={{ color: 'var(--tg-theme-hint-color)' }}>Загружаем...</p>}

      {!loading && cats.length === 0 && (
        <div className="mycats__empty">
          <div style={{ fontSize: 56 }}>🐱</div>
          <p>Вы ещё не добавили ни одного кота.</p>
          <p>Нажмите «Добавить», чтобы выставить своего питомца на оценку!</p>
        </div>
      )}

      {!loading && cats.length > 0 && (
        <div className="mycats__list">
          {cats.map(cat => (
            <div key={cat.id} className="mycats__card">
              <img
                className="mycats__photo"
                src={`${BASE}${cat.photo_url}`}
                alt={cat.name}
              />
              <div className="mycats__info">
                <div className="mycats__name">{cat.name}</div>
                {cat.breed && <div className="mycats__breed">{cat.breed}</div>}
                <div className="mycats__stats">
                  {cat.vote_count > 0 ? (
                    <>
                      <span className="mycats__stats-avg">⭐ {cat.avg_score}</span>
                      <span className="mycats__stats-votes">{cat.vote_count} оценок</span>
                    </>
                  ) : (
                    <span className="mycats__stats-votes">Пока нет оценок</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
