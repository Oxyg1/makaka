import { useState, useEffect } from 'react';
import { authUser, getCurrentUser } from './api';
import type { User } from './types';
import BottomNav from './components/BottomNav';
import UserProfileModal from './components/UserProfileModal';
import RatingScreen from './screens/RatingScreen';
import SubmitCatScreen from './screens/SubmitCatScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import FeedScreen from './screens/FeedScreen';
import ProfileScreen from './screens/ProfileScreen';

export type Tab = 'rate' | 'feed' | 'submit' | 'leaderboard' | 'profile';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rate');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [viewUserId, setViewUserId] = useState<number | null>(null);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; ready?: () => void; colorScheme?: string; expand?: () => void } } }).Telegram?.WebApp;
    const raw = tg?.initData || 'mock';
    tg?.expand?.();
    tg?.ready?.();
    if (tg?.colorScheme === 'dark') document.documentElement.classList.add('tg-dark');
    authUser(raw).then(u => { setUser(u); setReady(true); }).catch(() => setReady(true));
  }, []);

  if (!ready) return <div className="loading-screen">🐾</div>;

  const currentUser = user ?? getCurrentUser();

  return (
    <div className="app">
      <main className="app__content">
        {activeTab === 'rate' && <RatingScreen />}
        {activeTab === 'feed' && <FeedScreen onViewUser={setViewUserId} />}
        {activeTab === 'submit' && <SubmitCatScreen onSubmitted={() => setActiveTab('feed')} />}
        {activeTab === 'leaderboard' && <LeaderboardScreen onViewUser={setViewUserId} />}
        {activeTab === 'profile' && <ProfileScreen user={currentUser} onViewUser={setViewUserId} />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      {viewUserId !== null && (
        <UserProfileModal userId={viewUserId} currentUserId={currentUser?.id ?? null} onClose={() => setViewUserId(null)} />
      )}
    </div>
  );
}
