import { useState, useEffect } from 'react';
import { getUserProfile, getUserCats, getUserPosts } from '../api';
import type { UserProfile, CatWithStats, Post } from '../types';
import './UserProfileModal.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
const COLORS = ['#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FF2D55'];

type UTab = 'cats' | 'posts';

interface Props {
  userId: number;
  currentUserId: number | null;
  onClose: () => void;
}

export default function UserProfileModal({ userId, currentUserId, onClose }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<UTab>('cats');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getUserProfile(userId).then(setProfile),
      getUserCats(userId).then(setCats),
      getUserPosts(userId).then(setPosts),
    ]).finally(() => setLoading(false));
  }, [userId]);

  const avatarColor = profile ? COLORS[profile.first_name.charCodeAt(0) % COLORS.length] : '#8E8E93';
  const isMe = userId === currentUserId;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet user-profile-modal">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">{isMe ? 'Мой профиль' : 'Профиль'}</span>
          <span style={{ width: 64 }} />
        </div>

        <div className="user-profile-modal__scroll">
          {loading ? (
            <div className="user-profile-modal__loading">
              <div className="user-profile-modal__spinner" />
            </div>
          ) : profile && (
            <>
              <div className="user-profile-modal__hero">
                <div className="user-profile-modal__avatar" style={{ background: avatarColor }}>
                  {profile.first_name.slice(0, 1).toUpperCase()}
                </div>
                <h3 className="user-profile-modal__name">{profile.first_name}</h3>
                {profile.username && <p className="user-profile-modal__username">@{profile.username}</p>}
                <div className="user-profile-modal__stats">
                  <div className="user-profile-modal__stat">
                    <span className="user-profile-modal__stat-val">{profile.cat_count}</span>
                    <span className="user-profile-modal__stat-lbl">котов</span>
                  </div>
                  <div className="user-profile-modal__stat-sep" />
                  <div className="user-profile-modal__stat">
                    <span className="user-profile-modal__stat-val">{profile.post_count}</span>
                    <span className="user-profile-modal__stat-lbl">постов</span>
                  </div>
                  <div className="user-profile-modal__stat-sep" />
                  <div className="user-profile-modal__stat">
                    <span className="user-profile-modal__stat-val">{profile.total_rated}</span>
                    <span className="user-profile-modal__stat-lbl">оценил</span>
                  </div>
                </div>
              </div>

              <div className="user-profile-modal__tabs">
                {(['cats', 'posts'] as UTab[]).map(t => (
                  <button
                    key={t}
                    className={`user-profile-modal__tab${tab === t ? ' user-profile-modal__tab--active' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'cats' ? `Коты (${cats.length})` : `Посты (${posts.length})`}
                  </button>
                ))}
              </div>

              {tab === 'cats' && (
                cats.length === 0 ? (
                  <div className="user-profile-modal__empty">Нет котов</div>
                ) : (
                  <div className="user-profile-modal__cats">
                    {cats.map(cat => (
                      <div key={cat.id} className="user-profile-modal__cat">
                        <img src={`${BASE}${cat.photo_url}`} alt={cat.name} loading="lazy" />
                        <div className="user-profile-modal__cat-info">
                          <span className="user-profile-modal__cat-name">{cat.name}</span>
                          {cat.vote_count > 0 && (
                            <span className="user-profile-modal__cat-score">⭐ {cat.avg_score}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'posts' && (
                posts.length === 0 ? (
                  <div className="user-profile-modal__empty">Нет постов</div>
                ) : (
                  <div className="user-profile-modal__posts">
                    {posts.map(post => (
                      <div key={post.id} className="user-profile-modal__post">
                        <img src={`${BASE}${post.photo_url}`} alt="" loading="lazy" />
                        {post.likes_count > 0 && (
                          <div className="user-profile-modal__post-likes">❤️ {post.likes_count}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
