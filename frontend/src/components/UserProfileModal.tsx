import { useState, useEffect } from 'react';
import { getUserProfile, getUserCats, getUserPosts } from '../api';
import type { UserProfile, CatWithStats, Post } from '../types';
import { Avatar, avatarColor } from './CatCardModal';
import ShareButton from './ShareButton';
import CatCardModal from './CatCardModal';
import PostViewerModal from './PostViewerModal';
import { hapticSelection } from '../utils/haptics';
import './UserProfileModal.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
type UTab = 'cats' | 'posts';
const TABS: UTab[] = ['cats', 'posts'];

interface Props { userId: number; currentUserId: number | null; onClose: () => void; }

export default function UserProfileModal({ userId, currentUserId, onClose }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<UTab>('cats');
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<CatWithStats | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);

  useEffect(() => {
    setLoading(true); setProfile(null); setCats([]); setPosts([]);
    Promise.all([getUserProfile(userId), getUserCats(userId), getUserPosts(userId)])
      .then(([p, c, po]) => { setProfile(p); setCats(c); setPosts(po); })
      .finally(() => setLoading(false));
  }, [userId]);

  const switchTab = (t: UTab) => { hapticSelection(); setTab(t); };
  const activeIdx = TABS.indexOf(tab);
  const glowColor = avatarColor(profile?.first_name ?? '?');

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet upm">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close-btn" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">Профиль</span>
          {profile ? <ShareButton kind="profile" entityId={profile.id} title={profile.first_name} /> : <div style={{ width: 32 }} />}
        </div>
        <div className="upm__scroll">
          {loading ? (
            <div className="upm__loading"><div className="spinner" /></div>
          ) : profile && (
            <>
              <div className="upm__hero" style={{ '--avatar-glow': glowColor } as React.CSSProperties}>
                <div className="upm__avatar-wrap">
                  <Avatar name={profile.first_name} photoUrl={profile.photo_url} size={96} />
                </div>
                <h1 className="upm__name">{profile.first_name}</h1>
                {profile.username && <p className="upm__username">@{profile.username}</p>}
              </div>

              <div className="upm__stats">
                <div className="upm__stat"><span className="upm__stat-val">{profile.cat_count}</span><span className="upm__stat-lbl">{profile.cat_count === 1 ? 'кот' : 'котов'}</span></div>
                <div className="upm__sep" />
                <div className="upm__stat"><span className="upm__stat-val">{profile.total_rated}</span><span className="upm__stat-lbl">оценено</span></div>
                <div className="upm__sep" />
                <div className="upm__stat"><span className="upm__stat-val">{profile.post_count}</span><span className="upm__stat-lbl">{profile.post_count === 1 ? 'пост' : 'постов'}</span></div>
              </div>

              <div className="upm__seg" style={{ '--seg-idx': activeIdx } as React.CSSProperties}>
                <div className="upm__seg-indicator" />
                {TABS.map(t => (
                  <button key={t}
                    className={`upm__seg-btn${tab === t ? ' upm__seg-btn--active' : ''}`}
                    onClick={() => switchTab(t)}>
                    {t === 'cats' ? `Коты ${cats.length > 0 ? `· ${cats.length}` : ''}` : `Посты ${posts.length > 0 ? `· ${posts.length}` : ''}`}
                  </button>
                ))}
              </div>

              <div className="upm__content">
                {tab === 'cats' && (cats.length === 0 ? (
                  <div className="upm__empty"><p>Нет котов</p></div>
                ) : (
                  <div className="upm__cats-grid">
                    {cats.map(cat => (
                      <button key={cat.id} className="upm__cat-card" onClick={() => setSelectedCat(cat)}>
                        <img className="upm__cat-photo" src={`${BASE}${cat.photo_url}`} alt={cat.name} loading="lazy" />
                        <div className="upm__cat-overlay">
                          <div className="upm__cat-name">{cat.name}</div>
                          <div className="upm__cat-meta">
                            {cat.vote_count > 0
                              ? <span className="upm__cat-score">★ {cat.avg_score}</span>
                              : <span className="upm__cat-score upm__cat-score--none">Без оценок</span>}
                            {cat.breed && <span className="upm__cat-breed">· {cat.breed}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}

                {tab === 'posts' && (posts.length === 0 ? (
                  <div className="upm__empty"><p>Нет постов</p></div>
                ) : (
                  <div className="upm__posts">
                    {posts.map(post => (
                      <button key={post.id} className="upm__post" onClick={() => setViewingPost(post)}>
                        <img src={`${BASE}${post.photo_url}`} alt="" loading="lazy" />
                        {post.likes_count > 0 && (
                          <div className="upm__post-likes">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                            {post.likes_count}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedCat && (
        <CatCardModal cat={selectedCat} onClose={() => setSelectedCat(null)} />
      )}
      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          currentUserId={currentUserId}
          onClose={() => setViewingPost(null)}
        />
      )}
    </div>
  );
}
