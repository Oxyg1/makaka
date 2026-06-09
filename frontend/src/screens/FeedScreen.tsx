import { useState, useEffect, useRef, useCallback } from 'react';
import { getFeed, likePost, createPost, getComments, createComment, deleteComment, deletePost } from '../api';
import { hapticImpact, hapticSelection, hapticSuccess } from '../utils/haptics';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import type { Post, Comment, User } from '../types';
import './FeedScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
const COLORS = ['#7c6df9','#49df64','#ff453a','#ff9500','#af52de','#ff2d55','#5ac8fa','#ffcc00'];
function avatarColor(name: string) { return COLORS[name.charCodeAt(0) % COLORS.length]; }

function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div className="feed__avatar"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (d < 60) return 'только что';
  if (d < 3600) return `${Math.floor(d/60)} мин`;
  if (d < 86400) return `${Math.floor(d/3600)} ч`;
  if (d < 604800) return `${Math.floor(d/86400)} дн`;
  return new Date(s).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

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

/* ────────── PostCard ────────── */
interface PostCardProps {
  post: Post;
  isOwner: boolean;
  onViewUser: (id: number) => void;
  onLike: (post: Post) => void;
  onComments: () => void;
  onAskDelete: () => void;
}
function PostCard({ post, isOwner, onViewUser, onLike, onComments, onAskDelete }: PostCardProps) {
  const [popKey, setPopKey] = useState(0);
  const lastTapRef = useRef<number>(0);

  const triggerHeartPop = () => setPopKey(k => k + 1);

  const handlePhotoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      if (!post.liked_by_me) onLike(post);
      triggerHeartPop();
    } else {
      lastTapRef.current = now;
    }
  };

  const handleLikeClick = () => {
    if (!post.liked_by_me) triggerHeartPop();
    onLike(post);
  };

  const photoSrc = post.photo_url.startsWith('blob:') ? post.photo_url : `${BASE}${post.photo_url}`;
  const pending = post.id < 0;

  return (
    <article className={`feed__card${pending ? ' feed__card--pending' : ''}`}>
      <header className="feed__card-head">
        <button className="feed__author" onClick={() => onViewUser(post.user_id)}>
          <UserAvatar name={post.author_name} size={40} />
          <div className="feed__author-info">
            <span className="feed__author-name">{post.author_name}</span>
            {post.author_username && <span className="feed__author-un">@{post.author_username}</span>}
          </div>
        </button>
        <div className="feed__card-meta">
          <span className="feed__time">{timeAgo(post.created_at)}</span>
          {isOwner && (
            <button className="feed__menu-btn" onClick={onAskDelete} aria-label="Удалить">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="feed__photo-wrap" onClick={handlePhotoTap}>
        <img className="feed__photo" src={photoSrc} alt="" loading="lazy" />
        {popKey > 0 && (
          <div key={popKey} className="feed__heart-pop">
            <svg viewBox="0 0 24 24" fill="#ff453a">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
        )}
      </div>

      <div className="feed__bar">
        <button
          className={`feed__act feed__act--like${post.liked_by_me ? ' feed__act--liked' : ''}`}
          onClick={handleLikeClick} disabled={pending}
        >
          <svg width="24" height="24" viewBox="0 0 24 24"
            fill={post.liked_by_me ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <button className="feed__act" onClick={onComments}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      </div>

      <div className="feed__below">
        {post.likes_count > 0 && (
          <div className="feed__likes-count">{post.likes_count} {post.likes_count === 1 ? 'отметка «нравится»' : 'отметок «нравится»'}</div>
        )}
        {post.caption && (
          <p className="feed__caption">
            <span className="feed__caption-author">{post.author_name}</span>
            {' '}
            <span className="feed__caption-text">{post.caption}</span>
          </p>
        )}
        {post.comments_count > 0 && (
          <button className="feed__view-comments" onClick={onComments}>
            Посмотреть {post.comments_count === 1 ? '1 комментарий' : `все комментарии (${post.comments_count})`}
          </button>
        )}
      </div>
    </article>
  );
}

/* ────────── CommentsSheet ────────── */
function CommentsSheet({ postId, currentUserId, onClose, onPosted, onDeleted }: {
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
              <UserAvatar name={c.author_name} size={32} />
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
              <span className="feed__create-replace">Заменить</span>
            </div>
          ) : (
            <button className="feed__create-picker" onClick={() => fileRef.current?.click()}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              <span>Выбрать фото</span>
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
