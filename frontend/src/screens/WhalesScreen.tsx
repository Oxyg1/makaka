import { useEffect, useState } from 'react';
import { getUserFrogs, getWhales, lookupFrog } from '../api';
import type { AppConfig, Frog, Whale } from '../types';
import FrogCard from '../components/FrogCard';
import FrogDetailModal from '../components/FrogDetailModal';
import { hapticImpact, hapticError } from '../utils/haptics';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import './WhalesScreen.css';

interface Props {
  myUserId: number | null;
  config: AppConfig | null;
}

export default function WhalesScreen({ myUserId, config }: Props) {
  const [whales, setWhales] = useState<Whale[]>([]);
  const [loading, setLoading] = useState(true);
  const [openWhale, setOpenWhale] = useState<Whale | null>(null);
  const [viewFrog, setViewFrog] = useState<number | null>(null);

  const [link, setLink] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  const top3 = whales.slice(0, 3);
  const rest = whales.slice(3);

  useEffect(() => {
    getWhales().then(setWhales).catch(() => setWhales([])).finally(() => setLoading(false));
  }, []);

  async function findByLink() {
    if (!link.trim()) return;
    setLinkLoading(true); setLinkError('');
    try {
      const f = await lookupFrog(link.trim());
      setViewFrog(f.id);
    } catch (e) {
      setLinkError((e as Error).message);
      hapticError();
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <div className="screen">
      <header className="whales__header">
        <h1 className="screen__title">Холдеры</h1>
        <p className="screen__subtitle">Топ-владельцы KissedFrog. Зайдите в коллекцию и предложите обмен лично.</p>
      </header>

      <div className="screen__scroll">
        <div className="section-title">Поиск по ссылке</div>
        <div className="whales__link">
          <input
            className="field"
            placeholder="t.me/nft/KissedFrog-1234 или #1234"
            value={link}
            onChange={e => setLink(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && findByLink()}
          />
          <button className="btn-ghost" onClick={findByLink} disabled={linkLoading || !link.trim()}>
            {linkLoading ? '…' : 'Открыть'}
          </button>
        </div>
        {linkError && <p className="whales__error">{linkError}</p>}

        <div className="section-title">Топ холдеров</div>

        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>}

        {!loading && whales.length === 0 && (
          <div className="empty" style={{ padding: 24 }}>
            <p>Не удалось получить список холдеров.<br />Зайдите чуть позже.</p>
          </div>
        )}

        {!loading && whales.length > 0 && (
          <>
            {top3.length > 0 && (
              <div className="podium">
                {top3.map((w, i) => (
                  <button
                    key={w.id}
                    className={`podium__item podium__item--${i}`}
                    style={{ '--i': i } as React.CSSProperties}
                    onClick={() => { hapticImpact('light'); setOpenWhale(w); }}
                  >
                    {i === 0 && <span className="podium__crown">👑</span>}
                    <div className="podium__photo-wrap">
                      <div className="podium__photo">
                        {w.photo_url
                          ? <img src={w.photo_url} alt="" />
                          : <span>{(w.name ?? w.username ?? '?')[0]?.toUpperCase()}</span>}
                      </div>
                      <span className="podium__rank">{i + 1}</span>
                    </div>
                    <span className="podium__name">{w.name ?? w.username ?? '—'}</span>
                    <span className="podium__count">🐸 {w.gifts_count}</span>
                    <span className="podium__pedestal" />
                  </button>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <div className="whales__list">
                {rest.map((w, i) => (
                  <button
                    key={w.id}
                    className="whale-row"
                    style={{ '--i': i } as React.CSSProperties}
                    onClick={() => { hapticImpact('light'); setOpenWhale(w); }}
                  >
                    <div className="whale-row__rank">{i + 4}</div>
                    <div className="whale-row__avatar">
                      {w.photo_url ? <img src={w.photo_url} alt="" /> : <span>{(w.name ?? w.username ?? '?')[0]?.toUpperCase()}</span>}
                    </div>
                    <div className="whale-row__info">
                      <div className="whale-row__name">{w.name ?? w.username ?? '—'}</div>
                      {w.username && <div className="whale-row__un">@{w.username}</div>}
                    </div>
                    <div className="whale-row__count">
                      <div className="whale-row__count-value">{w.gifts_count}</div>
                      <div className="whale-row__count-label">🐸</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {openWhale && (
        <WhaleCollection
          whale={openWhale}
          onClose={() => setOpenWhale(null)}
          onPick={id => { setViewFrog(id); setOpenWhale(null); }}
        />
      )}

      {viewFrog !== null && (
        <FrogDetailModal
          frogId={viewFrog}
          myUserId={myUserId}
          config={config}
          onClose={() => setViewFrog(null)}
        />
      )}
    </div>
  );
}

function WhaleCollection({ whale, onClose, onPick }: { whale: Whale; onClose: () => void; onPick: (id: number) => void }) {
  const [frogs, setFrogs] = useState<Frog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const { sheetRef, overlayRef, swipeHandlers } = useSheetSwipe(onClose);

  useEffect(() => {
    if (!whale.telegram_id) { setLoading(false); return; }
    getUserFrogs(whale.telegram_id)
      .then(setFrogs)
      .catch(() => setFrogs([]))
      .finally(() => setLoading(false));
  }, [whale.telegram_id]);

  const models = Array.from(frogs.reduce((m, f) => m.set(f.model, (m.get(f.model) ?? 0) + 1), new Map<string, number>()))
    .sort((a, b) => b[1] - a[1]);
  const q = query.trim().toLowerCase();
  const filtered = frogs.filter(f =>
    (!model || f.model === model) &&
    (!q || f.model.toLowerCase().includes(q) || String(f.number).includes(q) || f.backdrop.toLowerCase().includes(q)),
  );

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet" ref={sheetRef} {...swipeHandlers}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__header">
          <button className="modal-sheet__close" onClick={onClose}>Назад</button>
          <span className="modal-sheet__title">{whale.name ?? whale.username ?? 'Коллекция'}</span>
          <span style={{ width: 60 }} />
        </div>
        {!loading && frogs.length > 0 && (
          <div className="coll__filter">
            <input
              className="field"
              placeholder="Поиск: модель, #номер, фон"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="coll__chips">
              <button className={`coll__chip${!model ? ' coll__chip--active' : ''}`} onClick={() => setModel(null)}>Все · {frogs.length}</button>
              {models.map(([m, c]) => (
                <button key={m} className={`coll__chip${model === m ? ' coll__chip--active' : ''}`} onClick={() => setModel(model === m ? null : m)}>
                  {m} · {c}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="modal-sheet__scroll">
          {!whale.telegram_id && (
            <div className="empty"><p>У этого холдера нет публичного telegram_id, коллекция недоступна.</p></div>
          )}
          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>}
          {!loading && frogs.length === 0 && whale.telegram_id && (
            <div className="empty"><p>Не удалось загрузить коллекцию.<br />Возможно, холдер скрыл подарки.</p></div>
          )}
          {!loading && filtered.length === 0 && frogs.length > 0 && (
            <div className="empty" style={{ padding: 24 }}><p>Ничего не найдено.</p></div>
          )}
          <div className="whales__grid">
            {filtered.map(f => (
              <FrogCard
                key={f.id}
                frog={f}
                size="sm"
                onClick={() => onPick(f.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
