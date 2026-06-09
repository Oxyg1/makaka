import { useRef, useState } from 'react';
import type { Post } from '../types';
import { Avatar } from './CatCardModal';
import SupportButton from './SupportButton';

const BASE = import.meta.env.VITE_API_URL ?? '';

export function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (d < 60) return 'только что';
  if (d < 3600) return `${Math.floor(d/60)} мин`;
  if (d < 86400) return `${Math.floor(d/3600)} ч`;
  if (d < 604800) return `${Math.floor(d/86400)} дн`;
  return new Date(s).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

interface PostCardProps {
  post: Post;
  isOwner: boolean;
  onViewUser: (id: number) => void;
  onLike: (post: Post) => void;
  onComments: () => void;
  onAskDelete: () => void;
  hideHeaderUser?: boolean;
}

export default function PostCard({ post, isOwner, onViewUser, onLike, onComments, onAskDelete, hideHeaderUser }: PostCardProps) {
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
      {!hideHeaderUser && (
        <header className="feed__card-head">
          <button className="feed__author" onClick={() => onViewUser(post.user_id)}>
            <Avatar name={post.author_name} photoUrl={post.author_photo_url} size={40} />
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
      )}

      <div className="feed__photo-wrap" onClick={handlePhotoTap}>
        <img className="feed__photo" src={photoSrc} alt="" loading="lazy" />
        {popKey > 0 && (
          <div key={popKey} className="feed__heart-pop">
            <svg viewBox="0 0 24 24" fill="#ff453a">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
        )}
        {!isOwner && (
          <SupportButton
            recipientUserId={post.user_id}
            recipientName={post.author_name}
            context="post"
            className="support-btn--floating"
          />
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
        {hideHeaderUser && (
          <div className="feed__below-time">{timeAgo(post.created_at)}</div>
        )}
      </div>
    </article>
  );
}
