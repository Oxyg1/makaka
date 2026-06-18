import { Router, Request, Response } from 'express';
import { fetchImage, getPreload } from '../services/visuals';

const router = Router();

router.get('/preload', async (_req: Request, res: Response) => {
  const data = await getPreload();
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(data);
});

router.get('/:kind/:name.png', async (req: Request, res: Response) => {
  const kind = req.params.kind;
  if (kind !== 'model' && kind !== 'pattern' && kind !== 'symbol') { res.status(404).end(); return; }
  const sizeRaw = Number(req.query.size ?? 256);
  const allowed: (64 | 128 | 256 | 512 | 1024)[] = [64, 128, 256, 512, 1024];
  const size = (allowed.includes(sizeRaw as 64 | 128 | 256 | 512 | 1024) ? sizeRaw : 256) as 64 | 128 | 256 | 512 | 1024;

  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const img = await fetchImage(kind, name, size);
  if (!img) { res.status(404).end(); return; }
  res.setHeader('Content-Type', img.contentType);
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  res.send(img.data);
});

export default router;
