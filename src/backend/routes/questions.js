import { Router } from 'express';
import { getDb, sendToTopic } from '../services/firebase.js';
import { v4 as uuid } from 'uuid';

export const questionsRouter = Router();

// Claude Code hook posts a question here
questionsRouter.post('/', async (req, res) => {
  const { sessionId, question, options, header, multiSelect } = req.body;
  if (!sessionId || !question) {
    return res.status(400).json({ error: 'sessionId and question required' });
  }

  const db = getDb();
  const questionId = uuid();

  const doc = {
    questionId,
    sessionId,
    question,
    header: header || '',
    options: options || [],
    multiSelect: multiSelect || false,
    status: 'pending',
    createdAt: new Date().toISOString(),
    answer: null,
    answeredAt: null,
  };

  await db.collection('questions').doc(questionId).set(doc);

  await db.collection('sessions').doc(sessionId).update({
    pendingQuestions: (await getPendingCount(db, sessionId, 'questions')) + 1,
    updatedAt: new Date().toISOString(),
  });

  try {
    await sendToTopic('questions', 'Claude needs your input', question, {
      questionId,
      sessionId,
      type: 'question',
    });
  } catch { /* notification failure is non-fatal */ }

  req.app.get('wsManager')?.broadcast('question:new', doc);
  res.json(doc);
});

// Mobile app posts an answer here
questionsRouter.post('/:id/answer', async (req, res) => {
  const { answer } = req.body;
  if (answer == null) return res.status(400).json({ error: 'answer required' });

  const db = getDb();
  const ref = db.collection('questions').doc(req.params.id);
  const doc = await ref.get();

  if (!doc.exists) return res.status(404).json({ error: 'Question not found' });
  if (doc.data().status !== 'pending') {
    return res.status(409).json({ error: 'Question already answered' });
  }

  await ref.update({
    answer,
    status: 'answered',
    answeredAt: new Date().toISOString(),
  });

  const sessionId = doc.data().sessionId;
  await db.collection('sessions').doc(sessionId).update({
    pendingQuestions: Math.max(0, (await getPendingCount(db, sessionId, 'questions'))),
    updatedAt: new Date().toISOString(),
  });

  const updated = { questionId: req.params.id, answer, sessionId };
  req.app.get('wsManager')?.broadcast('question:answered', updated);
  res.json(updated);
});

// Get pending questions
questionsRouter.get('/pending', async (_req, res) => {
  const db = getDb();
  const snapshot = await db
    .collection('questions')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get();

  const questions = [];
  snapshot.forEach((doc) => questions.push({ id: doc.id, ...doc.data() }));
  res.json(questions);
});

// Poll for answer (used by Claude Code hook)
questionsRouter.get('/:id/poll', async (req, res) => {
  const db = getDb();
  const doc = await db.collection('questions').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });

  const data = doc.data();
  res.json({
    status: data.status,
    answer: data.answer,
    answeredAt: data.answeredAt,
  });
});

async function getPendingCount(db, sessionId, collection) {
  const snapshot = await db
    .collection(collection)
    .where('sessionId', '==', sessionId)
    .where('status', '==', 'pending')
    .get();
  return snapshot.size;
}
