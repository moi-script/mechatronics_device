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

  await pruneOrphanedCircuits();

  mongoose.connection.on('error', (err) => console.error('[mongo] error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[mongo] disconnected'));
}

/**
 * Remove circuits whose owner no longer exists. Account deletion takes its
 * circuits with it, but anything orphaned before that was true would otherwise
 * keep its share link readable.
 */
async function pruneOrphanedCircuits(): Promise<void> {
  const { Circuit, User } = await import('./models');
  const ownerIds = await Circuit.distinct('ownerId');
  if (ownerIds.length === 0) return;

  const alive = new Set((await User.find({ _id: { $in: ownerIds } }, '_id').lean()).map((u) => String(u._id)));
  const orphaned = ownerIds.filter((id) => !alive.has(String(id)));
  if (orphaned.length === 0) return;

  const { deletedCount } = await Circuit.deleteMany({ ownerId: { $in: orphaned } });
  console.log(`[mongo] removed ${deletedCount} circuit(s) with no owner`);
}

export const dbReady = (): boolean => mongoose.connection.readyState === 1;

export async function closeDb(): Promise<void> {
  await mongoose.connection.close();
}
