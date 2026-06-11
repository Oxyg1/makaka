import { useState, useEffect } from 'react';
import { getMyCats, getStats, getUserPosts, deleteCat, getNotifications, markNotificationsRead } from '../api';
import { isHapticsEnabled, setHapticsEnabled, hapticSelection } from '../utils/haptics';
import type { CatWithStats, Notification, Post, User, UserStats } from '../types';
import { Avatar } from '../components/CatCardModal';
import CatCardModal from '../components/CatCardModal';
import EditCatSheet from '../components/EditCatSheet';
import PostViewerModal from '../components/PostViewerModal';
import StarBalanceButton from '../components/StarBalanceButton';
import ShareButton from '../components/ShareButton';
import './ProfileScreen.css';

const BASE = import.meta.env.VITE_API_URL ?? '';
type PTab = 'cats' | 'posts';
type SidePanel = null | 'notifs' | 'settings';
const TABS: PTab[] = ['cats', 'posts'];

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
  const [panel, setPanel] = useState<SidePanel>(null);
  const [cats, setCats] = useState<CatWithStats[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [haptics, setHaptics] = useState(isHapticsEnabled());
  const [fullscreen, setFullscreen] = useState(localStorage.getItem('fullscreen_enabled') === '1');
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCat, setSelectedCat] = useState<CatWithStats | null>(null);
  const [editCat, setEditCat] = useState<CatWithStats | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMyCats().catch(() => [] as CatWithStats[]),
      getStats().catch(() => null),
      user ? getUserPosts(user.id).catch(() => [] as Post[]) : Promise.resolve([] as Post[]),
    ]).then(([c, s, p]) => {
      setCats(c); setStats(s); setPosts(p);
    }).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    getNotifications().then(ns => setUnreadCount(ns.filter(n => !n.read).length)).catch(() => {});
  }, []);

  useEffect(() => {
    if (panel === 'notifs' && !notifsLoaded) {
      getNotifications().then(ns => {
        setNotifs(ns);
        setNotifsLoaded(true);
        setUnreadCount(0);
        markNotificationsRead().then(() => onNotificationsRead?.()).catch(() => {});
      }).catch(() => setNotifsLoaded(true));
    }
  }, [panel, notifsLoaded, onNotificationsRead]);

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

  const handleCatDeleted = (id: number) => setCats(prev => prev.filter(c => c.id !== id));

  const handleCatSaved = (updated: CatWithStats) => {
    setCats(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    setEditCat(null);
  };

  const handlePostDeleted = (id: number) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePostChanged = (updated: Post) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const switchTab = (t: PTab) => { hapticSelection(); setTab(t); };

  const activeIdx = TABS.indexOf(tab);

  return (
    <div className="profile">
      {/* Sticky top bar with action chips */}
      <div className="profile__topbar">
        <div className="profile__topbar-left">
          <button className="profile__chip" onClick={() => setPanel('notifs')} aria-label="Уведомления">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="profile__chip-dot" />}
          </button>
          <button className="profile__chip" onClick={() => setPanel('settings')} aria-label="Настройки">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <span className="profile__topbar-title">Профиль</span>
        <StarBalanceButton />
      </div>

      <div className="profile__scroll">
        {/* Hero */}
        <div className="profile__hero">
          <div className="profile__avatar-wrap">
            <Avatar name={user?.first_name ?? 'У'} photoUrl={user?.photo_url} size={96} />
          </div>
          <h1 className="profile__name">{user?.first_name ?? 'Пользователь'}</h1>
          {user?.username && <p className="profile__username">@{user.username}</p>}
          {stats && stats.streak_days > 0 && (
            <div className="profile__streak-chip">
              <span className="profile__streak-emoji">🔥</span>
              {stats.streak_days} {stats.streak_days === 1 ? 'день' : 'дн.'} подряд
            </div>
          )}
          {user && (
            <div className="profile__share-row">
              <ShareButton kind="profile" entityId={user.id} title={user.first_name} className="share-btn--full" />
            </div>
          )}
        </div>

        {/* Stats card */}
        <div className="profile__stats">
          <div className="profile__stat">
            <span className="profile__stat-val">{cats.length}</span>
            <span className="profile__stat-lbl">{cats.length === 1 ? 'кот' : 'котов'}</span>
          </div>
          <div className="profile__sep" />
          <div className="profile__stat">
            <span className="profile__stat-val">{stats?.total_rated ?? 0}</span>
            <span className="profile__stat-lbl">оценено</span>
          </div>
          <div className="profile__sep" />
          <div className="profile__stat">
            <span className="profile__stat-val">{posts.length}</span>
            <span className="profile__stat-lbl">{posts.length === 1 ? 'пост' : 'постов'}</span>
          </div>
        </div>

        {/* Segmented tabs */}
        <div className="profile__seg" style={{ '--seg-idx': activeIdx } as React.CSSProperties}>
          <div className="profile__seg-indicator" />
          {TABS.map(t => (
            <button key={t}
              className={`profile__seg-btn${tab === t ? ' profile__seg-btn--active' : ''}`}
              onClick={() => switchTab(t)}
            >
              {t === 'cats' ? `Коты ${cats.length > 0 ? `· ${cats.length}` : ''}` : `Посты ${posts.length > 0 ? `· ${posts.length}` : ''}`}
            </button>
          ))}
        </div>

        <div className="profile__content">
          {loading && <div className="profile__center"><div className="spinner" /></div>}

          {!loading && tab === 'cats' && (cats.length === 0 ? (
            <div className="profile__empty">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" opacity="0.18">
                <ellipse cx="9" cy="6" rx="2.2" ry="2.8" /><ellipse cx="15" cy="6" rx="2.2" ry="2.8" />
                <ellipse cx="5.5" cy="10.5" rx="1.8" ry="2.4" /><ellipse cx="18.5" cy="10.5" rx="1.8" ry="2.4" />
                <path d="M12 10c-3.5 0-6 2-6 5 0 2.5 1.5 4 6 4s6-1.5 6-4c0-3-2.5-5-6-5z" />
              </svg>
              <p>У вас пока нет котов</p>
              <p className="profile__empty-hint">Добавьте на вкладке «Добавить»</p>
            </div>
          ) : (
            <div className="profile__cats">
              {cats.map(cat => (
                <button key={cat.id} className="profile__cat" onClick={() => setSelectedCat(cat)}>
                  <img className="profile__cat-photo" src={`${BASE}${cat.photo_url}`} alt={cat.name} loading="lazy" />
                  <div className="profile__cat-overlay">
                    <div className="profile__cat-name">{cat.name}</div>
                    <div className="profile__cat-meta">
                      {cat.vote_count > 0
                        ? <span className="profile__cat-score">★ {cat.avg_score}</span>
                        : <span className="profile__cat-score profile__cat-score--none">Без оценок</span>}
                      {cat.breed && <span className="profile__cat-breed">· {cat.breed}</span>}
                    </div>
                  </div>
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
              <p className="profile__empty-hint">Поделитесь фото на вкладке «Лента»</p>
            </div>
          ) : (
            <div className="profile__grid">
              {posts.map(post => (
                <button key={post.id} className="profile__grid-item" onClick={() => setViewingPost(post)}>
                  <img src={`${BASE}${post.photo_url}`} alt="" loading="lazy" />
                  {post.likes_count > 0 && (
                    <div className="profile__grid-likes">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                      {post.likes_count}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Notifications sheet */}
      {panel === 'notifs' && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div className="modal-sheet__header">
              <div style={{ width: 60 }} />
              <span className="modal-sheet__title">Уведомления</span>
              <button className="modal-sheet__close-btn" onClick={() => setPanel(null)}>Готово</button>
            </div>
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
                  <div className="profile__notif-avatar-wrap">
                    <Avatar name={n.actor_name} photoUrl={n.actor_photo_url} size={40} />
                    <div className={`profile__notif-badge profile__notif-badge--${n.type}`}>
                      {n.type === 'like' ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                      ) : n.type === 'comment' ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" /></svg>
                      )}
                    </div>
                  </div>
                  <div className="profile__notif-body">
                    <div>
                      <span className="profile__notif-actor">{n.actor_name}</span>{' '}
                      <span className="profile__notif-text">
                        {n.type === 'like' ? 'лайкнул(а) ваш пост'
                          : n.type === 'comment' ? `написал(а): ${n.text}`
                          : n.text ?? 'оценил(а) вашего кота'}
                      </span>
                    </div>
                    <div className="profile__notif-time">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && <div className="profile__notif-dot" aria-hidden />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings sheet */}
      {panel === 'settings' && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div className="modal-sheet__header">
              <div style={{ width: 60 }} />
              <span className="modal-sheet__title">Настройки</span>
              <button className="modal-sheet__close-btn" onClick={() => setPanel(null)}>Готово</button>
            </div>
            <div className="profile__settings">
              <div className="profile__settings-group">
                <div className="profile__settings-row">
                  <div>
                    <div className="profile__settings-label">Тактильный отклик</div>
                    <div className="profile__settings-desc">Вибрация при действиях</div>
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
                  <span className="profile__settings-ver">2.1.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          currentUserId={user?.id ?? null}
          onClose={() => setViewingPost(null)}
          onChange={handlePostChanged}
          onDeleted={handlePostDeleted}
        />
      )}
    </div>
  );
}
