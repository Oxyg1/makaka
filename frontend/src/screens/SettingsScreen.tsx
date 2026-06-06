import { useState, useEffect } from 'react';
import { isHapticsEnabled, setHapticsEnabled, hapticImpact } from '../utils/haptics';
import { getStats } from '../api';
import type { UserStats } from '../types';
import './SettingsScreen.css';

export default function SettingsScreen() {
  const [haptics, setHaptics] = useState(isHapticsEnabled());
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => null);
  }, []);

  const toggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    setHaptics(val);
    if (val) hapticImpact('medium');
  };

  return (
    <div className="settings">
      <h2 className="section-title">Настройки</h2>

      {stats && (
        <div className="settings__section">
          <div className="settings__section-title">Моя статистика</div>
          <div className="settings__group">
            <div className="settings__row">
              <span className="settings__row-label">Оценено котов</span>
              <span className="settings__stat-value">{stats.total_rated}</span>
            </div>
            <div className="settings__row">
              <span className="settings__row-label">Пропущено</span>
              <span className="settings__stat-value">{stats.total_skipped}</span>
            </div>
            <div className="settings__row">
              <span className="settings__row-label">Серия дней</span>
              <span className="settings__stat-value settings__stat-streak">
                {stats.streak_days} {pluralDays(stats.streak_days)} 🔥
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="settings__section">
        <div className="settings__section-title">Интерфейс</div>
        <div className="settings__group">
          <div className="settings__row">
            <div className="settings__row-left">
              <span className="settings__row-label">Тактильный отклик</span>
              <span className="settings__row-desc">Вибрация при оценке котов</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={haptics} onChange={e => toggleHaptics(e.target.checked)} />
              <div className="toggle__track" />
              <div className="toggle__thumb" />
            </label>
          </div>
        </div>
      </div>

      <div className="settings__section">
        <div className="settings__section-title">О приложении</div>
        <div className="settings__group">
          <div className="settings__row">
            <div className="settings__row-left">
              <span className="settings__row-label">Cat Rater</span>
              <span className="settings__row-desc">Оценивайте котов и соревнуйтесь!</span>
            </div>
            <span style={{ fontSize: 28 }}>🐾</span>
          </div>
          <div className="settings__row">
            <div className="settings__row-left">
              <span className="settings__row-label">Версия</span>
            </div>
            <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: 15 }}>1.0.0</span>
          </div>
        </div>
      </div>

      <div className="settings__about">Сделано с ❤️ для любителей котов</div>
    </div>
  );
}

function pluralDays(n: number): string {
  const r = n % 10;
  if (n % 100 >= 11 && n % 100 <= 14) return 'дней';
  if (r === 1) return 'день';
  if (r >= 2 && r <= 4) return 'дня';
  return 'дней';
}
