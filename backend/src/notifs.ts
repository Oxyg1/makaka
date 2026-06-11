import { db } from './db';

export function createNotification(opts: {
  userId: number; actorId: number;
  type: 'like' | 'comment' | 'rating';
  entityType?: string; entityId?: number; text?: string;
}): void {
  if (opts.userId === opts.actorId) return;
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, text)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(opts.userId, opts.actorId, opts.type, opts.entityType ?? null, opts.entityId ?? null, opts.text ?? null);
  } catch { /* ignore */ }
}

export function sendBotMessage(telegramId: string, text: string): void {
  const token = process.env.BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token || telegramId === '1') return;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

/** Send a photo with a caption. `photoPath` is an absolute filesystem path. */
export async function sendBotPhoto(telegramId: string, photoPath: string, caption: string): Promise<void> {
  const token = process.env.BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token || telegramId === '1') return;
  try {
    const fs = await import('fs');
    if (!fs.existsSync(photoPath)) { sendBotMessage(telegramId, caption); return; }
    const buf = fs.readFileSync(photoPath);
    const form = new FormData();
    form.append('chat_id', telegramId);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([new Uint8Array(buf)]), 'photo.jpg');
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
  } catch {
    sendBotMessage(telegramId, caption);
  }
}
