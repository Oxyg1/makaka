import { useState, useEffect } from 'react';
import { authUser, getCurrentUser, getNotifications } from './api';
import type { User } from './types';
import BottomNav from './components/BottomNav';
import UserProfileModal from './components/UserProfileModal';
import RatingScreen from './screens/RatingScreen';
import SubmitCatScreen from './screens/SubmitCatScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import FeedScreen from './screens/FeedScreen';
import ProfileScreen from './screens/ProfileScreen';

export type Tab = 'rate' | 'feed' | 'submit' | 'leaderboard' | 'profile';

type TgWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  initDataUnsafe?: { user?: { photo_url?: string } };
};

function show(active: boolean): React.CSSProperties {
  return active ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' } : { display: 'none' };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rate');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [viewUserId, setViewUserId] = useState<number | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
    const raw = tg?.initData || 'mock';
    tg?.expand?.();
    tg?.ready?.();
    if (localStorage.getItem('fullscreen_enabled') === '1') {
      tg?.requestFullscreen?.();
      tg?.disableVerticalSwipes?.();
    }
    const tgPhotoUrl = tg?.initDataUnsafe?.user?.photo_url ?? null;
    authUser(raw).then(u => {
      setUser(tgPhotoUrl ? { ...u, photo_url: tgPhotoUrl } : u);
      setReady(true);
      getNotifications().then(ns => setUnreadNotifs(ns.filter(n => !n.read).length)).catch(() => {});
    }).catch(() => setReady(true));
  }, []);

  if (!ready) return <div className="loading-screen"><div className="loading-paw" /></div>;

  const currentUser = user ?? getCurrentUser();

  return (
    <div className="app">
      <main className="app__content">
        <div style={show(activeTab === 'rate')}><RatingScreen /></div>
        <div style={show(activeTab === 'feed')}><FeedScreen onViewUser={setViewUserId} currentUser={currentUser ?? null} /></div>
        <div style={show(activeTab === 'submit')}><SubmitCatScreen onSubmitted={() => setActiveTab('feed')} /></div>
        <div style={show(activeTab === 'leaderboard')}><LeaderboardScreen onViewUser={setViewUserId} /></div>
        <div style={show(activeTab === 'profile')}><ProfileScreen user={currentUser} onViewUser={setViewUserId} onNotificationsRead={() => setUnreadNotifs(0)} /></div>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} unreadNotifs={unreadNotifs} />
      {viewUserId !== null && (
        <UserProfileModal userId={viewUserId} currentUserId={currentUser?.id ?? null} onClose={() => setViewUserId(null)} />
      )}
    </div>
  );
}
