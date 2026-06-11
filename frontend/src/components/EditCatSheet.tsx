import { useState } from 'react';
import { updateCat } from '../api';
import type { CatWithStats } from '../types';
import ExtraPhotosManager from './ExtraPhotosManager';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import Portal from './Portal';

interface Props {
  cat: CatWithStats;
  onClose: () => void;
  onSaved: (updated: CatWithStats) => void;
}

export default function EditCatSheet({ cat, onClose, onSaved }: Props) {
  const [name, setName] = useState(cat.name);
  const [breed, setBreed] = useState(cat.breed ?? '');
  const [age, setAge] = useState(cat.age != null ? String(cat.age) : '');
  const [description, setDescription] = useState(cat.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const swipe = useSheetSwipe(onClose);

  const handleSave = async () => {
    if (!name.trim()) { setError('Имя обязательно'); return; }
    setSaving(true);
    try {
      const updated = await updateCat(cat.id, {
        name: name.trim(),
        breed: breed.trim() || undefined,
        age: age || undefined,
        description: description.trim() || undefined,
      });
      onSaved(updated);
    } catch {
      setError('Ошибка при сохранении');
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 14,
    padding: '12px 14px', color: 'var(--text)',
    fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <Portal>
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-sheet" ref={swipe.sheetRef}
          onTouchStart={swipe.handleTouchStart}
          onTouchMove={swipe.handleTouchMove}
          onTouchEnd={swipe.handleTouchEnd}
          onTouchCancel={swipe.handleTouchCancel}>
          <div className="modal-sheet__handle" />
          <div className="modal-sheet__header">
            <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
            <span className="modal-sheet__title">Редактировать кота</span>
            <button className="modal-sheet__action" onClick={handleSave} disabled={saving}>
              {saving ? '...' : 'Сохранить'}
            </button>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            {error && <p style={{ margin: 0, color: '#ff453a', fontSize: 13 }}>{error}</p>}
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Имя *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} maxLength={100} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Порода</label>
              <input value={breed} onChange={e => setBreed(e.target.value)} style={inputStyle} placeholder="Необязательно" maxLength={100} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Возраст (лет)</label>
              <input value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ''))} style={inputStyle} placeholder="Необязательно" inputMode="numeric" maxLength={2} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Описание</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Расскажите о коте..." maxLength={500}
                style={{ ...inputStyle, resize: 'none', minHeight: 80 }} />
            </div>

            <div style={{ marginTop: 4 }}>
              <ExtraPhotosManager catId={cat.id} />
            </div>

            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить изменения'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
