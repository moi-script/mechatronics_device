import mongoose from 'mongoose';
import { env } from './env';

/**
 * Connect to MongoDB and keep the process honest about it: fail fast on a bad
 * URI rather than hanging, and build indexes only outside production.
 */
export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  // sanitizeFilter is deliberately NOT enabled: it wraps any nested object
  // holding a $ key in $eq, which silently breaks legitimate operators like
  // $in on the server's own queries. Injection is prevented at the edge
  // instead - every filter value comes from a zod-parsed string, a JWT
  // subject, or an id checked with isValidObjectId, so no caller-supplied
  // object can ever reach a query.

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    autoIndex: !env.isProd,
  });

  if (env.isProd) {
    // In production indexes are created deliberately, once, at startup.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
  }

  // Housekeeping must never be able to stop the service from starting.
  try {
    await pruneOrphanedCircuits();
  } catch (err) {
    console.error('[mongo] orphan prune skipped:', (err as Error).message);
  }

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
