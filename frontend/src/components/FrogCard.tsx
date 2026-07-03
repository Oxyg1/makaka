import { useState, useEffect, useId, type CSSProperties } from 'react';
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
// TG-стиль: симметричная раскладка символов РАЗНОГО размера и яркости
// (крупные по углам, средние по сторонам, мелкие ярче у центра).
const SYMBOLS: { top: number; left: number; size: number; opacity: number; rot: number }[] = [
  // углы — крупные
  { top: 6, left: 6, size: 17, opacity: 0.28, rot: 0 },
  { top: 6, left: 77, size: 17, opacity: 0.28, rot: 0 },
  { top: 77, left: 6, size: 17, opacity: 0.28, rot: 0 },
  { top: 77, left: 77, size: 17, opacity: 0.28, rot: 0 },
  // середины сторон — средние
  { top: 2, left: 43, size: 12, opacity: 0.18, rot: 0 },
  { top: 86, left: 43, size: 12, opacity: 0.18, rot: 0 },
  { top: 43, left: 2, size: 12, opacity: 0.18, rot: 0 },
  { top: 43, left: 86, size: 12, opacity: 0.18, rot: 0 },
  // внутреннее кольцо — мелкие, чуть ярче
  { top: 25, left: 25, size: 9, opacity: 0.34, rot: 0 },
  { top: 25, left: 66, size: 9, opacity: 0.34, rot: 0 },
  { top: 66, left: 25, size: 9, opacity: 0.34, rot: 0 },
  { top: 66, left: 66, size: 9, opacity: 0.34, rot: 0 },
  // мелкие филлеры у сторон
  { top: 21, left: 46, size: 6.5, opacity: 0.13, rot: 0 },
  { top: 73, left: 46, size: 6.5, opacity: 0.13, rot: 0 },
  { top: 46, left: 21, size: 6.5, opacity: 0.13, rot: 0 },
  { top: 46, left: 73, size: 6.5, opacity: 0.13, rot: 0 },
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
      <circle cx="22.5" cy="23.5" r="1.9" fill="#111214"/>
      <circle cx="42.5" cy="23.5" r="1.9" fill="#111214"/>
      <path d="M22 42c4 4 16 4 20 0" stroke="#111214" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

// Сдвиг hex-цвета на ФИКСИРОВАННУЮ величину по каналам (одинаковое расхождение
// для всех фонов) → rgb-строка. d<0 — темнее.
function shiftHex(hex: string | null | undefined, d: number): string | null {
  if (!hex) return null;
  const m = hex.replace('#', '');
  if (m.length < 6) return null;
  const ch = (i: number) => {
    const v = parseInt(m.slice(i, i + 2), 16);
    return Number.isNaN(v) ? null : Math.max(0, Math.min(255, v + d));
  };
  const r = ch(0), g = ch(2), b = ch(4);
  if (r === null || g === null || b === null) return null;
  return `rgb(${r},${g},${b})`;
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
  // Лента номера = цвет КРАЁВ фона (там она и сидит → сливается с углом),
  // с реальным градиентом и одинаковым фиксированным расхождением для всех фонов.
  const onTrade = !!badge;
  const ribbonText = onTrade ? badge! : `#${frog.number}`;
  const ribBase = edge ?? center ?? '#0e0f0f';
  const ribTop = onTrade ? '#1fae5a' : ribBase;
  const ribBot = onTrade ? '#0e7a3c' : (shiftHex(ribBase, -22) ?? ribBase);
  const gid = 'rib' + useId().replace(/[:]/g, '');

  // TG-стиль: база = edge-цвет, сверху радиальный «halo» из center-цвета.
  // TG-стиль: ровный радиальный градиент из центра (center→edge), центр по
  // центру карточки — за стикером, как в Telegram.
  const artStyle: CSSProperties = center
    ? { background: `radial-gradient(100% 100% at 50% 42%, ${center} 0%, ${edge!} 78%)`, backgroundColor: edge! }
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
          <svg className="frog-card__ribbon" viewBox="0 0 56 56" preserveAspectRatio="xMaxYMin meet" aria-hidden="true">
            <defs>
              <linearGradient id={gid} x1="55.56" y1="56" x2="0.44" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={ribBot} />
                <stop offset="100%" stopColor={ribTop} />
              </linearGradient>
            </defs>
            <path d="M22.34 0 C24.71 0 26.99 0.96 28.64 2.66 L53.51 28.2 C55.11 29.84 56 32.04 56 34.34 V54.24 C56 55.17 55.48 55.48 52.99 55.48 L0.52 3.01 C-0.17 2.32 -0.17 1.21 0.52 0.52 C0.85 0.19 1.30 0 1.76 0 Z" fill={`url(#${gid})`} />
            <text x="33" y="21.5" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={onTrade ? 10 : 11} fontWeight="600" transform="rotate(45, 33, 23)">{ribbonText}</text>
          </svg>
          {size === 'lg' && !hideLabel && (
            <div className="frog-card__overlay">
              <span className="frog-card__overlay-name">{frog.model}</span>
              <span className="frog-card__overlay-meta">{frog.backdrop}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
