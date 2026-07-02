// «Кликер»: тапай жабку → очки. Апгрейды за очки: сила клика и
// лягушки-помощники (пассивный доход). Пройди всю цепочку тиров до
// Короля болота. Бусты — за Монеты. Оффлайн-доход считается по времени
// последнего сохранения; сервер валидирует скорость прироста и даёт
// монеты за ачивки (первая покупка каждого тира).

import { useCallback, useEffect, useRef, useState } from 'react';
import { getGameProgress, saveGameProgress, spendCoins } from '../../api';
import { hapticImpact, hapticSuccess, hapticError } from '../../utils/haptics';
import { modelImageUrl } from '../../utils/changes';
import Coin from './Coin';
import { CLICKER, HELPER_NAMES, HELPER_EMOJI, fmt } from './economy';
import './games.css';

interface ClickerState {
  points: number;        // текущие очки (тратятся на апгрейды)
  clickLevel: number;
  helpers: number[];     // штук помощников по тирам
  golden?: boolean;      // ×1.5 всё (навсегда)
  frenzyUntil?: number;  // клик ×2 до метки времени
  skipNext?: boolean;    // скидка 50% на следующий апгрейд
}

interface Float { id: number; x: number; y: number; text: string; }

interface Props {
  chain: string[];       // модели: частые → редкие
  balance: number;
  onBalance: (n: number) => void;
  onClose: () => void;
  onResult: () => void;
}

const PRICES = { frenzy: 100, golden: 500, skip: 200 };
const TIERS = CLICKER.helperPps.length;

const fresh = (): ClickerState => ({ points: 0, clickLevel: 0, helpers: Array(TIERS).fill(0) });

export default function ClickerGame({ chain, balance, onBalance, onClose, onResult }: Props) {
  const [st, setSt] = useState<ClickerState>(fresh);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState('');
  const idRef = useRef(1);
  const dirtyRef = useRef(false);
  const ref = useRef({ st, totalEarned });
  ref.current = { st, totalEarned };

  // ── загрузка + оффлайн-доход ──
  useEffect(() => {
    getGameProgress<ClickerState>('clicker').then(p => {
      const s: ClickerState = {
        ...fresh(),
        ...(p.state ?? {}),
        helpers: Array.from({ length: TIERS }, (_, i) => p.state?.helpers?.[i] ?? 0),
      };
      let earned = p.score;
      if (p.updated_at) {
        const elapsed = Math.min(Math.max(0, (Date.now() - Date.parse(p.updated_at + 'Z')) / 1000), CLICKER.offlineCapSec);
        const offline = Math.floor(pps(s) * elapsed);
        if (offline > 0) {
          s.points += offline;
          earned += offline;
          showToastRef.current(`💤 Пока вас не было: +${fmt(offline)} очков`);
        }
      }
      setSt(s);
      setTotalEarned(earned);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  // ── пассивный доход, тик 1с ──
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => {
      const rate = pps(ref.current.st);
      if (rate <= 0) return;
      setSt(s => ({ ...s, points: s.points + rate }));
      setTotalEarned(e => e + rate);
      dirtyRef.current = true;
    }, 1000);
    return () => clearInterval(t);
  }, [loaded]);

  // ── синк на сервер (раз в 8с + при выходе). Сервер может подрезать score
  //    и вернуть монеты за ачивки — отражаем и то и другое. ──
  const sync = useCallback(async () => {
    const { st: s, totalEarned: earned } = ref.current;
    try {
      const r = await saveGameProgress('clicker', {
        state: s,
        score: Math.floor(earned),
        level: s.helpers.filter(n => n >= 1).length,
      });
      if (r.coins_earned > 0) {
        onBalance(r.balance);
        showToastRef.current(`🏅 Ачивка: +${r.coins_earned} Монет`);
        onResult();
      }
      if (r.score < Math.floor(earned)) setTotalEarned(r.score); // сервер подрезал
    } catch { /* offline — доедет в следующий раз */ }
  }, [onBalance, onResult]);

  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => { if (dirtyRef.current) { dirtyRef.current = false; sync(); } }, 8000);
    return () => { clearInterval(t); sync(); };
  }, [loaded, sync]);

  // ── клик ──
  function tap(e: React.PointerEvent) {
    const frenzy = (st.frenzyUntil ?? 0) > Date.now();
    const power = Math.round(CLICKER.clickPower(st.clickLevel) * (st.golden ? 1.5 : 1) * (frenzy ? 2 : 1));
    hapticImpact('light');
    setSt(s => ({ ...s, points: s.points + power }));
    setTotalEarned(v => v + power);
    dirtyRef.current = true;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f: Float = {
      id: idRef.current++,
      x: e.clientX - rect.left + (Math.random() * 24 - 12),
      y: e.clientY - rect.top - 10,
      text: `+${fmt(power)}`,
    };
    setFloats(list => [...list.slice(-11), f]);
    setTimeout(() => setFloats(list => list.filter(x => x.id !== f.id)), 750);
  }

  // ── апгрейды за очки ──
  function costWithSkip(base: number): number {
    return st.skipNext ? Math.ceil(base / 2) : base;
  }
  function buyClick() {
    const cost = costWithSkip(CLICKER.clickCost(st.clickLevel));
    if (st.points < cost) return;
    hapticSuccess();
    setSt(s => ({ ...s, points: s.points - cost, clickLevel: s.clickLevel + 1, skipNext: false }));
    dirtyRef.current = true;
  }
  function buyHelper(tier: number) {
    const count = st.helpers[tier] ?? 0;
    const cost = costWithSkip(CLICKER.helperCost(tier, count));
    if (st.points < cost) return;
    hapticSuccess();
    setSt(s => {
      const helpers = [...s.helpers];
      helpers[tier] = (helpers[tier] ?? 0) + 1;
      return { ...s, points: s.points - cost, helpers, skipNext: false };
    });
    dirtyRef.current = true;
    // первая покупка тира → сервер начислит монеты, узнаем при синке
    if (count === 0) setTimeout(sync, 300);
  }

  // ── бусты за Монеты ──
  async function buyBoost(boost: string, apply: (s: ClickerState) => ClickerState) {
    hapticImpact('medium');
    try {
      const r = await spendCoins(boost);
      onBalance(r.balance);
      setSt(apply);
      dirtyRef.current = true;
      hapticSuccess();
    } catch (e) {
      hapticError();
      showToast((e as Error).message === 'Не хватает монет' ? 'Не хватает монет 🪙' : (e as Error).message);
    }
  }

  const showToastRef = useRef((m: string) => { void m; });
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(m: string) {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2600);
  }
  showToastRef.current = showToast;

  const rate = pps(st);
  const frenzyOn = (st.frenzyUntil ?? 0) > Date.now();
  const done = (st.helpers[TIERS - 1] ?? 0) >= 1;
  const clickCost = costWithSkip(CLICKER.clickCost(st.clickLevel));
  const baseModel = chain[0];

  return (
    <div className="game-screen">
      <div className="game-topbar">
        <button className="game-topbar__back" onClick={onClose} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="game-topbar__title">👆 Кликер</span>
        <span className="game-topbar__coins"><Coin size={16} /> {fmt(balance)}</span>
      </div>

      <div className="clicker-body">
        <div className="clicker-stage">
          <div className="clicker-points">{fmt(st.points)}</div>
          <div className="clicker-pps">
            {rate > 0 ? `+${fmt(rate)}/сек` : 'тапай жабку!'}
            {st.golden ? ' · ✨×1.5' : ''}{frenzyOn ? ' · ⚡×2' : ''}
          </div>

          <button className={`clicker-frog${st.golden ? ' clicker-frog--golden' : ''}`} onPointerDown={tap} aria-label="Тап">
            <FrogArt model={baseModel} />
          </button>

          {floats.map(f => (
            <span key={f.id} className="click-float" style={{ left: f.x, top: f.y }}>{f.text}</span>
          ))}

          <div className="boost-row" style={{ padding: '10px 0 2px' }}>
            <button className={`boost-btn${frenzyOn ? ' boost-btn--on' : ''}`} disabled={frenzyOn}
              onClick={() => buyBoost('clicker:frenzy', s => ({ ...s, frenzyUntil: Date.now() + 3600_000 }))}>
              ⚡ Клик ×2 на час {frenzyOn ? '· активно' : <span className="boost-btn__price"><Coin size={13} />{PRICES.frenzy}</span>}
            </button>
            {!st.golden && (
              <button className="boost-btn" onClick={() => buyBoost('clicker:golden', s => ({ ...s, golden: true }))}>
                ✨ Золотая жаба ×1.5 <span className="boost-btn__price"><Coin size={13} />{PRICES.golden}</span>
              </button>
            )}
            {!st.skipNext && (
              <button className="boost-btn" onClick={() => buyBoost('clicker:skip', s => ({ ...s, skipNext: true }))}>
                🎟 −50% на апгрейд <span className="boost-btn__price"><Coin size={13} />{PRICES.skip}</span>
              </button>
            )}
          </div>
        </div>

        <div className="clicker-shop">
          {done && (
            <div className="clicker-done">
              👑 Болото пройдено! Вы собрали всю цепочку — от Головастика до Короля болота.
              Ачивка и монеты уже начислены. Дальше — только рекорды.
            </div>
          )}

          <div className="section-title">Апгрейды</div>

          <button className="upg-row" onClick={buyClick} disabled={st.points < clickCost}>
            <span className="upg-row__icon">👆</span>
            <span className="upg-row__info">
              <div className="upg-row__name">Сила клика {st.skipNext && '· 🎟−50%'}</div>
              <div className="upg-row__sub">+1 за тап · сейчас {fmt(CLICKER.clickPower(st.clickLevel))}</div>
            </span>
            <span className="upg-row__cost">
              {fmt(clickCost)}
              <div className="upg-row__count">ур. {st.clickLevel}</div>
            </span>
          </button>

          {Array.from({ length: TIERS }, (_, t) => {
            const count = st.helpers[t] ?? 0;
            const locked = t > 0 && (st.helpers[t - 1] ?? 0) === 0;
            const cost = costWithSkip(CLICKER.helperCost(t, count));
            const model = chain[t + 1]; // тир 0 — следующая после базовой модель
            return (
              <button
                key={t}
                className={`upg-row${locked ? ' upg-row--locked' : ''}`}
                onClick={() => !locked && buyHelper(t)}
                disabled={locked || st.points < cost}
              >
                <span className="upg-row__icon"><HelperArt model={model} emoji={HELPER_EMOJI[t]} locked={locked} /></span>
                <span className="upg-row__info">
                  <div className="upg-row__name">{HELPER_NAMES[t]} {st.skipNext && !locked && '· 🎟−50%'}</div>
                  <div className="upg-row__sub">
                    {locked ? `Сначала купите: ${HELPER_NAMES[t - 1]}` : `+${fmt(CLICKER.helperPps[t])}/сек за штуку`}
                  </div>
                </span>
                <span className="upg-row__cost">
                  {locked ? '🔒' : fmt(cost)}
                  <div className="upg-row__count">{count > 0 ? `×${count}` : ''}</div>
                </span>
              </button>
            );
          })}

          <p className="shop-note">
            Монеты даются за ачивки: первая покупка каждого помощника и полное прохождение цепочки.
            Всего заработано очков: {fmt(totalEarned)} — это ваш результат в лидерборде.
          </p>
        </div>
      </div>

      {toast && <div className="game-toast">{toast}</div>}
    </div>
  );
}

function pps(s: ClickerState): number {
  let v = 0;
  for (let i = 0; i < TIERS; i++) v += (s.helpers[i] ?? 0) * CLICKER.helperPps[i];
  return Math.round(v * (s.golden ? 1.5 : 1));
}

function FrogArt({ model }: { model?: string }) {
  const [broken, setBroken] = useState(false);
  if (model && !broken) {
    return <img src={modelImageUrl(model, 256)} alt={model} draggable={false} onError={() => setBroken(true)} />;
  }
  return <span style={{ fontSize: 96, filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.45))' }}>🐸</span>;
}

function HelperArt({ model, emoji, locked }: { model?: string; emoji: string; locked: boolean }) {
  const [broken, setBroken] = useState(false);
  if (model && !broken && !locked) {
    return <img src={modelImageUrl(model, 128)} alt="" draggable={false} onError={() => setBroken(true)} />;
  }
  return <>{locked ? '❔' : emoji}</>;
}
