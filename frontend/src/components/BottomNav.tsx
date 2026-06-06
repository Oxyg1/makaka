import type { ReactElement } from 'react';
import type { Tab } from '../App';
import './BottomNav.css';

const ICONS: Record<Tab, ReactElement> = {
  rate: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="9" cy="6" rx="2.2" ry="2.8" />
      <ellipse cx="15" cy="6" rx="2.2" ry="2.8" />
      <ellipse cx="5.5" cy="10.5" rx="1.8" ry="2.4" />
      <ellipse cx="18.5" cy="10.5" rx="1.8" ry="2.4" />
      <path d="M12 10c-3.5 0-6 2-6 5 0 2.5 1.5 4 6 4s6-1.5 6-4c0-3-2.5-5-6-5z" />
    </svg>
  ),
  feed: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  ),
  submit: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  leaderboard: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="11" width="5" height="10" rx="1.5" />
      <rect x="9.5" y="6" width="5" height="15" rx="1.5" />
      <rect x="16" y="8" width="5" height="13" rx="1.5" />
    </svg>
  ),
  profile: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

const LABELS: Record<Tab, string> = {
  rate: 'Оценить',
  feed: 'Лента',
  submit: 'Добавить',
  leaderboard: 'Топ',
  profile: 'Профиль',
};

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNav({ activeTab, onTabChange }: Props) {
  const tabs = Object.keys(ICONS) as Tab[];
  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab}
          className={`bottom-nav__tab${activeTab === tab ? ' bottom-nav__tab--active' : ''}`}
          onClick={() => onTabChange(tab)}
          aria-current={activeTab === tab ? 'page' : undefined}
        >
          <div className="bottom-nav__dot" />
          <span className="bottom-nav__icon">{ICONS[tab]}</span>
          <span className="bottom-nav__label">{LABELS[tab]}</span>
        </button>
      ))}
    </nav>
  );
}
