import { useEffect, useState } from 'react';
import { getComments, createComment, deleteComment } from '../api';
import { hapticSuccess } from '../utils/haptics';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import { Avatar } from './CatCardModal';
import { timeAgo } from './PostCard';
import type { Comment } from '../types';

export default function CommentsSheet({ postId, currentUserId, onClose, onPosted, onDeleted }: {
  postId: number;
  currentUserId: number | null;
  onClose: () => void;
  onPosted: () => void;
  onDeleted: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const swipe = useSheetSwipe(onClose);

  useEffect(() => {
    setLoading(true);
    getComments(postId).then(setComments).finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const c = await createComment(postId, t);
      setComments(prev => [...prev, c]);
      setText('');
      hapticSuccess();
      onPosted();
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteComment(id);
      setComments(prev => prev.filter(c => c.id !== id));
      onDeleted();
    } catch { /* ignore */ }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet feed__comments-sheet" ref={swipe.sheetRef}
        onTouchStart={swipe.handleTouchStart}
        onTouchMove={swipe.handleTouchMove}
        onTouchEnd={swipe.handleTouchEnd}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <div style={{ width: 60 }} />
          <span className="modal-sheet__title">Комментарии</span>
          <button className="modal-sheet__close-btn" onClick={onClose}>Готово</button>
        </div>
        <div className="feed__comments-list">
          {loading && <div className="feed__center"><div className="spinner" /></div>}
          {!loading && comments.length === 0 && (
            <div className="feed__comments-empty">
              <p>Пока нет комментариев</p>
              <p className="feed__comments-empty-hint">Будьте первым!</p>
            </div>
          )}
          {!loading && comments.map(c => (
            <div key={c.id} className="feed__comment">
              <Avatar name={c.author_name} photoUrl={c.author_photo_url} size={32} />
              <div className="feed__comment-body">
                <div className="feed__comment-bubble">
                  <span className="feed__comment-author">{c.author_name}</span>
                  <span className="feed__comment-text">{c.text}</span>
                </div>
                <div className="feed__comment-meta">
                  <span>{timeAgo(c.created_at)}</span>
                  {currentUserId === c.user_id && (
                    <button className="feed__comment-delete" onClick={() => handleDelete(c.id)}>Удалить</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="feed__comment-input-row">
          <input
            className="feed__comment-input"
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Добавить комментарий..."
            maxLength={500}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          />
          <button className="feed__comment-send" onClick={handleSubmit} disabled={!text.trim() || sending} aria-label="Отправить">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
