import { useState } from 'react';
import { hapticImpact } from '../utils/haptics';
import './RatingSlider.css';

const COLORS = ['','#ff453a','#ff453a','#ff6b35','#ff9500','#ffcc00','#a8cc00','#34c759','#00b140','#a78bfa','#7c6df9'];
const THUMB = 26; // px

interface Props { value: number; onChange: (v: number) => void; disabled?: boolean; }

export default function RatingSlider({ value, onChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const pct = ((value - 1) / 9) * 100;
  const color = COLORS[value] || '#6d6d71';
  // Keep thumb fully within track at both ends
  const thumbOffset = (THUMB / 2) * (1 - 2 * pct / 100);
  const thumbLeft = `calc(${pct}% + ${thumbOffset}px)`;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) { hapticImpact('light'); onChange(parseInt(e.target.value)); }
  };

  return (
    <div className={`rating-slider${disabled ? ' rating-slider--disabled' : ''}`}
      style={{ '--rs-color': color } as React.CSSProperties}>

      {/* Transparent input covers the entire widget for easy dragging */}
      <input
        className="rating-slider__input"
        type="range" min={1} max={10} step={1}
        value={value || 1}
        onChange={handleInput}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        disabled={disabled}
      />

      <div className="rating-slider__track-wrap">
        <div className="rating-slider__fill" style={{ width: `${pct}%` }} />
        <div className="rating-slider__thumb"
          style={{
            left: thumbLeft,
            transform: `translateX(-50%) scale(${dragging ? 1.18 : 1})`,
          }}
        />
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
