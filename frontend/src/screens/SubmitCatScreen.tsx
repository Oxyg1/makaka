import { useState, useRef } from 'react';
import { submitCat } from '../api';
import './SubmitCatScreen.css';

interface Props {
  onSubmitted: () => void;
}

export default function SubmitCatScreen({ onSubmitted }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!photo) { setError('Добавьте фото кота'); return; }
    if (!name.trim()) { setError('Укажите имя кота'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('photo', photo);
      fd.append('name', name.trim());
      if (breed.trim()) fd.append('breed', breed.trim());
      if (age.trim()) fd.append('age', age.trim());
      if (description.trim()) fd.append('description', description.trim());

      await submitCat(fd);
      setSuccess(true);
      setTimeout(onSubmitted, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="submit-screen__success">
        <div style={{ fontSize: 72 }}>🎉</div>
        <h3>Кот добавлен!</h3>
        <p>Теперь другие пользователи смогут оценить вашего питомца.</p>
      </div>
    );
  }

  return (
    <form className="submit-screen" onSubmit={handleSubmit}>
      <h2>Добавить кота</h2>

      <div className="submit-screen__photo-picker">
        <label className="submit-screen__photo-label" htmlFor="cat-photo">
          {preview
            ? <img src={preview} alt="preview" />
            : (
              <div className="submit-screen__photo-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                  <rect x="3" y="5" width="18" height="15" rx="3" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>Нажмите, чтобы выбрать фото</span>
              </div>
            )
          }
        </label>
        <input
          ref={inputRef}
          id="cat-photo"
          className="submit-screen__photo-input"
          type="file"
          accept="image/*"
          onChange={handlePhoto}
        />
      </div>

      <div className="form-group">
        <label htmlFor="cat-name">Имя кота *</label>
        <input
          id="cat-name"
          type="text"
          placeholder="Мурзик, Барсик..."
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
        />
      </div>

      <div className="form-group">
        <label htmlFor="cat-breed">Порода</label>
        <input
          id="cat-breed"
          type="text"
          placeholder="Мейн-кун, дворянин..."
          value={breed}
          onChange={e => setBreed(e.target.value)}
          maxLength={60}
        />
      </div>

      <div className="form-group">
        <label htmlFor="cat-age">Возраст (лет)</label>
        <input
          id="cat-age"
          type="number"
          placeholder="2"
          min="0"
          max="30"
          value={age}
          onChange={e => setAge(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="cat-desc">Описание</label>
        <textarea
          id="cat-desc"
          placeholder="Расскажите о характере и особенностях кота..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={300}
        />
      </div>

      {error && (
        <p style={{ color: 'var(--tg-theme-destructive-text-color)', margin: 0, fontSize: 14 }}>
          {error}
        </p>
      )}

      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Отправляем...' : 'Добавить кота'}
      </button>
    </form>
  );
}
