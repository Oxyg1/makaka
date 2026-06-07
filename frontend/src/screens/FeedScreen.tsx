import { useState, useEffect, useRef, useCallback } from 'react';
import { getFeed, likePost, createPost, getComments, createComment, deleteComment, deletePost } from '../api';
import { hapticImpact, hapticSuccess } from '../utils/haptics';
import type { Post, Comment, User } from '../types';
import './FeedScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

const COLORS = ['#1689ff','#49df64','#ff453a','#ff9500','#af52de','#ff2d55','#5ac8fa'];
function avatarColor(name: string) { return COLORS[name.charCodeAt(0) % COLORS.length]; }

function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, color: '#fff', flexShrink: 0 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (d < 60) return 'только что';
  if (d < 3600) return `${Math.floor(d/60)} мин.`;
  if (d < 86400) return `${Math.floor(d/3600)} ч.`;
  return `${Math.floor(d/86400)} дн.`;
}

interface Props { onViewUser: (id: number) => void; currentUser: User | null; }

export default function FeedScreen({ onViewUser, currentUser }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPosts(await getFeed(0)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const el = endRef.current?.parentElement;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMore && !loading && posts.length >= 20) {
        setLoadingMore(true);
        getFeed(posts.length).then(more => { setPosts(p => [...p, ...more]); }).finally(() => setLoadingMore(false));
      }
    }, { threshold: 0.1 });
    if (endRef.current) obs.observe(endRef.current);
    return () => obs.disconnect();
  }, [posts.length, loadingMore, loading]);

  const handleLike = async (post: Post) => {
    hapticImpact('light');
    const optimistic = posts.map(p => p.id === post.id ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) } : p);
    setPosts(optimistic);
    try { const r = await likePost(post.id); setPosts(pp => pp.map(p => p.id === post.id ? { ...p, liked_by_me: r.liked, likes_count: r.likes_count } : p)); }
    catch { setPosts(pp => pp.map(p => p.id === post.id ? { ...p, liked_by_me: post.liked_by_me, likes_count: post.likes_count } : p)); }
  };

  const toggleComments = (postId: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  const handleDeletePost = async (id: number) => {
    try {
      await deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
  };

  const handleCommentPosted = (postId: number) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
  };

  const handleCommentDeleted = (postId: number) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
  };

  const feedLive = false; // set to true when feed is ready to launch

  if (!feedLive) return (
    <div className="feed">
      <div className="feed__wip">
        <div className="feed__wip-icon">🚧</div>
        <h3>Лента в разработке</h3>
        <p>Скоро здесь появятся посты,<br />комментарии и реакции.</p>
        <p>Следите за обновлениями!</p>
      </div>
    </div>
  );

  return (
    <div className="feed">
      <div className="feed__header">
        <h2>Лента</h2>
        <button className="feed__new-btn" onClick={() => setShowCreate(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Пост
        </button>
      </div>

      <div className="feed__list">
        {loading && <div className="feed__center"><div className="spinner" /></div>}

        {!loading && posts.length === 0 && (
          <div className="feed__empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
              <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            <h3>Лента пуста</h3>
            <p>Будьте первым!</p>
          </div>
        )}

        {posts.map(post => (
          <div key={post.id} className="feed__card">
            <div className="feed__card-header">
              <button className="feed__author" onClick={() => onViewUser(post.user_id)}>
                <UserAvatar name={post.author_name} />
                <div className="feed__author-info">
                  <span className="feed__author-name">{post.author_name}</span>
                  {post.author_username && <span className="feed__author-un">@{post.author_username}</span>}
                </div>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="feed__time">{timeAgo(post.created_at)}</span>
                {currentUser && post.user_id === currentUser.id && (
                  <button className="feed__delete-btn" onClick={() => handleDeletePost(post.id)} title="Удалить">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <img className="feed__photo" src={post.photo_url.startsWith('blob:') ? post.photo_url : `${BASE}${post.photo_url}`} alt="" loading="lazy" style={post.id < 0 ? { opacity: 0.7 } : undefined} />
            <div className="feed__card-footer">
              <div className="feed__actions">
                <button className={`feed__like${post.liked_by_me ? ' feed__like--active' : ''}`} onClick={() => handleLike(post)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={post.liked_by_me ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  {post.likes_count > 0 && post.likes_count}
                </button>
                <button className="feed__comment-btn" onClick={() => toggleComments(post.id)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {post.comments_count > 0 && post.comments_count}
                </button>
              </div>
              {post.caption && <p className="feed__caption">{post.caption}</p>}
              {expandedComments.has(post.id) && (
                <CommentsSection
                  postId={post.id}
                  currentUserId={currentUser?.id ?? null}
                  onCommentPosted={() => handleCommentPosted(post.id)}
                  onCommentDeleted={() => handleCommentDeleted(post.id)}
                />
              )}
            </div>
          </div>
        ))}

        {loadingMore && <div className="feed__center"><div className="spinner" /></div>}
        <div ref={endRef} />
      </div>

      {showCreate && (
        <CreateModal
          currentUser={currentUser}
          onClose={() => setShowCreate(false)}
          onOptimistic={temp => { setPosts(pp => [temp, ...pp]); setShowCreate(false); }}
          onReplace={(tempId, real) => setPosts(pp => pp.map(p => p.id === tempId ? real : p))}
          onRemove={tempId => setPosts(pp => pp.filter(p => p.id !== tempId))}
        />
      )}
    </div>
  );
}

function CommentsSection({ postId, currentUserId, onCommentPosted, onCommentDeleted }: {
  postId: number; currentUserId: number | null;
  onCommentPosted: () => void; onCommentDeleted: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getComments(postId).then(setComments).finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const c = await createComment(postId, text.trim());
      setComments(prev => [...prev, c]);
      setText('');
      hapticSuccess();
      onCommentPosted();
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteComment(id);
      setComments(prev => prev.filter(c => c.id !== id));
      onCommentDeleted();
    } catch { /* ignore */ }
  };

  return (
    <div className="feed__comments">
      {loading && <div className="feed__comments-loading"><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /></div>}
      {!loading && comments.length === 0 && <p className="feed__comments-empty">Нет комментариев</p>}
      {comments.map(c => (
        <div key={c.id} className="feed__comment">
          <span className="feed__comment-author">{c.author_name}</span>
          <span className="feed__comment-text">{c.text}</span>
          {currentUserId === c.user_id && (
            <button className="feed__comment-delete" onClick={() => handleDelete(c.id)}>×</button>
          )}
        </div>
      ))}
      <div className="feed__comment-input-row">
        <input
          className="feed__comment-input"
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Комментарий..."
          maxLength={500}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
        />
        <button className="feed__comment-send" onClick={handleSubmit} disabled={!text.trim() || sending}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

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

  const handleFile = (f: File) => { setPhoto(f); setPreview(URL.createObjectURL(f)); };

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
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Новый пост</span>
          <button className="modal-sheet__action" onClick={handleSubmit} disabled={!photo}>Опубл.</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {preview ? (
            <img src={preview} style={{ width: '100%', borderRadius: 16, objectFit: 'cover', maxHeight: '45vh', cursor: 'pointer' }} onClick={() => fileRef.current?.click()} alt="" />
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{ width: '100%', height: 180, background: 'var(--bg-card)', border: '1px dashed var(--border-strong)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Выбрать фото</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Расскажите о коте..." maxLength={300}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', color: 'var(--text)', fontSize: 15, resize: 'none', minHeight: 80, fontFamily: 'inherit' }} />
          <button className="btn-primary" onClick={handleSubmit} disabled={!photo}>Опубликовать</button>
        </div>
      </div>
    </div>
  );
}
