// Skeleton-заглушки: вместо спиннеров показываем «каркас» будущего
// контента — переход ощущается мгновенным, layout не прыгает.
// Все анимации — на transform (shimmer едет по ::after), GPU-friendly.

import type { CSSProperties } from 'react';

/** Базовый блок-мерцалка. Форму задаёт style/класс места использования. */
export function Skel({ style, className = '' }: { style?: CSSProperties; className?: string }) {
  return <div className={`skel ${className}`} style={style} aria-hidden="true" />;
}

/** Строка списка: круглый аватар + две строки текста + блок справа. */
export function SkelRow({ avatar = 42 }: { avatar?: number }) {
  return (
    <div className="skel-row" aria-hidden="true">
      <Skel style={{ width: avatar, height: avatar, borderRadius: '50%' }} />
      <div className="skel-row__lines">
        <Skel style={{ height: 13, width: '55%' }} />
        <Skel style={{ height: 10, width: '35%' }} />
      </div>
      <Skel style={{ width: 54, height: 34, borderRadius: 12 }} />
    </div>
  );
}

/** Карточка сделки/ордера в ленте. */
export function SkelCard({ height = 168 }: { height?: number }) {
  return <Skel style={{ height, borderRadius: 20 }} />;
}

/** Сетка квадратных карточек (инвентарь, коллекции). */
export function SkelGrid({ n = 6, className = 'whales__grid' }: { n?: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Skel key={i} style={{ aspectRatio: '1', borderRadius: 16 }} />
      ))}
    </div>
  );
}

/** Подиум топ-3: три колонки с кругом и подписями. */
export function SkelPodium() {
  return (
    <div className="skel-podium" aria-hidden="true">
      {[54, 78, 40].map((h, i) => (
        <div key={i} className="skel-podium__col" style={{ paddingBottom: h }}>
          <Skel style={{ width: i === 1 ? 84 : 64, height: i === 1 ? 84 : 64, borderRadius: '50%' }} />
          <Skel style={{ height: 11, width: '70%' }} />
          <Skel style={{ height: 10, width: '45%' }} />
        </div>
      ))}
    </div>
  );
}
