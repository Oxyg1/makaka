import { useEffect, useState, useCallback } from 'react';
import { getInventory, syncInventory } from '../api';
import type { Frog, AppConfig, User } from '../types';
import FrogCard from '../components/FrogCard';
import FrogDetailModal from '../components/FrogDetailModal';
import { hapticImpact, hapticSuccess, hapticError } from '../utils/haptics';
import './InventoryScreen.css';

interface Props {
  user: User | null;
  config: AppConfig | null;
  refreshKey?: number;
  onChanged: () => void;
}

export default function InventoryScreen({ user, config, refreshKey, onChanged }: Props) {
  const [items, setItems] = useState<Frog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [viewFrog, setViewFrog] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getInventory()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function handleSync() {
    setSyncing(true); setError('');
    hapticImpact('medium');
    try {
      const r = await syncInventory();
      if (r.added === 0) setError('У вас не нашлось KissedFrog в профиле');
      else hapticSuccess();
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      hapticError();
    } finally {
      setSyncing(false);
    }
  }

  const lastSync = user?.last_synced_at
    ? `Синк: ${new Date(user.last_synced_at + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : 'Ещё не синхронизировано';

  return (
    <div className="screen">
      <header className="inv__header">
        <div>
          <h1 className="screen__title">Инвентарь</h1>
          <p className="screen__subtitle">{items.length} лягуш{items.length === 1 ? 'ка' : items.length < 5 ? 'ки' : 'ек'} · {lastSync}</p>
        </div>
        <button className="inv__sync" onClick={handleSync} disabled={syncing}>
          {syncing ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>Синк</span>
            </>
          )}
        </button>
      </header>

      {error && <div className="inv__error">{error}</div>}

      <div className="screen__scroll">
        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>}

        {!loading && items.length === 0 && (
          <div className="empty">
            <div className="empty__icon">🐸</div>
            <h3>Пусто в инвентаре</h3>
            <p>Нажмите кнопку синхронизации сверху, чтобы загрузить ваших <b>KissedFrog</b> из Telegram-профиля.</p>
            {!user?.username && (
              <p style={{ color: 'var(--warn)' }}>
                У вашего TG нет username — без него синк не работает.
              </p>
            )}
          </div>
        )}

        <div className="inv__grid">
          {items.map(f => (
            <div key={f.id} onClick={() => { hapticImpact('light'); setViewFrog(f.id); }}>
              <FrogCard
                frog={f}
                size="md"
                badge={f.active_order_id ? 'на маркете' : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      {viewFrog !== null && (
        <FrogDetailModal
          frogId={viewFrog}
          myUserId={user?.id ?? null}
          config={config}
          onClose={() => setViewFrog(null)}
          onCreatedOrder={() => { load(); onChanged(); }}
        />
      )}
    </div>
  );
}
