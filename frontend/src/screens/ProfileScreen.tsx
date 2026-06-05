import { useState, useEffect } from 'react';
import { getMyCats, getUserPosts, getStats } from '../api';
import type { CatWithStats, Post, User } from '../types';
import { isHapticsEnabled, setHapticsEnabled, hapticImpact } from '../utils/haptics';
import './ProfileScreen.css';
import './FeedScreen.css';
import './SettingsScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';

type ProfileTab = 'cats' | 'posts' | 'settings';

interface Props {
  user: User | null;
  onViewUser: (id: number) => void;
}

export default function ProfileScreen({ user }: Props) {
  const [tab, setTab] = useState<ProfileTab>('cats');
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ total_rated: 0, streak_days: 0 });
  const [haptics, setHaptics] = useState(isHapticsEnabled());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMyCats().then(setCats),
      user ? getUserPosts(user.id).then(setPosts) : Promise.resolve(),
      getStats().then(s => setStats({ total_rated: s.total_rated, streak_days: s.streak_days })),
    ]).finally(() => setLoading(false));
  }, [user?.id]); // eslint-disable-line

  const toggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    setHaptics(val);
    if (val) hapticImpact('medium');
  };

  const colors = ['#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FF2D55'];
  const avatarColor = user ? colors[user.first_name.charCodeAt(0) % colors.length] : '#8E8E93';
  const initials = user?.first_name?.slice(0, 1).toUpperCase() ?? '?';

  return (
    <div className="profile">
      <div className="profile__header">
        <div className="profile__avatar" style={{ background: avatarColor }}>{initials}</div>
        <div className="profile__identity">
          <h2 className="profile__name">{user?.first_name ?? 'Пользователь'}</h2>
          {user?.username && <p className="profile__username">@{user.username}</p>}
        </div>
        <div className="profile__stats-row">
          <div className="profile__stat">
            <span className="profile__stat-value">{cats.length}</span>
            <span className="profile__stat-label">котов</span>
          </div>
          <div className="profile__stat-divider" />
          <div className="profile__stat">
            <span className="profile__stat-value">{stats.total_rated}</span>
            <span className="profile__stat-label">оценено</span>
          </div>
          <div className="profile__stat-divider" />
          <div className="profile__stat">
            <span className="profile__stat-value">{stats.streak_days}🔥</span>
            <span className="profile__stat-label">серия</span>
          </div>
        </div>
      </div>

      <div className="profile__tabs">
        {(['cats', 'posts', 'settings'] as ProfileTab[]).map(t => (
          <button
            key={t}
            className={`profile__tab${tab === t ? ' profile__tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'cats' ? 'Коты' : t === 'posts' ? 'Посты' : 'Настройки'}
          </button>
        ))}
      </div>

      <div className="profile__content">
        {loading && <div className="profile__loading"><div className="feed__spinner" /></div>}

        {!loading && tab === 'cats' && (
          cats.length === 0 ? (
            <div className="profile__empty">
              <div style={{ fontSize: 56 }}>🐱</div>
              <p>Вы ещё не добавили ни одного кота</p>
            </div>
          ) : (
            <div className="profile__cats-list">
              {cats.map(cat => (
                <div key={cat.id} className="profile__cat-card">
                  <img className="profile__cat-photo" src={`${BASE}${cat.photo_url}`} alt={cat.name} loading="lazy" />
                  <div className="profile__cat-info">
                    <div className="profile__cat-name">{cat.name}</div>
                    {cat.breed && <div className="profile__cat-breed">{cat.breed}</div>}
                    <div className="profile__cat-score">
                      {cat.vote_count > 0
                        ? <><span className="profile__cat-avg">⭐ {cat.avg_score}</span><span className="profile__cat-votes">{cat.vote_count} оц.</span></>
                        : <span className="profile__cat-votes">Нет оценок</span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {!loading && tab === 'posts' && (
          posts.length === 0 ? (
            <div className="profile__empty">
              <div style={{ fontSize: 56 }}>📸</div>
              <p>Вы ещё ничего не публиковали</p>
            </div>
          ) : (
            <div className="profile__posts-grid">
              {posts.map(post => (
                <div key={post.id} className="profile__post-thumb">
                  <img src={`${BASE}${post.photo_url}`} alt="" loading="lazy" />
                  <div className="profile__post-likes">❤️ {post.likes_count}</div>
                </div>
              ))}
            </div>
          )
        )}

        {!loading && tab === 'settings' && (
          <div className="profile__settings">
            <div className="settings__section">
              <div className="settings__section-title">Интерфейс</div>
              <div className="settings__group">
                <div className="settings__row">
                  <div className="settings__row-left">
                    <span className="settings__row-label">Тактильный отклик</span>
                    <span className="settings__row-desc">Вибрация при оценке котов</span>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={haptics} onChange={e => toggleHaptics(e.target.checked)} />
                    <div className="toggle__track" />
                    <div className="toggle__thumb" />
                  </label>
                </div>
              </div>
            </div>
            <div className="settings__section">
              <div className="settings__section-title">О приложении</div>
              <div className="settings__group">
                <div className="settings__row">
                  <div className="settings__row-left">
                    <span className="settings__row-label">Cat Rater</span>
                    <span className="settings__row-desc">Оценивайте котов и соревнуйтесь!</span>
                  </div>
                  <span style={{ fontSize: 24 }}>🐾</span>
                </div>
                <div className="settings__row">
                  <span className="settings__row-label">Версия</span>
                  <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: 15 }}>1.1.0</span>
                </div>
              </div>
            </div>
            <div className="settings__about">Сделано с ❤️ для любителей котов</div>
          </div>
        )}
      </div>
    </div>
  );
}
