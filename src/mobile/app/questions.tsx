import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingQuestions, answerQuestion, type Question } from '@/services/api';
import { wsService } from '@/services/websocket';

export default function QuestionsScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  const loadQuestions = useCallback(async () => {
    try {
      const data = await getPendingQuestions();
      setQuestions(data);
    } catch (err) {
      console.log('Failed to load questions:', err);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
    const unsub = wsService.on('question:new', loadQuestions);
    const unsub2 = wsService.on('question:answered', loadQuestions);
    return () => { unsub(); unsub2(); };
  }, [loadQuestions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadQuestions();
    setRefreshing(false);
  };

  const handleAnswer = async (questionId: string, answer: string) => {
    try {
      await answerQuestion(questionId, answer);
      setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
    } catch (err) {
      Alert.alert('Error', 'Failed to send answer');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      {questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={64} color="#2d2d44" />
          <Text style={styles.emptyTitle}>No pending questions</Text>
          <Text style={styles.emptySubtitle}>
            You'll get a notification when Claude needs input
          </Text>
        </View>
      ) : (
        questions.map((q) => (
          <View key={q.questionId} style={styles.card}>
            {q.header ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerText}>{q.header}</Text>
              </View>
            ) : null}

            <Text style={styles.question}>{q.question}</Text>

            <Text style={styles.meta}>
              Session: {q.sessionId.slice(0, 12)}... · {timeAgo(q.createdAt)}
            </Text>

            {/* Option buttons */}
            {q.options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={styles.optionButton}
                onPress={() => handleAnswer(q.questionId, opt.label)}
              >
                <Text style={styles.optionLabel}>{opt.label}</Text>
                {opt.description ? (
                  <Text style={styles.optionDesc}>{opt.description}</Text>
                ) : null}
              </TouchableOpacity>
            ))}

            {/* Custom answer input */}
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Type a custom answer..."
                placeholderTextColor="#666"
                value={customAnswers[q.questionId] || ''}
                onChangeText={(text) =>
                  setCustomAnswers((prev) => ({ ...prev, [q.questionId]: text }))
                }
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={() => {
                  const answer = customAnswers[q.questionId]?.trim();
                  if (answer) handleAnswer(q.questionId, answer);
                }}
              >
                <Ionicons name="send" size={20} color="#fff" />
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
  headerBadge: {
    backgroundColor: '#6c5ce722',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  headerText: { color: '#6c5ce7', fontSize: 12, fontWeight: '600' },
  question: { color: '#fff', fontSize: 16, lineHeight: 22, marginBottom: 8 },
  meta: { color: '#666', fontSize: 12, marginBottom: 12 },
  optionButton: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3d3d55',
  },
  optionLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
  optionDesc: { color: '#888', fontSize: 12, marginTop: 4 },
  customRow: { flexDirection: 'row', marginTop: 4, gap: 8 },
  customInput: {
    flex: 1,
    backgroundColor: '#0f0f23',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sendButton: {
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
