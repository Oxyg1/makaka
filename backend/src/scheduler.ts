/** Background scheduler: sends a daily "новые котики" reminder to users
 *  who haven't rated today and weren't already reminded today. Runs every
 *  hour but only sends inside a fixed UTC window so users don't get pinged
 *  in the middle of the night. */

import { db } from './db';
import { sendBotMessage } from './notifs';
import { logger } from './logger';

const REMINDER_START_UTC_HOUR = 15; // ~18:00 MSK / 10:00 CST
const REMINDER_END_UTC_HOUR = 19;   // ~22:00 MSK
const BATCH_SIZE = 50;
const HOUR_MS = 60 * 60 * 1000;

const REMINDER_MESSAGES = [
  'В Cat Rater появились новые котики! Загляни и поставь им оценки.',
  'Котики ждут вашей оценки — откройте Cat Rater и поддержите серию.',
  'Сегодня в Cat Rater новые пушистые мордашки. Пора их оценить!',
];

function pickMessage(): string {
  return REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
}

export async function runDailyReminders(): Promise<void> {
  const utcHour = new Date().getUTCHours();
  if (utcHour < REMINDER_START_UTC_HOUR || utcHour > REMINDER_END_UTC_HOUR) return;

  const today = new Date().toISOString().slice(0, 10);

  // Ensure every user has a user_stats row so the LEFT JOIN filter is reliable.
  const eligible = db.prepare(`
    SELECT u.id, u.telegram_id, u.first_name
    FROM users u
    LEFT JOIN user_stats s ON s.user_id = u.id
    WHERE u.telegram_id NOT IN ('1', 'mock')
      AND (s.last_reminded_date IS NULL OR s.last_reminded_date != ?)
      AND (s.last_rated_date IS NULL OR s.last_rated_date != ?)
    LIMIT ?
  `).all(today, today, BATCH_SIZE) as Array<{ id: number; telegram_id: string; first_name: string }>;

  if (eligible.length === 0) return;
  logger.info('daily-reminders: sending', { count: eligible.length });

  const upsertReminder = db.prepare(`
    INSERT INTO user_stats (user_id, last_reminded_date)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET last_reminded_date = excluded.last_reminded_date
  `);

  for (const u of eligible) {
    try {
      sendBotMessage(u.telegram_id, pickMessage());
      upsertReminder.run(u.id, today);
    } catch (e) {
      logger.warn('daily-reminders: send failed', { userId: u.id, error: String(e) });
    }
  }
}

export function startScheduler(): void {
  // First run shortly after boot (5 min) to avoid hammering the cold start.
  setTimeout(() => { runDailyReminders().catch(() => {}); }, 5 * 60 * 1000);
  setInterval(() => { runDailyReminders().catch(() => {}); }, HOUR_MS);
  logger.info('scheduler: daily reminders armed');
}
