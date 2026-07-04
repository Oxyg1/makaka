import type { ReactElement } from 'react';
import type { Tab } from '../App';
import { hapticSelection } from '../utils/haptics';
import './BottomNav.css';

const ICONS: Record<Tab, ReactElement> = {
  trade: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l4-4 4 4" /><path d="M7 5v8h7" />
      <path d="M21 15l-4 4-4-4" /><path d="M17 19v-8h-7" />
    </svg>
  ),
  whales: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14c0-3 3-5 6-5h7c3 0 5 2 5 5 0 3-3 4-5 4H9l-3 3v-3c-2 0-3-1-3-4z" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" />
    </svg>
  ),
  games: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9h12c2.2 0 4 1.8 4 4 0 4-2 6-3.5 6-1.2 0-2-.7-3-2l-.8-1H9.3l-.8 1c-1 1.3-1.8 2-3 2C4 19 2 17 2 13c0-2.2 1.8-4 4-4z" />
      <path d="M8 12v3" /><path d="M6.5 13.5h3" />
      <circle cx="16" cy="12.6" r="0.6" fill="currentColor" />
      <circle cx="18.2" cy="14.4" r="0.6" fill="currentColor" />
    </svg>
  ),
  profile: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

const LABELS: Record<Tab, string> = {
  trade: 'Трейд', whales: 'Холдеры', games: 'Игры', profile: 'Профиль',
};

const TABS: Tab[] = ['trade', 'whales', 'games', 'profile'];

interface Props { activeTab: Tab; onTabChange: (tab: Tab) => void; unreadOffers?: number; unreadNotifs?: number; }

export default function BottomNav({ activeTab, onTabChange, unreadOffers = 0, unreadNotifs = 0 }: Props) {
  const activeIndex = TABS.indexOf(activeTab);
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__indicator" style={{ translate: `${activeIndex * 100}% 0` }} />
      {TABS.map(tab => {
        const dot = tab === 'trade' ? unreadOffers : tab === 'profile' ? unreadNotifs : 0;
        return (
          <button key={tab}
            className={`bottom-nav__tab${activeTab === tab ? ' bottom-nav__tab--active' : ''}`}
            onClick={() => { hapticSelection(); onTabChange(tab); }}
            aria-current={activeTab === tab ? 'page' : undefined}
          >
            <span className="bottom-nav__icon">
              {ICONS[tab]}
              {dot > 0 && <span className="bottom-nav__dot" />}
            </span>
            <span className="bottom-nav__label">{LABELS[tab]}</span>
          </button>
        );
      })}
    </nav>
  );
}
