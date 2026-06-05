import { useState, useEffect, useRef, useCallback } from 'react';
import { getFeed, createPost, likePost } from '../api';
import type { Post } from '../types';
import { hapticImpact } from '../utils/haptics';
import './FeedScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)}м`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}д`;
  return new Date(dateStr).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ['#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FF2D55'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="feed-avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

interface Props {
  onViewUser: (id: number) => void;
}

export default function FeedScreen({ onViewUser }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadPosts = useCallback(async (reset = false) => {
    const offset = reset ? 0 : posts.length;
    if (!reset) setLoadingMore(true);
    try {
      const batch = await getFeed(offset);
      setPosts(prev => reset ? batch : [...prev, ...batch]);
      setHasMore(batch.length === 20);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [posts.length]);

  useEffect(() => { loadPosts(true); }, []); // eslint-disable-line

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!loadingMore && hasMore && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadPosts(false);
    }
  }, [loadingMore, hasMore, loadPosts]);

  const handleLike = async (post: Post) => {
    hapticImpact('light');
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
      : p
    ));
    try {
      const result = await likePost(post.id);
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: result.likes_count, liked_by_me: result.liked } : p));
    } catch {
      // revert on error
      setPosts(prev => prev.map(p => p.id === post.id ? post : p));
    }
  };

  const handlePosted = (post: Post) => {
    setPosts(prev => [post, ...prev]);
    setShowCreate(false);
  };

  return (
    <div className="feed">
      <div className="feed__header">
        <h2>Лента</h2>
        <button className="feed__create-btn" onClick={() => setShowCreate(true)}>+</button>
      </div>

      <div className="feed__list" onScroll={handleScroll}>
        {loading && (
          <div className="feed__loading">
            <div className="feed__spinner" />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="feed__empty">
            <div style={{ fontSize: 64 }}>📸</div>
            <h3>Лента пуста</h3>
            <p>Будьте первым — поделитесь своим котом!</p>
          </div>
        )}

        {posts.map(post => (
          <div key={post.id} className="feed__card">
            <div className="feed__card-header">
              <button className="feed__author" onClick={() => onViewUser(post.user_id)}>
                <UserAvatar name={post.author_name} size={36} />
                <div className="feed__author-info">
                  <span className="feed__author-name">{post.author_name}</span>
                  {post.author_username && <span className="feed__author-username">@{post.author_username}</span>}
                </div>
              </button>
              <span className="feed__time">{timeAgo(post.created_at)}</span>
            </div>
            <img className="feed__photo" src={`${BASE}${post.photo_url}`} alt="" loading="lazy" />
            <div className="feed__card-footer">
              <button
                className={`feed__like-btn${post.liked_by_me ? ' feed__like-btn--active' : ''}`}
                onClick={() => handleLike(post)}
              >
                {post.liked_by_me ? '❤️' : '🤍'} {post.likes_count > 0 ? post.likes_count : ''}
              </button>
              {post.caption && <p className="feed__caption">{post.caption}</p>}
            </div>
          </div>
        ))}

        {loadingMore && <div className="feed__loading-more"><div className="feed__spinner" /></div>}
      </div>

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} onPosted={handlePosted} />}
    </div>
  );
}

function CreatePostModal({ onClose, onPosted }: { onClose: () => void; onPosted: (post: Post) => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!photo || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('photo', photo);
      if (caption.trim()) fd.append('caption', caption.trim());
      const post = await createPost(fd);
      onPosted(post);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Отмена</button>
          <span className="modal-sheet__title">Новый пост</span>
          <button className="modal-sheet__action" onClick={handleSubmit} disabled={!photo || submitting}>
            {submitting ? '...' : 'Опубликовать'}
          </button>
        </div>

        <div className="modal-sheet__body">
          {preview ? (
            <img src={preview} className="create-post__preview" alt="" onClick={() => fileRef.current?.click()} />
          ) : (
            <button className="create-post__photo-btn" onClick={() => fileRef.current?.click()}>
              <span style={{ fontSize: 48 }}>📷</span>
              <span>Выбрать фото</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <textarea
            className="create-post__caption"
            placeholder="Расскажите о своём коте..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            maxLength={300}
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
