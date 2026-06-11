import { useState, useRef } from 'react';
import { submitCat } from '../api';
import { hapticSuccess } from '../utils/haptics';
import ExtraPhotosManager from '../components/ExtraPhotosManager';
import './SubmitCatScreen.css';

interface Props { onSubmitted: () => void; }

export default function SubmitCatScreen({ onSubmitted }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedCatId, setSubmittedCatId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPhoto(file); setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!photo) { setError('Добавьте фото кота'); return; }
    if (!name.trim()) { setError('Укажите имя кота'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('photo', photo); fd.append('name', name.trim());
      if (breed.trim()) fd.append('breed', breed.trim());
      if (age.trim()) fd.append('age', age.trim());
      if (description.trim()) fd.append('description', description.trim());
      const result = await submitCat(fd);
      hapticSuccess();
      setSubmittedCatId((result as unknown as { id: number }).id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка'); setSubmitting(false); }
  };

  if (submittedCatId !== null) {
    return (
      <div className="submit__success">
        <div className="submit__success-head">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" />
          </svg>
          <h3>Кот добавлен!</h3>
          <p>Другие пользователи смогут оценить вашего питомца.</p>
        </div>

        <ExtraPhotosManager catId={submittedCatId} initialPhotos={[]} />

        <button className="btn-primary submit__success-btn" onClick={onSubmitted}>
          Перейти к оценке
        </button>
      </div>
    );
  }

  return (
    <form className="submit" onSubmit={handleSubmit}>
      <div className="submit__scroll">
        <h2 className="submit__title">Добавить кота</h2>

        <label className="submit__photo" htmlFor="cat-photo">
          {preview ? <img src={preview} alt="" /> : (
            <div className="submit__photo-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              <span>Выбрать фото</span>
            </div>
          )}
        </label>
        <input ref={inputRef} id="cat-photo" type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />

        <div className="submit__extra-teaser">
          <div className="submit__extra-teaser-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
            </svg>
          </div>
          <div className="submit__extra-teaser-text">
            <b>Можно добавить до 5 фото</b>
            <span>После публикации — 2 звезды за фото</span>
          </div>
        </div>

        <div className="submit__group">
          <div className="submit__field">
            <label>Имя кота *</label>
            <input type="text" placeholder="Мурзик, Барсик..." value={name} onChange={e => setName(e.target.value)} maxLength={60} />
          </div>
          <div className="submit__field">
            <label>Порода</label>
            <input type="text" placeholder="Мейн-кун, дворянин..." value={breed} onChange={e => setBreed(e.target.value)} maxLength={60} />
          </div>
          <div className="submit__field">
            <label>Возраст (лет)</label>
            <input type="number" placeholder="2" min="0" max="30" value={age} onChange={e => setAge(e.target.value)} />
          </div>
          <div className="submit__field">
            <label>Описание</label>
            <textarea placeholder="Расскажите о характере..." value={description} onChange={e => setDescription(e.target.value)} maxLength={300} />
          </div>
        </div>

        {error && <p className="submit__error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Отправляем...' : 'Добавить кота'}
        </button>
      </div>
    </form>
  );
}
