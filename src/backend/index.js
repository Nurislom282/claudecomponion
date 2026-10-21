import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import { initFirebase } from './services/firebase.js';
import { sessionsRouter } from './routes/sessions.js';
import { questionsRouter } from './routes/questions.js';
import { approvalsRouter } from './routes/approvals.js';
import { usageRouter } from './routes/usage.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

initFirebase();

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.use('/api', authMiddleware);
app.use('/api/sessions', sessionsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/usage', usageRouter);

export const companion = onRequest({ region: 'us-central1', memory: '256MiB' }, app);
