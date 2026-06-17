import { useEffect, useState } from 'react';
import { getNotifications, markNotificationsRead, getMyOrders, cancelOrder } from '../api';
import type { Frog, Notification, Order, User } from '../types';
import { hapticImpact } from '../utils/haptics';
import { isHapticsEnabled, setHapticsEnabled } from '../utils/haptics';
import './ProfileScreen.css';

interface Props {
  user: User | null;
  inventoryCount: number;
  onOpenInventory: () => void;
  onNotificationsRead: () => void;
  refreshKey?: number;
}

export default function ProfileScreen({ user, inventoryCount, onOpenInventory, onNotificationsRead, refreshKey }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [orders, setOrders] = useState<(Order & Frog)[]>([]);
  const [haptics, setHaptics] = useState(isHapticsEnabled());

  useEffect(() => {
    getNotifications().then(setNotifs).catch(() => {});
    getMyOrders().then(setOrders).catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    if (notifs.some(n => !n.read)) {
      markNotificationsRead().then(() => onNotificationsRead()).catch(() => {});
    }
  }, [notifs, onNotificationsRead]);

  async function handleCancel(id: number) {
    hapticImpact('light');
    try { await cancelOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); }
    catch { /* ignore */ }
  }

  if (!user) return null;

  return (
    <div className="screen">
      <div className="profile__hero">
        <div className="profile__avatar">
          {user.photo_url ? <img src={user.photo_url} alt="" /> : <span>{user.first_name[0]?.toUpperCase()}</span>}
        </div>
        <div className="profile__name">{user.first_name}</div>
        {user.username && <div className="profile__un">@{user.username}</div>}

        <div className="profile__stats">
          <button className="profile__stat" onClick={onOpenInventory}>
            <div className="profile__stat-value">{inventoryCount}</div>
            <div className="profile__stat-label">в инвентаре</div>
          </button>
          <div className="profile__stat">
            <div className="profile__stat-value">{orders.length}</div>
            <div className="profile__stat-label">на маркете</div>
          </div>
        </div>
      </div>

      <div className="screen__scroll">
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
                    <div className="profile__order-meta">
                      {o.kind === 'sell' ? `Продажа · ${o.price_stars}⭐`
                        : o.kind === 'trade' ? 'Обмен'
                        : `Любой · ${o.price_stars ?? '—'}⭐`}
                    </div>
                  </div>
                  <button className="profile__order-cancel" onClick={() => handleCancel(o.id)}>×</button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="section-title">Уведомления</div>
        {notifs.length === 0 ? (
          <p className="profile__empty">Пока пусто.</p>
        ) : (
          <div className="profile__notifs">
            {notifs.map(n => (
              <div key={n.id} className={`profile__notif${!n.read ? ' profile__notif--unread' : ''}`}>
                <div className="profile__notif-icon">
                  {n.type === 'trade_done' ? '🤝' : n.type === 'offer_in' ? '📩' : n.type === 'offer_accepted' ? '✅' : n.type === 'offer_declined' ? '❌' : n.type === 'escrow_in' ? '🔒' : '🐸'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="profile__notif-text">{n.text}</div>
                  <div className="profile__notif-time">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

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
      </div>
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
