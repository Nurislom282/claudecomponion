import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import { initFirebase } from './services/firebase.js';
import { sessionsRouter } from './routes/sessions.js';
import { questionsRouter } from './routes/questions.js';
import { approvalsRouter } from './routes/approvals.js';
import { usageRouter } from './routes/usage.js';
import { authMiddleware } from './middleware/auth.js';
import { WebSocketManager } from './services/ws-manager.js';

config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3847;

app.use(cors());
app.use(express.json());

initFirebase();

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.use('/api', authMiddleware);
app.use('/api/sessions', sessionsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/usage', usageRouter);

const wsManager = new WebSocketManager(server);
app.set('wsManager', wsManager);

server.listen(PORT, () => {
  console.log(`Claude Companion API running on port ${PORT}`);
  console.log(`WebSocket available on ws://localhost:${PORT}`);
});

export { app, wsManager };
