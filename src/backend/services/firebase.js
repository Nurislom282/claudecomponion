import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let db;
let messaging;

export function initFirebase() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (serviceAccountPath) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }

  db = admin.firestore();
  messaging = admin.messaging();
  return { db, messaging };
}

export function getDb() {
  return db;
}

export function getMessaging() {
  return messaging;
}

export async function sendPushNotification(fcmToken, title, body, data = {}) {
  const message = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    token: fcmToken,
    android: {
      priority: 'high',
      notification: {
        channelId: 'claude-companion',
        sound: 'default',
      },
    },
  };

  return messaging.send(message);
}

export async function sendToTopic(topic, title, body, data = {}) {
  const message = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    topic,
    android: {
      priority: 'high',
      notification: {
        channelId: 'claude-companion',
        sound: 'default',
      },
    },
  };

  return messaging.send(message);
}
