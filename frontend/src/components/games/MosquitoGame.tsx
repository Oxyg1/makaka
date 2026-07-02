// «Комары»: лови комаров тапом — они появляются в случайных местах и
// быстро улетают. Раунд на время, сложность нарастает. Очки → Монеты.

import { useCallback, useEffect, useRef, useState } from 'react';
import { spendCoins, submitGameScore } from '../../api';
import { hapticImpact, hapticSuccess, hapticError } from '../../utils/haptics';
import Coin from './Coin';
import { fmt } from './economy';
import './games.css';

interface Mosq { id: number; x: number; y: number; size: number; }
interface Splat { id: number; x: number; y: number; text: string; }

type Phase = 'idle' | 'run' | 'end';

interface Props {
  balance: number;
  best: number;
  onBalance: (n: number) => void;
  onClose: () => void;
  onResult: () => void;
}

const BASE_ROUND = 45;
const PRICES = { time: 40, zone: 30, double: 50 };

export default function MosquitoGame({ balance, best: initialBest, onBalance, onClose, onResult }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BASE_ROUND);
  const [mosqs, setMosqs] = useState<Mosq[]>([]);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [best, setBest] = useState(initialBest);
  const [end, setEnd] = useState<{ score: number; coins: number; best: number } | null>(null);
  const [toast, setToast] = useState('');
  // бусты на следующий раунд
  const [boostTime, setBoostTime] = useState(false);
  const [boostZone, setBoostZone] = useState(false);
  const [boostDouble, setBoostDouble] = useState(false);

  const idRef = useRef(1);
  const runRef = useRef({ score: 0, streak: 0, endAt: 0, double: false, zone: false, start: 0 });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  async function buyBoost(boost: string, setter: (v: boolean) => void, active: boolean) {
    if (active) return;
    hapticImpact('medium');
    try {
      const r = await spendCoins(boost);
      onBalance(r.balance);
      setter(true);
      hapticSuccess();
    } catch (e) {
      hapticError();
      showToast((e as Error).message === 'Не хватает монет' ? 'Не хватает монет 🪙' : (e as Error).message);
    }
  }

  function startRound() {
    hapticImpact('medium');
    clearTimers();
    const dur = BASE_ROUND + (boostTime ? 15 : 0);
    runRef.current = { score: 0, streak: 0, endAt: Date.now() + dur * 1000, double: boostDouble, zone: boostZone, start: Date.now() };
    setScore(0); setStreak(0); setTimeLeft(dur);
    setMosqs([]); setSplats([]); setEnd(null);
    setPhase('run');
    // бусты одноразовые
    setBoostTime(false); setBoostZone(false); setBoostDouble(false);

    // таймер раунда
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((runRef.current.endAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) { clearInterval(tick); finishRound(); }
    }, 200);
    timersRef.current.push(tick as unknown as ReturnType<typeof setTimeout>);

    scheduleSpawn();
  }

  function progress01(): number {
    const { start, endAt } = runRef.current;
    return Math.min(1, Math.max(0, (Date.now() - start) / (endAt - start)));
  }

  function scheduleSpawn() {
    if (Date.now() >= runRef.current.endAt) return;
    const p = progress01();
    const interval = 900 - 520 * p;                     // чаще к концу
    const t = setTimeout(() => {
      spawnMosq();
      scheduleSpawn();
    }, interval * (0.75 + Math.random() * 0.5));
    timersRef.current.push(t);
  }

  function spawnMosq() {
    if (Date.now() >= runRef.current.endAt) return;
    const p = progress01();
    const sizeBase = 64 - 22 * p;                       // мельче к концу
    const size = Math.round(sizeBase * (runRef.current.zone ? 1.3 : 1));
    const m: Mosq = {
      id: idRef.current++,
      x: 6 + Math.random() * 82,                        // % поля
      y: 10 + Math.random() * 78,
      size,
    };
    setMosqs(list => [...list, m]);
    const ttl = 1600 - 650 * p;                          // живут меньше к концу
    const t = setTimeout(() => {
      setMosqs(list => {
        if (!list.some(x => x.id === m.id)) return list;
        runRef.current.streak = 0;                       // улетел — серия сброшена
        setStreak(0);
        return list.filter(x => x.id !== m.id);
      });
    }, ttl);
    timersRef.current.push(t);
  }

  function hit(m: Mosq) {
    hapticImpact('light');
    const r = runRef.current;
    r.streak += 1;
    const gain = (10 + Math.min(r.streak, 15)) * (r.double ? 2 : 1);
    r.score += gain;
    setScore(r.score);
    setStreak(r.streak);
    setMosqs(list => list.filter(x => x.id !== m.id));
    const splat: Splat = { id: idRef.current++, x: m.x, y: m.y, text: `+${gain}` };
    setSplats(list => [...list.slice(-14), splat]);
    setTimeout(() => setSplats(list => list.filter(s => s.id !== splat.id)), 600);
  }

  async function finishRound() {
    clearTimers();
    setMosqs([]);
    setPhase('end');
    const finalScore = runRef.current.score;
    if (finalScore <= 0) { setEnd({ score: 0, coins: 0, best }); return; }
    try {
      const r = await submitGameScore('mosquito', finalScore);
      onBalance(r.balance);
      setBest(r.best);
      setEnd({ score: r.score, coins: r.coins_earned, best: r.best });
      onResult();
      hapticSuccess();
    } catch (e) {
      setEnd({ score: finalScore, coins: 0, best });
      showToast((e as Error).message);
    }
  }

  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(m: string) {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2200);
  }

  return (
    <div className="game-screen">
      <div className="game-topbar">
        <button className="game-topbar__back" onClick={onClose} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="game-topbar__title">🦟 Комары</span>
        <span className="game-topbar__coins"><Coin size={16} /> {fmt(balance)}</span>
      </div>

      {phase === 'idle' && (
        <div className="mosq-intro">
          <div className="mosq-intro__emoji">🦟</div>
          <h2 className="mosq-intro__title">Успей поймать!</h2>
          <p className="mosq-intro__desc">
            Комары появляются в случайных местах и быстро улетают. Тапай по ним:
            серия попаданий без промахов даёт бонус. {BASE_ROUND} секунд — и чем дальше, тем они шустрее.
          </p>
          <div className="boost-row">
            <button className={`boost-btn${boostTime ? ' boost-btn--on' : ''}`} onClick={() => buyBoost('mosquito:time', setBoostTime, boostTime)}>
              ⏱ +15 сек {boostTime ? '✓' : <span className="boost-btn__price"><Coin size={13} />{PRICES.time}</span>}
            </button>
            <button className={`boost-btn${boostZone ? ' boost-btn--on' : ''}`} onClick={() => buyBoost('mosquito:zone', setBoostZone, boostZone)}>
              🎯 Крупнее {boostZone ? '✓' : <span className="boost-btn__price"><Coin size={13} />{PRICES.zone}</span>}
            </button>
            <button className={`boost-btn${boostDouble ? ' boost-btn--on' : ''}`} onClick={() => buyBoost('mosquito:double', setBoostDouble, boostDouble)}>
              ✨ Очки ×2 {boostDouble ? '✓' : <span className="boost-btn__price"><Coin size={13} />{PRICES.double}</span>}
            </button>
          </div>
          <button className="btn-primary mosq-intro__start" onClick={startRound}>Начать раунд</button>
          {best > 0 && <p className="mosq-intro__desc">Ваш рекорд: <b>{fmt(best)}</b></p>}
        </div>
      )}

      {phase !== 'idle' && (
        <div className="mosq-field">
          <div className="mosq-hud">
            <div>
              <div className="mosq-hud__score">{fmt(score)}</div>
              {streak >= 3 && <div className="mosq-hud__streak">🔥 серия ×{streak}</div>}
            </div>
            <div className={`mosq-hud__timer${timeLeft <= 5 && phase === 'run' ? ' mosq-hud__timer--low' : ''}`}>
              {timeLeft}s
            </div>
          </div>

          {mosqs.map(m => (
            <button
              key={m.id}
              className="mosquito"
              style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.size, height: m.size, fontSize: m.size * 0.62 }}
              onPointerDown={() => hit(m)}
              aria-label="комар"
            >
              <span className="mosquito__body">🦟</span>
            </button>
          ))}

          {splats.map(s => (
            <span key={s.id} className="mosq-splat" style={{ left: `${s.x}%`, top: `${s.y}%` }}>{s.text}</span>
          ))}

          {phase === 'end' && end && (
            <div className="round-end">
              <div className="round-end__card">
                <div className="round-end__emoji">{end.score > 0 ? '🏅' : '🦟'}</div>
                <div className="round-end__title">{end.score >= end.best && end.score > 0 ? 'Новый рекорд!' : 'Раунд окончен'}</div>
                <div className="round-end__score">{fmt(end.score)}</div>
                {end.coins > 0 && <div className="round-end__coins"><Coin size={17} /> +{end.coins} Монет</div>}
                {end.coins === 0 && end.score > 0 && <div className="round-end__meta">Дневной лимит монет исчерпан — очки в зачёте!</div>}
                <div className="round-end__meta">Рекорд: {fmt(end.best)}</div>
                <div className="round-end__actions">
                  <button className="btn-ghost" onClick={() => { hapticImpact('light'); setPhase('idle'); }}>Бусты</button>
                  <button className="btn-primary" onClick={startRound}>Ещё раз</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && <div className="game-toast">{toast}</div>}
    </div>
  );
}
