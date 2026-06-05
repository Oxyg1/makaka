import { useState } from 'react';
import { isHapticsEnabled, setHapticsEnabled, hapticImpact } from '../utils/haptics';
import './SettingsScreen.css';

export default function SettingsScreen() {
  const [haptics, setHaptics] = useState(isHapticsEnabled());

  const toggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    setHaptics(val);
    if (val) hapticImpact('medium');
  };

  return (
    <div className="settings">
      <h2 className="section-title">Настройки</h2>

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
