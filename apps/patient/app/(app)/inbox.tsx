import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { apiGet, apiPost } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/lib/theme';
import type { InboxMessage } from '@medical-ai/shared';

export default function Inbox() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGet<{ messages: InboxMessage[] }>('/messages');
      setMessages(res.messages);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (m: InboxMessage) => {
    if (!m.read_at) {
      await apiPost(`/messages/${m.id}/read`);
    }
    if (m.attachment_path) {
      try {
        const res = await apiGet<{ url: string }>(`/messages/${m.id}/attachment-url`);
        Linking.openURL(res.url);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    } else if (m.body) {
      Alert.alert(m.title, m.body);
    }
    load();
  };

  return (
    <Screen style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.title}>Inbox</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          !refreshing ? <Text style={styles.empty}>No messages yet.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={[styles.card, !item.read_at && styles.unread]}>
            <Text style={styles.kind}>{labelFor(item.kind)}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.body && <Text style={styles.body} numberOfLines={3}>{item.body}</Text>}
            {item.attachment_path && <Text style={styles.attachment}>Tap to open attachment →</Text>}
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function labelFor(kind: InboxMessage['kind']): string {
  switch (kind) {
    case 'summary': return 'VISIT SUMMARY';
    case 'prescription': return 'PRESCRIPTION';
    case 'note': return 'NOTE';
  }
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  kind: { fontSize: 11, color: colors.primary, fontWeight: '700', letterSpacing: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 4 },
  body: { color: colors.muted, marginTop: spacing.xs },
  attachment: { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
  time: { color: colors.muted, marginTop: spacing.sm, fontSize: 12 },
});
