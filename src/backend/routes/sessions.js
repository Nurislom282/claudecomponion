import { Router } from 'express';
import { getDb } from '../services/firebase.js';

export const sessionsRouter = Router();

sessionsRouter.post('/', async (req, res) => {
  const { sessionId, workingDir, startedAt, model } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const db = getDb();
  const doc = {
    sessionId,
    workingDir: workingDir || '',
    model: model || 'unknown',
    status: 'active',
    startedAt: startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pendingQuestions: 0,
    pendingApprovals: 0,
  };

  await db.collection('sessions').doc(sessionId).set(doc, { merge: true });
  req.app.get('wsManager')?.broadcast('session:started', doc);
  res.json(doc);
});

sessionsRouter.get('/', async (_req, res) => {
  try {
    const db = getDb();
    const snapshot = await db
      .collection('sessions')
      .limit(50)
      .get();

    const sessions = [];
    snapshot.forEach((doc) => sessions.push({ id: doc.id, ...doc.data() }));
    sessions.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    res.json(sessions);
  } catch (err) {
    console.error('Error fetching sessions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

sessionsRouter.get('/:id', async (req, res) => {
  const db = getDb();
  const doc = await db.collection('sessions').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Session not found' });
  res.json({ id: doc.id, ...doc.data() });
});

sessionsRouter.patch('/:id', async (req, res) => {
  const db = getDb();
  const updates = { ...req.body, updatedAt: new Date().toISOString() };
  await db.collection('sessions').doc(req.params.id).update(updates);
  req.app.get('wsManager')?.broadcast('session:updated', { sessionId: req.params.id, ...updates });
  res.json({ ok: true });
});

sessionsRouter.post('/:id/heartbeat', async (req, res) => {
  const db = getDb();
  const { inputTokens, outputTokens } = req.body;
  await db.collection('sessions').doc(req.params.id).update({
    updatedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    ...(inputTokens != null && { inputTokens }),
    ...(outputTokens != null && { outputTokens }),
  });
  res.json({ ok: true });
});
