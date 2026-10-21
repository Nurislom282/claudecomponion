import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getWidgetData, getSessions, type WidgetData, type Session } from '@/services/api';
import { wsService } from '@/services/websocket';

export default function DashboardScreen() {
  const router = useRouter();
  const [widget, setWidget] = useState<WidgetData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [w, s] = await Promise.all([getWidgetData(), getSessions()]);
      setWidget(w);
      setSessions(s);
    } catch (err) {
      console.log('Failed to load:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub1 = wsService.on('connected', () => setConnected(true));
    const unsub2 = wsService.on('disconnected', () => setConnected(false));
    const unsub3 = wsService.on('question:new', loadData);
    const unsub4 = wsService.on('approval:new', loadData);
    const unsub5 = wsService.on('usage:updated', loadData);

    const interval = setInterval(loadData, 30000);
    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5();
      clearInterval(interval);
    };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: connected ? '#00b894' : '#e74c3c' }]} />
        <Text style={styles.statusText}>{connected ? 'Connected' : 'Offline'}</Text>
      </View>

      {/* Usage Widget */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Token Usage</Text>
        {widget ? (
          <>
            <View style={styles.tokenRow}>
              <TokenStat label="Input" value={widget.tokens.input} />
              <TokenStat label="Output" value={widget.tokens.output} />
              <TokenStat label="Cost" value={`$${widget.tokens.cost.toFixed(2)}`} />
            </View>
            {widget.period && (
              <Text style={styles.resetText}>
                Resets in {widget.period.daysRemaining} days
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>Loading...</Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <ActionButton
          icon="chatbubble-ellipses"
          label="Questions"
          count={widget?.pendingQuestions || 0}
          color="#6c5ce7"
          onPress={() => router.push('/questions')}
        />
        <ActionButton
          icon="shield-checkmark"
          label="Approvals"
          count={widget?.pendingApprovals || 0}
          color="#e17055"
          onPress={() => router.push('/approvals')}
        />
        <ActionButton
          icon="pulse"
          label="Sessions"
          count={widget?.activeSessions || 0}
          color="#00b894"
          onPress={() => {}}
        />
      </View>

      {/* Active Sessions */}
      <Text style={styles.sectionTitle}>Active Sessions</Text>
      {sessions.filter((s) => s.status === 'active').length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No active sessions</Text>
        </View>
      ) : (
        sessions
          .filter((s) => s.status === 'active')
          .map((session) => (
            <View key={session.sessionId} style={styles.card}>
              <View style={styles.sessionRow}>
                <Ionicons name="terminal-outline" size={20} color="#6c5ce7" />
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionId} numberOfLines={1}>
                    {session.sessionId.slice(0, 16)}...
                  </Text>
                  <Text style={styles.sessionDir} numberOfLines={1}>
                    {session.workingDir || 'Unknown directory'}
                  </Text>
                </View>
                <Text style={styles.sessionModel}>{session.model}</Text>
              </View>
              {(session.pendingQuestions > 0 || session.pendingApprovals > 0) && (
                <View style={styles.sessionBadges}>
                  {session.pendingQuestions > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#6c5ce7' }]}>
                      <Text style={styles.badgeText}>{session.pendingQuestions} Q</Text>
                    </View>
                  )}
                  {session.pendingApprovals > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#e17055' }]}>
                      <Text style={styles.badgeText}>{session.pendingApprovals} A</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
      )}
    </ScrollView>
  );
}

function TokenStat({ label, value }: { label: string; value: string | number }) {
  const display = typeof value === 'number' ? formatNumber(value) : value;
  return (
    <View style={styles.tokenStat}>
      <Text style={styles.tokenValue}>{display}</Text>
      <Text style={styles.tokenLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  count,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  count: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
        {count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: '#888', fontSize: 13 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  tokenRow: { flexDirection: 'row', justifyContent: 'space-around' },
  tokenStat: { alignItems: 'center' },
  tokenValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tokenLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  resetText: { color: '#6c5ce7', fontSize: 12, textAlign: 'center', marginTop: 12 },
  emptyText: { color: '#666', textAlign: 'center', fontSize: 14 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    marginTop: 8,
  },
  actionButton: { alignItems: 'center' },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  actionLabel: { color: '#ccc', fontSize: 12, marginTop: 6 },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  sessionInfo: { flex: 1, marginLeft: 12 },
  sessionId: { color: '#fff', fontSize: 14, fontWeight: '500' },
  sessionDir: { color: '#888', fontSize: 12, marginTop: 2 },
  sessionModel: { color: '#6c5ce7', fontSize: 12, fontWeight: '500' },
  sessionBadges: { flexDirection: 'row', marginTop: 8, gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
