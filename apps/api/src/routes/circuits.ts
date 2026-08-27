import { Router } from 'express';
import { nanoid } from 'nanoid';
import { Circuit } from '../models';
import { readUser, requireUser, type AuthedRequest } from '../auth-middleware';

export const circuitsRouter = Router();
circuitsRouter.use(readUser);

const toCircuit = (doc: { modules: unknown; wires: unknown }) => ({
  modules: doc.modules,
  wires: doc.wires,
});

circuitsRouter.get('/circuits', requireUser, async (req: AuthedRequest, res) => {
  const docs = await Circuit.find({ ownerId: req.userId }).sort({ updatedAt: -1 }).lean();
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
  const { name, circuit } = req.body ?? {};
  if (!name || !circuit?.modules || !circuit?.wires) {
    res.status(400).json({ error: 'A name and a circuit are required.' });
    return;
  }
  const doc = await Circuit.create({
    ownerId: req.userId,
    name,
    modules: circuit.modules,
    wires: circuit.wires,
  });
  res.json({ id: String(doc._id) });
});

circuitsRouter.get('/circuits/:id', requireUser, async (req: AuthedRequest, res) => {
  const doc = await Circuit.findOne({ _id: req.params.id, ownerId: req.userId }).lean();
  if (!doc) {
    res.status(404).json({ error: 'No such circuit.' });
    return;
  }
  res.json({ id: String(doc._id), name: doc.name, circuit: toCircuit(doc) });
});

circuitsRouter.put('/circuits/:id', requireUser, async (req: AuthedRequest, res) => {
  const { name, circuit } = req.body ?? {};
  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (circuit) {
    update.modules = circuit.modules;
    update.wires = circuit.wires;
  }
  const doc = await Circuit.findOneAndUpdate({ _id: req.params.id, ownerId: req.userId }, update, { new: true });
  if (!doc) {
    res.status(404).json({ error: 'No such circuit.' });
    return;
  }
  res.json({ ok: true });
});

circuitsRouter.delete('/circuits/:id', requireUser, async (req: AuthedRequest, res) => {
  await Circuit.deleteOne({ _id: req.params.id, ownerId: req.userId });
  res.json({ ok: true });
});

circuitsRouter.post('/circuits/:id/share', requireUser, async (req: AuthedRequest, res) => {
  const doc = await Circuit.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!doc) {
    res.status(404).json({ error: 'No such circuit.' });
    return;
  }
  if (!doc.shareId) {
    doc.shareId = nanoid(10);
    await doc.save();
  }
  res.json({ shareId: doc.shareId });
});

/** Read-only, unauthenticated: anyone holding the link can inspect the wiring. */
circuitsRouter.get('/share/:shareId', async (req, res) => {
  const doc = await Circuit.findOne({ shareId: req.params.shareId }).lean();
  if (!doc) {
    res.status(404).json({ error: 'That share link is not valid.' });
    return;
  }
  res.json({ name: doc.name, circuit: toCircuit(doc) });
});
