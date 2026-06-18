import { Router } from 'express';
import { fetchGiftBySlug, fetchUserGifts } from '../services/poso';

const router = Router();

// Простой smoke-test poso без авторизации, чтобы можно было curl-ом проверить.
// Включается только если выставлен DEBUG=1.
router.get('/poso/gifts/:username', async (req, res) => {
  if (process.env.DEBUG !== '1') { res.status(404).end(); return; }
  const gifts = await fetchUserGifts(req.params.username);
  res.json({ count: gifts.length, gifts });
});

router.get('/poso/gift/:slug', async (req, res) => {
  if (process.env.DEBUG !== '1') { res.status(404).end(); return; }
  const g = await fetchGiftBySlug(req.params.slug);
  res.json(g);
});

export default router;
