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
import { useNavigation } from '@react-navigation/native';
import { getWidgetData, getSessions, type WidgetData, type Session } from '../services/api';
import { wsService } from '../services/websocket';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
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
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); clearInterval(interval); };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const inputTokens = widget?.tokens.input || 0;
  const outputTokens = widget?.tokens.output || 0;
  const totalTokens = inputTokens + outputTokens;
  const cost = widget?.tokens.cost || 0;
  const daysRemaining = widget?.period?.daysRemaining || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, { backgroundColor: connected ? '#00b894' : '#e74c3c' }]} />
          <Text style={styles.statusLabel}>{connected ? 'Connected' : 'Offline'}</Text>
        </View>
        <Text style={styles.statusEmail}>shellwindon@gmail.com</Text>
      </View>

      {/* Main Usage Card */}
      <View style={styles.usageCard}>
        <View style={styles.usageHeader}>
          <Ionicons name="speedometer" size={22} color="#6c5ce7" />
          <Text style={styles.usageTitle}>Token Usage</Text>
        </View>
        <Text style={styles.totalTokens}>{formatNumber(totalTokens)}</Text>
        <Text style={styles.totalLabel}>total tokens this period</Text>

        <View style={styles.progressBarBg}>
          <View style={[
            styles.progressBarInput,
            { flex: totalTokens > 0 ? inputTokens / totalTokens : 0.5 }
          ]} />
          <View style={[
            styles.progressBarOutput,
            { flex: totalTokens > 0 ? outputTokens / totalTokens : 0.5 }
          ]} />
        </View>

        <View style={styles.tokenBreakdown}>
          <View style={styles.tokenItem}>
            <View style={[styles.tokenDot, { backgroundColor: '#6c5ce7' }]} />
            <Text style={styles.tokenItemLabel}>Input</Text>
            <Text style={styles.tokenItemValue}>{formatNumber(inputTokens)}</Text>
          </View>
          <View style={styles.tokenItem}>
            <View style={[styles.tokenDot, { backgroundColor: '#e17055' }]} />
            <Text style={styles.tokenItemLabel}>Output</Text>
            <Text style={styles.tokenItemValue}>{formatNumber(outputTokens)}</Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="card-outline" size={24} color="#00b894" />
          <Text style={styles.statValue}>${cost.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Estimated Cost</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={24} color="#fdcb6e" />
          <Text style={styles.statValue}>{daysRemaining}</Text>
          <Text style={styles.statLabel}>Days Until Reset</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('questions')}>
          <View style={[styles.actionIconBg, { backgroundColor: '#6c5ce722' }]}>
            <Ionicons name="chatbubble-ellipses" size={28} color="#6c5ce7" />
            {(widget?.pendingQuestions || 0) > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{widget?.pendingQuestions}</Text>
              </View>
            )}
          </View>
          <Text style={styles.actionTitle}>Questions</Text>
          <Text style={styles.actionSub}>
            {widget?.pendingQuestions ? `${widget.pendingQuestions} pending` : 'None pending'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('approvals')}>
          <View style={[styles.actionIconBg, { backgroundColor: '#e1705522' }]}>
            <Ionicons name="shield-checkmark" size={28} color="#e17055" />
            {(widget?.pendingApprovals || 0) > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{widget?.pendingApprovals}</Text>
              </View>
            )}
          </View>
          <Text style={styles.actionTitle}>Approvals</Text>
          <Text style={styles.actionSub}>
            {widget?.pendingApprovals ? `${widget.pendingApprovals} pending` : 'None pending'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Sessions */}
      <View style={styles.sessionsHeader}>
        <Text style={styles.sectionTitle}>Active Sessions</Text>
        <View style={styles.sessionCount}>
          <Ionicons name="pulse" size={14} color="#00b894" />
          <Text style={styles.sessionCountText}>{widget?.activeSessions || 0}</Text>
        </View>
      </View>

      {sessions.filter((s) => s.status === 'active').length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="terminal-outline" size={40} color="#333" />
          <Text style={styles.emptyTitle}>No active sessions</Text>
          <Text style={styles.emptySub}>Sessions will appear when Claude Code is running</Text>
        </View>
      ) : (
        sessions
          .filter((s) => s.status === 'active')
          .map((session) => (
            <View key={session.sessionId} style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <View style={styles.sessionIconBg}>
                  <Ionicons name="terminal" size={20} color="#6c5ce7" />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionId} numberOfLines={1}>
                    {session.sessionId.slice(0, 16)}...
                  </Text>
                  <View style={styles.sessionMeta}>
                    <Ionicons name="folder-outline" size={12} color="#888" />
                    <Text style={styles.sessionDir} numberOfLines={1}>
                      {session.workingDir || 'Unknown'}
                    </Text>
                  </View>
                </View>
                <View style={styles.modelBadge}>
                  <Text style={styles.modelText}>{session.model}</Text>
                </View>
              </View>
              {(session.pendingQuestions > 0 || session.pendingApprovals > 0) && (
                <View style={styles.sessionBadges}>
                  {session.pendingQuestions > 0 && (
                    <View style={[styles.sBadge, { backgroundColor: '#6c5ce733' }]}>
                      <Ionicons name="chatbubble" size={12} color="#6c5ce7" />
                      <Text style={[styles.sBadgeText, { color: '#6c5ce7' }]}>{session.pendingQuestions}</Text>
                    </View>
                  )}
                  {session.pendingApprovals > 0 && (
                    <View style={[styles.sBadge, { backgroundColor: '#e1705533' }]}>
                      <Ionicons name="shield" size={12} color="#e17055" />
                      <Text style={[styles.sBadgeText, { color: '#e17055' }]}>{session.pendingApprovals}</Text>
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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusLeft: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { color: '#aaa', fontSize: 13 },
  statusEmail: { color: '#666', fontSize: 11 },

  usageCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  usageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  usageTitle: { color: '#aaa', fontSize: 14, fontWeight: '500' },
  totalTokens: { color: '#fff', fontSize: 36, fontWeight: '800', textAlign: 'center' },
  totalLabel: { color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  progressBarBg: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2d2d44',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarInput: { backgroundColor: '#6c5ce7', borderRadius: 3 },
  progressBarOutput: { backgroundColor: '#e17055', borderRadius: 3 },
  tokenBreakdown: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  tokenItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tokenDot: { width: 8, height: 8, borderRadius: 4 },
  tokenItemLabel: { color: '#888', fontSize: 12 },
  tokenItemValue: { color: '#ccc', fontSize: 12, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 8 },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },

  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },

  actionsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  actionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionSub: { color: '#666', fontSize: 11, marginTop: 2 },
  badge: {
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
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  sessionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sessionCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#00b89422', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sessionCountText: { color: '#00b894', fontSize: 12, fontWeight: '600' },

  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  emptyTitle: { color: '#555', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySub: { color: '#444', fontSize: 12, marginTop: 4, textAlign: 'center' },

  sessionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  sessionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6c5ce722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionInfo: { flex: 1, marginLeft: 12 },
  sessionId: { color: '#fff', fontSize: 13, fontWeight: '500' },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sessionDir: { color: '#888', fontSize: 11, flex: 1 },
  modelBadge: { backgroundColor: '#6c5ce722', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  modelText: { color: '#6c5ce7', fontSize: 11, fontWeight: '600' },
  sessionBadges: { flexDirection: 'row', marginTop: 10, gap: 8 },
  sBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sBadgeText: { fontSize: 12, fontWeight: '600' },
});
