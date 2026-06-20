import { useEffect, useRef, useState } from 'react';
import type { AnimationItem } from 'lottie-web';
import { modelImageUrl, modelLottieUrl } from '../utils/changes';

// Анимированный стикер подарка. Пока lottie грузится / если не вышло —
// показываем статичный PNG. Используется только в детали (как в Gift Wiki).
export default function LottieGift({ model, className }: { model: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let anim: AnimationItem | null = null;
    let alive = true;
    setReady(false);
    setFailed(false);
    // lottie-web грузим динамически — он тяжёлый и нужен только в детали.
    Promise.all([
      import('lottie-web'),
      fetch(modelLottieUrl(model)).then(r => (r.ok ? r.json() : Promise.reject(new Error('no lottie')))),
    ])
      .then(([mod, data]) => {
        if (!alive || !ref.current) return;
        anim = mod.default.loadAnimation({
          container: ref.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: data,
        });
        setReady(true);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; anim?.destroy(); };
  }, [model]);

  return (
    <div className={className} style={{ position: 'relative' }}>
      {!ready && (
        <img
          src={modelImageUrl(model, 512)}
          alt={model}
          style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0 }}
        />
      )}
      <div ref={ref} style={{ width: '100%', height: '100%', display: ready && !failed ? 'block' : 'none' }} />
    </div>
  );
}
