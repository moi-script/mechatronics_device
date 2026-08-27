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

const model = <T>(name: string, schema: Schema<T>): Model<T> =>
  (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema);

export const User = model('User', userSchema);
export const Circuit = model('Circuit', circuitSchema);
