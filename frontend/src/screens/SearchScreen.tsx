import { useEffect, useState } from 'react';
import { getAttributes, getMarket, lookupFrog } from '../api';
import type { Attributes, AppConfig, Frog, MarketEntry } from '../types';
import FrogCard from '../components/FrogCard';
import FrogDetailModal from '../components/FrogDetailModal';
import { hapticImpact, hapticError } from '../utils/haptics';
import './SearchScreen.css';

interface Props {
  myUserId: number | null;
  config: AppConfig | null;
}

export default function SearchScreen({ myUserId, config }: Props) {
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [found, setFound] = useState<Frog | null>(null);
  const [viewFrog, setViewFrog] = useState<number | null>(null);

  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [model, setModel] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [pattern, setPattern] = useState('');
  const [results, setResults] = useState<MarketEntry[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { getAttributes().then(setAttrs).catch(() => {}); }, []);

  async function handleLookup() {
    if (!link.trim()) return;
    setLookingUp(true); setLinkError(''); setFound(null);
    try {
      const f = await lookupFrog(link.trim());
      setFound(f);
    } catch (e) {
      setLinkError((e as Error).message);
      hapticError();
    } finally { setLookingUp(false); }
  }

  async function handleSearch() {
    if (!model && !backdrop && !pattern) return;
    setSearching(true); hapticImpact('light');
    try {
      const r = await getMarket({
        models: model ? [model] : [],
        backdrops: backdrop ? [backdrop] : [],
        patterns: pattern ? [pattern] : [],
      });
      setResults(r);
    } finally { setSearching(false); }
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div>
          <h1 className="screen__title">Поиск</h1>
          <p className="screen__subtitle">По ссылке или по фильтрам</p>
        </div>
      </div>

      <div className="screen__scroll">
        <div className="section-title">По ссылке / номеру</div>
        <div className="search__link-row">
          <input
            className="field"
            placeholder="t.me/nft/KissedFrog-1234 или #1234"
            value={link}
            onChange={e => setLink(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
          />
          <button className="btn-ghost" onClick={handleLookup} disabled={lookingUp || !link.trim()}>
            {lookingUp ? '…' : 'Найти'}
          </button>
        </div>
        {linkError && <p className="search__error">{linkError}</p>}
        {found && (
          <div className="search__found" onClick={() => { hapticImpact('light'); setViewFrog(found.id); }}>
            <FrogCard frog={found} size="md" />
          </div>
        )}

        <div className="section-title">По фильтрам</div>
        {attrs && (
          <div className="search__filters">
            <Select label="Модель" value={model} onChange={setModel} options={attrs.models.map(m => m.v)} />
            <Select label="Фон" value={backdrop} onChange={setBackdrop} options={attrs.backdrops.map(m => m.v)} />
            <Select label="Узор" value={pattern} onChange={setPattern} options={attrs.patterns.map(m => m.v)} />
          </div>
        )}
        <button className="btn-primary" onClick={handleSearch} disabled={searching || (!model && !backdrop && !pattern)}>
          {searching ? 'Ищем…' : 'Найти ордеры'}
        </button>

        {results && (
          <>
            <div className="section-title">Найдено: {results.length}</div>
            {results.length === 0 ? (
              <div className="empty"><div className="empty__icon">🪷</div><p>Активных ордеров не нашлось.<br />Откройте лягушку напрямую и предложите обмен.</p></div>
            ) : (
              <div className="search__grid">
                {results.map(o => (
                  <div key={o.id} onClick={() => { hapticImpact('light'); setViewFrog(o.frog_id); }}>
                    <FrogCard
                      frog={{ id: o.frog_id, number: o.number, model: o.model, backdrop: o.backdrop, pattern: o.pattern, image_url: o.image_url }}
                      size="md"
                      badge={o.kind === 'trade' ? 'обмен' : `${o.price_stars}⭐`}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

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

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="search__select">
      <span className="search__select-label">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Любая</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
