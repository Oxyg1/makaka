// «Монеты»: баланс, списания на бусты, покупка пакетов за Telegram Stars.
//
// Покупка (реальные деньги → монеты):
//   1) POST /purchase {pack} → createInvoiceLink (валюта XTR) → ссылка-инвойс;
//      клиент открывает её через tg.openInvoice().
//   2) Telegram шлёт боту pre_checkout_query и после оплаты successful_payment —
//      их принимает POST /telegram-webhook (настройте setWebhook бота на
//      https://<host>/api/coins/telegram-webhook, secret_token = TG_WEBHOOK_SECRET).
//   3) Вебхук идемпотентно (по telegram_payment_charge_id) зачисляет монеты.

import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../logger';
import {
  BOOST_PRICES, COIN_PACKS,
  addCoins, getBalance, hasTransaction, tgOfUser,
} from '../services/games';

const router = Router();

const BOT_API = 'https://api.telegram.org';

router.get('/balance', authMiddleware, (req: AuthRequest, res) => {
  const tg = tgOfUser(req.userId);
  if (!tg) { res.status(401).json({ error: 'Пользователь не найден' }); return; }
  res.json({ balance: getBalance(tg) });
});

// Каталог: цены бустов + пакеты монет (фронт не хардкодит цены).
router.get('/catalog', authMiddleware, (_req: AuthRequest, res) => {
  res.json({
    boosts: BOOST_PRICES,
    packs: Object.entries(COIN_PACKS).map(([id, p]) => ({ id, ...p })),
    payments_enabled: !!process.env.BOT_TOKEN,
  });
});

// Списание на буст. Клиент шлёт только id буста — цену знает сервер.
router.post('/spend', authMiddleware, (req: AuthRequest, res) => {
  const tg = tgOfUser(req.userId);
  if (!tg) { res.status(401).json({ error: 'Пользователь не найден' }); return; }
  const boost = String((req.body as { boost?: string }).boost ?? '');
  const price = BOOST_PRICES[boost];
  if (!price) { res.status(400).json({ error: 'Неизвестный буст' }); return; }
  try {
    const balance = addCoins(tg, -price, `spend:${boost}`, boost.split(':')[0]);
    res.json({ ok: true, balance, price });
  } catch (e) {
    if ((e as Error).message === 'INSUFFICIENT') {
      res.status(402).json({ error: 'Не хватает монет' });
      return;
    }
    throw e;
  }
});

// Создать инвойс на пакет монет (Telegram Stars).
router.post('/purchase', authMiddleware, async (req: AuthRequest, res) => {
  const tg = tgOfUser(req.userId);
  if (!tg) { res.status(401).json({ error: 'Пользователь не найден' }); return; }
  const packId = String((req.body as { pack?: string }).pack ?? '');
  const pack = COIN_PACKS[packId];
  if (!pack) { res.status(400).json({ error: 'Неизвестный пакет' }); return; }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) { res.status(503).json({ error: 'Платежи пока не настроены (нет BOT_TOKEN)' }); return; }

  const r = await fetch(`${BOT_API}/bot${botToken}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `${pack.coins} Монет`,
      description: `Пакет игровой валюты SWAMP: ${pack.coins} Монет`,
      payload: JSON.stringify({ t: 'coins', tg, pack: packId }),
      currency: 'XTR', // Telegram Stars
      prices: [{ label: `${pack.coins} Монет`, amount: pack.stars }],
    }),
  });
  const j = await r.json() as { ok: boolean; result?: string; description?: string };
  if (!j.ok || !j.result) {
    logger.warn('createInvoiceLink failed', { description: j.description });
    res.status(502).json({ error: `Telegram: ${j.description ?? 'не удалось создать инвойс'}` });
    return;
  }
  res.json({ link: j.result, ...pack });
});

// Вебхук бота: подтверждаем pre-checkout и зачисляем оплаченные пакеты.
router.post('/telegram-webhook', async (req: Request, res: Response) => {
  const expected = process.env.TG_WEBHOOK_SECRET;
  if (expected && req.headers['x-telegram-bot-api-secret-token'] !== expected) {
    res.status(403).end(); return;
  }
  res.json({ ok: true }); // отвечаем сразу — Telegram не любит ждать

  const upd = req.body as {
    pre_checkout_query?: { id: string; invoice_payload?: string };
    message?: { successful_payment?: { invoice_payload?: string; telegram_payment_charge_id?: string } };
  };
  const botToken = process.env.BOT_TOKEN;

  try {
    if (upd.pre_checkout_query && botToken) {
      await fetch(`${BOT_API}/bot${botToken}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: upd.pre_checkout_query.id, ok: true }),
      });
    }
    const pay = upd.message?.successful_payment;
    if (pay?.invoice_payload) {
      const payload = JSON.parse(pay.invoice_payload) as { t?: string; tg?: string; pack?: string };
      const pack = payload.pack ? COIN_PACKS[payload.pack] : undefined;
      const chargeId = pay.telegram_payment_charge_id ?? 'unknown';
      if (payload.t === 'coins' && payload.tg && pack) {
        const reason = `buy:${payload.pack}:${chargeId}`;
        if (!hasTransaction(payload.tg, reason)) { // идемпотентность по charge id
          addCoins(payload.tg, pack.coins, reason, null);
          logger.info(`Coins purchased: ${payload.tg} +${pack.coins} (${chargeId})`);
        }
      }
    }
  } catch (e) {
    logger.error('telegram-webhook error', { message: (e as Error).message });
  }
});

export default router;
