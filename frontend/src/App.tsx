import { useState, useEffect } from 'react';
import { authUser } from './api';
import BottomNav from './components/BottomNav';
import RatingScreen from './screens/RatingScreen';
import SubmitCatScreen from './screens/SubmitCatScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import MyCatsScreen from './screens/MyCatsScreen';
import SettingsScreen from './screens/SettingsScreen';

export type Tab = 'rate' | 'mycats' | 'submit' | 'leaderboard' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rate');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; ready?: () => void; colorScheme?: string; expand?: () => void } } }).Telegram?.WebApp;
    const raw = tg?.initData || 'mock';
    tg?.expand?.();
    tg?.ready?.();
    if (tg?.colorScheme === 'dark') document.documentElement.classList.add('tg-dark');
    authUser(raw).then(() => setReady(true)).catch(() => setReady(true));
  }, []);

  if (!ready) return <div className="loading-screen">🐾</div>;

  return (
    <div className="app">
      <main className="app__content">
        {activeTab === 'rate' && <RatingScreen />}
        {activeTab === 'mycats' && <MyCatsScreen />}
        {activeTab === 'submit' && <SubmitCatScreen onSubmitted={() => setActiveTab('rate')} />}
        {activeTab === 'leaderboard' && <LeaderboardScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
