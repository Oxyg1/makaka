import { Router } from 'express';
import { fetchGiftBySlug, fetchOwnerByTelegramId, fetchOwnerByUsername, fetchUserGifts } from '../services/poso';

const router = Router();

function guard(): boolean { return process.env.DEBUG === '1'; }

// curl https://host/api/debug/poso/owner/by-id/123
router.get('/poso/owner/by-id/:tg', async (req, res) => {
  if (!guard()) { res.status(404).end(); return; }
  res.json(await fetchOwnerByTelegramId(req.params.tg));
});

router.get('/poso/owner/by-name/:un', async (req, res) => {
  if (!guard()) { res.status(404).end(); return; }
  res.json(await fetchOwnerByUsername(req.params.un));
});

// curl https://host/api/debug/poso/gifts/by-id/123
router.get('/poso/gifts/by-id/:tg', async (req, res) => {
  if (!guard()) { res.status(404).end(); return; }
  const gifts = await fetchUserGifts({ telegramId: req.params.tg });
  res.json({ count: gifts.length, gifts });
});

router.get('/poso/gifts/by-name/:un', async (req, res) => {
  if (!guard()) { res.status(404).end(); return; }
  const gifts = await fetchUserGifts({ username: req.params.un });
  res.json({ count: gifts.length, gifts });
});

router.get('/poso/gift/:slug', async (req, res) => {
  if (!guard()) { res.status(404).end(); return; }
  res.json(await fetchGiftBySlug(req.params.slug));
});

export default router;
