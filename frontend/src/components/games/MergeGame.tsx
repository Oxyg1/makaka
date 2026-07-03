// «Мерж»: перетаскивай двух одинаковых лягушек друг на друга — получишь
// более редкую. Цепочка уровней = модели KissedFrog от частых к редким.
// Очки за слияния конвертируются в Монеты на сервере.
//
// Производительность: ghost перетаскивания двигается напрямую через DOM
// (без ре-рендеров на pointermove), все эффекты — transform/opacity.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGameProgress, saveGameProgress, spendCoins, submitGameScore } from '../../api';
import { hapticImpact, hapticSuccess, hapticError } from '../../utils/haptics';
import { modelImageUrl } from '../../utils/changes';
import Coin from './Coin';
import { Confetti, CoinBurst, useCountUp } from './fx';
import { MERGE_EMOJI, MERGE_MAX_LEVEL, fmt } from './economy';
import './games.css';

interface Chip { id: number; l: number; f?: boolean } // f = заморожена
type Board = (Chip | null)[];

interface MergeSaved {
  board?: (({ l: number; f?: boolean }) | null)[];
  field?: number;
  runScore?: number;
  potionUntil?: number;
  maxSeen?: number;
}

interface CellFx { id: number; idx: number; text?: string }

interface Props {
  chain: string[];               // модели: частые → редкие
  balance: number;
  onBalance: (n: number) => void;
  onClose: () => void;
  onResult: () => void;          // обновить сводку в хабе
  onOpenShop: () => void;        // не хватает монет → магазин
}

const SPAWN_MS = 3500;
const PRICES = { potion: 60, unfreeze: 30, field5: 300 };

export default function MergeGame({ chain, balance, onBalance, onClose, onResult, onOpenShop }: Props) {
  const maxLevel = Math.min(MERGE_MAX_LEVEL, Math.max(chain.length, 6));
  const idRef = useRef(1);
  const [field, setField] = useState(4);
  const [board, setBoard] = useState<Board>(() => Array(16).fill(null));
  const [runScore, setRunScore] = useState(0);
  const [best, setBest] = useState(0);
  const [potionUntil, setPotionUntil] = useState(0);
  const [maxSeen, setMaxSeen] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [denyAt, setDenyAt] = useState<number | null>(null);
  const [fx, setFx] = useState<CellFx[]>([]);
  const [mergedAt, setMergedAt] = useState<{ idx: number; key: number } | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [end, setEnd] = useState<{ score: number; coins: number; best: number; record: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const [spawnCd, setSpawnCd] = useState(false);
  const [spawnTick, setSpawnTick] = useState(0); // перезапуск полоски автоспавна

  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const dropAtRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const stateRef = useRef({ board, field, runScore, potionUntil, maxSeen });
  stateRef.current = { board, field, runScore, potionUntil, maxSeen };

  const displayScore = useCountUp(runScore, 450);

  const newChip = useCallback((l: number, f = false): Chip => ({ id: idRef.current++, l, f }), []);

  // ── загрузка сохранения ──
  useEffect(() => {
    getGameProgress<MergeSaved>('merge').then(p => {
      setBest(p.score);
      const s = p.state;
      if (s?.board && Array.isArray(s.board)) {
        const fld = s.field === 5 ? 5 : 4;
        setField(fld);
        const cells: Board = Array(fld * fld).fill(null);
        s.board.slice(0, fld * fld).forEach((c, i) => {
          if (c && typeof c.l === 'number' && c.l >= 1) cells[i] = newChip(Math.min(c.l, maxLevel), !!c.f);
        });
        setBoard(cells);
        setRunScore(Math.max(0, s.runScore ?? 0));
        setPotionUntil(s.potionUntil ?? 0);
        setMaxSeen(Math.max(1, s.maxSeen ?? 1));
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, [newChip, maxLevel]);

  // ── автосохранение (раз в 4с, если что-то менялось) + при выходе ──
  const persist = useCallback(() => {
    const { board: b, field: f, runScore: rs, potionUntil: pu, maxSeen: ms } = stateRef.current;
    const save: MergeSaved = {
      board: b.map(c => (c ? { l: c.l, ...(c.f ? { f: true } : {}) } : null)),
      field: f, runScore: rs, potionUntil: pu, maxSeen: ms,
    };
    saveGameProgress('merge', { state: save, level: f }).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (dirtyRef.current) { dirtyRef.current = false; persist(); } }, 4000);
    return () => { clearInterval(t); persist(); };
  }, [persist]);

  const markDirty = () => { dirtyRef.current = true; };

  // ── спавн ──
  const doSpawn = useCallback(() => {
    setBoard(b => {
      const empty = b.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
      if (!empty.length) return b;
      const nb = [...b];
      const filled = b.filter(Boolean).length;
      const lvl = filled > 5 && Math.random() < 0.15 ? 2 : 1;
      const frozen = filled > 6 && Math.random() < 0.08;
      nb[empty[Math.floor(Math.random() * empty.length)]] = newChip(lvl, frozen);
      dirtyRef.current = true;
      return nb;
    });
    setSpawnTick(k => k + 1);
  }, [newChip]);

  const potionOn = Date.now() < potionUntil;
  const spawnInterval = potionOn ? SPAWN_MS / 2 : SPAWN_MS;

  useEffect(() => {
    if (!loaded || end) return;
    const meta = { last: Date.now() };
    const t = setInterval(() => {
      const interval = Date.now() < stateRef.current.potionUntil ? SPAWN_MS / 2 : SPAWN_MS;
      if (Date.now() - meta.last >= interval) {
        meta.last = Date.now();
        doSpawn();
      }
    }, 250);
    return () => clearInterval(t);
  }, [loaded, end, doSpawn]);

  function spawnNow() {
    if (spawnCd) return;
    hapticImpact('light');
    doSpawn();
    setSpawnCd(true);
    setTimeout(() => setSpawnCd(false), 1500);
  }

  // ── эффекты в клетках ──
  const addFx = useCallback((idx: number, text?: string) => {
    const f: CellFx = { id: idRef.current++, idx, text };
    setFx(list => [...list.slice(-7), f]);
    setTimeout(() => setFx(list => list.filter(x => x.id !== f.id)), 800);
  }, []);

  function deny(idx: number) {
    hapticImpact('light');
    setDenyAt(idx);
    setTimeout(() => setDenyAt(null), 320);
  }

  // ── drag & drop ──
  function cellIndexAt(x: number, y: number): number | null {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = 8, gap = 7;
    const cell = (r.width - pad * 2 - (field - 1) * gap) / field;
    const cx = x - r.left - pad, cy = y - r.top - pad;
    if (cx < 0 || cy < 0) return null;
    const col = Math.floor(cx / (cell + gap)), row = Math.floor(cy / (cell + gap));
    if (col < 0 || col >= field || row < 0 || row >= field) return null;
    return row * field + col;
  }

  function moveGhost(x: number, y: number) {
    const g = ghostRef.current;
    if (g) g.style.transform = `translate(${x}px, ${y}px)`;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (end) return;
    const idx = cellIndexAt(e.clientX, e.clientY);
    if (idx === null) return;
    const chip = board[idx];
    if (!chip) return;
    if (chip.f) { tryUnfreeze(idx); return; }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    hapticImpact('light');
    setDragFrom(idx);
    dropAtRef.current = null;
    setDropAt(null);
    requestAnimationFrame(() => moveGhost(e.clientX, e.clientY));
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragFrom === null) return;
    moveGhost(e.clientX, e.clientY); // напрямую в DOM — без ре-рендера
    const idx = cellIndexAt(e.clientX, e.clientY);
    const target = idx !== null && idx !== dragFrom ? idx : null;
    if (target !== dropAtRef.current) {
      dropAtRef.current = target;
      setDropAt(target);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragFrom === null) return;
    const from = dragFrom;
    const to = cellIndexAt(e.clientX, e.clientY);
    setDragFrom(null); setDropAt(null); dropAtRef.current = null;
    if (to === null || to === from) return;
    setBoard(b => {
      const src = b[from], dst = b[to];
      if (!src) return b;
      const nb = [...b];
      if (!dst) { nb[to] = src; nb[from] = null; markDirty(); return nb; }           // перенос
      if (!dst.f && dst.l === src.l && src.l < maxLevel) {                            // слияние
        const nl = src.l + 1;
        nb[to] = newChip(nl); nb[from] = null;
        const gain = nl * nl * 10;
        setRunScore(s => s + gain);
        hapticSuccess();
        addFx(to, `+${gain}`);
        setMergedAt({ idx: to, key: idRef.current++ });
        if (nl > stateRef.current.maxSeen) {
          setMaxSeen(nl);
          setConfettiKey(k => k + 1);
          hapticImpact('heavy');
          showToast(nl === maxLevel ? '🏆 Максимальная лягушка!' : `✨ Новая лягушка открыта — ур. ${nl}!`);
        }
        markDirty();
        return nb;
      }
      deny(to);
      return b;
    });
  }

  // ── бусты ──
  async function buy(boost: string, apply: () => void) {
    hapticImpact('medium');
    try {
      const r = await spendCoins(boost);
      onBalance(r.balance);
      apply();
      hapticSuccess();
    } catch (e) {
      hapticError();
      if ((e as Error).message === 'Не хватает монет') {
        showToast('Не хватает монет — загляните в магазин 🪙');
        onOpenShop();
      } else {
        showToast((e as Error).message);
      }
    }
  }

  function tryUnfreeze(idx: number) {
    buy('merge:unfreeze', () => {
      setBoard(b => {
        const nb = [...b];
        const c = nb[idx];
        if (c) nb[idx] = { ...c, f: false };
        markDirty();
        return nb;
      });
      addFx(idx, '❄️→💧');
    });
  }

  function buyPotion() {
    buy('merge:potion', () => {
      setPotionUntil(Date.now() + 60_000);
      markDirty();
      showToast('Зелье! Спавн ×2 на 60 сек 🧪');
    });
  }

  function buyField5() {
    buy('merge:field5', () => {
      setField(5);
      setBoard(b => {
        const nb: Board = Array(25).fill(null);
        b.forEach((c, i) => { nb[Math.floor(i / 4) * 5 + (i % 4)] = c; });
        markDirty();
        return nb;
      });
      setConfettiKey(k => k + 1);
      showToast('Поле расширено до 5×5! 🎉');
    });
  }

  // ── конец раунда ──
  const stuck = useMemo(() => {
    if (board.some(c => !c)) return false;
    const seen = new Map<number, number>();
    for (const c of board) {
      if (!c || c.f || c.l >= maxLevel) continue;
      seen.set(c.l, (seen.get(c.l) ?? 0) + 1);
      if ((seen.get(c.l) ?? 0) >= 2) return false;
    }
    return true;
  }, [board, maxLevel]);

  async function finishRound() {
    hapticImpact('medium');
    if (runScore <= 0) { resetRun(); return; }
    try {
      const r = await submitGameScore('merge', runScore);
      onBalance(r.balance);
      const record = r.score >= r.best && r.score > 0 && r.best > best;
      setBest(r.best);
      setEnd({ score: r.score, coins: r.coins_earned, best: r.best, record });
      onResult();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  function resetRun() {
    setBoard(Array(field * field).fill(null));
    setRunScore(0);
    setEnd(null);
    dirtyRef.current = true;
  }

  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(m: string) {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2200);
  }

  const dragChip = dragFrom !== null ? board[dragFrom] : null;

  return (
    <div className="game-screen">
      <div className="game-topbar">
        <button className="game-topbar__back" onClick={onClose} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="game-topbar__title">🧬 Мерж</span>
        <button className="game-topbar__coins" onClick={() => { hapticImpact('light'); onOpenShop(); }}>
          <Coin size={16} /> {fmt(balance)} <span className="game-topbar__coins-plus">+</span>
        </button>
      </div>

      <div className="game-body">
        <div className="merge-hud">
          <div>
            <div className="merge-hud__label">Очки раунда</div>
            <div className="merge-hud__score">{fmt(displayScore)}</div>
          </div>
          <div className="merge-hud__best">Рекорд: {fmt(best)}</div>
        </div>

        {/* полоска до следующего автоспавна */}
        <div className="merge-spawnbar">
          {loaded && !end && <i key={spawnTick} style={{ animationDuration: `${spawnInterval}ms` }} />}
        </div>

        <div className="merge-board-wrap">
          <div
            ref={boardRef}
            className="merge-board"
            style={{ gridTemplateColumns: `repeat(${field}, 1fr)` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { setDragFrom(null); setDropAt(null); dropAtRef.current = null; }}
          >
            {board.map((c, i) => (
              <div key={i} className={`merge-cell${dropAt === i ? ' merge-cell--drop' : ''}${denyAt === i ? ' merge-cell--deny' : ''}`}>
                {c && (
                  <div
                    key={c.id}
                    className={`merge-chip${c.f ? ' merge-chip--frozen' : ''}${dragFrom === i ? ' merge-chip--drag' : ''}${mergedAt?.idx === i ? ' merge-chip--merged' : ''}`}
                  >
                    <ChipArt level={c.l} chain={chain} />
                    <span className="merge-chip__lvl">{c.l}</span>
                    {c.f && <span className="merge-chip__ice">❄️</span>}
                  </div>
                )}
                {fx.filter(f => f.idx === i).map(f => (
                  <span key={f.id}>
                    <span className="merge-ring" />
                    {f.text && <span className="merge-float">{f.text}</span>}
                  </span>
                ))}
              </div>
            ))}

            {confettiKey > 0 && <Confetti key={confettiKey} />}
          </div>

          {end && (
            <div className="round-end">
              <div className="round-end__card">
                {end.coins > 0 && <CoinBurst key={end.score} />}
                {end.record && <Confetti key={-end.score} />}
                <div className="round-end__emoji">{end.record ? '🏅' : '🧬'}</div>
                <div className="round-end__title">{end.record ? 'Новый рекорд!' : 'Раунд завершён'}</div>
                <EndScore value={end.score} />
                {end.coins > 0 && <div className="round-end__coins"><Coin size={17} /> +{end.coins} Монет</div>}
                {end.coins === 0 && <div className="round-end__meta">Дневной лимит монет исчерпан — очки всё равно в зачёте!</div>}
                <div className="round-end__meta">Рекорд: {fmt(end.best)}</div>
                <div className="round-end__actions">
                  <button className="btn-primary" onClick={() => { hapticImpact('light'); resetRun(); }}>Ещё раунд</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="merge-actions">
          <div className="boost-row">
            <button className={`boost-btn${potionOn ? ' boost-btn--on' : ''}`} onClick={buyPotion} disabled={potionOn}>
              🧪 Зелье спавна {potionOn ? '· активно' : <span className="boost-btn__price"><Coin size={13} />{PRICES.potion}</span>}
            </button>
            {field === 4 && (
              <button className="boost-btn" onClick={buyField5}>
                📐 Поле 5×5 <span className="boost-btn__price"><Coin size={13} />{PRICES.field5}</span>
              </button>
            )}
            <span className="boost-btn" style={{ cursor: 'default', opacity: 0.7 }}>❄️ тап по льду · <span className="boost-btn__price"><Coin size={13} />{PRICES.unfreeze}</span></span>
          </div>

          {/* кнопки в одном ряду и обе ВСЕГДА на месте — вёрстка не прыгает */}
          <div className="merge-btnrow">
            <button className="merge-spawn" onClick={spawnNow} disabled={spawnCd || !board.some(c => !c)}>
              {spawnCd ? '…' : '🥚 Подкинуть'}
            </button>
            <button
              className={`btn-ghost merge-finish${stuck ? ' merge-finish--stuck' : ''}`}
              onClick={finishRound}
              disabled={!stuck && runScore <= 0}
            >
              {stuck ? '🔒 Забрать монеты' : 'Завершить раунд'}
            </button>
          </div>
        </div>

        {/* цепочка прогрессии: что уже открыто и к чему стремиться */}
        <div className="merge-chain">
          {Array.from({ length: maxLevel }, (_, i) => {
            const lvl = i + 1;
            const locked = lvl > maxSeen;
            return (
              <span key={lvl} style={{ display: 'contents' }}>
                {i > 0 && <span className="merge-chain__arrow">▸</span>}
                <span className={`merge-chain__item${locked ? ' merge-chain__item--locked' : ''}${lvl === maxSeen ? ' merge-chain__item--current' : ''}`}>
                  <ChainArt level={lvl} chain={chain} />
                  <span className="merge-chain__num">{lvl}</span>
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {dragFrom !== null && dragChip && (
        <div className="merge-ghost" ref={ghostRef}>
          <ChipArt level={dragChip.l} chain={chain} big />
        </div>
      )}

      {toast && <div className="game-toast">{toast}</div>}
    </div>
  );
}

function EndScore({ value }: { value: number }) {
  const v = useCountUp(value, 900);
  return <div className="round-end__score">{fmt(v)}</div>;
}

function ChipArt({ level, chain, big }: { level: number; chain: string[]; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  const model = chain[level - 1];
  if (model && !broken) {
    return <img className="merge-chip__img" src={modelImageUrl(model, big ? 256 : 128)} alt={model} draggable={false} onError={() => setBroken(true)} />;
  }
  return <span className="merge-chip__emoji" style={big ? { fontSize: 42 } : undefined}>{MERGE_EMOJI[Math.min(level - 1, MERGE_EMOJI.length - 1)]}</span>;
}

function ChainArt({ level, chain }: { level: number; chain: string[] }) {
  const [broken, setBroken] = useState(false);
  const model = chain[level - 1];
  if (model && !broken) {
    return <img src={modelImageUrl(model, 64)} alt="" draggable={false} onError={() => setBroken(true)} />;
  }
  return <span style={{ fontSize: 18 }}>{MERGE_EMOJI[Math.min(level - 1, MERGE_EMOJI.length - 1)]}</span>;
}
