/**
 * Seed script: populates DB with demo cats downloaded from cataas.com
 * Run with: npx tsx src/seed.ts
 */
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { db } from './db';

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const CATS = [
  { name: 'Мурзик', breed: 'Мейн-кун', age: 3, description: 'Пушистый и величественный. Считает себя королём квартиры.' },
  { name: 'Барсик', breed: 'Шотландский вислоухий', age: 5, description: 'Флегматичный философ. Любит смотреть в окно часами.' },
  { name: 'Персик', breed: 'Персидская', age: 2, description: 'Нежная и ласковая. Мурчит как трактор.' },
  { name: 'Тигр', breed: 'Бенгальская', age: 4, description: 'Дикий снаружи, домашний внутри. Обожает охотиться на носки.' },
  { name: 'Снежок', breed: 'Турецкая ангора', age: 1, description: 'Белоснежный и игривый. Гроза всех новогодних игрушек.' },
  { name: 'Кекс', breed: 'Британская короткошёрстная', age: 6, description: 'Серьёзный бизнесмен. Не одобряет объятия.' },
  { name: 'Лиса', breed: 'Абиссинская', age: 2, description: 'Рыжая бестия. Открывает все шкафы и холодильник.' },
  { name: 'Граф', breed: 'Сиамская', age: 7, description: 'Аристократ с характером. Говорит громко и по делу.' },
  { name: 'Пончик', breed: 'Дворянин', age: 3, description: 'Толстенький и счастливый. Главное в жизни — еда и сон.' },
  { name: 'Зефир', breed: 'Рэгдолл', age: 4, description: 'Мягкий как игрушка, расслабляется на руках полностью.' },
];

const CAT_URLS = [
  'https://cataas.com/cat?width=600&height=600',
  'https://cataas.com/cat/cute?width=600&height=600',
  'https://cataas.com/cat/funny?width=600&height=600',
  'https://cataas.com/cat/orange?width=600&height=600',
  'https://cataas.com/cat/white?width=600&height=600',
  'https://cataas.com/cat/black?width=600&height=600',
  'https://cataas.com/cat/grey?width=600&height=600',
  'https://cataas.com/cat/small?width=600&height=600',
  'https://cataas.com/cat/kitten?width=600&height=600',
  'https://cataas.com/cat/fluffy?width=600&height=600',
];

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https : http;
    const req = get.get(url, { headers: { 'User-Agent': 'CatRater/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', e => { fs.unlinkSync(dest); reject(e); });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function seed() {
  // Create seed user
  db.prepare(`
    INSERT OR IGNORE INTO users (telegram_id, username, first_name)
    VALUES ('seed_user', 'catmaster', 'Cat Master')
  `).run();

  const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get('seed_user') as { id: number };

  // Check already seeded
  const existing = db.prepare('SELECT COUNT(*) as n FROM cats WHERE owner_id = ?').get(user.id) as { n: number };
  if (existing.n > 0) {
    console.log(`Already seeded (${existing.n} cats). Delete cats first if you want to re-seed.`);
    process.exit(0);
  }

  console.log('Downloading cat photos...');

  for (let i = 0; i < CATS.length; i++) {
    const cat = CATS[i];
    const filename = `seed_${Date.now()}_${i}.jpg`;
    const filePath = path.join(uploadsDir, filename);

    try {
      process.stdout.write(`  [${i + 1}/${CATS.length}] ${cat.name}... `);
      await downloadFile(CAT_URLS[i], filePath);

      // Try to create thumbnail with sharp
      try {
        const sharp = (await import('sharp')).default;
        await sharp(filePath)
          .resize(400, 400, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(path.join(uploadsDir, `thumb_${filename}`));
      } catch { /* sharp optional */ }

      db.prepare(`
        INSERT INTO cats (owner_id, name, breed, age, description, photo_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, cat.name, cat.breed, cat.age, cat.description, `/uploads/${filename}`);

      console.log('✓');
    } catch (e) {
      console.log(`✗ (${(e as Error).message})`);
    }
  }

  const total = db.prepare('SELECT COUNT(*) as n FROM cats').get() as { n: number };
  console.log(`\nDone! ${total.n} cats in database.`);
}

seed().catch(console.error);
