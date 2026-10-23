import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { customAlphabet, nanoid } from 'nanoid';
import { z } from 'zod';
import { WIRE_COLORS, circuitStats, type Circuit as SimCircuit } from '@mech/sim';
import { Circuit, User } from '../models';
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

/** One parallel group of a ladder rung: up to 8 branches of up to 8 contacts. */
const parallel = z
  .array(
    z
      .array(
        z.object({
          addr: z.string().regex(/^(I(0\d|1[0-7])|Q(0\d|1[01])|M(0\d|1[0-5])|T[0-7])$/),
          nc: z.boolean().optional(),
        }),
      )
      .max(8),
  )
  .max(8);

const circuitSchema = z.object({
  modules: z
    .array(
      z.object({
        id: z.string().max(40),
        type: z.string().max(20),
        x: z.number().finite(),
        y: z.number().finite(),
        // A timer carries its set point; anything else leaves it off.
        delaySec: z.number().finite().min(1).max(3600).optional(),
        // Where a limit switch is bolted. Drop it and the switch comes back
        // loose, waiting for a finger that is never coming.
        mount: z
          .object({ cylinderId: z.string().max(40), at: z.enum(['home', 'out']) })
          .optional(),
        // A PLC's program. Drop it and the PLC comes back blank, and the
        // circuit wired around it does nothing.
        ladder: z
          .array(
            z.object({
              // Blocks in series, each parallel branches of series contacts; rungs
              // saved before blocks carry one parallel group as `branches`.
              blocks: z.array(parallel).max(8).optional(),
              branches: parallel.optional(),
              coil: z.object({
                addr: z.string().regex(/^(Q(0\d|1[01])|M(0\d|1[0-5])|T[0-7])$/),
                kind: z.enum(['OUT', 'SET', 'RST', 'TON']),
                presetSec: z.number().min(0.1).max(3600).optional(),
              }),
            }),
          )
          .max(64)
          .optional(),
        // A PLC's address plan: which part each I / Q address is meant for.
        io: z.record(z.string().regex(/^(I(0\d|1[0-7])|Q(0\d|1[01]))$/), z.string().max(40)).optional(),
      }),
    )
    .max(64),
  wires: z
    .array(
      z.object({
        id: z.string().max(40),
        color: z.enum(WIRE_COLORS),
        // Omitted means an electrical lead. Air tubing has to survive the round
        // trip, or a saved pneumatic circuit comes back with its tubes turned
        // into leads and no air reaching anything.
        kind: z.enum(['lead', 'tube']).optional(),
        a: endRef,
        b: endRef,
      }),
    )
    .max(400),
  /** Which bench it was built on. Absent means the trainer, as it always was. */
  board: z.enum(['trainer', 'pneumatics', 'simple']).optional(),
});

const name = z.string().trim().min(1).max(120);
const createSchema = z.object({ name, circuit: circuitSchema });
const updateSchema = z.object({ name: name.optional(), circuit: circuitSchema.optional() });

/** How many circuits one account may keep: room for a class's submissions over a term. */
const MAX_PER_USER = 300;

/** Short enough to write on a board; no 0/O or 1/I to misread. */
const newClassCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const submitSchema = z.object({ code: z.string().trim().toUpperCase().length(6), name, circuit: circuitSchema });

const toCircuit = (doc: { modules: unknown; wires: unknown; board?: string }) => ({
  modules: doc.modules,
  wires: doc.wires,
  // Absent for everything saved before there was a second bench.
  board: doc.board ?? 'trainer',
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
      board: d.board ?? 'trainer',
      ...circuitStats(d as unknown as SimCircuit),
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
    board: parsed.data.circuit.board ?? 'trainer',
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
    update.board = parsed.data.circuit.board ?? 'trainer';
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

/** The account's class code, made on first ask. */
circuitsRouter.post('/class-code', requireUser, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(401).json({ error: 'Sign in to do that.' });
    return;
  }
  // A clash with another account's code fails the unique index; a fresh draw settles it.
  for (let i = 0; !user.classCode && i < 5; i++) {
    try {
      user.classCode = newClassCode();
      await user.save();
    } catch {
      user.classCode = undefined;
    }
  }
  if (!user.classCode) {
    res.status(500).json({ error: 'Could not make a class code. Try again.' });
    return;
  }
  res.json({ code: user.classCode });
});

/**
 * A student hands a circuit in to whoever owns the code. It lands in that
 * account under the student's name; handing in the same circuit again
 * replaces the earlier copy rather than piling up duplicates.
 */
circuitsRouter.post('/submit', requireUser, async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'That circuit could not be submitted.' });
    return;
  }
  const [teacher, student] = await Promise.all([
    User.findOne({ classCode: parsed.data.code }).lean(),
    User.findById(req.userId).lean(),
  ]);
  if (!teacher) {
    res.status(404).json({ error: 'No class has that code. Check it with your instructor.' });
    return;
  }
  if (!student) {
    res.status(401).json({ error: 'Sign in to do that.' });
    return;
  }

  const label = parsed.data.name === student.name ? student.name : student.name + ' · ' + parsed.data.name;
  const fields = {
    modules: parsed.data.circuit.modules,
    wires: parsed.data.circuit.wires,
    board: parsed.data.circuit.board ?? 'trainer',
  };
  const filter = { ownerId: teacher._id, submittedBy: student._id, name: label.slice(0, 120) };
  const replaced = await Circuit.findOneAndUpdate(filter, fields);
  if (!replaced) {
    if ((await Circuit.countDocuments({ ownerId: teacher._id })) >= MAX_PER_USER) {
      res.status(409).json({ error: 'Your instructor’s library is full. Let them know.' });
      return;
    }
    await Circuit.create({ ...filter, ...fields });
  }
  res.json({ to: teacher.name, name: filter.name, replaced: !!replaced });
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
