// Распознавание аккаунтов-маркетов / хранилищ среди владельцев гифтов.
// Это не люди (Portals, MRKT Bank, *Relayer, Getgems, Tonnel, Fragment и т.п.) —
// их прячем из топа холдеров, а лягушек на них помечаем «на маркете».

const MARKET_KEYWORDS = [
  'portal',        // Portals
  'mrkt',          // MRKT Bank
  'relayer',       // Gift Relayer, Getgems Relayer, Trade Relayer
  'getgems',       // Getgems
  'gift rolls',    // Gift Rolls Transfer
  'gift to credit',// Gift To Credit
  'tonnel',        // Tonnel
  'fragment',      // Fragment
];

export function isMarketAccount(name?: string | null, username?: string | null): boolean {
  const s = `${name ?? ''} ${username ?? ''}`.toLowerCase();
  return MARKET_KEYWORDS.some(k => s.includes(k));
}
