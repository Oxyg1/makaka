import { useEffect, useState } from 'react';
import type { Attributes } from '../types';
import { getAttributes } from '../api';
import './FilterSheet.css';

export interface FilterValue {
  offer_models: string[];
  offer_backdrops: string[];
  offer_patterns: string[];
  wants_models: string[];
  wants_backdrops: string[];
  wants_patterns: string[];
  sort?: 'new' | 'rare';
}

export const EMPTY_FILTER: FilterValue = {
  offer_models: [], offer_backdrops: [], offer_patterns: [],
  wants_models: [], wants_backdrops: [], wants_patterns: [],
  sort: 'new',
};

export function isEmptyFilter(f: FilterValue) {
  return !f.offer_models.length && !f.offer_backdrops.length && !f.offer_patterns.length
    && !f.wants_models.length && !f.wants_backdrops.length && !f.wants_patterns.length
    && (f.sort === 'new' || !f.sort);
}

interface Props {
  value: FilterValue;
  onClose: () => void;
  onApply: (v: FilterValue) => void;
}

type Tab = 'offer' | 'wants';

export default function FilterSheet({ value, onClose, onApply }: Props) {
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [draft, setDraft] = useState<FilterValue>(value);
  const [tab, setTab] = useState<Tab>('offer');

  useEffect(() => { getAttributes().then(setAttrs).catch(() => {}); }, []);

  function toggle(key: keyof FilterValue, v: string) {
    setDraft(d => {
      const list = d[key] as string[];
      return { ...d, [key]: list.includes(v) ? list.filter(x => x !== v) : [...list, v] };
    });
  }

  function reset() {
    setDraft(EMPTY_FILTER);
  }

  const offerCount = draft.offer_models.length + draft.offer_backdrops.length + draft.offer_patterns.length;
  const wantsCount = draft.wants_models.length + draft.wants_backdrops.length + draft.wants_patterns.length;

  const prefix = tab === 'offer' ? 'offer' : 'wants';
  const M = `${prefix}_models` as keyof FilterValue;
  const B = `${prefix}_backdrops` as keyof FilterValue;
  const P = `${prefix}_patterns` as keyof FilterValue;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={reset}>Сброс</button>
          <span className="modal-sheet__title">Фильтры</span>
          <button className="modal-sheet__action" onClick={() => onApply(draft)}>Готово</button>
        </div>
        <div className="modal-sheet__scroll">
          <div className="filter__tabs">
            <button
              className={`filter__tab${tab === 'offer' ? ' filter__tab--active' : ''}`}
              onClick={() => setTab('offer')}
            >
              Отдают {offerCount > 0 && <span className="filter__tab-badge">{offerCount}</span>}
            </button>
            <button
              className={`filter__tab${tab === 'wants' ? ' filter__tab--active' : ''}`}
              onClick={() => setTab('wants')}
            >
              Хотят {wantsCount > 0 && <span className="filter__tab-badge">{wantsCount}</span>}
            </button>
          </div>

          <p className="filter__hint">
            {tab === 'offer'
              ? 'Какую лягушку хочется получить — выбирайте здесь.'
              : 'Какую лягушку готовы отдать — выбирайте здесь.'}
          </p>

          <div className="section-title">Сортировка</div>
          <div className="filter__chips">
            {(['new', 'rare'] as const).map(v => (
              <button
                key={v}
                className={`filter__chip${(draft.sort ?? 'new') === v ? ' filter__chip--active' : ''}`}
                onClick={() => setDraft(d => ({ ...d, sort: v }))}
                type="button"
              >
                {v === 'new' ? 'Свежие' : 'Редкие'}
              </button>
            ))}
          </div>

          {attrs && (
            <>
              <div className="section-title">Модель</div>
              <ChipList options={attrs.models} selected={draft[M] as string[]} onToggle={v => toggle(M, v)} />

              <div className="section-title">Фон</div>
              <ChipList options={attrs.backdrops} selected={draft[B] as string[]} onToggle={v => toggle(B, v)} />

              <div className="section-title">Узор</div>
              <ChipList options={attrs.patterns} selected={draft[P] as string[]} onToggle={v => toggle(P, v)} />
            </>
          )}
        </div>
        <div className="modal-sheet__footer">
          <button className="btn-primary" onClick={() => onApply(draft)}>Применить</button>
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
