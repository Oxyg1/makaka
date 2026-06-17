import type { ReactElement } from 'react';
import type { Tab } from '../App';
import { hapticSelection } from '../utils/haptics';
import './BottomNav.css';

const ICONS: Record<Tab, ReactElement> = {
  market: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-4h15L21 9" />
      <path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z" />
      <path d="M8 13c0 2 1.8 3.5 4 3.5s4-1.5 4-3.5" />
    </svg>
  ),
  inventory: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="15" rx="8" ry="6" />
      <circle cx="8" cy="9" r="3" />
      <circle cx="16" cy="9" r="3" />
      <circle cx="8" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  search: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.2" y2="16.2" />
    </svg>
  ),
  offers: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l4-4 4 4" /><path d="M7 5v8h7" />
      <path d="M21 15l-4 4-4-4" /><path d="M17 19v-8h-7" />
    </svg>
  ),
  profile: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

const LABELS: Record<Tab, string> = {
  market: 'Маркет', inventory: 'Инвентарь', search: 'Поиск', offers: 'Сделки', profile: 'Профиль',
};

const TABS: Tab[] = ['market', 'inventory', 'search', 'offers', 'profile'];

interface Props { activeTab: Tab; onTabChange: (tab: Tab) => void; unreadOffers?: number; unreadNotifs?: number; }

export default function BottomNav({ activeTab, onTabChange, unreadOffers = 0, unreadNotifs = 0 }: Props) {
  const activeIndex = TABS.indexOf(activeTab);
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__indicator" style={{ translate: `${activeIndex * 100}% 0` }} />
      {TABS.map(tab => {
        const dot = tab === 'offers' ? unreadOffers : tab === 'profile' ? unreadNotifs : 0;
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
