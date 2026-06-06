import { useState, useEffect, useRef, useCallback } from 'react';
import { getFeed, likePost, createPost } from '../api';
import type { Post } from '../types';
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

interface Props { onViewUser: (id: number) => void; }

export default function FeedScreen({ onViewUser }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
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
    const optimistic = posts.map(p => p.id === post.id ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) } : p);
    setPosts(optimistic);
    try { const r = await likePost(post.id); setPosts(pp => pp.map(p => p.id === post.id ? { ...p, liked_by_me: r.liked, likes_count: r.likes_count } : p)); }
    catch { setPosts(posts); }
  };

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
              <span className="feed__time">{timeAgo(post.created_at)}</span>
            </div>
            <img className="feed__photo" src={`${BASE}${post.photo_url}`} alt="" loading="lazy" />
            <div className="feed__card-footer">
              <button className={`feed__like${post.liked_by_me ? ' feed__like--active' : ''}`} onClick={() => handleLike(post)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={post.liked_by_me ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {post.likes_count > 0 && post.likes_count}
              </button>
              {post.caption && <p className="feed__caption">{post.caption}</p>}
            </div>
          </div>
        ))}

        {loadingMore && <div className="feed__center"><div className="spinner" /></div>}
        <div ref={endRef} />
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onPosted={p => { setPosts(pp => [p, ...pp]); setShowCreate(false); }} />}
    </div>
  );
}

function CreateModal({ onClose, onPosted }: { onClose: () => void; onPosted: (p: Post) => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => { setPhoto(f); setPreview(URL.createObjectURL(f)); };
  const handleSubmit = async () => {
    if (!photo || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData(); fd.append('photo', photo);
      if (caption.trim()) fd.append('caption', caption.trim());
      onPosted(await createPost(fd));
    } catch { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Новый пост</span>
          <button className="modal-sheet__action" onClick={handleSubmit} disabled={!photo || submitting}>
            {submitting ? '...' : 'Опубл.'}
          </button>
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
          <button className="btn-primary" onClick={handleSubmit} disabled={!photo || submitting}>
            {submitting ? 'Публикуем...' : 'Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  );
}
