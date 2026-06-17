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

  const activeFilters = [
    filter.kind && (filter.kind === 'trade' ? 'Обмен' : 'Продажа'),
    ...filter.models, ...filter.backdrops, ...filter.patterns,
  ].filter(Boolean);

  return (
    <div className="screen">
      <div className="screen__header">
        <div>
          <h1 className="screen__title">Маркет</h1>
          <p className="screen__subtitle">{items.length} активн{items.length === 1 ? 'ый ордер' : items.length < 5 ? 'ых ордера' : 'ых ордеров'}</p>
        </div>
        <button
          className={`market__filter-btn${isEmptyFilter(filter) ? '' : ' market__filter-btn--active'}`}
          onClick={() => { hapticImpact('light'); setShowFilter(true); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          {!isEmptyFilter(filter) && <span className="market__filter-dot" />}
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div className="market__active-chips">
          {activeFilters.slice(0, 8).map((f, i) => <span key={i} className="chip chip--primary">{f}</span>)}
          {activeFilters.length > 8 && <span className="chip">+{activeFilters.length - 8}</span>}
        </div>
      )}

      <div className="screen__scroll">
        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>}

        {!loading && items.length === 0 && (
          <div className="empty">
            <div className="empty__icon">🪷</div>
            <h3>Пока пусто</h3>
            <p>Никто не выставил лягушек по вашим фильтрам.<br />Попробуйте сбросить.</p>
          </div>
        )}

        <div className="market__grid">
          {items.map(o => (
            <div key={o.id} className="market__cell" onClick={() => { hapticImpact('light'); setViewFrog(o.frog_id); }}>
              <FrogCard
                frog={{ id: o.frog_id, number: o.number, model: o.model, backdrop: o.backdrop, pattern: o.pattern, image_url: o.image_url }}
                size="md"
                badge={o.kind === 'trade' ? 'обмен' : o.kind === 'sell' ? `${o.price_stars}⭐` : `${o.price_stars ?? ''}⭐/обмен`}
              />
            </div>
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
