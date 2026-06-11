/**
 * Localization module.
 * - All UI text goes through `t(key)`; never hard-code strings in UI/game modules.
 * - To add a new language: extend STRINGS with new locale code and run `setLang('xx')`.
 * - The active language is mirrored to localStorage and falls back to the browser language.
 */

const STRINGS = {
  ru: {
    'game.title':         'Лягушачья Лагуна',
    'game.subtitle':      'Сливай. Развивай. Коллекционируй.',
    'game.spawn':         'Призвать лягушку',
    'game.nextDiscovery': 'Следующее открытие',

    'loading.tip':        'Подсказка: соедини двух одинаковых лягушек, чтобы развить их.',

    'menu.subtitle':      'Уютное мерж-приключение',
    'menu.play':          'Играть',
    'menu.collection':    'Коллекция',
    'menu.daily':         'Ежедневная награда',
    'menu.discovered':    'Открыто',
    'menu.bestLevel':     'Лучший вид',
    'menu.coins':         'Монеты',
    'menu.streak':        'Серия дней',

    'collection.title':   'Коллекция',
    'collection.locked':  'Не открыто',

    'daily.title':        'Ежедневные награды',
    'daily.claim':        'Забрать',
    'daily.claimX2':      'Забрать ×2 (Реклама)',
    'daily.day':          'День',
    'daily.alreadyClaimed': 'Награда уже получена. Возвращайся завтра!',
    'daily.streakBonus':  'Бонус за серию: +{n}',

    'pause.title':        'Пауза',
    'pause.text':         'Передохни, лотосы подождут.',
    'pause.resume':       'Продолжить',
    'pause.restart':      'Начать заново',
    'pause.toMenu':       'В главное меню',

    'gameover.title':     'Лагуна переполнена',
    'gameover.summary':   'Ты достиг лягушки уровня {n}.',
    'gameover.continueAd':'Продолжить (Реклама)',
    'gameover.playAgain': 'Сыграть ещё',
    'gameover.menu':      'Главное меню',
    'gameover.earnedCoins':'Монеты',
    'gameover.bestLevel': 'Лучший',
    'gameover.discovered':'Новых',

    'popup.newDiscovery': 'Новый вид',
    'popup.continue':     'Продолжить',

    'tutorial.drag':      'Перетащи одну лягушку на другую, чтобы слить их.',
    'tutorial.spawn':     'Нажми сюда, чтобы призвать новую лягушку.',

    'toast.noSpace':      'Нет места на поле!',
    'toast.notEnoughCoins':'Не хватает монет',
    'toast.boosterUsed':  'Бустер использован',
    'toast.noBoosters':   'Нет бустеров',
    'toast.adUnavailable':'Реклама пока недоступна',
    'toast.savedProgress':'Прогресс сохранён',
    'toast.languageChanged':'Язык: Русский',

    'mission.mergeTo':    'Развей до уровня {n}',
    'mission.mergeCount': 'Соедини {n} раз',
    'mission.spawnCount': 'Призови {n} лягушек',
    'mission.discover':   'Открой новый вид',

    'frog.1.name':  'Головастик',
    'frog.2.name':  'Прудовая',
    'frog.3.name':  'Луговая',
    'frog.4.name':  'Тростниковая',
    'frog.5.name':  'Изумрудная',
    'frog.6.name':  'Лиственная',
    'frog.7.name':  'Древесная',
    'frog.8.name':  'Огненная',
    'frog.9.name':  'Лунная',
    'frog.10.name': 'Кристальная',
    'frog.11.name': 'Радужная',
    'frog.12.name': 'Легендарная',

    'frog.1.desc':  'Тёплый малыш на старте пути.',
    'frog.2.desc':  'Самая обычная и милая.',
    'frog.3.desc':  'Любит тёплые луга и солнце.',
    'frog.4.desc':  'Прячется в зарослях у воды.',
    'frog.5.desc':  'Её кожа сверкает изумрудом.',
    'frog.6.desc':  'Маскируется под мокрый лист.',
    'frog.7.desc':  'Лазит по веткам уверенно.',
    'frog.8.desc':  'Кожа тлеет тёплыми углями.',
    'frog.9.desc':  'Появляется только в полнолуние.',
    'frog.10.desc': 'Будто высечена из живого камня.',
    'frog.11.desc': 'Каждая чешуйка — отдельный цвет.',
    'frog.12.desc': 'Легенда, которую все искали.'
  },

  en: {
    'game.title':         'Frog Lagoon',
    'game.subtitle':      'Merge. Evolve. Collect.',
    'game.spawn':         'Spawn frog',
    'game.nextDiscovery': 'Next discovery',

    'loading.tip':        'Tip: merge two identical frogs to evolve them.',

    'menu.subtitle':      'A cozy evolution merge journey',
    'menu.play':          'Play',
    'menu.collection':    'Collection',
    'menu.daily':         'Daily reward',
    'menu.discovered':    'Discovered',
    'menu.bestLevel':     'Best evolution',
    'menu.coins':         'Lily coins',
    'menu.streak':        'Daily streak',

    'collection.title':   'Collection',
    'collection.locked':  'Not discovered',

    'daily.title':        'Daily rewards',
    'daily.claim':        'Claim today',
    'daily.claimX2':      'Claim ×2 (Ad)',
    'daily.day':          'Day',
    'daily.alreadyClaimed': 'Already claimed today. Come back tomorrow!',
    'daily.streakBonus':  'Streak bonus: +{n}',

    'pause.title':        'Paused',
    'pause.text':         'Take a breath. Lily pads are waiting.',
    'pause.resume':       'Resume',
    'pause.restart':      'Restart run',
    'pause.toMenu':       'Back to menu',

    'gameover.title':     'Pond is full',
    'gameover.summary':   'You reached evolution level {n}.',
    'gameover.continueAd':'Continue (Ad)',
    'gameover.playAgain': 'Play again',
    'gameover.menu':      'Main menu',
    'gameover.earnedCoins':'Coins',
    'gameover.bestLevel': 'Best',
    'gameover.discovered':'New',

    'popup.newDiscovery': 'New species',
    'popup.continue':     'Continue',

    'tutorial.drag':      'Drag one frog onto another to merge them.',
    'tutorial.spawn':     'Tap here to spawn a new frog.',

    'toast.noSpace':      'No space on the board!',
    'toast.notEnoughCoins':'Not enough coins',
    'toast.boosterUsed':  'Booster used',
    'toast.noBoosters':   'No boosters left',
    'toast.adUnavailable':'Ads are not available yet',
    'toast.savedProgress':'Progress saved',
    'toast.languageChanged':'Language: English',

    'mission.mergeTo':    'Evolve to level {n}',
    'mission.mergeCount': 'Merge {n} times',
    'mission.spawnCount': 'Spawn {n} frogs',
    'mission.discover':   'Discover a new species',

    'frog.1.name':  'Tadpole',
    'frog.2.name':  'Pond Frog',
    'frog.3.name':  'Meadow Frog',
    'frog.4.name':  'Reed Frog',
    'frog.5.name':  'Emerald Frog',
    'frog.6.name':  'Leaf Frog',
    'frog.7.name':  'Tree Frog',
    'frog.8.name':  'Ember Frog',
    'frog.9.name':  'Moonlit Frog',
    'frog.10.name': 'Crystal Frog',
    'frog.11.name': 'Rainbow Frog',
    'frog.12.name': 'Legendary Frog',

    'frog.1.desc':  'A tiny warm-up at the start.',
    'frog.2.desc':  'The everyday classic — very cute.',
    'frog.3.desc':  'Loves sunny meadows.',
    'frog.4.desc':  'Hides among reeds near water.',
    'frog.5.desc':  'Skin shines like an emerald.',
    'frog.6.desc':  'Blends in with wet leaves.',
    'frog.7.desc':  'Climbs branches with ease.',
    'frog.8.desc':  'Skin glows like warm embers.',
    'frog.9.desc':  'Only appears on a full moon.',
    'frog.10.desc': 'As if carved from living stone.',
    'frog.11.desc': 'Every scale a different color.',
    'frog.12.desc': 'The legend everyone seeks.'
  }
};

let currentLang = 'en';
const listeners = new Set();

export function detectLang() {
  const stored = localStorage.getItem('lang');
  if (stored && STRINGS[stored]) return stored;
  const browser = (navigator.language || 'en').slice(0, 2);
  return STRINGS[browser] ? browser : 'en';
}

export function setLang(code) {
  if (!STRINGS[code]) return;
  currentLang = code;
  localStorage.setItem('lang', code);
  document.documentElement.lang = code;
  // Re-render all elements with [data-i18n]
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  listeners.forEach((fn) => fn(code));
}

export function getLang() { return currentLang; }

export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function t(key, params) {
  const dict = STRINGS[currentLang] || STRINGS.en;
  let str = dict[key] ?? STRINGS.en[key] ?? key;
  if (params) {
    for (const k in params) str = str.replace(`{${k}}`, params[k]);
  }
  return str;
}

export function availableLangs() { return Object.keys(STRINGS); }
