import { useState } from 'react';

// Иконка «Монеты». Основной арт кладётся на сервер в /assets/coin.png
// (казино-стиль, прозрачный фон). Пока файла нет — рисуем SVG-фоллбэк,
// чтобы интерфейс не ломался.
export default function Coin({ size = 18 }: { size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return (
      <img
        src="/assets/coin.png"
        width={size} height={size}
        alt="Монеты"
        style={{ display: 'inline-block', verticalAlign: '-3px', objectFit: 'contain' }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: '-3px' }} aria-label="Монеты">
      <defs>
        <radialGradient id="coin-g" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffe9a3" />
          <stop offset="55%" stopColor="#f5c518" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#coin-g)" stroke="#8a6508" strokeWidth="1" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="rgba(138,101,8,0.55)" strokeWidth="1" strokeDasharray="2 1.6" />
      <text x="12" y="16" textAnchor="middle" fontSize="10.5" fontWeight="900" fill="#7a5906">S</text>
    </svg>
  );
}
