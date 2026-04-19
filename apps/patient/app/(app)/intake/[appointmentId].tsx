import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../../../src/lib/api';
import { colors, radius, spacing } from '../../../src/lib/theme';
import type { IntakeChat, IntakeMessage } from '@medical-ai/shared';

export default function Intake() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const router = useRouter();
  const [chat, setChat] = useState<IntakeChat | null>(null);
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const res = await apiPost<{ intake_chat: IntakeChat; messages: IntakeMessage[] }>(
        '/intake/start',
        { appointment_id: appointmentId }
      );
      setChat(res.intake_chat);
      setMessages(res.messages);
      setCompleted(res.intake_chat.completed);
    })();
  }, [appointmentId]);

  const send = async () => {
    if (!input.trim() || !chat || sending || completed) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    // Optimistically add user message
    const optimistic: IntakeMessage = {
      id: `tmp-${Date.now()}`,
      intake_chat_id: chat.id,
      role: 'user',
      content,
      question_index: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await apiPost<{
        next_question: string | null;
        question_index: number | null;
        completed: boolean;
        summary?: string;
      }>('/intake/reply', { intake_chat_id: chat.id, content });

      if (res.next_question) {
        setMessages((m) => [
          ...m,
          {
            id: `tmp-a-${Date.now()}`,
            intake_chat_id: chat.id,
            role: 'assistant',
            content: res.next_question!,
            question_index: res.question_index,
            created_at: new Date().toISOString(),
          },
        ]);
      } else if (res.completed) {
        setCompleted(true);
      }
    } catch (e) {
      // rollback on failure
      setMessages((m) => m.filter((msg) => msg.id !== optimistic.id));
    }
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Pre-visit intake</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <Bubble message={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={
            completed ? (
              <View style={styles.done}>
                <Text style={styles.doneTitle}>All set ✓</Text>
                <Text style={styles.doneSub}>
                  Your doctor will review this before your visit.
                </Text>
              </View>
            ) : sending ? (
              <View style={{ padding: spacing.md }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
        />

        {!completed && (
          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              style={styles.textInput}
              placeholder="Type your answer…"
              placeholderTextColor={colors.muted}
              multiline
              editable={!sending}
            />
            <Pressable onPress={send} disabled={sending || !input.trim()} style={styles.sendBtn}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Send</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: IntakeMessage }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        styles.bubbleRow,
        { justifyContent: isUser ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.userBubble : colors.assistantBubble,
          },
        ]}
      >
        <Text style={{ color: isUser ? colors.userBubbleText : colors.text, fontSize: 15, lineHeight: 21 }}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.sm },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  inputBar: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    maxHeight: 120,
    marginRight: spacing.sm,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  done: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.success, marginBottom: spacing.xs },
  doneSub: { color: colors.muted, textAlign: 'center' },
});
