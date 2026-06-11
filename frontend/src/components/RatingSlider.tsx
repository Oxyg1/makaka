import { useRef, useState, useCallback, useEffect } from 'react';
import { hapticImpact } from '../utils/haptics';
import './RatingSlider.css';

const COLORS = ['','#ff453a','#ff453a','#ff6b35','#ff9500','#ffcc00','#a8cc00','#34c759','#00b140','#32ade6','#7c6df9'];
const HINT_KEY = 'rs_dragged_once';

interface Props { value: number; onChange: (v: number) => void; disabled?: boolean; }

export default function RatingSlider({ value, onChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState<boolean>(() => localStorage.getItem(HINT_KEY) !== '1');
  const trackRef = useRef<HTMLDivElement>(null);

  // Thumb always sits on a discrete tick. The CSS transition does the smooth
  // glide between ticks when the finger crosses a threshold during a drag.
  const pct = value > 0 ? ((value - 1) / 9) * 100 : 0;
  const color = COLORS[value] || '#6d6d71';

  useEffect(() => {
    if (dragging && showHint) {
      setShowHint(false);
      localStorage.setItem(HINT_KEY, '1');
    }
  }, [dragging, showHint]);

  const updateFromX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.round(ratio * 9) + 1;
    if (v !== value) { hapticImpact('light'); onChange(v); }
  }, [value, onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || disabled) return;
    updateFromX(e.clientX);
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div
      className={`rating-slider${disabled ? ' rating-slider--disabled' : ''}${showHint ? ' rating-slider--hint' : ''}`}
      style={{ '--rs-color': color } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="rating-slider__track-wrap" ref={trackRef}>
        <div className="rating-slider__fill" style={{ width: `${pct}%` }} />
        <div className="rating-slider__thumb" style={{ left: `${pct}%` }} />
      </div>

      <div className="rating-slider__ticks">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}
            className={`rating-slider__tick${i + 1 <= value ? ' rating-slider__tick--active' : ''}`}>
            {i + 1}
          </span>
        ))}
      </div>

      {showHint && (
        <div className="rating-slider__hint" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 6 9 12 15 18" />
          </svg>
          Потяните, чтобы оценить
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </div>
      )}

      <div className={`rating-slider__score${dragging ? ' rating-slider__score--bump' : ''}`}>
        {value > 0 ? value : '—'}
      </div>
    </div>
  );
}
