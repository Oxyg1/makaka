import { useState, useRef } from 'react';
import { submitCat, uploadCatPhoto, EXTRA_PHOTO_COST } from '../api';
import { hapticSuccess, hapticError } from '../utils/haptics';
import { useBalance, setBalance as setBalanceCache, refreshBalance } from '../utils/balance';
import ExtraPhotosManager from '../components/ExtraPhotosManager';
import StarsModal from '../components/StarsModal';
import StarIcon from '../components/StarIcon';
import './SubmitCatScreen.css';

interface Props { onSubmitted: () => void; }

export default function SubmitCatScreen({ onSubmitted }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [extraPhoto, setExtraPhoto] = useState<File | null>(null);
  const [extraPreview, setExtraPreview] = useState('');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedCatId, setSubmittedCatId] = useState<number | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);
  const { balance } = useBalance();

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPhoto(file); setPreview(URL.createObjectURL(file));
  };

  const handleExtraPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setExtraPhoto(file); setExtraPreview(URL.createObjectURL(file));
  };

  const handlePickExtra = () => {
    if (!photo) return; // shouldn't happen since the slot is hidden
    if ((balance?.balance ?? 0) < EXTRA_PHOTO_COST) {
      setTopupOpen(true);
      return;
    }
    extraInputRef.current?.click();
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
      const result = await submitCat(fd) as unknown as { id: number };
      hapticSuccess();

      // Upload the chosen extra photo, if any.
      if (extraPhoto && (balance?.balance ?? 0) >= EXTRA_PHOTO_COST) {
        try {
          const ed = new FormData();
          ed.append('photo', extraPhoto);
          const r = await uploadCatPhoto(result.id, ed);
          if (balance) setBalanceCache({ ...balance, balance: r.newBalance });
          else refreshBalance();
        } catch {
          // non-fatal; the cat is already created
          hapticError();
        }
      }

      setSubmittedCatId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setSubmitting(false);
    }
  };

  if (submittedCatId !== null) {
    return (
      <div className="submit__success">
        <div className="submit__success-head">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" />
          </svg>
          <h3>Кот добавлен!</h3>
          <p>Можете добавить ещё фото или сразу перейти к оценке.</p>
        </div>

        <ExtraPhotosManager catId={submittedCatId} />

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

        <div className="submit__slots">
          <label className={`submit__slot${preview ? ' submit__slot--filled' : ''}`} htmlFor="cat-photo">
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <div className="submit__slot-empty">
                <div className="submit__slot-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <span className="submit__slot-title">Основное фото</span>
                <span className="submit__slot-badge submit__slot-badge--free">Бесплатно</span>
              </div>
            )}
            {preview && <span className="submit__slot-replace">Основное</span>}
          </label>
          <input ref={inputRef} id="cat-photo" type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />

          {photo && (
            <button type="button"
              className={`submit__slot submit__slot--extra${extraPreview ? ' submit__slot--filled' : ''}`}
              onClick={extraPreview ? () => extraInputRef.current?.click() : handlePickExtra}>
              {extraPreview ? (
                <>
                  <img src={extraPreview} alt="" />
                  <span className="submit__slot-replace">Доп. фото</span>
                </>
              ) : (
                <div className="submit__slot-empty">
                  <div className="submit__slot-icon submit__slot-icon--star"><StarIcon size={22} /></div>
                  <span className="submit__slot-title">Доп. фото</span>
                  <span className="submit__slot-badge submit__slot-badge--paid">
                    <StarIcon size={11} /> {EXTRA_PHOTO_COST}
                  </span>
                </div>
              )}
            </button>
          )}
          <input ref={extraInputRef} type="file" accept="image/*" onChange={handleExtraPhoto} style={{ display: 'none' }} />
        </div>

        {photo && (
          <p className="submit__slot-hint">
            Ещё фото можно будет добавить после публикации (до 5 шт.).
          </p>
        )}

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

      {topupOpen && <StarsModal onClose={() => setTopupOpen(false)} />}
    </form>
  );
}
