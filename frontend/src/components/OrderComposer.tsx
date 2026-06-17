import { useEffect, useState } from 'react';
import type { Attributes, Frog } from '../types';
import { createOrder, getAttributes } from '../api';
import FrogCard from './FrogCard';
import './OrderComposer.css';

interface Props {
  frog: Frog;
  onClose: () => void;
  onCreated: () => void;
}

type Kind = 'trade' | 'sell' | 'any';

export default function OrderComposer({ frog, onClose, onCreated }: Props) {
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [kind, setKind] = useState<Kind>('trade');
  const [price, setPrice] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getAttributes().then(setAttrs).catch(() => {}); }, []);

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }

  async function submit() {
    if (kind === 'sell' && !price) { setError('Укажите цену в звёздах'); return; }
    setSubmitting(true); setError('');
    try {
      await createOrder({
        frog_id: frog.id,
        kind,
        price_stars: price ? Number(price) : null,
        wants_models: kind === 'sell' ? [] : models,
        wants_backdrops: kind === 'sell' ? [] : backdrops,
        wants_patterns: kind === 'sell' ? [] : patterns,
        note: note.trim() || undefined,
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Новый ордер</span>
          <button className="modal-sheet__action" onClick={submit} disabled={submitting}>Создать</button>
        </div>
        <div className="modal-sheet__scroll">
          <div className="order-comp__hero">
            <div style={{ maxWidth: 140, margin: '0 auto' }}>
              <FrogCard frog={frog} size="sm" />
            </div>
          </div>

          <div className="section-title">Тип ордера</div>
          <div className="order-comp__kind">
            {(['trade', 'sell', 'any'] as Kind[]).map(k => (
              <button
                key={k}
                className={`order-comp__kind-btn${kind === k ? ' order-comp__kind-btn--active' : ''}`}
                onClick={() => setKind(k)}
                type="button"
              >
                {k === 'trade' ? 'Обмен' : k === 'sell' ? 'Продажа' : 'Любой'}
              </button>
            ))}
          </div>

          {(kind === 'sell' || kind === 'any') && (
            <>
              <div className="section-title">Цена (звёзды)</div>
              <input
                className="field"
                type="number" inputMode="numeric"
                value={price} onChange={e => setPrice(e.target.value)}
                placeholder={kind === 'sell' ? 'обязательно' : 'необязательно'}
              />
            </>
          )}

          {(kind === 'trade' || kind === 'any') && attrs && (
            <>
              <div className="section-title">Хочу получить (модели)</div>
              <ChipPicker options={attrs.models.map(m => m.v)} selected={models} onToggle={v => toggle(models, setModels, v)} />
              <div className="section-title">Хочу фон</div>
              <ChipPicker options={attrs.backdrops.map(m => m.v)} selected={backdrops} onToggle={v => toggle(backdrops, setBackdrops, v)} />
              <div className="section-title">Хочу узор</div>
              <ChipPicker options={attrs.patterns.map(m => m.v)} selected={patterns} onToggle={v => toggle(patterns, setPatterns, v)} />
            </>
          )}

          <div className="section-title">Заметка</div>
          <textarea
            className="field"
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Опционально"
            maxLength={280}
          />

          {error && <p className="order-comp__error">{error}</p>}

          <div style={{ marginTop: 16 }}>
            <button className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Создаём…' : 'Создать ордер'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipPicker({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="order-comp__chips">
      {options.map(o => (
        <button
          key={o}
          className={`order-comp__chip${selected.includes(o) ? ' order-comp__chip--active' : ''}`}
          onClick={() => onToggle(o)} type="button"
        >
          {o}
        </button>
      ))}
    </div>
  );
}
