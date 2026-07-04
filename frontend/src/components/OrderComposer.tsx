import { useEffect, useState } from 'react';
import type { Attributes, Frog } from '../types';
import { createOrder, getAttributes } from '../api';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import FrogCard from './FrogCard';
import './OrderComposer.css';

interface Props {
  frog: Frog;
  onClose: () => void;
  onCreated: () => void;
}

export default function OrderComposer({ frog, onClose, onCreated }: Props) {
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { sheetRef, overlayRef, swipeHandlers } = useSheetSwipe(onClose);

  useEffect(() => { getAttributes().then(setAttrs).catch(() => {}); }, []);

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }

  const wantsCount = models.length + backdrops.length + patterns.length;
  const canSubmit = wantsCount > 0 && note.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      await createOrder({
        frog_id: frog.id,
        wants_models: models,
        wants_backdrops: backdrops,
        wants_patterns: patterns,
        note: note.trim(),
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet" ref={sheetRef} {...swipeHandlers}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Открыть обмен</span>
          <span style={{ width: 60 }} />
        </div>
        <div className="modal-sheet__scroll">
          <div className="order-comp__lead">
            <div style={{ width: 110, flexShrink: 0 }}>
              <FrogCard frog={frog} size="sm" />
            </div>
            <div className="order-comp__lead-text">
              <div className="order-comp__lead-label">Вы отдаёте</div>
              <div className="order-comp__lead-title">{frog.model}</div>
              <div className="order-comp__lead-meta">#{frog.number} · {frog.backdrop} · {frog.pattern}</div>
            </div>
          </div>

          <div className="section-title">Что хотите взамен</div>
          <p className="order-comp__hint">Выберите хотя бы один атрибут. Можно несколько — ордер найдут все, кто подходит.</p>

          {attrs && (
            <>
              <div className="order-comp__group">
                <div className="order-comp__group-label">Модель</div>
                <ChipPicker options={attrs.models.map(m => m.v)} selected={models} onToggle={v => toggle(models, setModels, v)} />
              </div>
              <div className="order-comp__group">
                <div className="order-comp__group-label">Фон</div>
                <ChipPicker options={attrs.backdrops.map(m => m.v)} selected={backdrops} onToggle={v => toggle(backdrops, setBackdrops, v)} />
              </div>
              <div className="order-comp__group">
                <div className="order-comp__group-label">Узор</div>
                <ChipPicker options={attrs.patterns.map(m => m.v)} selected={patterns} onToggle={v => toggle(patterns, setPatterns, v)} />
              </div>
            </>
          )}

          <div className="section-title">Расскажите зачем</div>
          <p className="order-comp__hint">Это видят все. Опишите контекст — почему хотите именно такой обмен, что готовы предложить сверху, насколько срочно.</p>
          <textarea
            className="field order-comp__note"
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Собираю сет в этой модели, хочу такую же но с фоном Aurora. Готов к диалогу."
            maxLength={500}
          />
          <div className="order-comp__counter">{note.length}/500</div>

          {error && <p className="order-comp__error">{error}</p>}
        </div>
        <div className="modal-sheet__footer">
          <button className="btn-primary" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? 'Публикуем…' : 'Опубликовать ордер'}
          </button>
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
