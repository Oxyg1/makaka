import type { Tab } from '../App';
import './BottomNav.css';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'rate',        label: 'Оценить',    icon: '/icons/rate.png' },
  { id: 'mycats',      label: 'Мои',        icon: '/icons/mycats.png' },
  { id: 'submit',      label: 'Добавить',   icon: '/icons/submit.png' },
  { id: 'leaderboard', label: 'Топ',        icon: '/icons/leaderboard.png' },
  { id: 'settings',    label: 'Настройки',  icon: '/icons/settings.png' },
];

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`bottom-nav__tab${activeTab === tab.id ? ' bottom-nav__tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <div className="bottom-nav__dot" />
          <img
            className="bottom-nav__icon"
            src={tab.icon}
            alt={tab.label}
          />
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
