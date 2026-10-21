import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUsage, getWidgetData, type UsageData, type WidgetData } from '../services/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function UsageScreen() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [widget, setWidget] = useState<WidgetData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [u, w] = await Promise.all([getUsage(), getWidgetData()]);
      setUsage(u);
      setWidget(w);
    } catch (err) {
      console.log('Failed to load usage:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalTokens = widget?.tokens?.total || 0;
  const inputTokens = widget?.tokens?.input || 0;
  const outputTokens = widget?.tokens?.output || 0;
  const cost = widget?.tokens?.cost || 0;
  const daysRemaining = widget?.period?.daysRemaining || 0;

  const inputRatio = totalTokens > 0 ? inputTokens / totalTokens : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {/* Token Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Period</Text>
        <Text style={styles.bigNumber}>{formatNumber(totalTokens)}</Text>
        <Text style={styles.bigLabel}>total tokens</Text>

        {/* Token bar */}
        <View style={styles.tokenBar}>
          <View style={[styles.tokenBarInput, { flex: inputRatio }]} />
          <View style={[styles.tokenBarOutput, { flex: 1 - inputRatio }]} />
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6c5ce7' }]} />
            <Text style={styles.legendText}>Input: {formatNumber(inputTokens)}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#e17055' }]} />
            <Text style={styles.legendText}>Output: {formatNumber(outputTokens)}</Text>
          </View>
        </View>
      </View>

      {/* Cost & Reset */}
      <View style={styles.row}>
        <View style={[styles.card, styles.halfCard]}>
          <Ionicons name="wallet-outline" size={24} color="#00b894" />
          <Text style={styles.metricValue}>${cost.toFixed(2)}</Text>
          <Text style={styles.metricLabel}>Estimated Cost</Text>
        </View>
        <View style={[styles.card, styles.halfCard]}>
          <Ionicons name="time-outline" size={24} color="#6c5ce7" />
          <Text style={styles.metricValue}>{daysRemaining}</Text>
          <Text style={styles.metricLabel}>Days Until Reset</Text>
        </View>
      </View>

      {/* Session Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Activity</Text>
        <View style={styles.statsGrid}>
          <StatItem icon="terminal" value={widget?.activeSessions || 0} label="Active" color="#00b894" />
          <StatItem icon="chatbubble-ellipses" value={widget?.pendingQuestions || 0} label="Questions" color="#6c5ce7" />
          <StatItem icon="shield-checkmark" value={widget?.pendingApprovals || 0} label="Approvals" color="#e17055" />
        </View>
      </View>

      {/* Recent Usage */}
      {usage?.local?.recentSessions?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Sessions</Text>
          {usage.local.recentSessions.slice(0, 5).map((s: any, i: number) => (
            <View key={i} style={styles.historyRow}>
              <View style={styles.historyInfo}>
                <Text style={styles.historySession} numberOfLines={1}>
                  {s.sessionId?.slice(0, 16) || 'Unknown'}
                </Text>
                <Text style={styles.historyTokens}>
                  {formatNumber(s.inputTokens || 0)} in · {formatNumber(s.outputTokens || 0)} out
                </Text>
              </View>
              <Text style={styles.historyCost}>
                ${(s.estimatedCost || 0).toFixed(3)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Reset Info */}
      {widget?.period && (
        <View style={styles.resetInfo}>
          <Text style={styles.resetText}>
            Period: {new Date(widget.period.start).toLocaleDateString()} —{' '}
            {new Date(widget.period.end).toLocaleDateString()}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatItem({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  bigNumber: { color: '#fff', fontSize: 40, fontWeight: '800', textAlign: 'center' },
  bigLabel: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  tokenBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#2d2d44',
  },
  tokenBarInput: { backgroundColor: '#6c5ce7', borderRadius: 4 },
  tokenBarOutput: { backgroundColor: '#e17055', borderRadius: 4 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#888', fontSize: 12 },
  row: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1, alignItems: 'center' },
  metricValue: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 8 },
  metricLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  historyInfo: { flex: 1 },
  historySession: { color: '#ccc', fontSize: 13 },
  historyTokens: { color: '#888', fontSize: 11, marginTop: 2 },
  historyCost: { color: '#00b894', fontSize: 14, fontWeight: '600' },
  resetInfo: { alignItems: 'center', marginVertical: 16 },
  resetText: { color: '#666', fontSize: 12 },
});
