import { useRef, useState, useCallback } from 'react';
import { hapticImpact } from '../utils/haptics';
import './RatingSlider.css';

const COLORS = ['','#ff453a','#ff453a','#ff6b35','#ff9500','#ffcc00','#a8cc00','#34c759','#00b140','#a78bfa','#7c6df9'];

interface Props { value: number; onChange: (v: number) => void; disabled?: boolean; }

export default function RatingSlider({ value, onChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = value > 0 ? ((value - 1) / 9) * 100 : 0;
  const color = COLORS[value] || '#6d6d71';

  const valueFromX = useCallback((clientX: number) => {
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
    valueFromX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || disabled) return;
    valueFromX(e.clientX);
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div
      className={`rating-slider${disabled ? ' rating-slider--disabled' : ''}`}
      style={{ '--rs-color': color } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="rating-slider__track-wrap" ref={trackRef}>
        <div className="rating-slider__fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="rating-slider__ticks">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}
            className={`rating-slider__tick${i + 1 <= value ? ' rating-slider__tick--active' : ''}`}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className={`rating-slider__score${dragging ? ' rating-slider__score--bump' : ''}`}>
        {value > 0 ? value : '—'}
      </div>
    </div>
  );
}
