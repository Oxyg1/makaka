import { useState, useEffect } from 'react';
import { getMyCats, getStats, getUserPosts, deleteCat, deletePost, getNotifications, markNotificationsRead } from '../api';
import { isHapticsEnabled, setHapticsEnabled } from '../utils/haptics';
import type { CatWithStats, Notification, Post, User, UserStats } from '../types';
import { Avatar } from '../components/CatCardModal';
import CatCardModal from '../components/CatCardModal';
import EditCatSheet from '../components/EditCatSheet';
import './ProfileScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
type PTab = 'cats' | 'posts' | 'notifications' | 'settings';

function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (d < 60) return 'только что';
  if (d < 3600) return `${Math.floor(d/60)} мин.`;
  if (d < 86400) return `${Math.floor(d/3600)} ч.`;
  return `${Math.floor(d/86400)} дн.`;
}

type TgWebApp = { requestFullscreen?: () => void; exitFullscreen?: () => void; disableVerticalSwipes?: () => void; };
function getTg(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

interface Props { user: User | null; onViewUser: (id: number) => void; onNotificationsRead?: () => void; }

export default function ProfileScreen({ user, onNotificationsRead }: Props) {
  const [tab, setTab] = useState<PTab>('cats');
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [haptics, setHaptics] = useState(isHapticsEnabled());
  const [fullscreen, setFullscreen] = useState(localStorage.getItem('fullscreen_enabled') === '1');
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);
  const [selectedCat, setSelectedCat] = useState<CatWithStats | null>(null);
  const [editCat, setEditCat] = useState<CatWithStats | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMyCats().catch(() => [] as CatWithStats[]),
      getStats().catch(() => null),
      user ? getUserPosts(user.id).catch(() => [] as Post[]) : Promise.resolve([] as Post[]),
    ]).then(([c, s, p]) => {
      setCats(c);
      setStats(s);
      setPosts(p);
    }).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (tab === 'notifications' && !notifsLoaded) {
      getNotifications().then(ns => {
        setNotifs(ns);
        setNotifsLoaded(true);
        markNotificationsRead().then(() => onNotificationsRead?.()).catch(() => {});
      }).catch(() => setNotifsLoaded(true));
    }
  }, [tab, notifsLoaded, onNotificationsRead]);

  const toggleHaptics = (v: boolean) => { setHapticsEnabled(v); setHaptics(v); };

  const toggleFullscreen = (v: boolean) => {
    setFullscreen(v);
    const tg = getTg();
    if (v) {
      localStorage.setItem('fullscreen_enabled', '1');
      tg?.requestFullscreen?.();
      tg?.disableVerticalSwipes?.();
    } else {
      localStorage.removeItem('fullscreen_enabled');
      tg?.exitFullscreen?.();
    }
  };

  const handleCatDeleted = (id: number) => {
    setCats(prev => prev.filter(c => c.id !== id));
  };

  const handleCatSaved = (updated: CatWithStats) => {
    setCats(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    setEditCat(null);
  };

  const handleDeletePost = async (id: number) => {
    setDeletingPostId(id);
    try {
      await deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
    setDeletingPostId(null);
  };

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
          {(['cats','posts','notifications','settings'] as PTab[]).map(t => (
            <button key={t} className={`profile__tab${tab === t ? ' profile__tab--active' : ''}`} onClick={() => setTab(t)}>
              {t === 'cats' ? 'Коты' : t === 'posts' ? 'Посты' : t === 'notifications' ? 'Уведомления' : 'Настройки'}
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
              <button key={cat.id} className="profile__cat" onClick={() => setSelectedCat(cat)}>
                <img className="profile__cat-photo" src={`${BASE}${cat.photo_url}`} alt={cat.name} loading="lazy" />
                <div className="profile__cat-info">
                  <div className="profile__cat-name">{cat.name}</div>
                  {cat.breed && <div className="profile__cat-breed">{cat.breed}</div>}
                  {cat.vote_count > 0
                    ? <div className="profile__cat-score">★ {cat.avg_score} · {cat.vote_count} оц.</div>
                    : <div className="profile__cat-score profile__cat-score--none">Нет оценок</div>}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0, marginRight: 12 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
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
                <button
                  className="profile__grid-delete"
                  onClick={() => handleDeletePost(post.id)}
                  disabled={deletingPostId === post.id}
                >
                  {deletingPostId === post.id ? '...' : '×'}
                </button>
              </div>
            ))}
          </div>
        ))}

        {tab === 'notifications' && (
          <div className="profile__notifs">
            {!notifsLoaded && <div className="profile__center"><div className="spinner" /></div>}
            {notifsLoaded && notifs.length === 0 && (
              <div className="profile__empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p>Нет уведомлений</p>
              </div>
            )}
            {notifsLoaded && notifs.map(n => (
              <div key={n.id} className={`profile__notif${n.read ? '' : ' profile__notif--unread'}`}>
                <div className="profile__notif-icon">
                  {n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : '⭐'}
                </div>
                <div className="profile__notif-body">
                  <span className="profile__notif-actor">{n.actor_name}</span>
                  {' '}
                  <span className="profile__notif-text">
                    {n.type === 'like' ? 'лайкнул ваш пост'
                      : n.type === 'comment' ? `написал: ${n.text}`
                      : n.text ?? 'оценил вашего кота'}
                  </span>
                  <div className="profile__notif-time">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

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
              <div className="profile__settings-row">
                <div>
                  <div className="profile__settings-label">Полный экран</div>
                  <div className="profile__settings-desc">Скрыть панель Telegram</div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={fullscreen} onChange={e => toggleFullscreen(e.target.checked)} />
                  <div className="toggle__track" /><div className="toggle__thumb" />
                </label>
              </div>
            </div>
            <div className="profile__settings-group">
              <div className="profile__settings-row">
                <div className="profile__settings-label">Cat Rater</div>
                <span className="profile__settings-ver">2.0.0</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedCat && (
        <CatCardModal
          cat={selectedCat}
          onClose={() => setSelectedCat(null)}
          isOwner
          onEdit={cat => { setSelectedCat(null); setEditCat(cat as CatWithStats); }}
          onDelete={id => { handleCatDeleted(id); deleteCat(id).catch(() => {}); }}
        />
      )}

      {editCat && (
        <EditCatSheet
          cat={editCat}
          onClose={() => setEditCat(null)}
          onSaved={handleCatSaved}
        />
      )}
    </div>
  );
}
