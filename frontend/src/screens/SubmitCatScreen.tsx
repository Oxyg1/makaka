import { useState, useRef } from 'react';
import { submitCat, uploadCatPhoto, createInvoice } from '../api';
import { hapticSuccess } from '../utils/haptics';
import './SubmitCatScreen.css';

interface Props { onSubmitted: () => void; }

const MAX_EXTRA = 3;

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
  const [extraUrls, setExtraUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

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

  const handleAddPhoto = async () => {
    if (!submittedCatId || extraUrls.length >= MAX_EXTRA) return;
    const tg = (window as unknown as { Telegram?: { WebApp?: { openInvoice?: (url: string, cb: (s: string) => void) => void } } }).Telegram?.WebApp;

    if (tg?.openInvoice) {
      try {
        const { invoiceLink } = await createInvoice('photo', submittedCatId);
        tg.openInvoice(invoiceLink, status => { if (status === 'paid') extraInputRef.current?.click(); });
      } catch { extraInputRef.current?.click(); }
    } else {
      extraInputRef.current?.click();
    }
  };

  const handleExtraSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !submittedCatId) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('photo', file);
      const res = await uploadCatPhoto(submittedCatId, fd);
      setExtraUrls(u => [...u, res.photo_url]);
      hapticSuccess();
    } catch { /* ignore */ }
    finally { setUploading(false); }
  };

  if (submittedCatId !== null) {
    const BASE = import.meta.env.VITE_API_URL ?? '';
    return (
      <div className="submit__success">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" />
        </svg>
        <h3>Кот добавлен!</h3>
        <p>Другие пользователи смогут оценить вашего питомца.</p>

        {extraUrls.length < MAX_EXTRA && (
          <div className="submit__extra">
            <p className="submit__extra-title">Добавить ещё фото <span className="submit__stars">2 ⭐ за каждое</span></p>
            <div className="submit__extra-row">
              {extraUrls.map((url, i) => (
                <img key={i} className="submit__extra-thumb" src={url.startsWith('/') ? `${BASE}${url}` : url} alt="" />
              ))}
              {Array.from({ length: MAX_EXTRA - extraUrls.length }).map((_, i) => (
                <button key={i} className="submit__extra-add" onClick={handleAddPhoto} disabled={uploading}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z"/></svg>
                  <span>фото</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <input ref={extraInputRef} type="file" accept="image/*" onChange={handleExtraSelected} style={{ display: 'none' }} />

        <button className="btn-primary" style={{ marginTop: 8 }} onClick={onSubmitted}>
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
