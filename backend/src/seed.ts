// Демо-данные на первый старт.
import { db } from './db';
import { upsertFrog } from './services/frogs';

const DEMO_USERS = [
  { telegram_id: 'demo_1', username: 'frogprince', first_name: 'Frog Prince' },
  { telegram_id: 'demo_2', username: 'pondqueen', first_name: 'Pond Queen' },
  { telegram_id: 'demo_3', username: 'lilypadder', first_name: 'Lily Padder' },
];

const MODELS = ['Lily Pad','Swamp King','Royal Hopper','Bubble Mage','Moss Druid','Pondling','Ribbit Star','Toxic Bloom','Golden Croak','Reed Sage'];
const BACKDROPS = ['Mint','Lagoon','Sunset','Jungle','Aurora','Twilight','Coral','Obsidian'];
const PATTERNS = ['Dots','Stripes','Camo','Stars','Vines','Glyphs','Lotus','Plain'];

const NOTES = [
  'Хочу собрать сет в этой модели — нужен такой же, но с другим фоном.',
  'Не хватает этого фона в коллекции, готов отдать любимую лягушку.',
  'Меняю на узор как у меня сейчас — для пары.',
  'Открыт к предложениям, главное чтобы редкий фон.',
];

function pick<T>(arr: T[], seed: number): T { return arr[Math.abs(seed) % arr.length]; }

export function seed() {
  const exists = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE telegram_id LIKE 'demo_%'`).get() as { c: number };
  if (exists.c > 0) return;

  const insertUser = db.prepare(`INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)`);
  const userIds: number[] = [];
  for (const u of DEMO_USERS) {
    const r = insertUser.run(u.telegram_id, u.username, u.first_name);
    userIds.push(Number(r.lastInsertRowid));
  }

  for (let i = 0; i < 24; i++) {
    const ownerId = userIds[i % userIds.length];
    const ownerUn = DEMO_USERS[i % userIds.length].username;
    const n = 1000 + i * 23;
    const frog = upsertFrog({
      gift_id: `demo-${n}`,
      slug: `KissedFrog-${n}`,
      number: n,
      model: pick(MODELS, i * 7 + 3),
      backdrop: pick(BACKDROPS, i * 11 + 5),
      pattern: pick(PATTERNS, i * 19 + 1),
      model_rarity: 0.05 + ((i * 7) % 80) / 100,
      backdrop_rarity: 0.1 + ((i * 11) % 70) / 100,
      pattern_rarity: 0.08 + ((i * 19) % 75) / 100,
      owner_username: ownerUn,
    }, ownerId);

    // Каждой второй лягушке — открытый ордер с осмысленным wants
    if (i % 2 === 0) {
      const wantedBackdrop = pick(BACKDROPS, i * 13 + 7);
      db.prepare(`
        INSERT INTO orders (frog_id, user_id, wants_backdrops, wants_models, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        frog.id, ownerId,
        JSON.stringify([wantedBackdrop]),
        i % 4 === 0 ? JSON.stringify([frog.model]) : null,
        pick(NOTES, i),
      );
    }
  }
}

if (require.main === module) { seed(); console.log('seeded'); }
