import { useState } from 'react';
import './StarRating.css';

interface Props {
  value: number;
  onChange: (score: number) => void;
  disabled?: boolean;
}

export default function StarRating({ value, onChange, disabled }: Props) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="star-rating" role="group" aria-label="Rate this cat">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          className={`star${n <= display ? ' star--filled' : ''}`}
          onClick={() => !disabled && onChange(n)}
          onMouseEnter={() => !disabled && setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onTouchStart={() => !disabled && setHovered(n)}
          disabled={disabled}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
