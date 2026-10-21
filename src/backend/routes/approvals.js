import { Router } from 'express';
import { getDb, sendToTopic } from '../services/firebase.js';
import { v4 as uuid } from 'uuid';

export const approvalsRouter = Router();

// Claude Code hook posts an approval request here
approvalsRouter.post('/', async (req, res) => {
  const { sessionId, toolName, description, command, filePath, riskLevel } = req.body;
  if (!sessionId || !toolName) {
    return res.status(400).json({ error: 'sessionId and toolName required' });
  }

  const db = getDb();
  const approvalId = uuid();

  const doc = {
    approvalId,
    sessionId,
    toolName,
    description: description || '',
    command: command || '',
    filePath: filePath || '',
    riskLevel: riskLevel || 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
    decision: null,
    decidedAt: null,
  };

  await db.collection('approvals').doc(approvalId).set(doc);

  const notifTitle = riskLevel === 'high'
    ? `[HIGH RISK] Approval needed: ${toolName}`
    : `Approval needed: ${toolName}`;

  try {
    await sendToTopic('approvals', notifTitle, description || command || toolName, {
      approvalId,
      sessionId,
      toolName,
      riskLevel: riskLevel || 'normal',
      type: 'approval',
    });
  } catch { /* non-fatal */ }

  req.app.get('wsManager')?.broadcast('approval:new', doc);
  res.json(doc);
});

// Mobile app approves or denies
approvalsRouter.post('/:id/decide', async (req, res) => {
  const { decision } = req.body;
  if (!['approved', 'denied'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "approved" or "denied"' });
  }

  const db = getDb();
  const ref = db.collection('approvals').doc(req.params.id);
  const doc = await ref.get();

  if (!doc.exists) return res.status(404).json({ error: 'Approval not found' });
  if (doc.data().status !== 'pending') {
    return res.status(409).json({ error: 'Already decided' });
  }

  await ref.update({
    decision,
    status: decision,
    decidedAt: new Date().toISOString(),
  });

  const updated = { approvalId: req.params.id, decision, sessionId: doc.data().sessionId };
  req.app.get('wsManager')?.broadcast('approval:decided', updated);
  res.json(updated);
});

// Get pending approvals
approvalsRouter.get('/pending', async (_req, res) => {
  const db = getDb();
  const snapshot = await db
    .collection('approvals')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get();

  const approvals = [];
  snapshot.forEach((doc) => approvals.push({ id: doc.id, ...doc.data() }));
  res.json(approvals);
});

// Bulk approve all pending
approvalsRouter.post('/approve-all', async (_req, res) => {
  const db = getDb();
  const snapshot = await db
    .collection('approvals')
    .where('status', '==', 'pending')
    .get();

  const batch = db.batch();
  const now = new Date().toISOString();
  const ids = [];

  snapshot.forEach((doc) => {
    batch.update(doc.ref, { decision: 'approved', status: 'approved', decidedAt: now });
    ids.push(doc.id);
  });

  await batch.commit();
  res.json({ approved: ids.length, ids });
});

// Poll for decision (used by Claude Code hook)
approvalsRouter.get('/:id/poll', async (req, res) => {
  const db = getDb();
  const doc = await db.collection('approvals').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });

  const data = doc.data();
  res.json({
    status: data.status,
    decision: data.decision,
    decidedAt: data.decidedAt,
  });
});
