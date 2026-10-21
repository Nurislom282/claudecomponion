import { Router } from 'express';
import { getDb } from '../services/firebase.js';
import { getUsageSummary, getLocalUsage, estimateCost } from '../services/anthropic-usage.js';

export const usageRouter = Router();

// Get combined usage (API + local tracking)
usageRouter.get('/', async (_req, res) => {
  const db = getDb();
  const [apiUsage, localUsage] = await Promise.all([
    getUsageSummary().catch(() => null),
    getLocalUsage(db).catch(() => null),
  ]);

  res.json({
    api: apiUsage,
    local: localUsage,
    timestamp: new Date().toISOString(),
  });
});

// Get widget data (compact format for Android widget)
usageRouter.get('/widget', async (_req, res) => {
  const db = getDb();
  const localUsage = await getLocalUsage(db);

  const activeSessions = await db
    .collection('sessions')
    .where('status', '==', 'active')
    .get();

  const pendingQuestions = await db
    .collection('questions')
    .where('status', '==', 'pending')
    .get();

  const pendingApprovals = await db
    .collection('approvals')
    .where('status', '==', 'pending')
    .get();

  res.json({
    tokens: {
      input: localUsage?.totals?.inputTokens || 0,
      output: localUsage?.totals?.outputTokens || 0,
      total: localUsage?.totals?.totalTokens || 0,
      cost: localUsage?.totals?.estimatedCost || 0,
    },
    period: localUsage?.period || null,
    activeSessions: activeSessions.size,
    pendingQuestions: pendingQuestions.size,
    pendingApprovals: pendingApprovals.size,
    timestamp: new Date().toISOString(),
  });
});

// Track usage from a session (called by hooks)
usageRouter.post('/track', async (req, res) => {
  const { sessionId, inputTokens, outputTokens, model, tool } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const db = getDb();
  const cost = estimateCost(inputTokens || 0, outputTokens || 0, model);

  await db.collection('usage').add({
    sessionId,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    model: model || 'unknown',
    tool: tool || null,
    estimatedCost: cost,
    timestamp: new Date(),
  });

  req.app.get('wsManager')?.broadcast('usage:updated', {
    sessionId,
    inputTokens,
    outputTokens,
    cost,
  });

  res.json({ ok: true, estimatedCost: cost });
});

// Get usage history
usageRouter.get('/history', async (req, res) => {
  const db = getDb();
  const days = parseInt(req.query.days) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshot = await db
    .collection('usage')
    .where('timestamp', '>=', since)
    .orderBy('timestamp', 'desc')
    .limit(500)
    .get();

  const entries = [];
  snapshot.forEach((doc) => entries.push({ id: doc.id, ...doc.data() }));
  res.json(entries);
});
