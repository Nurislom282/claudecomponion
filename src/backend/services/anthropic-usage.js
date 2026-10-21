import Anthropic from '@anthropic-ai/sdk';

let client;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function getUsageSummary() {
  // The Anthropic admin API provides organization usage data
  // This uses the beta admin endpoints when available
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const res = await fetch('https://api.anthropic.com/v1/usage', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2024-01-01',
      },
    });

    if (res.ok) {
      return await res.json();
    }

    return buildLocalUsageSummary();
  } catch {
    return buildLocalUsageSummary();
  }
}

function buildLocalUsageSummary() {
  // When API usage endpoint is unavailable, return tracked local data
  return {
    source: 'local',
    message: 'Using locally tracked usage data. Configure ANTHROPIC_API_KEY with admin access for full account usage.',
  };
}

export async function getLocalUsage(db) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const snapshot = await db
    .collection('usage')
    .where('timestamp', '>=', monthStart)
    .orderBy('timestamp', 'desc')
    .get();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  const sessions = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    totalInputTokens += data.inputTokens || 0;
    totalOutputTokens += data.outputTokens || 0;
    totalCost += data.estimatedCost || 0;
    sessions.push({ id: doc.id, ...data });
  });

  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    source: 'local',
    period: {
      start: monthStart.toISOString(),
      end: resetDate.toISOString(),
      daysRemaining: Math.ceil((resetDate - now) / 86400000),
    },
    totals: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost: Math.round(totalCost * 100) / 100,
    },
    sessionCount: sessions.length,
    recentSessions: sessions.slice(0, 10),
  };
}

export function estimateCost(inputTokens, outputTokens, model = 'claude-sonnet-4-20250514') {
  const pricing = {
    'claude-opus-4-20250514': { input: 15, output: 75 },
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
  };

  const rate = pricing[model] || pricing['claude-sonnet-4-20250514'];
  return ((inputTokens * rate.input) + (outputTokens * rate.output)) / 1_000_000;
}
