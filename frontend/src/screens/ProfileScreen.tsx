import { useState, useEffect } from 'react';
import { getMyCats, getStats, getUserPosts } from '../api';
import { isHapticsEnabled, setHapticsEnabled } from '../utils/haptics';
import type { CatWithStats, Post, User, UserStats } from '../types';
import { Avatar } from '../components/CatCardModal';
import './ProfileScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
type PTab = 'cats' | 'posts' | 'settings';

interface Props { user: User | null; onViewUser: (id: number) => void; }

export default function ProfileScreen({ user }: Props) {
  const [tab, setTab] = useState<PTab>('cats');
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [haptics, setHaptics] = useState(isHapticsEnabled());

  useEffect(() => {
    setLoading(true);
    Promise.all([getMyCats(), getStats(), user ? getUserPosts(user.id) : Promise.resolve([])])
      .then(([c, s, p]) => { setCats(c); setStats(s); setPosts(p); })
      .finally(() => setLoading(false));
  }, [user]);

  const toggleHaptics = (v: boolean) => { setHapticsEnabled(v); setHaptics(v); };

  return (
    <div className="profile">
      <div className="profile__hero">
        <Avatar name={user?.first_name ?? 'У'} photoUrl={user?.photo_url} size={80} />
        <div className="profile__identity">
          <h2 className="profile__name">{user?.first_name ?? 'Пользователь'}</h2>
          {user?.username && <p className="profile__username">@{user.username}</p>}
        </div>
        {stats && (
          <div className="profile__stats">
            <div className="profile__stat">
              <span className="profile__stat-val">{cats.length}</span>
              <span className="profile__stat-lbl">котов</span>
            </div>
            <div className="profile__sep" />
            <div className="profile__stat">
              <span className="profile__stat-val">{stats.total_rated}</span>
              <span className="profile__stat-lbl">оценено</span>
            </div>
            <div className="profile__sep" />
            <div className="profile__stat">
              <span className="profile__stat-val">{stats.streak_days}</span>
              <span className="profile__stat-lbl">серия</span>
            </div>
          </div>
        )}
      </div>

      <div className="profile__tabs-wrap">
        <div className="profile__tabs">
          {(['cats','posts','settings'] as PTab[]).map(t => (
            <button key={t} className={`profile__tab${tab === t ? ' profile__tab--active' : ''}`} onClick={() => setTab(t)}>
              {t === 'cats' ? 'Коты' : t === 'posts' ? 'Посты' : 'Настройки'}
            </button>
          ))}
        </div>
      </div>

      <div className="profile__body">
        {loading && <div className="profile__center"><div className="spinner" /></div>}

        {!loading && tab === 'cats' && (cats.length === 0 ? (
          <div className="profile__empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" opacity="0.2">
              <ellipse cx="9" cy="6" rx="2.2" ry="2.8" /><ellipse cx="15" cy="6" rx="2.2" ry="2.8" />
              <ellipse cx="5.5" cy="10.5" rx="1.8" ry="2.4" /><ellipse cx="18.5" cy="10.5" rx="1.8" ry="2.4" />
              <path d="M12 10c-3.5 0-6 2-6 5 0 2.5 1.5 4 6 4s6-1.5 6-4c0-3-2.5-5-6-5z" />
            </svg>
            <p>Нет котов</p>
          </div>
        ) : (
          <div className="profile__cats">
            {cats.map(cat => (
              <div key={cat.id} className="profile__cat">
                <img className="profile__cat-photo" src={`${BASE}${cat.photo_url}`} alt={cat.name} loading="lazy" />
                <div className="profile__cat-info">
                  <div className="profile__cat-name">{cat.name}</div>
                  {cat.breed && <div className="profile__cat-breed">{cat.breed}</div>}
                  {cat.vote_count > 0
                    ? <div className="profile__cat-score">★ {cat.avg_score} · {cat.vote_count} оц.</div>
                    : <div className="profile__cat-score profile__cat-score--none">Нет оценок</div>}
                </div>
              </div>
            ))}
          </div>
        ))}

        {!loading && tab === 'posts' && (posts.length === 0 ? (
          <div className="profile__empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
              <rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            <p>Нет постов</p>
          </div>
        ) : (
          <div className="profile__grid">
            {posts.map(post => (
              <div key={post.id} className="profile__grid-item">
                <img src={`${BASE}${post.photo_url}`} alt="" loading="lazy" />
                {post.likes_count > 0 && <div className="profile__grid-likes">♥ {post.likes_count}</div>}
              </div>
            ))}
          </div>
        ))}

        {!loading && tab === 'settings' && (
          <div className="profile__settings">
            <div className="profile__settings-group">
              <div className="profile__settings-row">
                <div>
                  <div className="profile__settings-label">Тактильный отклик</div>
                  <div className="profile__settings-desc">Вибрация при оценке</div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={haptics} onChange={e => toggleHaptics(e.target.checked)} />
                  <div className="toggle__track" /><div className="toggle__thumb" />
                </label>
              </div>
            </div>
            <div className="profile__settings-group">
              <div className="profile__settings-row">
                <div className="profile__settings-label">Cat Rater</div>
                <span className="profile__settings-ver">1.2.0</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
