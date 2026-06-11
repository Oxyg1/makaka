import { useState, useRef, useEffect } from 'react';
import { uploadCatPhoto, deleteCatPhoto, getCatPhotos, rotateCatPhoto } from '../api';
import { hapticSuccess, hapticError, hapticImpact } from '../utils/haptics';
import { useBalance, refreshBalance, setBalance } from '../utils/balance';
import StarIcon from './StarIcon';
import StarsModal from './StarsModal';
import Portal from './Portal';
import './ExtraPhotosManager.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
const COST = 2;
const MAX = 5;

interface Photo { id: number; photo_url: string; sort_order: number; }

interface Props {
  catId: number;
  /** Optional initial photos so the parent can pre-seed without an extra fetch. */
  initialPhotos?: { id: number; photo_url: string; sort_order: number }[];
  onChange?: (photos: Photo[]) => void;
}

export default function ExtraPhotosManager({ catId, initialPhotos, onChange }: Props) {
  const { balance } = useBalance();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos ?? []);
  const [loading, setLoading] = useState(!initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPhotos) return;
    getCatPhotos(catId).then(p => setPhotos(p as Photo[])).finally(() => setLoading(false));
  }, [catId, initialPhotos]);

  useEffect(() => { onChange?.(photos); }, [photos]); // eslint-disable-line react-hooks/exhaustive-deps

  const canAdd = photos.length < MAX;
  const hasBalance = (balance?.balance ?? 0) >= COST;

  const pickFile = () => {
    hapticImpact('light');
    setError(null);
    if (!hasBalance) { setTopupOpen(true); return; }
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await uploadCatPhoto(catId, fd);
      setPhotos(p => [...p, { id: res.id, photo_url: res.photo_url, sort_order: res.sort_order }]);
      if (balance) setBalance({ ...balance, balance: res.newBalance });
      else refreshBalance();
      hapticSuccess();
    } catch (e) {
      hapticError();
      const msg = e instanceof Error ? e.message : 'Ошибка';
      let parsed = msg;
      try { parsed = (JSON.parse(msg) as { error?: string }).error ?? msg; } catch { /* not json */ }
      if (parsed === 'Недостаточно звёзд') { setTopupOpen(true); return; }
      setError(parsed);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: number) => {
    setConfirmDeleteId(null);
    try {
      await deleteCatPhoto(catId, photoId);
      setPhotos(p => p.filter(x => x.id !== photoId));
      hapticSuccess();
    } catch {
      hapticError();
    }
  };

  const handleRotate = async (photoId: number) => {
    hapticImpact('light');
    try {
      await rotateCatPhoto(catId, photoId);
      // Force browsers to refetch the image by appending a cache-buster.
      setPhotos(p => p.map(x => x.id === photoId
        ? { ...x, photo_url: x.photo_url.split('?')[0] + `?v=${Date.now()}` }
        : x));
    } catch {
      hapticError();
    }
  };

  if (loading) {
    return <div className="epm__loading"><div className="spinner" /></div>;
  }

  return (
    <div className="epm">
      <div className="epm__head">
        <span className="epm__title">Дополнительные фото</span>
        <span className="epm__count">{photos.length} / {MAX}</span>
      </div>

      <div className="epm__grid">
        {photos.map(p => (
          <div key={p.id} className="epm__tile">
            <img src={p.photo_url.startsWith('/') ? `${BASE}${p.photo_url}` : p.photo_url} alt="" />
            <button className="epm__tile-rot" onClick={() => handleRotate(p.id)} aria-label="Повернуть">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 3 16 3" />
                <path d="M21 3l-6.5 6.5" />
                <path d="M3 16a9 9 0 0 0 16.5 5" />
              </svg>
            </button>
            <button className="epm__tile-del" onClick={() => setConfirmDeleteId(p.id)} aria-label="Удалить">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            className={`epm__add${uploading ? ' epm__add--loading' : ''}`}
            onClick={pickFile}
            disabled={uploading}
          >
            {uploading ? (
              <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2 }} />
            ) : (
              <>
                <div className="epm__add-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="epm__add-cost">
                  <StarIcon size={11} />
                  <span>{COST}</span>
                </div>
              </>
            )}
          </button>
        )}
      </div>

      {error && <p className="epm__error">{error}</p>}

      <p className="epm__hint">
        Стоимость каждого фото: <b>{COST}</b> звезды. У вас на балансе: <b>{balance?.balance ?? 0}</b>.
      </p>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />

      {topupOpen && <StarsModal onClose={() => setTopupOpen(false)} />}

      {confirmDeleteId !== null && (
        <Portal>
          <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
            <div className="epm__confirm" onClick={e => e.stopPropagation()}>
              <h3>Удалить фото?</h3>
              <p>Звёзды не возвращаются.</p>
              <div className="epm__confirm-actions">
                <button className="epm__confirm-cancel" onClick={() => setConfirmDeleteId(null)}>Отмена</button>
                <button className="epm__confirm-delete" onClick={() => handleDelete(confirmDeleteId)}>Удалить</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
