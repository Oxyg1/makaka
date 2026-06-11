import { useState, useEffect, useCallback, useRef } from 'react';
import { getNextCat, rateCat, skipCat, resetRatings } from '../api';
import RatingSlider from '../components/RatingSlider';
import type { CatWithStats } from '../types';
import { hapticSuccess, hapticError, hapticImpact } from '../utils/haptics';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import { ageLabel } from '../components/CatCardModal';
import { useCatLike, syncCatLike } from '../utils/catLikes';
import StarBalanceButton from '../components/StarBalanceButton';
import SupportButton from '../components/SupportButton';
import ReportSheet from '../components/ReportSheet';
import './RatingScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

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
        <img className="rs__photo" src={`${BASE}${photos[0]}`}
          srcSet={`${BASE}${photos[0].replace('/uploads/', '/uploads/thumb_')} 400w, ${BASE}${photos[0]} 1200w`}
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
            src={`${BASE}${url}`}
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

function LikeOverlayButton({ catId, seedLiked, seedCount, disabled }: { catId: number; seedLiked: boolean; seedCount: number; disabled?: boolean }) {
  const { liked, count, toggle } = useCatLike(catId, seedLiked, seedCount);
  return (
    <button
      className={`rs__like-btn${liked ? ' rs__like-btn--active' : ''}`}
      onClick={() => { hapticImpact('light'); toggle(); }}
      disabled={disabled}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

function plural(n: number, a: string, b: string, c: string) {
  const m = Math.abs(n) % 100;
  if (m >= 11 && m <= 19) return c;
  switch (m % 10) { case 1: return a; case 2: case 3: case 4: return b; default: return c; }
}

type Dir = 'up' | 'left' | null;

function applyCat(cat: CatWithStats | null, set: {
  setCat: (c: CatWithStats | null) => void;
  setScore: (n: number) => void;
  setDir: (d: Dir) => void;
  setSubmitting: (b: boolean) => void;
}) {
  set.setCat(cat);
  set.setScore(5);
  set.setDir(null);
  set.setSubmitting(false);
  if (cat) syncCatLike(cat.id, cat.liked_by_me ?? false, cat.likes_count ?? 0);
}

export default function RatingScreen() {
  const [cat, setCat] = useState<CatWithStats | null | undefined>(undefined);
  const [score, setScore] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [dir, setDir] = useState<Dir>(null);
  const [count, setCount] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const setters = { setCat, setScore, setDir, setSubmitting };

  const loadNext = useCallback(async (): Promise<CatWithStats | null> => {
    const next = await getNextCat();
    if (next?.photo_url) new Image().src = `${BASE}${next.photo_url}`;
    return next ?? null;
  }, []);

  useEffect(() => {
    loadNext()
      .then(next => applyCat(next, setters))
      .catch(() => setCat(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d: Dir, action: () => Promise<void>) => {
    if (submitting) return;
    setSubmitting(true); setDir(d);

    // Run action + prefetch in parallel with the exit animation
    const pipeline = action()
      .then(() => { setCount(c => c + 1); return loadNext(); })
      .catch(async () => { try { return await loadNext(); } catch { return null; } });

    const animDone = new Promise<void>(r => setTimeout(r, 280));

    setCat(undefined); // show spinner immediately after animation starts
    Promise.all([pipeline, animDone]).then(([next]) => applyCat(next, setters));
  };

  const handleRate = () => {
    if (!cat) return;
    go('up', async () => { await rateCat(cat.id, scoreRef.current); hapticSuccess(); });
  };

  const handleSkip = () => {
    if (!cat) return;
    go('left', async () => { await skipCat(cat.id); hapticError(); });
  };

  const descSwipe = useSheetSwipe(() => setDescOpen(false));

  if (cat === undefined) return (
    <div className="rs__state"><div className="spinner" /><p>Ищем кота...</p></div>
  );

  if (cat === null) return (
    <RateAgainScreen count={count} plural={plural} onReset={async () => {
      setCat(undefined);
      try { await resetRatings(); } catch { /* continue even if reset fails */ }
      loadNext().then(next => applyCat(next, setters)).catch(() => setCat(null));
    }} />
  );

  return (
    <div className="rs">
      <div className="rs__topbar">
        {count > 0 ? <div className="rs__counter">Оценено: {count}</div> : <div />}
        <StarBalanceButton />
      </div>

      <div className="rs__scroll">
        <div className={`rs__card${dir ? ` rs__card--${dir}` : ''}`}>

          <PhotoCarousel
            photos={[cat.photo_url, ...(cat.extra_photos ?? [])]}
            name={cat.name}
            overlay={
              <>
                <div className="rs__overlay">
                  <span className="rs__badge">#{cat.id}</span>
                  <LikeOverlayButton catId={cat.id} seedLiked={cat.liked_by_me ?? false} seedCount={cat.likes_count ?? 0} disabled={submitting} />
                </div>
                {cat.owner_id != null && (
                  <SupportButton
                    recipientUserId={cat.owner_id}
                    recipientName={cat.owner_name}
                    context="cat"
                    entityId={cat.id}
                    className="support-btn--floating"
                  />
                )}
              </>
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
              <div className="rs__desc-wrap">
                <p className="rs__desc">{cat.description}</p>
                {cat.description.length > 80 && (
                  <button className="rs__desc-more-btn" onClick={() => setDescOpen(true)}>Подробнее</button>
                )}
              </div>
            )}

            <div className="rs__footer">
              <RatingSlider value={score} onChange={setScore} disabled={submitting} />
              <div className="rs__label-row">
                <p className="rs__label">{LABELS[score]}</p>
                {score > 0 && score < 3 && (
                  <button className="rs__report-link" onClick={() => setReportOpen(true)}>
                    Пожаловаться
                  </button>
                )}
              </div>
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

      {reportOpen && (
        <ReportSheet
          type="cat"
          entityId={cat.id}
          entityName={cat.name}
          onClose={() => setReportOpen(false)}
        />
      )}

      {descOpen && cat.description && (
        <div className="modal-overlay" onClick={() => setDescOpen(false)}>
          <div className="modal-sheet" ref={descSwipe.sheetRef}
            onTouchStart={descSwipe.handleTouchStart}
            onTouchMove={descSwipe.handleTouchMove}
            onTouchEnd={descSwipe.handleTouchEnd}
            onClick={e => e.stopPropagation()}
          >
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
