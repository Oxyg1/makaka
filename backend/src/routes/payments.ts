import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { getOrCreateBalance, ADMIN_TG_ID } from './stars';
import { sendBotMessage } from '../notifs';
import { logger } from '../logger';

const router = Router();
const BOT_TOKEN = process.env.BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? '';

const PRICES: Record<string, { label: string; amount: number }> = {
  photo: { label: 'Дополнительное фото кота', amount: 2 },
};

// POST /api/payments/invoice
router.post('/invoice', authMiddleware, async (req: AuthRequest, res) => {
  const { feature, entityId } = req.body as { feature: string; entityId?: number };

  const price = PRICES[feature];
  if (!price) { res.status(400).json({ error: 'Unknown feature' }); return; }

  if (!BOT_TOKEN) { res.status(503).json({ error: 'Payments not configured' }); return; }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: price.label,
        description: `Покупка: ${price.label}`,
        payload: JSON.stringify({ feature, entityId, userId: req.userId }),
        currency: 'XTR',
        prices: [{ label: price.label, amount: price.amount }],
      }),
    });

    const data = await tgRes.json() as { ok: boolean; result?: string; description?: string };
    if (!data.ok) { res.status(502).json({ error: data.description ?? 'Telegram API error' }); return; }

    res.json({ invoiceLink: data.result });
  } catch {
    res.status(502).json({ error: 'Failed to create invoice' });
  }
});

// POST /api/payments/webhook — receives Telegram updates
router.post('/webhook', async (req, res) => {
  const update = req.body as Record<string, unknown>;

  if (update.pre_checkout_query) {
    const pq = update.pre_checkout_query as { id: string };
    if (BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: pq.id, ok: true }),
      }).catch(() => null);
    }
    res.json({ ok: true });
    return;
  }

  if (update.message) {
    const msg = update.message as Record<string, unknown>;
    const from = msg.from as { id: number; username?: string; first_name?: string } | undefined;
    const text = (msg.text as string | undefined) ?? '';

    if (msg.successful_payment) {
      const sp = msg.successful_payment as { telegram_payment_charge_id: string; invoice_payload: string; total_amount: number };
      const fromId = from?.id;
      try {
        const payload = JSON.parse(sp.invoice_payload) as { feature: string; entityId?: number; amount?: number };
        const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(String(fromId)) as { id: number } | undefined;
        if (user) {
          db.prepare(`
            INSERT OR IGNORE INTO payments (user_id, telegram_payment_charge_id, feature, entity_id, used)
            VALUES (?, ?, ?, ?, 0)
          `).run(user.id, sp.telegram_payment_charge_id, payload.feature, payload.entityId ?? null);

          if (payload.feature === 'stars_topup') {
            const amount = payload.amount ?? sp.total_amount;
            getOrCreateBalance(user.id);
            db.prepare('UPDATE user_balance SET balance = balance + ? WHERE user_id = ?').run(amount, user.id);
            db.prepare(`INSERT INTO star_transactions (user_id, type, amount, telegram_charge_id, note) VALUES (?, 'topup', ?, ?, ?)`)
              .run(user.id, amount, sp.telegram_payment_charge_id, null);
            logger.info('stars topup credited', { userId: user.id, amount });
            sendBotMessage(String(fromId), `✅ Баланс пополнен на <b>${amount} ⭐</b>`);
          }
        }
      } catch (e) {
        logger.warn('payment payload parse failed', { error: String(e) });
      }
    } else if (text && from) {
      handleBotCommand(text, from);
    }
  }

  res.json({ ok: true });
});

// ─────────────── Bot text commands ───────────────
function handleBotCommand(text: string, from: { id: number; username?: string; first_name?: string }): void {
  const fromId = String(from.id);
  const isAdmin = fromId === ADMIN_TG_ID;

  if (text === '/start') {
    sendBotMessage(fromId, `👋 Привет, ${from.first_name ?? 'друг'}!\n\nДобро пожаловать в <b>Cat Rater</b> — рейтинг самых пушистых котов в Telegram.\n\nОткройте Mini App кнопкой ниже, оценивайте котов, делитесь своими и поддерживайте любимцев звёздами ⭐`);
    return;
  }

  if (!isAdmin) {
    return; // silent for non-admin commands
  }

  if (text === '/admin' || text === '/stats') {
    const totalTopup = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM star_transactions WHERE type = 'topup'`).get() as { n: number }).n;
    const totalCommission = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM star_transactions WHERE type = 'commission'`).get() as { n: number }).n;
    const totalDonations = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM star_transactions WHERE type = 'donation_out'`).get() as { n: number }).n;
    const pendingW = (db.prepare(`SELECT COUNT(*) AS n FROM withdrawal_requests WHERE status = 'pending'`).get() as { n: number }).n;
    const pendingWSum = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM withdrawal_requests WHERE status = 'pending'`).get() as { n: number }).n;
    const users = (db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n;
    const activeBalances = (db.prepare(`SELECT COALESCE(SUM(balance), 0) AS n FROM user_balance`).get() as { n: number }).n;
    sendBotMessage(fromId,
`📊 <b>Cat Rater Admin</b>

👥 Пользователей: <b>${users}</b>
💰 Куплено звёзд: <b>${totalTopup} ⭐</b>
🎁 Передано донатов: <b>${totalDonations} ⭐</b>
💎 Комиссия (ваша): <b>${totalCommission} ⭐</b>
🏦 Активный баланс юзеров: <b>${activeBalances} ⭐</b>

📤 Заявок на вывод: <b>${pendingW}</b> на сумму <b>${pendingWSum} ⭐</b>

/withdrawals — список заявок
/users — статистика юзеров
/help — все команды`);
    return;
  }

  if (text === '/withdrawals') {
    const rows = db.prepare(`
      SELECT w.id, w.amount, w.created_at, u.first_name, u.username, u.telegram_id
      FROM withdrawal_requests w
      JOIN users u ON u.id = w.user_id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC LIMIT 20
    `).all() as Array<{ id: number; amount: number; created_at: string; first_name: string; username: string | null; telegram_id: string }>;
    if (rows.length === 0) { sendBotMessage(fromId, '✅ Нет заявок на вывод.'); return; }
    const body = rows.map(r => {
      const u = r.username ? `@${r.username}` : '—';
      return `<b>#${r.id}</b> · ${r.first_name} (${u}) · TG <code>${r.telegram_id}</code> · <b>${r.amount} ⭐</b>\n/approve_${r.id}  /reject_${r.id}`;
    }).join('\n\n');
    sendBotMessage(fromId, `📤 <b>Заявки на вывод:</b>\n\n${body}`);
    return;
  }

  const approveMatch = text.match(/^\/approve_(\d+)$/);
  const rejectMatch = text.match(/^\/reject_(\d+)$/);
  if (approveMatch) { processWithdrawal(parseInt(approveMatch[1], 10), true, fromId); return; }
  if (rejectMatch) { processWithdrawal(parseInt(rejectMatch[1], 10), false, fromId); return; }

  if (text === '/users') {
    const top = db.prepare(`
      SELECT u.first_name, u.username, b.balance, b.total_received, b.total_spent
      FROM user_balance b JOIN users u ON u.id = b.user_id
      ORDER BY b.total_spent + b.total_received DESC LIMIT 10
    `).all() as Array<{ first_name: string; username: string | null; balance: number; total_received: number; total_spent: number }>;
    if (top.length === 0) { sendBotMessage(fromId, 'Пока нет активности.'); return; }
    const body = top.map((r, i) => {
      const u = r.username ? `@${r.username}` : '—';
      return `${i + 1}. ${r.first_name} (${u})\n   баланс ${r.balance} · получил ${r.total_received} · потратил ${r.total_spent}`;
    }).join('\n');
    sendBotMessage(fromId, `🏆 <b>Топ-10 по активности:</b>\n\n${body}`);
    return;
  }

  if (text === '/help') {
    sendBotMessage(fromId,
`🛠 <b>Админ-команды:</b>

/admin — общая статистика
/withdrawals — список заявок на вывод
/approve_N — одобрить заявку N
/reject_N — отклонить (вернёт баланс юзеру)
/users — топ юзеров по активности`);
    return;
  }
}

function processWithdrawal(id: number, approve: boolean, adminTgId: string): void {
  const req = db.prepare(`
    SELECT w.id, w.amount, w.status, w.user_id, u.telegram_id, u.first_name
    FROM withdrawal_requests w JOIN users u ON u.id = w.user_id
    WHERE w.id = ?
  `).get(id) as { id: number; amount: number; status: string; user_id: number; telegram_id: string; first_name: string } | undefined;
  if (!req) { sendBotMessage(adminTgId, `Заявка #${id} не найдена.`); return; }
  if (req.status !== 'pending') { sendBotMessage(adminTgId, `Заявка #${id} уже обработана (${req.status}).`); return; }

  if (approve) {
    db.prepare(`UPDATE withdrawal_requests SET status = 'approved', processed_at = datetime('now') WHERE id = ?`).run(id);
    db.prepare(`INSERT INTO star_transactions (user_id, type, amount, note) VALUES (?, 'withdrawal_done', ?, ?)`)
      .run(req.user_id, req.amount, `request #${id} approved`);
    sendBotMessage(adminTgId, `✅ Заявка #${id} одобрена. Не забудьте отправить ${req.amount} ⭐ юзеру ${req.first_name} (TG <code>${req.telegram_id}</code>).`);
    sendBotMessage(req.telegram_id, `✅ Ваш запрос на вывод <b>${req.amount} ⭐</b> одобрен! Звёзды поступят в ближайшее время.`);
  } else {
    db.prepare(`UPDATE withdrawal_requests SET status = 'rejected', processed_at = datetime('now') WHERE id = ?`).run(id);
    db.prepare('UPDATE user_balance SET balance = balance + ? WHERE user_id = ?').run(req.amount, req.user_id);
    db.prepare(`INSERT INTO star_transactions (user_id, type, amount, note) VALUES (?, 'withdrawal_rejected', ?, ?)`)
      .run(req.user_id, req.amount, `request #${id} rejected — balance returned`);
    sendBotMessage(adminTgId, `❌ Заявка #${id} отклонена. ${req.amount} ⭐ возвращены на баланс ${req.first_name}.`);
    sendBotMessage(req.telegram_id, `❌ Ваш запрос на вывод <b>${req.amount} ⭐</b> отклонён. Звёзды возвращены на баланс.`);
  }
}

export default router;
