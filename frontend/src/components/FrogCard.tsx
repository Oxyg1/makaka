import { useEffect, useState, type CSSProperties } from 'react';
import type { Frog } from '../types';
import { getBackdropInfo, modelImageUrl, patternImageUrl } from '../utils/changes';
import './FrogCard.css';

// Запасные градиенты на случай если backdrop ещё не загрузился или API недоступен.
const FALLBACK_GRADIENTS: Record<string, string> = {
  Mint:     'linear-gradient(135deg,#a7f3d0 0%,#34d399 100%)',
  Lagoon:   'linear-gradient(135deg,#6ee7b7 0%,#0e7490 100%)',
  Sunset:   'linear-gradient(135deg,#fdba74 0%,#ec4899 100%)',
  Jungle:   'linear-gradient(135deg,#4ade80 0%,#166534 100%)',
  Aurora:   'linear-gradient(135deg,#a78bfa 0%,#22d3ee 100%)',
  Twilight: 'linear-gradient(135deg,#1e3a8a 0%,#9333ea 100%)',
  Coral:    'linear-gradient(135deg,#fda4af 0%,#f59e0b 100%)',
  Obsidian: 'linear-gradient(135deg,#1f2937 0%,#0f172a 100%)',
};

function FrogFace({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.35))' }}>
      <defs>
        <linearGradient id="frog-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#86efac"/>
          <stop offset="1" stopColor="#15803d"/>
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="40" rx="22" ry="18" fill="url(#frog-body)"/>
      <circle cx="22" cy="22" r="9" fill="url(#frog-body)"/>
      <circle cx="42" cy="22" r="9" fill="url(#frog-body)"/>
      <circle cx="22" cy="22" r="4" fill="#fff"/>
      <circle cx="42" cy="22" r="4" fill="#fff"/>
      <circle cx="22.5" cy="23.5" r="1.9" fill="#0d1410"/>
      <circle cx="42.5" cy="23.5" r="1.9" fill="#0d1410"/>
      <path d="M22 42c4 4 16 4 20 0" stroke="#0d1410" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

interface Props {
  frog: Pick<Frog, 'number' | 'model' | 'backdrop' | 'pattern' | 'image_url'> & { id?: number };
  size?: 'sm' | 'md' | 'lg';
  badge?: string;
  onClick?: () => void;
}

export default function FrogCard({ frog, size = 'md', badge, onClick }: Props) {
  const [bd, setBd] = useState<{ center?: string; edge?: string; pattern?: string }>({});
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let alive = true;
    getBackdropInfo(frog.backdrop).then(info => {
      if (!alive || !info) return;
      setBd({ center: info.centerColor, edge: info.edgeColor, pattern: info.patternColor });
    });
    return () => { alive = false; };
  }, [frog.backdrop]);

  const artStyle: CSSProperties = bd.center
    ? { background: `radial-gradient(circle at 50% 35%, ${bd.center} 0%, ${bd.edge ?? bd.center} 100%)` }
    : { background: FALLBACK_GRADIENTS[frog.backdrop] ?? 'linear-gradient(135deg,#4ade80 0%,#16a34a 100%)' };

  const patternStyle: CSSProperties = {
    backgroundImage: `url(${patternImageUrl(frog.pattern, 256)})`,
    backgroundSize: size === 'sm' ? '40px 40px' : size === 'lg' ? '64px 64px' : '52px 52px',
    backgroundRepeat: 'repeat',
    opacity: 0.18,
    filter: bd.pattern ? undefined : 'brightness(1.4) contrast(1.1)',
  };

  const modelSize = size === 'lg' ? 512 : size === 'sm' ? 128 : 256;
  const cls = `frog-card frog-card--${size}${onClick ? ' frog-card--btn' : ''}`;

  return (
    <button className={cls} onClick={onClick} type="button" disabled={!onClick}>
      <div className="frog-card__art" style={artStyle}>
        <div className="frog-card__pattern" style={patternStyle} />
        {frog.image_url && !imgError ? (
          <img src={frog.image_url} alt={frog.model} onError={() => setImgError(true)} />
        ) : (
          <img
            src={modelImageUrl(frog.model, modelSize)}
            alt={frog.model}
            onError={() => setImgError(true)}
            className="frog-card__model-img"
            style={imgError ? { display: 'none' } : undefined}
          />
        )}
        {imgError && <FrogFace size={size === 'lg' ? 96 : size === 'sm' ? 44 : 72} />}
        {badge && <span className="frog-card__badge">{badge}</span>}
      </div>
      <div className="frog-card__body">
        <div className="frog-card__model">{frog.model}</div>
        <div className="frog-card__meta">
          <span className="frog-card__num">#{frog.number}</span>
          <span className="frog-card__dot">·</span>
          <span>{frog.backdrop}</span>
        </div>
      </div>
    </button>
  );
}
