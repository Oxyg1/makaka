import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import './db';
import { seed } from './seed';
import { logger } from './logger';
import authRouter from './routes/auth';
import inventoryRouter from './routes/inventory';
import marketRouter from './routes/market';
import frogsRouter from './routes/frogs';
import offersRouter from './routes/offers';
import notificationsRouter from './routes/notifications';
import configRouter from './routes/config';
import debugRouter from './routes/debug';

const app = express();
const PORT = process.env.PORT ?? 3001;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} → ${res.statusCode}`, {
        body: req.body,
        userId: (req as Request & { userId?: number }).userId,
      });
    }
  });
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/market', marketRouter);
app.use('/api/frogs', frogsRouter);
app.use('/api/offers', offersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/config', configRouter);
app.use('/api/debug', debugRouter);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`Unhandled error: ${req.method} ${req.path}`, { message, stack, body: req.body });
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

seed();
app.listen(PORT, () => logger.info(`SWAMP backend running on :${PORT}`));
