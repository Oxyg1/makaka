import { useState, useEffect, type CSSProperties } from 'react';
import type { Frog } from '../types';
import { getBackdropInfoSync, loadPreload, modelImageUrl, patternImageUrl, type BackdropInfo } from '../utils/changes';
import LottieGift from './LottieGift';
import './FrogCard.css';

// Фоллбэк-градиенты пока preload не приехал.
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

// Классическая TG-NFT расстановка символов вокруг модели.
// Размер карточки = 100×100%, центр для модели — точка (50,50).
//   - 4 крупных в углах (повёрнуты «лучом» от центра)
//   - 4 средних посередине каждой стороны
//   - 8 мелких в промежутках для плотности
// Симбол отрисовываем через CSS mask + цвет patternColor — получаем
// настоящий монохромный паттерн, а не «плитку».
const SYMBOLS: { top: number; left: number; size: number; opacity: number; rot: number }[] = [
  // 4 крупных по углам
  { top: 6,  left: 6,  size: 18, opacity: 0.55, rot: -30 },
  { top: 6,  left: 76, size: 18, opacity: 0.55, rot: 30 },
  { top: 76, left: 6,  size: 18, opacity: 0.55, rot: -150 },
  { top: 76, left: 76, size: 18, opacity: 0.55, rot: 150 },
  // 4 средних по сторонам
  { top: 2,  left: 41, size: 14, opacity: 0.45, rot: 0 },
  { top: 84, left: 41, size: 14, opacity: 0.45, rot: 180 },
  { top: 41, left: 2,  size: 14, opacity: 0.45, rot: -90 },
  { top: 41, left: 84, size: 14, opacity: 0.45, rot: 90 },
  // 8 мелких заполняющих
  { top: 22, left: 22, size: 9, opacity: 0.35, rot: -15 },
  { top: 22, left: 69, size: 9, opacity: 0.35, rot: 15 },
  { top: 69, left: 22, size: 9, opacity: 0.35, rot: -165 },
  { top: 69, left: 69, size: 9, opacity: 0.35, rot: 165 },
  { top: 17, left: 47, size: 7, opacity: 0.3,  rot: 0 },
  { top: 76, left: 47, size: 7, opacity: 0.3,  rot: 180 },
  { top: 47, left: 17, size: 7, opacity: 0.3,  rot: -90 },
  { top: 47, left: 76, size: 7, opacity: 0.3,  rot: 90 },
];

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
  frog: Pick<Frog, 'number' | 'model' | 'backdrop' | 'pattern' | 'image_url' | 'center_color' | 'edge_color' | 'pattern_color'> & { id?: number };
  size?: 'sm' | 'md' | 'lg';
  badge?: string;
  /** не показывать оверлей с названием (когда имя выводится отдельно) */
  hideLabel?: boolean;
  /** анимированный стикер (lottie) вместо PNG — только в детали */
  animated?: boolean;
  onClick?: () => void;
}

export default function FrogCard({ frog, size = 'md', badge, hideLabel, animated, onClick }: Props) {
  const [imgError, setImgError] = useState(false);
  // Цвета фона: приоритет — данные самой лягушки (бэкенд, из парсера Telegram).
  // Фоллбэк — preload (changes.tg), который на части серверов пустой.
  const hasDataColor = !!frog.center_color;
  const [info, setInfo] = useState<BackdropInfo | null>(() => getBackdropInfoSync(frog.backdrop));

  useEffect(() => {
    if (hasDataColor) return; // цвета уже есть в данных — preload не нужен
    const sync = getBackdropInfoSync(frog.backdrop);
    if (sync) { setInfo(sync); return; }
    let alive = true;
    loadPreload()
      .then(() => { if (alive) setInfo(getBackdropInfoSync(frog.backdrop)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [frog.backdrop, hasDataColor]);

  const center = frog.center_color ?? info?.centerColor ?? null;
  const edge = frog.edge_color ?? info?.edgeColor ?? center;
  const symbolColor = frog.pattern_color ?? info?.patternColor ?? 'rgba(255,255,255,0.85)';

  // TG-стиль: база = edge-цвет, сверху радиальный «halo» из center-цвета.
  const artStyle: CSSProperties = center
    ? { background: `radial-gradient(125% 90% at 50% 16%, ${center} 0%, ${edge!} 62%)`, backgroundColor: edge! }
    : { background: FALLBACK_GRADIENTS[frog.backdrop] ?? 'linear-gradient(135deg,#4ade80 0%,#16a34a 100%)' };

  const symbolMaskUrl = `url(${patternImageUrl(frog.pattern, size === 'lg' ? 128 : 64)})`;
  const modelSize: 128 | 256 | 512 = size === 'lg' ? 512 : size === 'sm' ? 128 : 256;
  const cls = `frog-card frog-card--${size}${onClick ? ' frog-card--btn' : ''}`;

  return (
    <button className={cls} onClick={onClick} type="button" disabled={!onClick}>
      <div className="frog-card__art" style={artStyle}>
        <div className="frog-card__art-fill">
          {/* Символы паттерна — позиции в % считаются от квадрата */}
          {SYMBOLS.map((s, i) => (
            <span
              key={i}
              className="frog-card__symbol"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: `${s.size}%`,
                height: `${s.size}%`,
                opacity: s.opacity,
                transform: `rotate(${s.rot}deg)`,
                background: symbolColor,
                WebkitMaskImage: symbolMaskUrl,
                maskImage: symbolMaskUrl,
              }}
            />
          ))}
          {animated ? (
            <LottieGift model={frog.model} className="frog-card__model-img" />
          ) : !imgError ? (
            <img
              src={modelImageUrl(frog.model, modelSize)}
              alt={frog.model}
              onError={() => setImgError(true)}
              className="frog-card__model-img"
              loading="lazy"
            />
          ) : (
            <FrogFace size={size === 'lg' ? 96 : size === 'sm' ? 44 : 72} />
          )}
          {badge && <span className="frog-card__badge">{badge}</span>}
          {!hideLabel && (
            <div className="frog-card__overlay">
              <span className="frog-card__overlay-name">{frog.model}</span>
              <span className="frog-card__overlay-meta">#{frog.number} · {frog.backdrop}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
