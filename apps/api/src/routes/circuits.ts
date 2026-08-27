import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { Circuit } from '../models';
import { readUser, requireUser, type AuthedRequest } from '../auth-middleware';

export const circuitsRouter = Router();
circuitsRouter.use(readUser);

/**
 * The board is a fixed panel, so a well-formed circuit has a bounded shape.
 * Validating it keeps arbitrary documents out of the database.
 */
const endRef = z.union([
  z.object({ kind: z.literal('terminal'), moduleId: z.string().max(40), pinId: z.string().max(40) }),
  z.object({ kind: z.literal('stack'), wireId: z.string().max(40), end: z.enum(['A', 'B']) }),
  z.object({ kind: z.literal('loose'), x: z.number().finite(), y: z.number().finite() }),
]);

const circuitSchema = z.object({
  modules: z
    .array(
      z.object({
        id: z.string().max(40),
        type: z.string().max(20),
        x: z.number().finite(),
        y: z.number().finite(),
      }),
    )
    .max(64),
  wires: z
    .array(
      z.object({
        id: z.string().max(40),
        color: z.enum(['blue', 'green', 'red', 'black', 'yellow']),
        a: endRef,
        b: endRef,
      }),
    )
    .max(400),
});

const name = z.string().trim().min(1).max(120);
const createSchema = z.object({ name, circuit: circuitSchema });
const updateSchema = z.object({ name: name.optional(), circuit: circuitSchema.optional() });

/** How many circuits one account may keep. */
const MAX_PER_USER = 100;

const toCircuit = (doc: { modules: unknown; wires: unknown }) => ({
  modules: doc.modules,
  wires: doc.wires,
});

const badId = (res: Parameters<Parameters<typeof circuitsRouter.get>[1]>[1], id: string): boolean => {
  if (isValidObjectId(id)) return false;
  res.status(404).json({ error: 'No such circuit.' });
  return true;
};

circuitsRouter.get('/circuits', requireUser, async (req: AuthedRequest, res) => {
  const docs = await Circuit.find({ ownerId: req.userId }).sort({ updatedAt: -1 }).limit(MAX_PER_USER).lean();
  res.json({
    circuits: docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      shareId: d.shareId ?? undefined,
      updatedAt: d.updatedAt,
    })),
  });
});

circuitsRouter.post('/circuits', requireUser, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'That circuit could not be saved.' });
    return;
  }

  if ((await Circuit.countDocuments({ ownerId: req.userId })) >= MAX_PER_USER) {
    res.status(409).json({ error: `You can keep up to ${MAX_PER_USER} circuits. Delete one to make room.` });
    return;
  }

  const doc = await Circuit.create({
    ownerId: req.userId,
    name: parsed.data.name,
    modules: parsed.data.circuit.modules,
    wires: parsed.data.circuit.wires,
  });
  res.status(201).json({ id: String(doc._id) });
});

circuitsRouter.get('/circuits/:id', requireUser, async (req: AuthedRequest, res) => {
  if (badId(res, req.params.id)) return;
  const doc = await Circuit.findOne({ _id: req.params.id, ownerId: req.userId }).lean();
  if (!doc) {
    res.status(404).json({ error: 'No such circuit.' });
    return;
  }
  res.json({ id: String(doc._id), name: doc.name, circuit: toCircuit(doc) });
});

circuitsRouter.put('/circuits/:id', requireUser, async (req: AuthedRequest, res) => {
  if (badId(res, req.params.id)) return;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'That circuit could not be saved.' });
    return;
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.circuit) {
    update.modules = parsed.data.circuit.modules;
    update.wires = parsed.data.circuit.wires;
  }

  // Scoped by ownerId, so one account can never write another's circuit.
  const doc = await Circuit.findOneAndUpdate({ _id: req.params.id, ownerId: req.userId }, update, { new: true });
  if (!doc) {
    res.status(404).json({ error: 'No such circuit.' });
    return;
  }
  res.json({ ok: true });
});

circuitsRouter.delete('/circuits/:id', requireUser, async (req: AuthedRequest, res) => {
  if (badId(res, req.params.id)) return;
  await Circuit.deleteOne({ _id: req.params.id, ownerId: req.userId });
  res.json({ ok: true });
});

circuitsRouter.post('/circuits/:id/share', requireUser, async (req: AuthedRequest, res) => {
  if (badId(res, req.params.id)) return;
  const doc = await Circuit.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!doc) {
    res.status(404).json({ error: 'No such circuit.' });
    return;
  }
  if (!doc.shareId) {
    doc.shareId = nanoid(16);
    await doc.save();
  }
  res.json({ shareId: doc.shareId });
});

circuitsRouter.delete('/circuits/:id/share', requireUser, async (req: AuthedRequest, res) => {
  if (badId(res, req.params.id)) return;
  await Circuit.updateOne({ _id: req.params.id, ownerId: req.userId }, { $unset: { shareId: 1 } });
  res.json({ ok: true });
});

/** Read-only, unauthenticated: anyone holding the link can inspect the wiring. */
circuitsRouter.get('/share/:shareId', async (req, res) => {
  const shareId = String(req.params.shareId);
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(shareId)) {
    res.status(404).json({ error: 'That share link is not valid.' });
    return;
  }
  const doc = await Circuit.findOne({ shareId }).lean();
  if (!doc) {
    res.status(404).json({ error: 'That share link is not valid.' });
    return;
  }
  res.json({ name: doc.name, circuit: toCircuit(doc) });
});
