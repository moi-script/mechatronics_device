/**
 * Set the download tally to a given number.
 *
 * The counter starts at zero, but the downloads did not: the first APK went
 * out as a GitHub release, and those copies are as real as any since. This
 * carries a known figure over so the number on the site is the whole story
 * rather than the part that happened to be instrumented.
 *
 * It is also the way to correct a tally that has drifted — a run of test
 * requests, say — without going near the database by hand.
 *
 *   MONGODB_URI='<the Atlas connection string>' \
 *     node apps/api/scripts/set-download-count.mjs 11
 */
import mongoose from 'mongoose';

const TALLY = 'apk-downloads';

const to = Number(process.argv[2]);
if (!Number.isInteger(to) || to < 0) {
  console.error('Usage: node apps/api/scripts/set-download-count.mjs <whole number>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required. Take it from the API service’s environment.');
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });

const counters = mongoose.connection.collection('counters');
const before = (await counters.findOne({ _id: TALLY }))?.count ?? 0;
await counters.updateOne({ _id: TALLY }, { $set: { count: to } }, { upsert: true });

console.log(`[downloads] ${before} -> ${to}`);
await mongoose.disconnect();
