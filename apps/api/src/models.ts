import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  /** A pending password reset: the code's hash, when it lapses, and wrong guesses so far. */
  reset?: { codeHash: string; expires: Date; tries: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface CircuitDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  modules: unknown;
  wires: unknown;
  /** Which bench it was built on. Absent means the trainer, as it always was. */
  board?: string;
  shareId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    reset: {
      type: new Schema({ codeHash: String, expires: Date, tries: Number }, { _id: false }),
      required: false,
    },
  },
  { timestamps: true },
);

/**
 * Module positions and wiring are stored as-is: the sim package owns their
 * shape, so Mixed keeps this schema from drifting away from it.
 */
const circuitSchema = new Schema<CircuitDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    modules: { type: Schema.Types.Mixed, required: true },
    wires: { type: Schema.Types.Mixed, required: true },
    board: { type: String, enum: ['trainer', 'pneumatics'] },
    shareId: { type: String, index: true, sparse: true },
  },
  { timestamps: true },
);

const model = <T>(name: string, schema: Schema<T>): Model<T> =>
  (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema);

export const User = model('User', userSchema);
export const Circuit = model('Circuit', circuitSchema);

/**
 * A named running total. Kept as its own tiny document so a count can be
 * raised with one atomic `$inc` rather than read, added to and written back,
 * which would lose increments whenever two people downloaded at once.
 */
export interface CounterDoc {
  _id: string;
  count: number;
}

const counterSchema = new Schema<CounterDoc>(
  { _id: { type: String }, count: { type: Number, required: true, default: 0 } },
  { versionKey: false },
);

/**
 * One row per download already counted, so the same phone tapping the button
 * four times is still one download. The row holds a hash, never an address:
 * it only has to collide with itself.
 *
 * These expire; the tally is the record, and these exist only to keep it
 * honest for as long as a repeat is plausible.
 */
export interface DownloadHitDoc {
  _id: Types.ObjectId;
  key: string;
  at: Date;
}

const downloadHitSchema = new Schema<DownloadHitDoc>(
  {
    key: { type: String, required: true, unique: true },
    at: { type: Date, required: true, default: Date.now, expires: '30d' },
  },
  { versionKey: false },
);

export const Counter = model('Counter', counterSchema);
export const DownloadHit = model('DownloadHit', downloadHitSchema);
