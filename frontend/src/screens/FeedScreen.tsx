import { useState, useEffect, useRef, useCallback } from 'react';
import { getFeed, likePost, createPost, deletePost } from '../api';
import { hapticImpact, hapticSelection, hapticSuccess } from '../utils/haptics';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import PostCard from '../components/PostCard';
import CommentsSheet from '../components/CommentsSheet';
import type { Post, User } from '../types';
import './FeedScreen.css';

interface Props { onViewUser: (id: number) => void; currentUser: User | null; }

export default function FeedScreen({ onViewUser, currentUser }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const first = await getFeed(0);
      setPosts(first);
      setHasMore(first.length >= 20);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!endRef.current || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMore && !loading && posts.length > 0) {
        setLoadingMore(true);
        getFeed(posts.length).then(more => {
          setPosts(p => [...p, ...more]);
          if (more.length < 20) setHasMore(false);
        }).finally(() => setLoadingMore(false));
      }
    }, { threshold: 0.1, rootMargin: '200px' });
    obs.observe(endRef.current);
    return () => obs.disconnect();
  }, [posts.length, loadingMore, loading, hasMore]);

  const handleLike = useCallback(async (post: Post) => {
    hapticImpact('light');
    const optimistic = posts.map(p => p.id === post.id
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) }
      : p);
    setPosts(optimistic);
    try {
      const r = await likePost(post.id);
      setPosts(pp => pp.map(p => p.id === post.id ? { ...p, liked_by_me: r.liked, likes_count: r.likes_count } : p));
    } catch {
      setPosts(pp => pp.map(p => p.id === post.id ? { ...p, liked_by_me: post.liked_by_me, likes_count: post.likes_count } : p));
    }
  }, [posts]);

  const handleDeletePost = async (id: number) => {
    setConfirmDeleteId(null);
    try {
      await deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      hapticSuccess();
    } catch { /* ignore */ }
  };

  const updateCommentsCount = (postId: number, delta: number) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count + delta) } : p));
  };

  return (
    <div className="feed">
      <div className="feed__topbar">
        <h2 className="feed__topbar-title">Лента</h2>
        <button className="feed__new-btn" onClick={() => { hapticSelection(); setShowCreate(true); }} aria-label="Новый пост">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="feed__scroll" ref={scrollRef}>
        {loading && <div className="feed__center"><div className="spinner" /></div>}

        {!loading && posts.length === 0 && (
          <div className="feed__empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
              <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            <h3>Лента пуста</h3>
            <p>Опубликуйте первое фото своего кота</p>
            <button className="feed__empty-btn" onClick={() => setShowCreate(true)}>Создать пост</button>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div className="feed__list">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isOwner={!!currentUser && post.user_id === currentUser.id}
                onViewUser={onViewUser}
                onLike={handleLike}
                onComments={() => setCommentsPostId(post.id)}
                onAskDelete={() => setConfirmDeleteId(post.id)}
              />
            ))}
            {loadingMore && <div className="feed__center"><div className="spinner" /></div>}
            {!hasMore && posts.length > 5 && <div className="feed__end">Вы посмотрели всё</div>}
            <div ref={endRef} style={{ height: 1 }} />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          currentUser={currentUser}
          onClose={() => setShowCreate(false)}
          onOptimistic={temp => { setPosts(pp => [temp, ...pp]); setShowCreate(false); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onReplace={(tempId, real) => setPosts(pp => pp.map(p => p.id === tempId ? real : p))}
          onRemove={tempId => setPosts(pp => pp.filter(p => p.id !== tempId))}
        />
      )}

      {commentsPostId !== null && (
        <CommentsSheet
          postId={commentsPostId}
          currentUserId={currentUser?.id ?? null}
          onClose={() => setCommentsPostId(null)}
          onPosted={() => updateCommentsCount(commentsPostId, 1)}
          onDeleted={() => updateCommentsCount(commentsPostId, -1)}
        />
      )}

      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="feed__confirm" onClick={e => e.stopPropagation()}>
            <h3>Удалить пост?</h3>
            <p>Это действие нельзя отменить</p>
            <div className="feed__confirm-actions">
              <button className="feed__confirm-cancel" onClick={() => setConfirmDeleteId(null)}>Отмена</button>
              <button className="feed__confirm-delete" onClick={() => handleDeletePost(confirmDeleteId)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────── CreateModal ────────── */
function CreateModal({ currentUser, onClose, onOptimistic, onReplace, onRemove }: {
  currentUser: User | null;
  onClose: () => void;
  onOptimistic: (p: Post) => void;
  onReplace: (tempId: number, real: Post) => void;
  onRemove: (tempId: number) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const swipe = useSheetSwipe(onClose);

  const handleFile = (f: File) => {
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = () => {
    if (!photo || !preview) return;
    const captionText = caption.trim();
    const tempId = -Date.now();
    const tempPost: Post = {
      id: tempId,
      user_id: currentUser?.id ?? 0,
      photo_url: preview,
      caption: captionText || null,
      created_at: new Date().toISOString(),
      author_name: currentUser?.first_name ?? 'Вы',
      author_username: currentUser?.username ?? null,
      author_photo_url: currentUser?.photo_url ?? null,
      likes_count: 0, liked_by_me: false, comments_count: 0,
    };
    hapticSuccess();
    onOptimistic(tempPost);
    const fd = new FormData();
    fd.append('photo', photo);
    if (captionText) fd.append('caption', captionText);
    createPost(fd).then(real => onReplace(tempId, real)).catch(() => onRemove(tempId));
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet" ref={swipe.sheetRef}
        onTouchStart={swipe.handleTouchStart}
        onTouchMove={swipe.handleTouchMove}
        onTouchEnd={swipe.handleTouchEnd}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Новый пост</span>
          <button className="modal-sheet__action" onClick={handleSubmit} disabled={!photo}>Опубл.</button>
        </div>
        <div className="feed__create">
          {preview ? (
            <div className="feed__create-preview" onClick={() => fileRef.current?.click()}>
              <img src={preview} alt="" />
              <span className="feed__create-replace">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 11 10 11" />
                </svg>
                Заменить
              </span>
            </div>
          ) : (
            <button className="feed__create-picker" onClick={() => fileRef.current?.click()}>
              <div className="feed__create-picker-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <span className="feed__create-picker-title">Выбрать фото</span>
              <span className="feed__create-picker-hint">Покажите вашего кота</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <textarea className="feed__create-textarea"
            value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Расскажите о коте..." maxLength={300} />
          <button className="btn-primary" onClick={handleSubmit} disabled={!photo}>Опубликовать</button>
        </div>
      </div>
    </div>
  );
}
