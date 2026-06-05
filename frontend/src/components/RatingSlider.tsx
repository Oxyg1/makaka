import { useRef, useState } from 'react';
import { hapticSelection } from '../utils/haptics';
import './RatingSlider.css';

interface Props {
  value: number;
  onChange: (score: number) => void;
  disabled?: boolean;
}

const SCORE_COLORS = ['', '#FF3B30', '#FF3B30', '#FF6B35', '#FF9500', '#FFCC00', '#A8CC00', '#34C759', '#00B140', '#007AFF', '#AF52DE'];

export default function RatingSlider({ value, onChange, disabled }: Props) {
  const [bumping, setBumping] = useState(false);
  const prevValue = useRef(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const v = parseInt(e.target.value, 10);
    if (v !== prevValue.current) {
      hapticSelection();
      prevValue.current = v;
      setBumping(false);
      requestAnimationFrame(() => setBumping(true));
    }
    onChange(v);
  }

  const pct = ((value - 1) / 9) * 100;
  const color = value > 0 ? SCORE_COLORS[value] : '#8E8E93';

  return (
    <div className="rating-slider">
      <div className={`rating-slider__score${bumping ? ' rating-slider__score--bump' : ''}`} style={{ color }}>
        {value > 0 ? value : '—'}
      </div>
      <div className="rating-slider__track-wrap">
        <input
          type="range"
          min={1}
          max={10}
          value={value || 1}
          onChange={handleChange}
          disabled={disabled}
          className="rating-slider__input"
          style={{
            '--fill-pct': `${value > 0 ? pct : 0}%`,
            '--fill-color': color,
          } as React.CSSProperties}
        />
        <div className="rating-slider__labels">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <span
              key={n}
              className={`rating-slider__tick${n <= value ? ' rating-slider__tick--active' : ''}`}
              style={n <= value ? { color } : {}}
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
