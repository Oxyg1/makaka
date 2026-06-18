import { useEffect, useState, useCallback } from 'react';
import {
  getNotifications, markNotificationsRead, getMyOrders, cancelOrder,
  getInventory, syncInventory,
} from '../api';
import type { AppConfig, Frog, Notification, Order, User } from '../types';
import FrogCard from '../components/FrogCard';
import FrogDetailModal from '../components/FrogDetailModal';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import { isHapticsEnabled, setHapticsEnabled } from '../utils/haptics';
import './ProfileScreen.css';
import './InventoryScreen.css';

interface Props {
  user: User | null;
  config: AppConfig | null;
  onNotificationsRead: () => void;
  onChanged: () => void;
  refreshKey?: number;
}

export default function ProfileScreen({ user, config, onNotificationsRead, onChanged, refreshKey }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [orders, setOrders] = useState<(Order & Frog)[]>([]);
  const [haptics, setHaptics] = useState(isHapticsEnabled());

  const [items, setItems] = useState<Frog[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [viewFrog, setViewFrog] = useState<number | null>(null);

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    try { setItems(await getInventory()); }
    finally { setInvLoading(false); }
  }, []);

  useEffect(() => {
    getNotifications().then(setNotifs).catch(() => {});
    getMyOrders().then(setOrders).catch(() => {});
    loadInventory();
  }, [refreshKey, loadInventory]);

  useEffect(() => {
    if (notifs.some(n => !n.read)) {
      markNotificationsRead().then(() => onNotificationsRead()).catch(() => {});
    }
  }, [notifs, onNotificationsRead]);

  async function handleSync() {
    setSyncing(true); setSyncMsg('');
    hapticImpact('medium');
    try {
      const r = await syncInventory();
      if (r.added === 0) setSyncMsg('У вас не нашлось KissedFrog в профиле');
      else hapticSuccess();
      await loadInventory();
      onChanged();
    } catch (e) {
      setSyncMsg((e as Error).message);
      hapticError();
    } finally {
      setSyncing(false);
    }
  }

  async function handleCancel(id: number) {
    hapticImpact('light');
    try { await cancelOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); }
    catch { /* ignore */ }
  }

  if (!user) return null;

  const lastSync = user.last_synced_at
    ? new Date(user.last_synced_at + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'ещё не синхронизировано';

  return (
    <div className="screen">
      <div className="profile__hero">
        <div className="profile__avatar">
          {user.photo_url ? <img src={user.photo_url} alt="" /> : <span>{user.first_name[0]?.toUpperCase()}</span>}
        </div>
        <div className="profile__name">{user.first_name}</div>
        {user.username && <div className="profile__un">@{user.username}</div>}

        <div className="profile__stats">
          <div className="profile__stat">
            <div className="profile__stat-value">{items.length}</div>
            <div className="profile__stat-label">в инвентаре</div>
          </div>
          <div className="profile__stat">
            <div className="profile__stat-value">{orders.length}</div>
            <div className="profile__stat-label">на обмене</div>
          </div>
        </div>
      </div>

      <div className="screen__scroll">
        {/* ── Инвентарь ───────────────────────────── */}
        <div className="profile__section-head">
          <div className="section-title" style={{ margin: 0 }}>Мои лягушки</div>
          <button className="inv__sync" onClick={handleSync} disabled={syncing}>
            {syncing ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span>Синк</span>
              </>
            )}
          </button>
        </div>
        <p className="profile__sub-hint">
          Синк: {lastSync}. Нажми на свою лягушку → <b>«Открыть обмен»</b>, чтобы выставить её в поиск.
        </p>
        {syncMsg && <div className="inv__error" style={{ margin: '0 0 10px' }}>{syncMsg}</div>}

        {invLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>}

        {!invLoading && items.length === 0 && (
          <div className="empty" style={{ padding: '24px 16px' }}>
            <div className="empty__icon">🐸</div>
            <h3>Инвентарь пуст</h3>
            <p>Нажми <b>«Синк»</b>, чтобы подтянуть твоих <b>KissedFrog</b> из Telegram-профиля.</p>
            {!user.username && (
              <p style={{ color: 'var(--warn)' }}>У твоего TG нет username — без него синк не работает.</p>
            )}
          </div>
        )}

        {!invLoading && items.length > 0 && (
          <div className="inv__grid">
            {items.map(f => (
              <div key={f.id} onClick={() => { hapticImpact('light'); setViewFrog(f.id); }}>
                <FrogCard frog={f} size="md" badge={f.active_order_id ? 'на обмене' : undefined} />
              </div>
            ))}
          </div>
        )}

        {/* ── Мои ордеры ──────────────────────────── */}
        {orders.length > 0 && (
          <>
            <div className="section-title">Мои ордеры</div>
            <div className="profile__orders">
              {orders.map(o => (
                <div key={o.id} className="profile__order">
                  <div className="profile__order-info">
                    <div className="profile__order-title">
                      {o.model} <span className="profile__order-num">#{o.number}</span>
                    </div>
                    <div className="profile__order-meta">{o.note}</div>
                  </div>
                  <button className="profile__order-cancel" onClick={() => handleCancel(o.id)} aria-label="Снять">×</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Уведомления ─────────────────────────── */}
        <div className="section-title">Уведомления</div>
        {notifs.length === 0 ? (
          <p className="profile__empty">Пока пусто.</p>
        ) : (
          <div className="profile__notifs">
            {notifs.map(n => (
              <div key={n.id} className={`profile__notif${!n.read ? ' profile__notif--unread' : ''}`}>
                <div className="profile__notif-icon">
                  {n.type === 'offer_in' ? '📩' : n.type === 'offer_accepted' ? '✅' : n.type === 'offer_declined' ? '❌' : '🐸'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="profile__notif-text">{n.text}</div>
                  <div className="profile__notif-time">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Настройки ───────────────────────────── */}
        <div className="section-title">Настройки</div>
        <div className="profile__settings">
          <label className="profile__setting">
            <span>Хаптика</span>
            <input
              type="checkbox" checked={haptics}
              onChange={e => { setHaptics(e.target.checked); setHapticsEnabled(e.target.checked); }}
            />
          </label>
        </div>

        <div className="profile__credits">
          Powered by{' '}
          <a href="https://t.me/GiftChanges" target="_blank" rel="noreferrer">@GiftChanges</a>{' '}
          (<a href="https://api.changes.tg" target="_blank" rel="noreferrer">api.changes.tg</a>)
          {' — '}визуалки подарков
          <br />
          Данные подарков —{' '}
          <a href="https://poso.see.tg" target="_blank" rel="noreferrer">poso.see.tg</a>
        </div>
      </div>

      {viewFrog !== null && (
        <FrogDetailModal
          frogId={viewFrog}
          myUserId={user.id}
          config={config}
          onClose={() => setViewFrog(null)}
          onCreatedOrder={() => { loadInventory(); getMyOrders().then(setOrders).catch(() => {}); onChanged(); }}
        />
      )}
    </div>
  );
}

function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s + 'Z').getTime()) / 1000);
  if (d < 60) return 'только что';
  if (d < 3600) return `${Math.floor(d / 60)} мин.`;
  if (d < 86400) return `${Math.floor(d / 3600)} ч.`;
  return `${Math.floor(d / 86400)} дн.`;
}
