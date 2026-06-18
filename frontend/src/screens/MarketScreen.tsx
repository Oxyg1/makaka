import { useEffect, useState, useCallback } from 'react';
import { getMarket } from '../api';
import type { MarketEntry, AppConfig } from '../types';
import FrogCard from '../components/FrogCard';
import FilterSheet, { EMPTY_FILTER, isEmptyFilter, type FilterValue } from '../components/FilterSheet';
import FrogDetailModal from '../components/FrogDetailModal';
import { hapticImpact } from '../utils/haptics';
import './MarketScreen.css';

interface Props {
  myUserId: number | null;
  config: AppConfig | null;
  refreshKey?: number;
}

type Sort = 'new' | 'price_asc' | 'price_desc' | 'rare';
const SORTS: { v: Sort; l: string }[] = [
  { v: 'new', l: 'Свежие' },
  { v: 'price_asc', l: 'Цена ↑' },
  { v: 'price_desc', l: 'Цена ↓' },
  { v: 'rare', l: 'Редкие' },
];

const KINDS: { v: '' | 'trade' | 'sell'; l: string }[] = [
  { v: '', l: 'Все' },
  { v: 'trade', l: 'Обмен' },
  { v: 'sell', l: 'Продажа' },
];

export default function MarketScreen({ myUserId, config, refreshKey }: Props) {
  const [items, setItems] = useState<MarketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const [viewFrog, setViewFrog] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getMarket({
        kind: filter.kind,
        models: filter.models,
        backdrops: filter.backdrops,
        patterns: filter.patterns,
        min_price: filter.min_price,
        max_price: filter.max_price,
        sort: filter.sort,
      });
      setItems(r);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const activeAttr = filter.models.length + filter.backdrops.length + filter.patterns.length;

  return (
    <div className="screen">
      <header className="market__header">
        <div className="market__header-top">
          <div>
            <h1 className="screen__title">Маркет</h1>
            <p className="screen__subtitle">
              {loading ? 'Загружаем…' : `${items.length} ${plural(items.length, 'ордер', 'ордера', 'ордеров')}`}
            </p>
          </div>
          <button
            className={`market__filter-btn${activeAttr > 0 ? ' market__filter-btn--active' : ''}`}
            onClick={() => { hapticImpact('light'); setShowFilter(true); }}
            aria-label="Фильтры"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            {activeAttr > 0 && <span className="market__filter-count">{activeAttr}</span>}
          </button>
        </div>

        {/* Горизонтальные быстрые фильтры — стиль Portals */}
        <div className="market__row">
          {KINDS.map(k => (
            <button
              key={k.v || 'all'}
              className={`pill${(filter.kind ?? '') === k.v ? ' pill--active' : ''}`}
              onClick={() => { hapticImpact('light'); setFilter(f => ({ ...f, kind: (k.v || undefined) as FilterValue['kind'] })); }}
            >
              {k.l}
            </button>
          ))}
          <div className="market__row-sep" />
          {SORTS.map(s => (
            <button
              key={s.v}
              className={`pill${(filter.sort ?? 'new') === s.v ? ' pill--active' : ''}`}
              onClick={() => { hapticImpact('light'); setFilter(f => ({ ...f, sort: s.v })); }}
            >
              {s.l}
            </button>
          ))}
        </div>
      </header>

      <div className="screen__scroll market__scroll">
        {loading && items.length === 0 && (
          <div className="market__skeleton">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="market__skeleton-cell" />)}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="empty">
            <div className="empty__icon">🪷</div>
            <h3>Пока пусто</h3>
            <p>Ничего не нашлось.<br />Попробуйте сбросить фильтры или зайдите позже.</p>
            {!isEmptyFilter(filter) && (
              <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setFilter(EMPTY_FILTER)}>
                Сбросить фильтры
              </button>
            )}
          </div>
        )}

        <div className="market__grid">
          {items.map(o => (
            <FrogCard
              key={o.id}
              frog={{ id: o.frog_id, number: o.number, model: o.model, backdrop: o.backdrop, pattern: o.pattern, image_url: o.image_url }}
              size="md"
              badge={o.kind === 'trade' ? 'обмен' : `${o.price_stars ?? ''}⭐`}
              onClick={() => { hapticImpact('light'); setViewFrog(o.frog_id); }}
            />
          ))}
        </div>
      </div>

      {showFilter && (
        <FilterSheet
          value={filter}
          onClose={() => setShowFilter(false)}
          onApply={v => { setFilter(v); setShowFilter(false); }}
        />
      )}

      {viewFrog !== null && (
        <FrogDetailModal
          frogId={viewFrog}
          myUserId={myUserId}
          config={config}
          onClose={() => setViewFrog(null)}
          onCreatedOffer={load}
          onCreatedOrder={load}
        />
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return many;
  const m10 = n % 10;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}
