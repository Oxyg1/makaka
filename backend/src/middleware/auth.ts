import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

export interface AuthRequest extends Request {
  userId?: number;
}

function upsertUser(telegramId: string, username: string | null, firstName: string): number {
  const stmt = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name
    RETURNING id
  `);
  const row = stmt.get(telegramId, username, firstName) as { id: number };
  return row.id;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const initData = req.headers['x-init-data'] as string | undefined;

  if (!initData) {
    res.status(401).json({ error: 'Missing X-Init-Data header' });
    return;
  }

  // Dev mode bypass
  if (process.env.NODE_ENV !== 'production' && initData === 'mock') {
    const mockUser = db.prepare(`
      INSERT OR IGNORE INTO users (telegram_id, username, first_name)
      VALUES ('mock_user', 'mockuser', 'Mock User')
    `);
    mockUser.run();
    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get('mock_user') as { id: number };
    req.userId = user.id;
    next();
    return;
  }

  try {
    // Parse init data manually (works with @telegram-apps/init-data-node v1.x)
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) {
      res.status(401).json({ error: 'No user in init data' });
      return;
    }

    const tgUser = JSON.parse(userStr);
    const userId = upsertUser(
      String(tgUser.id),
      tgUser.username ?? null,
      tgUser.first_name ?? 'User'
    );
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid init data' });
  }
}
