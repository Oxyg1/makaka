import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import './db';
import { logger } from './logger';
import authRouter from './routes/auth';
import catsRouter from './routes/cats';
import leaderboardRouter from './routes/leaderboard';
import feedRouter from './routes/feed';
import usersRouter from './routes/users';
import notificationsRouter from './routes/notifications';
import paymentsRouter from './routes/payments';
import starsRouter from './routes/stars';
import reportsRouter from './routes/reports';

const app = express();
const PORT = process.env.PORT ?? 3001;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Log every response that is 4xx or 5xx
app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} → ${res.statusCode}`, {
        body: req.body,
        query: req.query,
        userId: (req as Request & { userId?: number }).userId,
      });
    }
  });
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/cats', catsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/feed', feedRouter);
app.use('/api/users', usersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/stars', starsRouter);
app.use('/api/reports', reportsRouter);

// Global error handler — catches any thrown error from routes
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`Unhandled error: ${req.method} ${req.path}`, { message, stack, body: req.body });
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

app.listen(PORT, () => logger.info(`Backend running on :${PORT}`));
