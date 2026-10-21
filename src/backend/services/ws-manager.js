import { WebSocketServer } from 'ws';

export class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Map();

    this.wss.on('connection', (ws, req) => {
      const deviceId = new URL(req.url, 'http://localhost').searchParams.get('deviceId');
      if (deviceId) {
        this.clients.set(deviceId, ws);
        ws.on('close', () => this.clients.delete(deviceId));
      }

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          this.handleMessage(ws, msg);
        } catch { /* ignore malformed */ }
      });
    });
  }

  handleMessage(ws, msg) {
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    }
  }

  broadcast(event, data) {
    const payload = JSON.stringify({ type: event, data, timestamp: Date.now() });
    for (const ws of this.clients.values()) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  sendTo(deviceId, event, data) {
    const ws = this.clients.get(deviceId);
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: event, data, timestamp: Date.now() }));
      return true;
    }
    return false;
  }
}
