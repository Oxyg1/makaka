import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    escrow_username: process.env.ESCROW_USERNAME ?? 'kissedfrog',
    poso_base: process.env.POSO_API_BASE ?? 'https://poso.see.tg/api',
  });
});

export default router;
