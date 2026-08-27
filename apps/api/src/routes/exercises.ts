import { Router } from 'express';
import { runScript, type Circuit, type ScriptStep } from '@mech/sim';
import { Attempt, Exercise } from '../models';
import { readUser, type AuthedRequest } from '../auth-middleware';

export const exercisesRouter = Router();
exercisesRouter.use(readUser);

exercisesRouter.get('/', async (_req, res) => {
  const docs = await Exercise.find().sort({ order: 1 }).lean();
  res.json({
    exercises: docs.map((d) => ({ id: String(d._id), title: d.title, brief: d.brief })),
  });
});

exercisesRouter.get('/:id', async (req, res) => {
  const doc = await Exercise.findById(req.params.id).lean();
  if (!doc) {
    res.status(404).json({ error: 'No such exercise.' });
    return;
  }
  res.json({ id: String(doc._id), title: doc.title, brief: doc.brief });
});

/**
 * Grading runs the student's wiring through the same solver the browser uses,
 * so a pass cannot be manufactured on the client.
 */
exercisesRouter.post('/:id/grade', async (req: AuthedRequest, res) => {
  const doc = await Exercise.findById(req.params.id).lean();
  if (!doc) {
    res.status(404).json({ error: 'No such exercise.' });
    return;
  }
  const circuit = req.body?.circuit as Circuit | undefined;
  if (!circuit?.modules || !circuit?.wires) {
    res.status(400).json({ error: 'Send the circuit you want graded.' });
    return;
  }

  const result = runScript(circuit, doc.script as ScriptStep[]);
  if (req.userId) {
    await Attempt.create({
      userId: req.userId,
      exerciseId: doc._id,
      passed: result.passed,
      results: result.results,
    });
  }
  res.json(result);
});
