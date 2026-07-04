// «Трейд» — единый таб: лента обменов (бывший MarketScreen) + мои сделки
// (бывший TradesScreen). Оба экрана остаются смонтированными — состояние,
// фильтры и скролл не теряются при переключении под-вкладок.

import { useState } from 'react';
import type { AppConfig } from '../types';
import MarketScreen from './MarketScreen';
import TradesScreen from './TradesScreen';
import { hapticSelection } from '../utils/haptics';
import './TradeHubScreen.css';

type Sub = 'feed' | 'deals';

interface Props {
  myUserId: number | null;
  config: AppConfig | null;
  refreshKey?: number;
  unreadOffers?: number;
  onChanged: () => void;
}

export default function TradeHubScreen({ myUserId, config, refreshKey, unreadOffers = 0, onChanged }: Props) {
  const [sub, setSub] = useState<Sub>('feed');

  function switchTo(s: Sub) {
    if (s === sub) return;
    hapticSelection();
    setSub(s);
  }

  return (
    <div className="screen tradehub">
      <header className="tradehub__header">
        <h1 className="screen__title">Трейд</h1>
        <div className="tradehub__tabs seg" style={{ '--seg-idx': sub === 'feed' ? 0 : 1, '--seg-n': 2 } as React.CSSProperties}>
          <span className="seg__indicator" />
          <button className={`tradehub__tab seg__btn${sub === 'feed' ? ' seg__btn--active' : ''}`} onClick={() => switchTo('feed')}>
            Лента
          </button>
          <button className={`tradehub__tab seg__btn${sub === 'deals' ? ' seg__btn--active' : ''}`} onClick={() => switchTo('deals')}>
            Мои сделки
            {unreadOffers > 0 && <span className="tradehub__badge">{unreadOffers}</span>}
          </button>
        </div>
      </header>

      <div className="tradehub__pane" style={{ display: sub === 'feed' ? 'flex' : 'none' }}>
        <MarketScreen myUserId={myUserId} config={config} refreshKey={refreshKey} embedded />
      </div>
      <div className="tradehub__pane" style={{ display: sub === 'deals' ? 'flex' : 'none' }}>
        <TradesScreen myUserId={myUserId} refreshKey={refreshKey} onChanged={onChanged} embedded />
      </div>
    </div>
  );
}
