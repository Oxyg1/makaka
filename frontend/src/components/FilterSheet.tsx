import { useEffect, useState } from 'react';
import type { Attributes } from '../types';
import { getAttributes } from '../api';
import './FilterSheet.css';

export interface FilterValue {
  kind?: 'trade' | 'sell' | 'any';
  models: string[];
  backdrops: string[];
  patterns: string[];
  min_price?: number;
  max_price?: number;
  sort?: 'new' | 'price_asc' | 'price_desc' | 'rare';
}

export const EMPTY_FILTER: FilterValue = { models: [], backdrops: [], patterns: [], sort: 'new' };

export function isEmptyFilter(f: FilterValue) {
  return !f.kind && !f.models.length && !f.backdrops.length && !f.patterns.length && f.min_price === undefined && f.max_price === undefined && (f.sort === 'new' || !f.sort);
}

interface Props {
  value: FilterValue;
  onClose: () => void;
  onApply: (v: FilterValue) => void;
}

export default function FilterSheet({ value, onClose, onApply }: Props) {
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [draft, setDraft] = useState<FilterValue>(value);
  const [minP, setMinP] = useState(value.min_price?.toString() ?? '');
  const [maxP, setMaxP] = useState(value.max_price?.toString() ?? '');

  useEffect(() => { getAttributes().then(setAttrs).catch(() => {}); }, []);

  function toggle(key: 'models' | 'backdrops' | 'patterns', v: string) {
    setDraft(d => ({ ...d, [key]: d[key].includes(v) ? d[key].filter(x => x !== v) : [...d[key], v] }));
  }

  function apply() {
    onApply({
      ...draft,
      min_price: minP ? Number(minP) : undefined,
      max_price: maxP ? Number(maxP) : undefined,
    });
  }

  function reset() {
    setDraft(EMPTY_FILTER); setMinP(''); setMaxP('');
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={reset}>Сброс</button>
          <span className="modal-sheet__title">Фильтры</span>
          <button className="modal-sheet__action" onClick={apply}>Готово</button>
        </div>
        <div className="modal-sheet__scroll">
          <div className="section-title">Тип</div>
          <div className="filter__kind">
            {(['', 'trade', 'sell'] as const).map(k => (
              <button
                key={k || 'all'}
                className={`filter__kind-btn${(draft.kind ?? '') === k ? ' filter__kind-btn--active' : ''}`}
                onClick={() => setDraft(d => ({ ...d, kind: (k || undefined) as FilterValue['kind'] }))}
                type="button"
              >
                {k === 'trade' ? 'Обмен' : k === 'sell' ? 'Продажа' : 'Все'}
              </button>
            ))}
          </div>

          <div className="section-title">Сортировка</div>
          <div className="filter__sort">
            {([
              ['new', 'Новые'],
              ['price_asc', 'Цена ↑'],
              ['price_desc', 'Цена ↓'],
              ['rare', 'Редкость'],
            ] as const).map(([v, l]) => (
              <button
                key={v}
                className={`filter__chip${(draft.sort ?? 'new') === v ? ' filter__chip--active' : ''}`}
                onClick={() => setDraft(d => ({ ...d, sort: v }))}
                type="button"
              >
                {l}
              </button>
            ))}
          </div>

          {(draft.kind === 'sell' || !draft.kind) && (
            <>
              <div className="section-title">Цена (звёзды)</div>
              <div className="filter__range">
                <input className="field" inputMode="numeric" placeholder="От" value={minP} onChange={e => setMinP(e.target.value)} />
                <span className="filter__range-dash">—</span>
                <input className="field" inputMode="numeric" placeholder="До" value={maxP} onChange={e => setMaxP(e.target.value)} />
              </div>
            </>
          )}

          {attrs && (
            <>
              <div className="section-title">Модель</div>
              <ChipList options={attrs.models} selected={draft.models} onToggle={v => toggle('models', v)} />

              <div className="section-title">Фон</div>
              <ChipList options={attrs.backdrops} selected={draft.backdrops} onToggle={v => toggle('backdrops', v)} />

              <div className="section-title">Узор</div>
              <ChipList options={attrs.patterns} selected={draft.patterns} onToggle={v => toggle('patterns', v)} />
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <button className="btn-primary" onClick={apply}>Применить</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipList({ options, selected, onToggle }: { options: { v: string; c: number }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="filter__chips">
      {options.map(o => (
        <button
          key={o.v}
          className={`filter__chip${selected.includes(o.v) ? ' filter__chip--active' : ''}`}
          onClick={() => onToggle(o.v)} type="button"
        >
          {o.v}
          <span className="filter__chip-count">{o.c}</span>
        </button>
      ))}
    </div>
  );
}
