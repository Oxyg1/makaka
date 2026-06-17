// Простой сид: добавляем демо-юзеров и пачку лягушек, чтобы маркет был не пустой.
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

function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length]; }

export function seed() {
  const exists = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE telegram_id LIKE 'demo_%'`).get() as { c: number };
  if (exists.c > 0) return;

  const insertUser = db.prepare(`INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)`);
  const userIds: number[] = [];
  for (const u of DEMO_USERS) {
    const r = insertUser.run(u.telegram_id, u.username, u.first_name);
    userIds.push(Number(r.lastInsertRowid));
  }

  for (let i = 0; i < 30; i++) {
    const ownerId = userIds[i % userIds.length];
    const ownerUn = DEMO_USERS[i % userIds.length].username;
    const n = 1000 + i * 23;
    const frog = upsertFrog({
      gift_id: `KissedFrog-${n}`,
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

    if (i % 2 === 0) {
      const kind = i % 4 === 0 ? 'sell' : 'trade';
      const price = kind === 'sell' ? 100 + i * 25 : null;
      db.prepare(`
        INSERT INTO orders (frog_id, user_id, kind, price_stars, wants_models, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        frog.id, ownerId, kind, price,
        kind === 'trade' ? JSON.stringify([pick(MODELS, i + 1), pick(MODELS, i + 4)]) : null,
        kind === 'trade' ? 'Готов к обмену' : null,
      );
    }
  }
}

if (require.main === module) {
  seed();
  console.log('seeded');
}
