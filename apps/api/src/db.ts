import mongoose from 'mongoose';
import { env } from './env';

/**
 * Connect to MongoDB and keep the process honest about it: fail fast on a bad
 * URI rather than hanging, and build indexes only outside production.
 */
export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  // Reject anything with a $ or a dot in a key before it reaches a query.
  mongoose.set('sanitizeFilter', true);

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    autoIndex: !env.isProd,
  });

  if (env.isProd) {
    // In production indexes are created deliberately, once, at startup.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
  }

  mongoose.connection.on('error', (err) => console.error('[mongo] error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[mongo] disconnected'));
}

export const dbReady = (): boolean => mongoose.connection.readyState === 1;

export async function closeDb(): Promise<void> {
  await mongoose.connection.close();
}
