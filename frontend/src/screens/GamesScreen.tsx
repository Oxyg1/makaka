// «Игры» — хаб: баланс Монет, дневной бонус, карточки трёх игр,
// лидерборды и магазин монет. Сами игры открываются полноэкранно.

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { claimDailyBonus, getGamesState } from '../api';
import type { GameId, GamesState } from '../types';
import Coin from '../components/games/Coin';
import { useCountUp } from '../components/games/fx';
import { Skel, SkelCard } from '../components/Skeleton';

// Игры и шторки — отдельные чанки: главный бандл не тянет игровой код
const CoinShop = lazy(() => import('../components/games/CoinShop'));
const LeaderboardSheet = lazy(() => import('../components/games/LeaderboardSheet'));
const MergeGame = lazy(() => import('../components/games/MergeGame'));
const MosquitoGame = lazy(() => import('../components/games/MosquitoGame'));
const ClickerGame = lazy(() => import('../components/games/ClickerGame'));
import { fmt, MERGE_CHAIN, CLICKER_CHAIN } from '../components/games/economy';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import './GamesScreen.css';

const GAMES: { id: GameId; title: string; desc: string; emoji: string }[] = [
  { id: 'merge', title: 'Мерж', desc: 'Соединяй одинаковых лягушек — получай более редких', emoji: '🧬' },
  { id: 'mosquito', title: 'Комары', desc: 'Лови комаров на скорость, пока не улетели', emoji: '🦟' },
  { id: 'clicker', title: 'Кликер', desc: 'Тапай жабку и прокачивай болото до Короля', emoji: '👆' },
];

export default function GamesScreen({ active }: { active: boolean }) {
  const [state, setState] = useState<GamesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [openGame, setOpenGame] = useState<GameId | null>(null);
  const [lbGame, setLbGame] = useState<GameId | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [toast, setToast] = useState('');
  const loadedOnce = useRef(false);

  const refresh = useCallback(() => {
    getGamesState().then(setState).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active || loadedOnce.current) return;
    loadedOnce.current = true;
    refresh();
  }, [active, refresh]);

  const setBalance = useCallback((n: number) => {
    setState(s => (s ? { ...s, balance: n } : s));
  }, []);

  async function claimDaily() {
    hapticImpact('medium');
    try {
      const r = await claimDailyBonus();
      hapticSuccess();
      setState(s => (s ? { ...s, balance: r.balance, daily_available: false } : s));
      showToast(`🎁 +${r.coins} Монет!`);
    } catch (e) {
      hapticError();
      setState(s => (s ? { ...s, daily_available: false } : s));
      showToast((e as Error).message);
    }
  }

  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(m: string) {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2400);
  }

  const balance = state?.balance ?? 0;

  return (
    <div className="screen">
      <header className="games__header">
        <div>
          <h1 className="screen__title">Игры</h1>
          <p className="screen__subtitle">Играй, соревнуйся, зарабатывай Монеты</p>
        </div>
        <BalanceChip balance={balance} onClick={() => { hapticImpact('light'); setShowShop(true); }} />
      </header>

      <div className="screen__scroll">
        {loading && (
          <>
            <Skel style={{ height: 66, borderRadius: 18, marginBottom: 12 }} />
            <div className="games__list">
              <SkelCard height={112} /><SkelCard height={112} /><SkelCard height={112} />
            </div>
          </>
        )}

        {!loading && state?.daily_available && (
          <div className="daily-card">
            <span className="daily-card__icon">🎁</span>
            <div className="daily-card__text">
              <div className="daily-card__title">Дневной бонус</div>
              <div className="daily-card__sub">+{state.daily_bonus} Монет за вход — каждый день</div>
            </div>
            <button className="daily-card__btn" onClick={claimDaily}>Забрать</button>
          </div>
        )}

        {!loading && (
          <div className="games__list">
            {GAMES.map(g => {
              const s = state?.games[g.id];
              return (
                <article key={g.id} className="game-card" onClick={() => { hapticImpact('light'); setOpenGame(g.id); }}>
                  <GameArt id={g.id} emoji={g.emoji} />
                  <div className="game-card__info">
                    <div className="game-card__title">{g.title}</div>
                    <div className="game-card__desc">{g.desc}</div>
                    <div className="game-card__meta">
                      {s && s.best > 0
                        ? <>
                            <span className="chip chip--primary">рекорд {fmt(s.best)}</span>
                            {s.rank && <span className="chip">#{s.rank} из {s.players}</span>}
                          </>
                        : <span className="chip chip--ghost">ещё не играли</span>}
                    </div>
                  </div>
                  <div className="game-card__side">
                    <button className="game-card__play" onClick={e => { e.stopPropagation(); hapticImpact('medium'); setOpenGame(g.id); }}>
                      {s && s.best > 0 ? 'Продолжить' : 'Играть'}
                    </button>
                    <button className="game-card__lb" onClick={e => { e.stopPropagation(); hapticImpact('light'); setLbGame(g.id); }}>
                      🏆 Лидерборд
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && (
          <p className="games__note">
            💡 Очки конвертируются в Монеты автоматически (до {state?.games.merge.daily_cap ?? 500} в день с игры).
            Монеты тратятся на бусты и улучшения, а докупить их можно за Telegram Stars в магазине.
          </p>
        )}
      </div>

      <Suspense fallback={<GameLoading />}>
        {openGame === 'merge' && (
          <MergeGame chain={MERGE_CHAIN} balance={balance} onBalance={setBalance} onClose={() => { setOpenGame(null); refresh(); }} onResult={refresh} onOpenShop={() => setShowShop(true)} />
        )}
        {openGame === 'mosquito' && (
          <MosquitoGame balance={balance} best={state?.games.mosquito.best ?? 0} onBalance={setBalance} onClose={() => { setOpenGame(null); refresh(); }} onResult={refresh} onOpenShop={() => setShowShop(true)} />
        )}
        {openGame === 'clicker' && (
          <ClickerGame chain={CLICKER_CHAIN} balance={balance} onBalance={setBalance} onClose={() => { setOpenGame(null); refresh(); }} onResult={refresh} onOpenShop={() => setShowShop(true)} />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {lbGame && <LeaderboardSheet game={lbGame} onClose={() => setLbGame(null)} />}
        {showShop && <CoinShop onClose={() => setShowShop(false)} onBalance={setBalance} />}
      </Suspense>

      {toast && <div className="game-toast">{toast}</div>}
    </div>
  );
}

// Мгновенный отклик на тап по игре, пока догружается её чанк.
function GameLoading() {
  return (
    <div className="game-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );
}

// Иконка игры: арт из /assets/games/{id}.png (кладётся на сервер),
// пока файла нет — градиент с эмодзи.
function GameArt({ id, emoji }: { id: GameId; emoji: string }) {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return (
      <img
        className="game-card__art game-card__art--img"
        src={`/assets/games/${id}.png`}
        alt=""
        onError={() => setBroken(true)}
      />
    );
  }
  return <div className={`game-card__art game-card__art--${id}`}>{emoji}</div>;
}

// Баланс с плавным набегом числа — награды «дотекают» на глазах.
function BalanceChip({ balance, onClick }: { balance: number; onClick: () => void }) {
  const v = useCountUp(balance, 600);
  return (
    <button className="coin-chip" onClick={onClick} aria-label="Магазин монет">
      <Coin size={20} /> {fmt(v)}
      <span className="coin-chip__plus">+</span>
    </button>
  );
}
