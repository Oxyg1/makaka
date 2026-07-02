// Формулы и константы игр (зеркало backend/src/services/games.ts —
// сервер по этим же формулам валидирует прогресс, клиент только рисует).

export const CLICKER = {
  clickPower: (lvl: number) => 1 + lvl,
  clickCost: (lvl: number) => Math.ceil(15 * Math.pow(1.6, lvl)),
  helperPps: [1, 4, 15, 50, 160, 500, 1500, 5000],
  helperBaseCost: [50, 300, 1800, 9000, 45000, 220000, 1_000_000, 5_000_000],
  helperCost: (tier: number, count: number) =>
    Math.ceil(CLICKER.helperBaseCost[tier] * Math.pow(1.15, count)),
  offlineCapSec: 8 * 3600,
};

export const HELPER_NAMES = [
  'Головастик', 'Лягушонок', 'Квакун', 'Болотный страж',
  'Царевна', 'Золотая жаба', 'Древний дух', 'Король болота',
];
export const HELPER_EMOJI = ['🥚', '🐸', '🎺', '🛡️', '👸', '🏆', '🔮', '👑'];

// Эмодзи-лестница уровней мержа (фоллбэк, когда нет картинки модели).
export const MERGE_EMOJI = ['🥚', '🌱', '🪷', '🐸', '🐢', '🦎', '🐊', '🐉', '👑', '💎', '🌟', '🏆'];
export const MERGE_MAX_LEVEL = 12;

export function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + 'k';
  return String(Math.floor(n));
}
