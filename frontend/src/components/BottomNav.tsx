import type { Tab } from '../App';
import './BottomNav.css';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'rate', label: 'Оценить', icon: '⭐' },
  { id: 'mycats', label: 'Мои коты', icon: '🐱' },
  { id: 'submit', label: 'Добавить', icon: '➕' },
  { id: 'leaderboard', label: 'Топ', icon: '🏆' },
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
          <span className="bottom-nav__icon">{tab.icon}</span>
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
