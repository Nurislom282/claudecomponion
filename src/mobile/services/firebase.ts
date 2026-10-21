import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

let app: FirebaseApp | null = null;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCqiiRPVzFwYCuOm9rmdZ31JcEHu2o0YW4',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'myproject-51d82.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'myproject-51d82',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'myproject-51d82.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1029053181595',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:1029053181595:web:7337b7222c916b54ed203e',
};

export function initFirebaseClient() {
  if (getApps().length === 0 && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
  } else if (getApps().length > 0) {
    app = getApps()[0];
  }
  return app;
}

export function getFirestoreDb() {
  const firebaseApp = app || initFirebaseClient();
  if (!firebaseApp) return null;
  return getFirestore(firebaseApp);
}

export function subscribeToPendingQuestions(
  callback: (questions: any[]) => void
): Unsubscribe | null {
  const db = getFirestoreDb();
  if (!db) return null;

  const q = query(
    collection(db, 'questions'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const questions: any[] = [];
    snapshot.forEach((doc) => questions.push({ id: doc.id, ...doc.data() }));
    callback(questions);
  });
}

export function subscribeToPendingApprovals(
  callback: (approvals: any[]) => void
): Unsubscribe | null {
  const db = getFirestoreDb();
  if (!db) return null;

  const q = query(
    collection(db, 'approvals'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const approvals: any[] = [];
    snapshot.forEach((doc) => approvals.push({ id: doc.id, ...doc.data() }));
    callback(approvals);
  });
}

export function subscribeToSessions(
  callback: (sessions: any[]) => void
): Unsubscribe | null {
  const db = getFirestoreDb();
  if (!db) return null;

  const q = query(
    collection(db, 'sessions'),
    where('status', '==', 'active'),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const sessions: any[] = [];
    snapshot.forEach((doc) => sessions.push({ id: doc.id, ...doc.data() }));
    callback(sessions);
  });
}
