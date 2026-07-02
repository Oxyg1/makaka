import { useEffect, useState, useCallback, useRef } from 'react';
import { authUser, getConfig, getNotifications, getOffers } from './api';
import { loadPreload } from './utils/changes';
import type { AppConfig, User } from './types';
import BottomNav from './components/BottomNav';
import TradeHubScreen from './screens/TradeHubScreen';
import WhalesScreen from './screens/WhalesScreen';
import GamesScreen from './screens/GamesScreen';
import ProfileScreen from './screens/ProfileScreen';

export type Tab = 'trade' | 'whales' | 'games' | 'profile';

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

/** Обёртка вкладки: при активации перезапускает анимацию pane-in,
 *  не размонтируя экран (состояние и скролл сохраняются). */
function TabPane({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (active && el) {
      el.classList.remove('pane-in');
      void el.offsetWidth; // форсируем reflow, чтобы анимация запустилась заново
      el.classList.add('pane-in');
    }
  }, [active]);
  return <div ref={ref} className="tab-pane" style={show(active)}>{children}</div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('trade');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const [unreadOffers, setUnreadOffers] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const [tradeKey, setTradeKey] = useState(0);
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
      const [offIn, notifs] = await Promise.all([
        getOffers('in'),
        getNotifications(),
      ]);
      setUnreadOffers(offIn.filter(o => o.status === 'pending').length);
      setUnreadNotifs(notifs.filter(n => !n.read).length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (ready) refreshBadges(); }, [ready, refreshBadges]);

  if (!ready) return <div className="loading-screen"><div className="loading-frog" /></div>;

  function changeTab(t: Tab) {
    setActiveTab(t);
    if (t === 'trade') setTradeKey(k => k + 1);
    if (t === 'profile') setProfileKey(k => k + 1);
  }

  return (
    <div className="app">
      <main className="app__content">
        <TabPane active={activeTab === 'trade'}>
          <TradeHubScreen
            myUserId={user?.id ?? null}
            config={config}
            refreshKey={tradeKey}
            unreadOffers={unreadOffers}
            onChanged={refreshBadges}
          />
        </TabPane>
        <TabPane active={activeTab === 'whales'}>
          <WhalesScreen myUserId={user?.id ?? null} config={config} />
        </TabPane>
        <TabPane active={activeTab === 'games'}>
          <GamesScreen active={activeTab === 'games'} />
        </TabPane>
        <TabPane active={activeTab === 'profile'}>
          <ProfileScreen
            user={user}
            config={config}
            onNotificationsRead={() => setUnreadNotifs(0)}
            onChanged={refreshBadges}
            refreshKey={profileKey}
          />
        </TabPane>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={changeTab} unreadOffers={unreadOffers} unreadNotifs={unreadNotifs} />
    </div>
  );
}
