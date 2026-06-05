import { useState, useEffect } from 'react';
import { authUser } from './api';
import BottomNav from './components/BottomNav';
import RatingScreen from './screens/RatingScreen';
import SubmitCatScreen from './screens/SubmitCatScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import MyCatsScreen from './screens/MyCatsScreen';

export type Tab = 'rate' | 'mycats' | 'submit' | 'leaderboard';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rate');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Telegram WebApp injects window.Telegram.WebApp
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; ready?: () => void } } }).Telegram?.WebApp;
    const raw = tg?.initData || 'mock';

    if (tg?.ready) tg.ready();

    authUser(raw)
      .then(() => setReady(true))
      .catch(() => setReady(true)); // still show UI on auth failure in dev
  }, []);

  if (!ready) {
    return <div className="loading-screen">Загрузка...</div>;
  }

  return (
    <div className="app">
      <main className="app__content">
        {activeTab === 'rate' && <RatingScreen />}
        {activeTab === 'mycats' && <MyCatsScreen />}
        {activeTab === 'submit' && (
          <SubmitCatScreen onSubmitted={() => setActiveTab('rate')} />
        )}
        {activeTab === 'leaderboard' && <LeaderboardScreen />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
