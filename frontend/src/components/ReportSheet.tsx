import { useState } from 'react';
import { reportContent } from '../api';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import { hapticSuccess, hapticError } from '../utils/haptics';
import Portal from './Portal';
import './ReportSheet.css';

interface Props {
  type: 'cat' | 'post';
  entityId: number;
  entityName?: string;
  onClose: () => void;
  onDone?: () => void;
}

const REASONS = [
  'Не относится к котам',
  'Спам или реклама',
  'Оскорбительный контент',
  'Жестокое обращение с животным',
  '18+ контент',
];

export default function ReportSheet({ type, entityId, entityName, onClose, onDone }: Props) {
  const [reason, setReason] = useState<string>('');
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const swipe = useSheetSwipe(onClose);

  const submit = async () => {
    const finalReason = reason === 'other' ? custom.trim() : reason;
    if (!finalReason) return;
    setLoading(true);
    try {
      await reportContent(type, entityId, finalReason);
      hapticSuccess();
      setSent(true);
      onDone?.();
      setTimeout(onClose, 1400);
    } catch {
      hapticError();
    } finally {
      setLoading(false);
    }
  };

  const label = type === 'cat' ? 'на кота' : 'на пост';

  return (
    <Portal>
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-sheet report-sheet" ref={swipe.sheetRef}
          onTouchStart={swipe.handleTouchStart}
          onTouchMove={swipe.handleTouchMove}
          onTouchEnd={swipe.handleTouchEnd}
          onTouchCancel={swipe.handleTouchCancel}>
          <div className="modal-sheet__handle" />
          <div className="modal-sheet__header">
            <button className="modal-sheet__close-btn" onClick={onClose}>Отмена</button>
            <span className="modal-sheet__title">Пожаловаться</span>
            <div style={{ width: 60 }} />
          </div>

          <div className="report-sheet__body">
            <p className="report-sheet__intro">
              Жалоба {label}{entityName ? ` «${entityName}»` : ''} будет отправлена модератору.
            </p>

            {sent ? (
              <div className="report-sheet__done">
                <div className="report-sheet__done-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 12 10 18 20 6" />
                  </svg>
                </div>
                <p>Жалоба отправлена</p>
              </div>
            ) : (
              <>
                <div className="report-sheet__options">
                  {REASONS.map(r => (
                    <button key={r}
                      className={`report-sheet__option${reason === r ? ' report-sheet__option--active' : ''}`}
                      onClick={() => setReason(r)}>
                      {r}
                    </button>
                  ))}
                  <button
                    className={`report-sheet__option${reason === 'other' ? ' report-sheet__option--active' : ''}`}
                    onClick={() => setReason('other')}>
                    Другое
                  </button>
                </div>

                {reason === 'other' && (
                  <textarea
                    className="report-sheet__textarea"
                    value={custom}
                    onChange={e => setCustom(e.target.value)}
                    placeholder="Опишите причину..."
                    maxLength={500}
                    autoFocus
                  />
                )}

                <button
                  className="report-sheet__submit"
                  onClick={submit}
                  disabled={loading || !reason || (reason === 'other' && !custom.trim())}>
                  {loading ? '...' : 'Отправить жалобу'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
