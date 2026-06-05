import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import './db'; // runs schema migration at import
import authRouter from './routes/auth';
import catsRouter from './routes/cats';
import leaderboardRouter from './routes/leaderboard';

const app = express();
const PORT = process.env.PORT ?? 3001;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/cats', catsRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.listen(PORT, () => {
  console.log(`Backend running on :${PORT}`);
});
