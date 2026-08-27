import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { authRouter } from './routes/auth';
import { circuitsRouter } from './routes/circuits';
import { exercisesRouter } from './routes/exercises';

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/mechatronic_trainer';
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

const app = express();
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

app.use('/api/auth', authRouter);
app.use('/api', circuitsRouter);
app.use('/api/exercises', exercisesRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('mongo connected');
  app.listen(PORT, () => console.log('api listening on http://localhost:' + PORT));
}

main().catch((err) => {
  console.error('failed to start:', err.message);
  process.exit(1);
});
