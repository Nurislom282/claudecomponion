import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = Platform.OS === 'web'
  ? 'http://localhost:3847'
  : 'https://claudecomponion.onrender.com';
const API_SECRET = '1df346d299f1fafb112b948645208100d81697bf2c04b7d1';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export default function SettingsScreen() {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiUrl, setApiUrl] = useState(API_URL);
  const [apiSecret, setApiSecret] = useState(API_SECRET);

  const checkServer = useCallback(async () => {
    setServerStatus('checking');
    try {
      const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      setServerInfo(data);
      setServerStatus('online');
    } catch {
      setServerStatus('offline');
      setServerInfo(null);
    }
  }, [apiUrl]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/sessions`, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiSecret ? { Authorization: `Bearer ${apiSecret}` } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const sessions = await res.json();
        const logEntries: LogEntry[] = [];

        logEntries.push({
          id: 'conn-' + Date.now(),
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `API connected. ${Array.isArray(sessions) ? sessions.length : 0} sessions found.`,
          source: 'api',
        });

        if (Array.isArray(sessions)) {
          sessions.forEach((s: any) => {
            logEntries.push({
              id: 'session-' + s.sessionId,
              timestamp: s.startedAt || s.updatedAt || new Date().toISOString(),
              level: 'info',
              message: `Session ${s.sessionId?.slice(0, 16)}... | ${s.workingDir || 'unknown'} | ${s.status}`,
              source: 'session',
            });
          });
        }

        setLogs(logEntries);
      } else {
        setLogs([{
          id: 'err-' + Date.now(),
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `API returned ${res.status}: ${await res.text()}`,
          source: 'api',
        }]);
      }
    } catch (err: any) {
      setLogs([{
        id: 'err-' + Date.now(),
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Failed to connect: ${err.message}`,
        source: 'api',
      }]);
    }
  }, [apiUrl, apiSecret]);

  useEffect(() => {
    checkServer();
  }, [checkServer]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([checkServer(), showLogs ? fetchLogs() : Promise.resolve()]);
    setRefreshing(false);
  };

  const toggleLogs = () => {
    const next = !showLogs;
    setShowLogs(next);
    if (next) fetchLogs();
  };

  const testConnection = async () => {
    await checkServer();
    if (serverStatus === 'online') {
      Alert.alert('Connection OK', `Server is online at ${apiUrl}`);
    } else {
      Alert.alert('Connection Failed', `Cannot reach ${apiUrl}`);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {/* Account Info */}
      <View style={styles.card}>
        <View style={styles.accountHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#6c5ce7" />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountEmail}>shellwindon@gmail.com</Text>
            <Text style={styles.accountPlan}>Claude Code Companion</Text>
          </View>
        </View>
      </View>

      {/* Server Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Server Connection</Text>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            { backgroundColor: serverStatus === 'online' ? '#00b894' : serverStatus === 'offline' ? '#e74c3c' : '#fdcb6e' }
          ]} />
          <Text style={styles.statusText}>
            {serverStatus === 'checking' ? 'Checking...' : serverStatus === 'online' ? 'Online' : 'Offline'}
          </Text>
        </View>
        <Text style={styles.serverUrl}>{apiUrl}</Text>
        {serverInfo && (
          <Text style={styles.serverDetail}>
            Last ping: {new Date(serverInfo.timestamp).toLocaleTimeString()}
          </Text>
        )}
        <TouchableOpacity style={styles.button} onPress={testConnection}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>
      </View>

      {/* Monitoring Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monitoring</Text>
        <View style={styles.infoRow}>
          <Ionicons name="desktop-outline" size={18} color="#888" />
          <Text style={styles.infoLabel}>Machine</Text>
          <Text style={styles.infoValue}>Your Mac (via hooks)</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="cloud-outline" size={18} color="#888" />
          <Text style={styles.infoLabel}>Backend</Text>
          <Text style={styles.infoValue}>Render (Free)</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="flame-outline" size={18} color="#888" />
          <Text style={styles.infoLabel}>Database</Text>
          <Text style={styles.infoValue}>Firebase Firestore</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="key-outline" size={18} color="#888" />
          <Text style={styles.infoLabel}>Auth</Text>
          <Text style={styles.infoValue}>{apiSecret ? 'API Key Set' : 'No Key'}</Text>
        </View>
      </View>

      {/* Logs */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.logHeader} onPress={toggleLogs}>
          <Text style={styles.cardTitle}>Activity Logs</Text>
          <Ionicons name={showLogs ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
        </TouchableOpacity>

        {showLogs && (
          <View style={styles.logContainer}>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>No logs yet. Pull to refresh.</Text>
            ) : (
              logs.map((log) => (
                <View key={log.id} style={styles.logEntry}>
                  <View style={styles.logMeta}>
                    <View style={[
                      styles.logLevel,
                      { backgroundColor: log.level === 'error' ? '#e74c3c33' : '#00b89433' }
                    ]}>
                      <Text style={[
                        styles.logLevelText,
                        { color: log.level === 'error' ? '#e74c3c' : '#00b894' }
                      ]}>
                        {log.level.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.refreshLogsBtn} onPress={fetchLogs}>
              <Ionicons name="refresh-outline" size={14} color="#6c5ce7" />
              <Text style={styles.refreshLogsText}>Refresh Logs</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* App Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.aboutText}>Claude Code Companion v1.0.0</Text>
        <Text style={styles.aboutSubtext}>Control Claude Code sessions from your phone</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
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
  accountHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6c5ce722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: { marginLeft: 16, flex: 1 },
  accountEmail: { color: '#fff', fontSize: 16, fontWeight: '600' },
  accountPlan: { color: '#6c5ce7', fontSize: 13, marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: '#ccc', fontSize: 14 },
  serverUrl: { color: '#888', fontSize: 12, marginBottom: 4 },
  serverDetail: { color: '#666', fontSize: 11, marginBottom: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
    gap: 10,
  },
  infoLabel: { color: '#888', fontSize: 13, width: 80 },
  infoValue: { color: '#ccc', fontSize: 13, flex: 1 },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logContainer: { marginTop: 8 },
  logEntry: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  logLevel: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  logLevelText: { fontSize: 10, fontWeight: '700' },
  logTime: { color: '#666', fontSize: 11 },
  logMessage: { color: '#ccc', fontSize: 12 },
  refreshLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
    marginTop: 8,
  },
  refreshLogsText: { color: '#6c5ce7', fontSize: 13 },
  emptyText: { color: '#666', textAlign: 'center', fontSize: 13, padding: 16 },
  aboutText: { color: '#ccc', fontSize: 14 },
  aboutSubtext: { color: '#666', fontSize: 12, marginTop: 4 },
});
