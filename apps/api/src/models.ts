import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CircuitDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  modules: unknown;
  wires: unknown;
  shareId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExerciseDoc {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  brief: string;
  script: unknown;
  order: number;
}

export interface AttemptDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  exerciseId: Types.ObjectId;
  passed: boolean;
  results: unknown;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
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
    shareId: { type: String, index: true, sparse: true },
  },
  { timestamps: true },
);

const exerciseSchema = new Schema<ExerciseDoc>({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  brief: { type: String, required: true },
  script: { type: Schema.Types.Mixed, required: true },
  order: { type: Number, default: 0 },
});

const attemptSchema = new Schema<AttemptDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise', index: true },
    passed: { type: Boolean, required: true },
    results: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const model = <T>(name: string, schema: Schema<T>): Model<T> =>
  (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema);

export const User = model('User', userSchema);
export const Circuit = model('Circuit', circuitSchema);
export const Exercise = model('Exercise', exerciseSchema);
export const Attempt = model('Attempt', attemptSchema);
