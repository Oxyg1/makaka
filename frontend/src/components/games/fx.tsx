// Общие «джус»-эффекты игр: каунт-ап чисел, конфетти, всплывающие монеты.
// Всё на transform/opacity — GPU, без layout.

import { useEffect, useRef, useState } from 'react';

/** Плавный набег числа от предыдущего значения к новому (для очков/наград). */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(Math.round(from + (target - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Конфетти-взрыв (12 частиц) по центру родителя. Ключом перезапускается. */
export function Confetti() {
  const COLORS = ['#4ade80', '#f5c518', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa'];
  return (
    <span className="fx-confetti" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const d = 46 + (i % 3) * 22;
        return (
          <i
            key={i}
            style={{
              background: COLORS[i % COLORS.length],
              '--dx': `${Math.cos(a) * d}px`,
              '--dy': `${Math.sin(a) * d - 30}px`,
              '--rot': `${(i % 2 ? 1 : -1) * (180 + i * 40)}deg`,
              animationDelay: `${(i % 4) * 30}ms`,
            } as React.CSSProperties}
          />
        );
      })}
    </span>
  );
}

/** Фонтан монет вверх (награда). Ключом перезапускается. */
export function CoinBurst({ n = 6 }: { n?: number }) {
  return (
    <span className="fx-coinburst" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          style={{
            '--dx': `${(i - (n - 1) / 2) * 26 + (i % 2 ? 6 : -6)}px`,
            '--dy': `${-70 - (i % 3) * 26}px`,
            animationDelay: `${i * 45}ms`,
          } as React.CSSProperties}
        >🪙</i>
      ))}
    </span>
  );
}
