import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:3847'
  : 'https://claudecomponion.onrender.com';

let apiSecret = '1df346d299f1fafb112b948645208100d81697bf2c04b7d1';

export function setApiSecret(secret: string) {
  apiSecret = secret;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiSecret ? { Authorization: `Bearer ${apiSecret}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json();
}

// Sessions
export const getSessions = () => request<Session[]>('/sessions');
export const getSession = (id: string) => request<Session>(`/sessions/${id}`);

// Questions
export const getPendingQuestions = () => request<Question[]>('/questions/pending');
export const answerQuestion = (id: string, answer: string) =>
  request(`/questions/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });

// Approvals
export const getPendingApprovals = () => request<Approval[]>('/approvals/pending');
export const decideApproval = (id: string, decision: 'approved' | 'denied') =>
  request(`/approvals/${id}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
export const approveAll = () =>
  request<{ approved: number }>('/approvals/approve-all', { method: 'POST' });

// Usage
export const getUsage = () => request<UsageData>('/usage');
export const getWidgetData = () => request<WidgetData>('/usage/widget');

// Activity
export const getActivity = (sessionId?: string) =>
  request<Activity[]>(`/activity${sessionId ? `?sessionId=${sessionId}` : ''}`);

// Session control
export const endSession = (id: string) =>
  request(`/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ended' }),
  });

// Types
export interface Session {
  sessionId: string;
  workingDir: string;
  model: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  pendingQuestions: number;
  pendingApprovals: number;
}

export interface Question {
  questionId: string;
  sessionId: string;
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
  status: string;
  createdAt: string;
  answer: string | null;
}

export interface Approval {
  approvalId: string;
  sessionId: string;
  toolName: string;
  description: string;
  command: string;
  filePath: string;
  riskLevel: string;
  status: string;
  createdAt: string;
  decision: string | null;
}

export interface WidgetData {
  tokens: {
    input: number;
    output: number;
    total: number;
    cost: number;
  };
  period: {
    start: string;
    end: string;
    daysRemaining: number;
  } | null;
  activeSessions: number;
  pendingQuestions: number;
  pendingApprovals: number;
  timestamp: string;
}

export interface Activity {
  activityId: string;
  sessionId: string;
  type: string;
  tool: string;
  message: string;
  filePath: string;
  command: string;
  content: string;
  createdAt: string;
}

export interface UsageData {
  api: any;
  local: any;
  timestamp: string;
}
