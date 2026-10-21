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
  getPendingApprovals,
  decideApproval,
  approveAll,
  type Approval,
} from '../services/api';
import { wsService } from '../services/websocket';

export default function ApprovalsScreen() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadApprovals = useCallback(async () => {
    try {
      const data = await getPendingApprovals();
      setApprovals(data);
    } catch (err) {
      console.log('Failed to load approvals:', err);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
    const unsub = wsService.on('approval:new', loadApprovals);
    const unsub2 = wsService.on('approval:decided', loadApprovals);
    return () => { unsub(); unsub2(); };
  }, [loadApprovals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApprovals();
    setRefreshing(false);
  };

  const handleDecision = async (id: string, decision: 'approved' | 'denied') => {
    try {
      await decideApproval(id, decision);
      setApprovals((prev) => prev.filter((a) => a.approvalId !== id));
    } catch {
      Alert.alert('Error', 'Failed to submit decision');
    }
  };

  const handleApproveAll = () => {
    Alert.alert(
      'Approve All',
      `Approve all ${approvals.length} pending items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          onPress: async () => {
            try {
              await approveAll();
              setApprovals([]);
            } catch {
              Alert.alert('Error', 'Failed to approve all');
            }
          },
        },
      ]
    );
  };

  const riskColor = (level: string) => {
    if (level === 'high') return '#e74c3c';
    if (level === 'medium') return '#e17055';
    return '#00b894';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {approvals.length > 1 && (
        <TouchableOpacity style={styles.approveAllButton} onPress={handleApproveAll}>
          <Ionicons name="checkmark-done" size={20} color="#fff" />
          <Text style={styles.approveAllText}>Approve All ({approvals.length})</Text>
        </TouchableOpacity>
      )}

      {approvals.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark-outline" size={64} color="#2d2d44" />
          <Text style={styles.emptyTitle}>No pending approvals</Text>
          <Text style={styles.emptySubtitle}>
            Tool calls that need your permission will appear here
          </Text>
        </View>
      ) : (
        approvals.map((a) => (
          <View key={a.approvalId} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.riskBadge, { backgroundColor: riskColor(a.riskLevel) + '22' }]}>
                <Text style={[styles.riskText, { color: riskColor(a.riskLevel) }]}>
                  {a.riskLevel.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.toolName}>{a.toolName}</Text>
            </View>

            {a.description ? (
              <Text style={styles.description}>{a.description}</Text>
            ) : null}

            {a.command ? (
              <View style={styles.commandBox}>
                <Text style={styles.commandText}>{a.command}</Text>
              </View>
            ) : null}

            {a.filePath ? (
              <Text style={styles.filePath}>
                <Ionicons name="document-outline" size={12} color="#888" /> {a.filePath}
              </Text>
            ) : null}

            <Text style={styles.meta}>
              Session: {a.sessionId.slice(0, 12)}... · {timeAgo(a.createdAt)}
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.decisionButton, styles.denyButton]}
                onPress={() => handleDecision(a.approvalId, 'denied')}
              >
                <Ionicons name="close" size={18} color="#e74c3c" />
                <Text style={[styles.decisionText, { color: '#e74c3c' }]}>Deny</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.decisionButton, styles.approveButton]}
                onPress={() => handleDecision(a.approvalId, 'approved')}
              >
                <Ionicons name="checkmark" size={18} color="#00b894" />
                <Text style={[styles.decisionText, { color: '#00b894' }]}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  approveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00b89422',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#00b89444',
  },
  approveAllText: { color: '#00b894', fontSize: 15, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#666', fontSize: 14, marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  riskBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  riskText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  toolName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  description: { color: '#ccc', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  commandBox: {
    backgroundColor: '#0f0f23',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  commandText: { color: '#6c5ce7', fontSize: 13, fontFamily: 'monospace' },
  filePath: { color: '#888', fontSize: 12, marginBottom: 8 },
  meta: { color: '#666', fontSize: 12, marginBottom: 12 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  decisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  denyButton: { backgroundColor: '#e74c3c11', borderWidth: 1, borderColor: '#e74c3c33' },
  approveButton: { backgroundColor: '#00b89411', borderWidth: 1, borderColor: '#00b89433' },
  decisionText: { fontSize: 15, fontWeight: '600' },
});
