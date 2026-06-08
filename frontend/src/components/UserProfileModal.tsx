import { useState, useEffect } from 'react';
import { getUserProfile, getUserCats, getUserPosts } from '../api';
import type { UserProfile, CatWithStats, Post } from '../types';
import { Avatar } from './CatCardModal';
import './UserProfileModal.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
type UTab = 'cats' | 'posts';

interface Props { userId: number; onClose: () => void; }

export default function UserProfileModal({ userId, onClose }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<UTab>('cats');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoading(true); setLoadError(false); setProfile(null); setCats([]); setPosts([]);
    Promise.all([getUserProfile(userId), getUserCats(userId), getUserPosts(userId)])
      .then(([p, c, po]) => { setProfile(p); setCats(c); setPosts(po); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet upm">
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close-btn" onClick={onClose}>Закрыть</button>
          <span className="modal-sheet__title">Профиль</span>
          <div style={{ width: 60 }} />
        </div>
        <div className="upm__scroll">
          {loading ? (
            <div className="upm__loading"><div className="spinner" /></div>
          ) : loadError ? (
            <div className="upm__loading"><p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Не удалось загрузить профиль</p></div>
          ) : profile && (
            <>
              <div className="upm__hero">
                <Avatar name={profile.first_name} photoUrl={profile.photo_url} size={72} />
                <h3 className="upm__name">{profile.first_name}</h3>
                {profile.username && <p className="upm__username">@{profile.username}</p>}
                <div className="upm__stats">
                  <div className="upm__stat"><span className="upm__stat-val">{profile.cat_count}</span><span className="upm__stat-lbl">котов</span></div>
                  <div className="upm__sep" />
                  <div className="upm__stat"><span className="upm__stat-val">{profile.post_count}</span><span className="upm__stat-lbl">постов</span></div>
                  <div className="upm__sep" />
                  <div className="upm__stat"><span className="upm__stat-val">{profile.total_rated}</span><span className="upm__stat-lbl">оценил</span></div>
                </div>
              </div>
              <div className="upm__tabs">
                {(['cats','posts'] as UTab[]).map(t => (
                  <button key={t} className={`upm__tab${tab === t ? ' upm__tab--active' : ''}`} onClick={() => setTab(t)}>
                    {t === 'cats' ? `Коты (${cats.length})` : `Посты (${posts.length})`}
                  </button>
                ))}
              </div>
              {tab === 'cats' && (cats.length === 0 ? <p className="upm__empty">Нет котов</p> : (
                <div className="upm__cats">
                  {cats.map(cat => (
                    <div key={cat.id} className="upm__cat">
                      <img src={`${BASE}${cat.photo_url}`} alt={cat.name} />
                      <div className="upm__cat-info">
                        <span className="upm__cat-name">{cat.name}</span>
                        {cat.avg_score > 0 && <span className="upm__cat-score">★ {cat.avg_score}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {tab === 'posts' && (posts.length === 0 ? <p className="upm__empty">Нет постов</p> : (
                <div className="upm__posts">
                  {posts.map(post => (
                    <div key={post.id} className="upm__post">
                      <img src={`${BASE}${post.photo_url}`} alt="" />
                      {post.likes_count > 0 && <span className="upm__post-likes">♥ {post.likes_count}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
