// Формулы и константы игр (зеркало backend/src/services/games.ts —
// сервер по этим же формулам валидирует прогресс, клиент только рисует).

export const CLICKER = {
  clickPower: (lvl: number) => 1 + lvl,
  clickCost: (lvl: number) => Math.ceil(15 * Math.pow(1.6, lvl)),
  helperPps: [1, 4, 15, 50, 160, 500, 1500, 5000],
  helperBaseCost: [50, 300, 1800, 9000, 45000, 220000, 1_000_000, 5_000_000],
  helperCost: (tier: number, count: number) =>
    Math.ceil(CLICKER.helperBaseCost[tier] * Math.pow(1.15, count)),
  // Оффлайн-доход: 25% от pps и максимум за 2 часа — иначе баланс
  // взрывается миллионами после каждого захода.
  offlineRate: 0.25,
  offlineCapSec: 2 * 3600,
};

export const HELPER_NAMES = [
  'Головастик', 'Лягушонок', 'Квакун', 'Болотный страж',
  'Царевна', 'Золотая жаба', 'Древний дух', 'Король болота',
];
export const HELPER_EMOJI = ['🥚', '🐸', '🎺', '🛡️', '👸', '🏆', '🔮', '👑'];

// ── Цепочки моделей KissedFrog (по реальной редкости коллекции) ──
// Мерж: 12 уровней от самой частой (Brownie, 4%) к редким.
// Финал — Happy Pepe (0.5%), как самый желанный.
export const MERGE_CHAIN = [
  'Brownie',       // 4%
  'Tide Pod',      // 4%
  'Lemon Juice',   // 4%
  'Peach',         // 4%
  'Melon',         // 3%
  'Ramune',        // 2.5%
  'Silver',        // 2%
  'Desert Frog',   // 1.5%
  'Prince Ribbit', // 1.5%
  'Icefrog',       // 1%
  'Tesla Frog',    // 1%
  'Happy Pepe',    // 0.5% — финал
];

// Кликер: базовая жабка + 8 тиров помощников (частые → редкие).
export const CLICKER_CHAIN = [
  'Brownie',        // базовая (тапаем её)
  'Sky Leaper',     // 4%
  'Frogtart',       // 3%
  'Starry Night',   // 2.5%
  'Poison',         // 2.5%
  'Bronze',         // 2%
  'Ms. Toad',       // 1.5%
  'Pond Fairy',     // 1%
  'Count Croakula', // 0.5% — Король болота
];

// Эмодзи-лестница уровней мержа (фоллбэк, когда нет картинки модели).
export const MERGE_EMOJI = ['🥚', '🌱', '🪷', '🐸', '🐢', '🦎', '🐊', '🐉', '👑', '💎', '🌟', '🏆'];
export const MERGE_MAX_LEVEL = 12;

export function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + 'k';
  return String(Math.floor(n));
}
