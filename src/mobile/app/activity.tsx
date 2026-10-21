import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getActivity,
  getSessions,
  endSession,
  type Activity,
  type Session,
} from '../services/api';
import { wsService } from '../services/websocket';

const TOOL_ICONS: Record<string, { icon: string; color: string }> = {
  Bash: { icon: 'terminal', color: '#e17055' },
  Edit: { icon: 'create', color: '#6c5ce7' },
  Write: { icon: 'document-text', color: '#00b894' },
  Read: { icon: 'eye', color: '#0984e3' },
  Agent: { icon: 'people', color: '#fdcb6e' },
  WebFetch: { icon: 'globe', color: '#00cec9' },
  default: { icon: 'code-slash', color: '#888' },
};

export default function ActivityScreen() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        getActivity(selectedSession || undefined),
        getSessions(),
      ]);
      setActivities(a);
      setSessions(s);
    } catch (err) {
      console.log('Failed to load activity:', err);
    }
  }, [selectedSession]);

  useEffect(() => {
    loadData();
    const unsub1 = wsService.on('activity:new', loadData);
    const unsub2 = wsService.on('session:started', loadData);
    const unsub3 = wsService.on('session:updated', loadData);
    const interval = setInterval(loadData, 10000);
    return () => { unsub1(); unsub2(); unsub3(); clearInterval(interval); };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleEndSession = (id: string) => {
    Alert.alert('End Session', `End session ${id.slice(0, 12)}...?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          try {
            await endSession(id);
            loadData();
          } catch {
            Alert.alert('Error', 'Failed to end session');
          }
        },
      },
    ]);
  };

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {/* Active Sessions Control */}
      <Text style={styles.sectionTitle}>Active Sessions</Text>
      {activeSessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="terminal-outline" size={32} color="#444" />
          <Text style={styles.emptyText}>No active sessions</Text>
        </View>
      ) : (
        activeSessions.map((s) => (
          <View key={s.sessionId} style={styles.sessionCard}>
            <View style={styles.sessionTop}>
              <View style={styles.sessionLeft}>
                <View style={styles.sessionDot} />
                <View>
                  <Text style={styles.sessionId}>{s.sessionId.slice(0, 16)}...</Text>
                  <View style={styles.sessionMeta}>
                    <Ionicons name="folder-outline" size={11} color="#888" />
                    <Text style={styles.sessionDir} numberOfLines={1}>
                      {s.workingDir?.split('/').slice(-2).join('/') || 'Unknown'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.sessionRight}>
                <View style={styles.modelTag}>
                  <Text style={styles.modelText}>{s.model}</Text>
                </View>
                <TouchableOpacity
                  style={styles.endBtn}
                  onPress={() => handleEndSession(s.sessionId)}
                >
                  <Ionicons name="stop-circle" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Session filter */}
            <TouchableOpacity
              style={[
                styles.filterBtn,
                selectedSession === s.sessionId && styles.filterBtnActive,
              ]}
              onPress={() =>
                setSelectedSession(
                  selectedSession === s.sessionId ? null : s.sessionId
                )
              }
            >
              <Ionicons
                name={selectedSession === s.sessionId ? 'funnel' : 'funnel-outline'}
                size={14}
                color={selectedSession === s.sessionId ? '#6c5ce7' : '#888'}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedSession === s.sessionId && styles.filterTextActive,
                ]}
              >
                {selectedSession === s.sessionId ? 'Showing activity' : 'Filter activity'}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Live Activity Feed */}
      <View style={styles.feedHeader}>
        <Text style={styles.sectionTitle}>Live Activity</Text>
        <View style={styles.liveDot}>
          <View style={styles.liveDotInner} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {activities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="pulse-outline" size={40} color="#444" />
          <Text style={styles.emptyText}>No activity yet</Text>
          <Text style={styles.emptySubtext}>
            Install hooks to see Claude's actions in real-time
          </Text>
        </View>
      ) : (
        activities.map((a, i) => {
          const toolInfo = TOOL_ICONS[a.tool] || TOOL_ICONS.default;
          return (
            <View key={a.activityId || i} style={styles.activityCard}>
              <View style={styles.activityLeft}>
                <View style={[styles.activityIcon, { backgroundColor: toolInfo.color + '22' }]}>
                  <Ionicons name={toolInfo.icon as any} size={16} color={toolInfo.color} />
                </View>
                {i < activities.length - 1 && <View style={styles.activityLine} />}
              </View>
              <View style={styles.activityContent}>
                <View style={styles.activityTop}>
                  <Text style={styles.activityTool}>{a.tool || a.type}</Text>
                  <Text style={styles.activityTime}>{timeAgo(a.createdAt)}</Text>
                </View>
                {a.message ? (
                  <Text style={styles.activityMessage} numberOfLines={2}>
                    {a.message}
                  </Text>
                ) : null}
                {a.filePath ? (
                  <View style={styles.fileRow}>
                    <Ionicons name="document-outline" size={11} color="#888" />
                    <Text style={styles.filePath} numberOfLines={1}>{a.filePath}</Text>
                  </View>
                ) : null}
                {a.command ? (
                  <View style={styles.commandBox}>
                    <Text style={styles.commandText} numberOfLines={2}>$ {a.command}</Text>
                  </View>
                ) : null}
                {a.content ? (
                  <Text style={styles.contentPreview} numberOfLines={3}>{a.content}</Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },

  sessionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00b894', marginRight: 10 },
  sessionId: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sessionDir: { color: '#888', fontSize: 11 },
  sessionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modelTag: { backgroundColor: '#6c5ce722', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modelText: { color: '#6c5ce7', fontSize: 11, fontWeight: '600' },
  endBtn: { padding: 4 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  filterBtnActive: {},
  filterText: { color: '#888', fontSize: 12 },
  filterTextActive: { color: '#6c5ce7' },

  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e74c3c' },
  liveText: { color: '#e74c3c', fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 12,
  },
  emptyText: { color: '#555', fontSize: 15, fontWeight: '600', marginTop: 10 },
  emptySubtext: { color: '#444', fontSize: 12, marginTop: 4, textAlign: 'center' },

  activityCard: { flexDirection: 'row', marginBottom: 4 },
  activityLeft: { alignItems: 'center', width: 36, marginRight: 10 },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityLine: { width: 2, flex: 1, backgroundColor: '#2d2d44', marginVertical: 4 },
  activityContent: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  activityTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  activityTool: { color: '#fff', fontSize: 13, fontWeight: '600' },
  activityTime: { color: '#666', fontSize: 10 },
  activityMessage: { color: '#ccc', fontSize: 12, lineHeight: 18 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  filePath: { color: '#6c5ce7', fontSize: 11, flex: 1 },
  commandBox: {
    backgroundColor: '#0f0f23',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  commandText: { color: '#e17055', fontSize: 11, fontFamily: 'monospace' },
  contentPreview: { color: '#888', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
});
