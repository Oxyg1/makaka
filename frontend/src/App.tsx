import { useEffect, useState, useCallback } from 'react';
import { authUser, getConfig, getInventory, getNotifications, getOffers } from './api';
import { loadPreload } from './utils/changes';
import type { AppConfig, User } from './types';
import BottomNav from './components/BottomNav';
import MarketScreen from './screens/MarketScreen';
import InventoryScreen from './screens/InventoryScreen';
import WhalesScreen from './screens/WhalesScreen';
import TradesScreen from './screens/TradesScreen';
import ProfileScreen from './screens/ProfileScreen';

export type Tab = 'market' | 'inventory' | 'whales' | 'trades' | 'profile';

type TgWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  initDataUnsafe?: { user?: { photo_url?: string } };
};

function show(active: boolean): React.CSSProperties {
  return active
    ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }
    : { display: 'none' };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const [inventoryCount, setInventoryCount] = useState(0);
  const [unreadOffers, setUnreadOffers] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const [marketKey, setMarketKey] = useState(0);
  const [tradesKey, setTradesKey] = useState(0);
  const [inventoryKey, setInventoryKey] = useState(0);
  const [profileKey, setProfileKey] = useState(0);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
    const raw = tg?.initData || 'mock';
    tg?.expand?.();
    tg?.ready?.();
    tg?.disableVerticalSwipes?.();
    tg?.setHeaderColor?.('#0d1410');
    tg?.setBackgroundColor?.('#0d1410');

    const tgPhotoUrl = tg?.initDataUnsafe?.user?.photo_url ?? null;
    authUser(raw)
      .then(u => {
        setUser(tgPhotoUrl ? { ...u, photo_url: tgPhotoUrl } : u);
        setReady(true);
      })
      .catch(() => setReady(true));
    getConfig().then(setConfig).catch(() => {});
    loadPreload().catch(() => {});
  }, []);

  const refreshBadges = useCallback(async () => {
    try {
      const [inv, offIn, notifs] = await Promise.all([
        getInventory(),
        getOffers('in'),
        getNotifications(),
      ]);
      setInventoryCount(inv.length);
      setUnreadOffers(offIn.filter(o => o.status === 'pending').length);
      setUnreadNotifs(notifs.filter(n => !n.read).length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (ready) refreshBadges(); }, [ready, refreshBadges]);

  if (!ready) return <div className="loading-screen"><div className="loading-frog" /></div>;

  function changeTab(t: Tab) {
    setActiveTab(t);
    if (t === 'market') setMarketKey(k => k + 1);
    if (t === 'inventory') setInventoryKey(k => k + 1);
    if (t === 'trades') setTradesKey(k => k + 1);
    if (t === 'profile') setProfileKey(k => k + 1);
  }

  return (
    <div className="app">
      <main className="app__content">
        <div style={show(activeTab === 'market')}>
          <MarketScreen myUserId={user?.id ?? null} config={config} refreshKey={marketKey} />
        </div>
        <div style={show(activeTab === 'inventory')}>
          <InventoryScreen user={user} config={config} refreshKey={inventoryKey} onChanged={refreshBadges} />
        </div>
        <div style={show(activeTab === 'whales')}>
          <WhalesScreen myUserId={user?.id ?? null} config={config} />
        </div>
        <div style={show(activeTab === 'trades')}>
          <TradesScreen myUserId={user?.id ?? null} refreshKey={tradesKey} onChanged={refreshBadges} />
        </div>
        <div style={show(activeTab === 'profile')}>
          <ProfileScreen
            user={user}
            inventoryCount={inventoryCount}
            onOpenInventory={() => changeTab('inventory')}
            onNotificationsRead={() => setUnreadNotifs(0)}
            refreshKey={profileKey}
          />
        </div>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={changeTab} unreadOffers={unreadOffers} unreadNotifs={unreadNotifs} />
    </div>
  );
}
