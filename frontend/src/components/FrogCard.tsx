import type { CSSProperties } from 'react';
import type { Frog } from '../types';
import './FrogCard.css';

const BACKDROP_GRADIENTS: Record<string, string> = {
  Mint:     'linear-gradient(135deg,#a7f3d0 0%,#34d399 100%)',
  Lagoon:   'linear-gradient(135deg,#6ee7b7 0%,#0e7490 100%)',
  Sunset:   'linear-gradient(135deg,#fdba74 0%,#ec4899 100%)',
  Jungle:   'linear-gradient(135deg,#4ade80 0%,#166534 100%)',
  Aurora:   'linear-gradient(135deg,#a78bfa 0%,#22d3ee 100%)',
  Twilight: 'linear-gradient(135deg,#1e3a8a 0%,#9333ea 100%)',
  Coral:    'linear-gradient(135deg,#fda4af 0%,#f59e0b 100%)',
  Obsidian: 'linear-gradient(135deg,#1f2937 0%,#0f172a 100%)',
};

function backdropStyle(name: string): CSSProperties {
  return { background: BACKDROP_GRADIENTS[name] ?? 'linear-gradient(135deg,#4ade80 0%,#16a34a 100%)' };
}

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
  const cls = `frog-card frog-card--${size}${onClick ? ' frog-card--btn' : ''}`;
  return (
    <button className={cls} onClick={onClick} type="button" disabled={!onClick}>
      <div className="frog-card__art" style={backdropStyle(frog.backdrop)}>
        <PatternOverlay name={frog.pattern} />
        {frog.image_url ? <img src={frog.image_url} alt={frog.model} /> : <FrogFace size={size === 'lg' ? 96 : size === 'sm' ? 44 : 72} />}
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

function PatternOverlay({ name }: { name: string }) {
  switch (name) {
    case 'Dots':
      return <div className="frog-card__pattern" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1.5px, transparent 1.5px)', backgroundSize: '14px 14px' }} />;
    case 'Stripes':
      return <div className="frog-card__pattern" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 6px, transparent 6px 14px)' }} />;
    case 'Camo':
      return <div className="frog-card__pattern" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 6px, transparent 7px), radial-gradient(rgba(0,0,0,0.15) 5px, transparent 6px)', backgroundSize: '24px 24px, 30px 30px', backgroundPosition: '0 0, 12px 12px' }} />;
    case 'Stars':
      return <div className="frog-card__pattern frog-card__pattern--stars" />;
    case 'Vines':
      return <div className="frog-card__pattern" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(34,197,94,0.18) 0 3px, transparent 3px 22px)' }} />;
    case 'Glyphs':
      return <div className="frog-card__pattern" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 18px), repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 18px)' }} />;
    case 'Lotus':
      return <div className="frog-card__pattern" style={{ backgroundImage: 'radial-gradient(ellipse 22px 12px at center, rgba(255,255,255,0.10), transparent 70%)', backgroundSize: '40px 40px' }} />;
    default: return null;
  }
}
