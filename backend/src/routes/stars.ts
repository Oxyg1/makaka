/**
 * Stars economy: balance, top-up, donation, withdrawal request.
 *
 * 1 ⭐ (Telegram Stars) = 1 internal balance unit.
 * Donation commission: 30% kept by platform, floor(amount * 0.7) credited to recipient.
 * Withdrawals: min 100 ⭐, immediately debits balance and creates a pending request.
 * Admin (telegram_id = ADMIN_TG_ID) approves/rejects via bot text commands.
 */

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { sendBotMessage } from '../notifs';
import { logger } from '../logger';

const router = Router();
const BOT_TOKEN = process.env.BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
export const ADMIN_TG_ID = '1031503708';
const COMMISSION_RATE = 0.3;
const MIN_WITHDRAWAL = 100;

/** Split a donation amount into net + commission with 1-decimal precision. */
function splitDonation(amount: number): { net: number; commission: number } {
  const net = Math.round(amount * (1 - COMMISSION_RATE) * 10) / 10;
  const commission = Math.round((amount - net) * 10) / 10;
  return { net, commission };
}

export function getOrCreateBalance(userId: number): { balance: number; total_received: number; total_spent: number } {
  let row = db.prepare('SELECT balance, total_received, total_spent FROM user_balance WHERE user_id = ?').get(userId) as
    { balance: number; total_received: number; total_spent: number } | undefined;
  if (!row) {
    db.prepare('INSERT INTO user_balance (user_id) VALUES (?)').run(userId);
    row = { balance: 0, total_received: 0, total_spent: 0 };
  }
  return row;
}

// GET /api/stars/balance
router.get('/balance', authMiddleware, (req: AuthRequest, res) => {
  const b = getOrCreateBalance(req.userId!);
  res.json(b);
});

// POST /api/stars/topup { amount } → returns invoiceLink
router.post('/topup', authMiddleware, async (req: AuthRequest, res) => {
  const { amount } = req.body as { amount: number };
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
    res.status(400).json({ error: 'Amount must be 1..100000' });
    return;
  }
  if (!BOT_TOKEN) {
    res.status(503).json({ error: 'Payments not configured' });
    return;
  }
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${amount} Stars · Cat Rater`,
        description: `Пополнение баланса на ${amount} звёзд`,
        payload: JSON.stringify({ feature: 'stars_topup', amount, userId: req.userId }),
        currency: 'XTR',
        prices: [{ label: `${amount} Stars`, amount }],
      }),
    });
    const data = await tgRes.json() as { ok: boolean; result?: string; description?: string };
    if (!data.ok) {
      logger.warn('topup invoice failed', { userId: req.userId, amount, description: data.description });
      res.status(502).json({ error: data.description ?? 'Telegram error' });
      return;
    }
    res.json({ invoiceLink: data.result });
  } catch (e) {
    logger.error('topup invoice exception', { userId: req.userId, error: String(e) });
    res.status(502).json({ error: 'Network error' });
  }
});

// POST /api/stars/donate { recipientUserId, amount, catId?, postId? }
router.post('/donate', authMiddleware, (req: AuthRequest, res) => {
  const { recipientUserId, amount, note, catId, postId } = req.body as {
    recipientUserId: number; amount: number; note?: string; catId?: number; postId?: number;
  };
  if (!Number.isInteger(amount) || amount < 1) {
    res.status(400).json({ error: 'Amount must be a positive integer' });
    return;
  }
  if (recipientUserId === req.userId) {
    res.status(400).json({ error: 'Cannot donate to yourself' });
    return;
  }
  const recipient = db.prepare('SELECT id, telegram_id, first_name FROM users WHERE id = ?').get(recipientUserId) as
    { id: number; telegram_id: string; first_name: string } | undefined;
  if (!recipient) { res.status(404).json({ error: 'Recipient not found' }); return; }

  const senderBalance = getOrCreateBalance(req.userId!);
  if (senderBalance.balance < amount) {
    res.status(400).json({ error: 'Insufficient balance', balance: senderBalance.balance });
    return;
  }

  const { net: netAmount, commission } = splitDonation(amount);

  const targetCat = Number.isInteger(catId) ? catId! : null;
  const targetPost = Number.isInteger(postId) ? postId! : null;

  const tx = db.transaction(() => {
    db.prepare('UPDATE user_balance SET balance = balance - ?, total_spent = total_spent + ? WHERE user_id = ?')
      .run(amount, amount, req.userId!);
    getOrCreateBalance(recipientUserId);
    db.prepare('UPDATE user_balance SET balance = balance + ?, total_received = total_received + ? WHERE user_id = ?')
      .run(netAmount, netAmount, recipientUserId);
    db.prepare(`INSERT INTO star_transactions (user_id, type, amount, related_user_id, note, target_cat_id, target_post_id) VALUES (?, 'donation_out', ?, ?, ?, ?, ?)`)
      .run(req.userId!, amount, recipientUserId, note ?? null, targetCat, targetPost);
    db.prepare(`INSERT INTO star_transactions (user_id, type, amount, related_user_id, note, target_cat_id, target_post_id) VALUES (?, 'donation_in', ?, ?, ?, ?, ?)`)
      .run(recipientUserId, netAmount, req.userId!, note ?? null, targetCat, targetPost);
    db.prepare(`INSERT INTO star_transactions (user_id, type, amount, related_user_id, note) VALUES (?, 'commission', ?, ?, ?)`)
      .run(req.userId!, commission, recipientUserId, `from donation #${amount}`);
  });
  tx();

  const sender = db.prepare('SELECT first_name, username FROM users WHERE id = ?').get(req.userId!) as { first_name: string; username: string | null } | undefined;
  if (sender && recipient.telegram_id !== '1') {
    sendBotMessage(recipient.telegram_id, `<b>${sender.first_name}</b> отправил вам ${netAmount} звёзд!`);
  }

  // Admin: every donation
  if (sender && String(req.userId) !== ADMIN_TG_ID) {
    const sHandle = sender.username ? `@${sender.username}` : sender.first_name;
    const rHandle = recipient.first_name;
    const targetTxt = targetCat ? ` (кот #${targetCat})` : targetPost ? ` (пост #${targetPost})` : '';
    sendBotMessage(ADMIN_TG_ID,
      `Донат: ${sHandle} → ${rHandle} · ${amount} звёзд${targetTxt}\nЧистыми: ${netAmount} · Комиссия: ${commission}`);
  }

  res.json({ ok: true, sent: amount, received: netAmount, commission, newBalance: senderBalance.balance - amount });
});

// POST /api/stars/withdraw { amount }
router.post('/withdraw', authMiddleware, (req: AuthRequest, res) => {
  const { amount } = req.body as { amount: number };
  if (!Number.isInteger(amount) || amount < MIN_WITHDRAWAL) {
    res.status(400).json({ error: `Минимум ${MIN_WITHDRAWAL} звёзд` });
    return;
  }
  const bal = getOrCreateBalance(req.userId!);
  if (bal.balance < amount) {
    res.status(400).json({ error: 'Недостаточно баланса', balance: bal.balance });
    return;
  }

  const result = db.transaction(() => {
    db.prepare('UPDATE user_balance SET balance = balance - ? WHERE user_id = ?').run(amount, req.userId!);
    const r = db.prepare('INSERT INTO withdrawal_requests (user_id, amount) VALUES (?, ?) RETURNING id').get(req.userId!, amount) as { id: number };
    db.prepare(`INSERT INTO star_transactions (user_id, type, amount, note) VALUES (?, 'withdrawal_request', ?, ?)`)
      .run(req.userId!, amount, `request #${r.id}`);
    return r;
  })();

  const user = db.prepare('SELECT first_name, username, telegram_id FROM users WHERE id = ?').get(req.userId!) as
    { first_name: string; username: string | null; telegram_id: string } | undefined;
  if (user) {
    const handle = user.username ? `@${user.username}` : '—';
    const msg = `<b>Новый запрос на вывод #${result.id}</b>\n\nПользователь: ${user.first_name} (${handle})\nTG ID: <code>${user.telegram_id}</code>\nСумма: <b>${amount}</b> звёзд\n\n/approve_${result.id} — одобрить\n/reject_${result.id} — отклонить`;
    sendBotMessage(ADMIN_TG_ID, msg);
  }

  res.json({ ok: true, requestId: result.id, newBalance: bal.balance - amount });
});

// GET /api/stars/transactions — last 50 of own
router.get('/transactions', authMiddleware, (req: AuthRequest, res) => {
  const txs = db.prepare(`
    SELECT t.id, t.type, t.amount, t.related_user_id, t.note, t.created_at,
      u.first_name AS related_name, u.username AS related_username
    FROM star_transactions t
    LEFT JOIN users u ON u.id = t.related_user_id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
    LIMIT 50
  `).all(req.userId!);
  res.json(txs);
});

export default router;
