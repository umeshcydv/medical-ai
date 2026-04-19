import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { apiGet } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/lib/theme';
import type { InboxMessage } from '@medical-ai/shared';

export default function Prescriptions() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGet<{ messages: InboxMessage[] }>('/messages');
      setMessages(res.messages.filter((m) => m.kind === 'prescription'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (m: InboxMessage) => {
    try {
      const res = await apiGet<{ url: string }>(`/messages/${m.id}/attachment-url`);
      Linking.openURL(res.url);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <Screen style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.title}>Prescriptions</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={!refreshing ? <Text style={styles.empty}>No prescriptions yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => open(item)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.link}>Open PDF →</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
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
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  time: { color: colors.muted, marginTop: 4, fontSize: 13 },
  link: { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
});
