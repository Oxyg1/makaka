import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

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
    if (msg.successful_payment) {
      const sp = msg.successful_payment as { telegram_payment_charge_id: string; invoice_payload: string };
      const fromId = (msg.from as { id: number }).id;
      try {
        const payload = JSON.parse(sp.invoice_payload) as { feature: string; entityId?: number };
        const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(String(fromId)) as { id: number } | undefined;
        if (user) {
          db.prepare(`
            INSERT OR IGNORE INTO payments (user_id, telegram_payment_charge_id, feature, entity_id, used)
            VALUES (?, ?, ?, ?, 0)
          `).run(user.id, sp.telegram_payment_charge_id, payload.feature, payload.entityId ?? null);
        }
      } catch { /* malformed payload */ }
    }
  }

  res.json({ ok: true });
});

export default router;
