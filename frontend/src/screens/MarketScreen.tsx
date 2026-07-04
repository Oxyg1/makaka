import { useEffect, useState, useCallback } from 'react';
import { getMarket } from '../api';
import type { MarketEntry, AppConfig } from '../types';
import FrogCard from '../components/FrogCard';
import FilterSheet, { EMPTY_FILTER, isEmptyFilter, type FilterValue } from '../components/FilterSheet';
import FrogDetailModal from '../components/FrogDetailModal';
import { hapticImpact } from '../utils/haptics';
import { getBackdropInfoSync, loadPreload, modelImageUrl, type BackdropInfo } from '../utils/changes';
import './MarketScreen.css';

interface Props {
  myUserId: number | null;
  config: AppConfig | null;
  refreshKey?: number;
  /** внутри таба «Трейд»: без своего заголовка и нижнего отступа */
  embedded?: boolean;
}

const SORTS: { v: 'new' | 'rare'; l: string }[] = [
  { v: 'new', l: 'Свежие' },
  { v: 'rare', l: 'Редкие' },
];

export default function MarketScreen({ myUserId, config, refreshKey, embedded }: Props) {
  const [items, setItems] = useState<MarketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const [viewFrog, setViewFrog] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getMarket({
        offer_models: filter.offer_models,
        offer_backdrops: filter.offer_backdrops,
        offer_patterns: filter.offer_patterns,
        wants_models: filter.wants_models,
        wants_backdrops: filter.wants_backdrops,
        wants_patterns: filter.wants_patterns,
        sort: filter.sort,
      });
      setItems(r);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const activeAttr =
    (filter.offer_models?.length ?? 0)
    + (filter.offer_backdrops?.length ?? 0)
    + (filter.offer_patterns?.length ?? 0)
    + (filter.wants_models?.length ?? 0)
    + (filter.wants_backdrops?.length ?? 0)
    + (filter.wants_patterns?.length ?? 0);

  return (
    <div className={`screen${embedded ? ' screen--embedded' : ''}`}>
      <header className="market__header">
        <div className="market__header-top">
          <div>
            {!embedded && <h1 className="screen__title">Обмены</h1>}
            <p className="screen__subtitle">
              {loading ? 'Загружаем…' : `${items.length} ${plural(items.length, 'предложение', 'предложения', 'предложений')}`}
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

        <div className="market__row">
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
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="market__skeleton-card" />)}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="empty">
            <div className="empty__icon">🪷</div>
            <h3>Нет открытых обменов</h3>
            <p>Никто пока не выставил то, что вы ищете.<br />Создайте свой ордер из инвентаря.</p>
            {!isEmptyFilter(filter) && (
              <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setFilter(EMPTY_FILTER)}>
                Сбросить фильтры
              </button>
            )}
          </div>
        )}

        <div className="market__list">
          {items.map(o => <OrderRow key={o.id} order={o} onOpen={() => setViewFrog(o.frog_id)} />)}
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

function OrderRow({ order: o, onOpen }: { order: MarketEntry; onOpen: () => void }) {
  const wantsM = parseJson(o.wants_models);
  const wantsB = parseJson(o.wants_backdrops);
  const wantsP = parseJson(o.wants_patterns);

  return (
    <article className="order-row" onClick={() => { hapticImpact('light'); onOpen(); }}>
      <div className="order-row__top">
        <div className="order-row__avatar">{(o.user_name || '?')[0].toUpperCase()}</div>
        <div className="order-row__person">
          <div className="order-row__name">{o.user_name}</div>
          {o.user_username && <div className="order-row__un">@{o.user_username}</div>}
        </div>
        <div className="order-row__time">{timeAgo(o.created_at)}</div>
      </div>

      <div className="order-row__exchange">
        <div className="order-row__side">
          <div className="order-row__side-label">Отдаёт</div>
          <FrogCard
            frog={{ id: o.frog_id, number: o.number, model: o.model, backdrop: o.backdrop, pattern: o.pattern, image_url: o.image_url, center_color: o.center_color, edge_color: o.edge_color, pattern_color: o.pattern_color }}
            size="sm"
            hideLabel
          />
        </div>

        <div className="order-row__arrow">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
          </svg>
        </div>

        <div className="order-row__wants">
          <div className="order-row__side-label">Хочет</div>
          <WantPortrait models={wantsM} backdrops={wantsB} patterns={wantsP} />
        </div>
      </div>

      {o.note && <div className="order-row__note">«{o.note}»</div>}
    </article>
  );
}

// «Портрет» желаемого: миниатюра модели (на её фоне, если задан) + подпись
// с тем, что не важно («любой фон / узор»). Если важна только модель —
// показываем просто модель без фона.
function WantPortrait({ models, backdrops, patterns }: { models: string[]; backdrops: string[]; patterns: string[] }) {
  const model = models[0] ?? null;
  const backdrop = backdrops[0] ?? null;
  const [info, setInfo] = useState<BackdropInfo | null>(() => (backdrop ? getBackdropInfoSync(backdrop) : null));

  useEffect(() => {
    if (!backdrop) { setInfo(null); return; }
    const sync = getBackdropInfoSync(backdrop);
    if (sync) { setInfo(sync); return; }
    let alive = true;
    loadPreload().then(() => { if (alive) setInfo(getBackdropInfoSync(backdrop)); }).catch(() => {});
    return () => { alive = false; };
  }, [backdrop]);

  const center = info?.centerColor ?? null;
  const edge = info?.edgeColor ?? center;
  const artBg = center
    ? `radial-gradient(100% 100% at 50% 42%, ${center} 0%, ${edge} 80%)`
    : backdrop ? 'var(--bg-elev)' : 'rgba(255,255,255,0.03)';

  const title = model ?? backdrop ?? patterns[0] ?? 'Любую лягушку';
  const hints: string[] = [];
  if (models.length > 1) hints.push(`+${models.length - 1} модель`);
  if (!models.length) hints.push('любая модель');
  if (!backdrops.length) hints.push('любой фон');
  if (!patterns.length) hints.push('любой узор');

  return (
    <div className="want-portrait">
      <div className="want-portrait__art" style={{ background: artBg }}>
        {model
          ? <img src={modelImageUrl(model, 256)} alt={model} className="want-portrait__img" loading="lazy" />
          : <span className="want-portrait__q">{backdrop ? '🎨' : '?'}</span>}
      </div>
      <div className="want-portrait__cap">
        <div className="want-portrait__title">{title}</div>
        {hints.length > 0 && <div className="want-portrait__hint">{hints.join(' · ')}</div>}
      </div>
    </div>
  );
}

function parseJson(s: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s + 'Z').getTime()) / 1000);
  if (d < 60) return 'только что';
  if (d < 3600) return `${Math.floor(d / 60)} мин.`;
  if (d < 86400) return `${Math.floor(d / 3600)} ч.`;
  return `${Math.floor(d / 86400)} д.`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return many;
  const m10 = n % 10;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}
