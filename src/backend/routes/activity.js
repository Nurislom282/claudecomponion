import { Router } from 'express';
import { getDb } from '../services/firebase.js';
import { v4 as uuid } from 'uuid';

export const activityRouter = Router();

// Hook posts activity here
activityRouter.post('/', async (req, res) => {
  const { sessionId, type, tool, message, filePath, command, content } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const db = getDb();
  const activityId = uuid();

  const doc = {
    activityId,
    sessionId,
    type: type || 'tool_use',
    tool: tool || '',
    message: message || '',
    filePath: filePath || '',
    command: command || '',
    content: (content || '').slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  await db.collection('activity').doc(activityId).set(doc);

  try {
    await db.collection('sessions').doc(sessionId).update({
      lastActivity: doc.message || doc.tool,
      updatedAt: new Date().toISOString(),
    });
  } catch { /* session may not exist */ }

  req.app.get('wsManager')?.broadcast('activity:new', doc);
  res.json(doc);
});

// Get recent activity (optionally filtered by session)
activityRouter.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { sessionId, limit: lim } = req.query;
    const max = Math.min(parseInt(lim) || 50, 200);

    let query = db.collection('activity');
    if (sessionId) {
      query = query.where('sessionId', '==', sessionId);
    }
    const snapshot = await query.limit(max).get();

    const items = [];
    snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(items);
  } catch (err) {
    console.error('Error fetching activity:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear activity for a session
activityRouter.delete('/:sessionId', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db
      .collection('activity')
      .where('sessionId', '==', req.params.sessionId)
      .get();

    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    res.json({ deleted: snapshot.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
