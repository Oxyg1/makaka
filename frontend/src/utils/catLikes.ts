import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { likeCat } from '../api';

type Entry = { liked: boolean; count: number };

const cache = new Map<number, Entry>();
const subs = new Map<number, Set<() => void>>();

function notify(catId: number) {
  subs.get(catId)?.forEach(fn => fn());
}

function subscribe(catId: number, cb: () => void): () => void {
  let s = subs.get(catId);
  if (!s) { s = new Set(); subs.set(catId, s); }
  s.add(cb);
  return () => {
    s!.delete(cb);
    if (s!.size === 0) subs.delete(catId);
  };
}

/** Push fresh server data into the shared cache (called whenever an API returns a cat). */
export function syncCatLike(catId: number, liked: boolean, count: number) {
  const cur = cache.get(catId);
  if (cur && cur.liked === liked && cur.count === count) return;
  cache.set(catId, { liked, count });
  notify(catId);
}

/** Shared, source-of-truth cat-like hook. Any place that reads the same catId stays in sync. */
export function useCatLike(catId: number, seedLiked: boolean, seedCount: number) {
  useEffect(() => {
    if (!cache.has(catId)) {
      cache.set(catId, { liked: seedLiked, count: seedCount });
      notify(catId);
    }
  }, [catId, seedLiked, seedCount]);

  const sub = useCallback((cb: () => void) => subscribe(catId, cb), [catId]);
  const getSnapshot = useCallback(() => cache.get(catId), [catId]);
  const entry = useSyncExternalStore(sub, getSnapshot, getSnapshot);

  const liked = entry?.liked ?? seedLiked;
  const count = entry?.count ?? seedCount;

  const toggle = useCallback(async () => {
    const cur = cache.get(catId) ?? { liked: seedLiked, count: seedCount };
    const nextLiked = !cur.liked;
    const nextCount = Math.max(0, cur.count + (nextLiked ? 1 : -1));
    syncCatLike(catId, nextLiked, nextCount);
    try {
      const r = await likeCat(catId);
      syncCatLike(catId, r.liked, r.likes_count);
    } catch {
      syncCatLike(catId, cur.liked, cur.count);
    }
  }, [catId, seedLiked, seedCount]);

  return { liked, count, toggle };
}
