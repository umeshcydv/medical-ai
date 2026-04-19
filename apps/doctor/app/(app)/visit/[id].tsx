import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { apiGet, apiPatch, apiPost, apiUpload } from '../../../src/lib/api';
import { Button } from '../../../src/components/Button';
import { colors, radius, spacing } from '../../../src/lib/theme';
import type { IntakeChat, IntakeMessage, Prescription, VisitSession } from '@medical-ai/shared';

type Stage = 'pre' | 'recording' | 'transcribing' | 'summary' | 'prescription' | 'preview' | 'sent';

export default function Visit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<VisitSession | null>(null);
  const [intake, setIntake] = useState<{ chat: IntakeChat | null; messages: IntakeMessage[] }>({ chat: null, messages: [] });
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const v = await apiGet<{ visit: VisitSession }>(`/visits/${id}`);
    setVisit(v.visit);

    const intakeRes = await apiGet<{ intake_chat: IntakeChat | null; messages: IntakeMessage[] }>(`/intake/${v.visit.appointment_id}`);
    setIntake({ chat: intakeRes.intake_chat, messages: intakeRes.messages });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const stage: Stage = (() => {
    if (!visit) return 'pre';
    if (visit.status === 'recording' && !visit.recording_path) return 'pre';
    if (visit.status === 'transcribing') return 'transcribing';
    if (visit.status === 'summary_ready') return 'summary';
    if (visit.status === 'prescription_ready') return 'prescription';
    if (visit.status === 'sent') return 'sent';
    return 'pre';
  })();

  // ----- Recording -----
  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert('Microphone permission required');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: r } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(r);
    } catch (e: any) {
      Alert.alert('Recording failed', e.message);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error('No recording URI');

      await apiUpload(`/visits/${id}/recording`, 'audio', uri, 'visit.m4a', 'audio/m4a');
      await load();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
    setBusy(false);
  };

  // ----- Finalize transcript (poll) -----
  const finalizeTranscript = async () => {
    setBusy(true);
    try {
      const res = await apiPost<{ status: string; summary?: string }>(`/visits/${id}/finalize-transcript`);
      if (res.status === 'pending') {
        Alert.alert('Still transcribing', 'Try again in a moment.');
      } else {
        await load();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setBusy(false);
  };

  // ----- Summary editing -----
  const [editMsg, setEditMsg] = useState('');
  const sendEdit = async () => {
    if (!editMsg.trim()) return;
    setBusy(true);
    try {
      await apiPost(`/visits/${id}/summary/edit`, { message: editMsg });
      setEditMsg('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setBusy(false);
  };

  const confirmSummary = async () => {
    setBusy(true);
    try {
      await apiPost(`/visits/${id}/summary/confirm`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setBusy(false);
  };

  // ----- Prescription editing -----
  const updatePrescription = async (p: Prescription) => {
    setBusy(true);
    try {
      await apiPatch(`/visits/${id}/prescription`, { prescription: p });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setBusy(false);
  };

  const sendToPatient = async () => {
    setBusy(true);
    try {
      await apiPost(`/visits/${id}/send`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Visit</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {/* Pre-visit intake summary */}
          {intake.chat?.ai_summary && (
            <Section title="Pre-visit intake summary">
              <Text style={styles.bodyText}>{intake.chat.ai_summary}</Text>
            </Section>
          )}

          {/* Stage: record */}
          {stage === 'pre' && (
            <Section title="In-room recording">
              <Text style={styles.hint}>
                Tap Start to record the consultation. Tap Stop when the conversation ends — we'll transcribe it and draft a summary.
              </Text>
              {recording ? (
                <Button
                  title={busy ? 'Uploading…' : 'Stop recording'}
                  variant="danger"
                  onPress={stopRecording}
                  loading={busy}
                  style={{ marginTop: spacing.md }}
                />
              ) : (
                <Button title="Start recording" onPress={startRecording} style={{ marginTop: spacing.md }} />
              )}
            </Section>
          )}

          {/* Stage: transcribing */}
          {stage === 'transcribing' && (
            <Section title="Transcribing">
              <Text style={styles.hint}>Audio uploaded. AWS Transcribe is identifying speakers and converting speech to text.</Text>
              <Button title="Check status" onPress={finalizeTranscript} loading={busy} style={{ marginTop: spacing.md }} />
            </Section>
          )}

          {/* Stage: summary review/edit */}
          {stage === 'summary' && visit && (
            <Section title="Draft summary">
              <Text style={styles.bodyText}>{visit.summary_draft}</Text>

              <Text style={[styles.hint, { marginTop: spacing.md }]}>
                Chat with the assistant to edit (e.g. "rename diagnosis to migraine").
              </Text>
              {(visit.summary_edit_chat || []).map((m, i) => (
                <View
                  key={i}
                  style={[
                    styles.editBubble,
                    { alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      backgroundColor: m.role === 'user' ? colors.userBubble : colors.assistantBubble },
                  ]}
                >
                  <Text style={{ color: m.role === 'user' ? colors.userBubbleText : colors.text }}>{m.content}</Text>
                </View>
              ))}
              <View style={styles.editInputRow}>
                <TextInput
                  value={editMsg}
                  onChangeText={setEditMsg}
                  placeholder="Ask AI to edit…"
                  placeholderTextColor={colors.muted}
                  style={styles.editInput}
                />
                <Pressable onPress={sendEdit} style={styles.sendBtn} disabled={busy}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Send</Text>
                </Pressable>
              </View>

              <Button title="Confirm summary → draft prescription" onPress={confirmSummary} loading={busy} style={{ marginTop: spacing.md }} />
            </Section>
          )}

          {/* Stage: prescription */}
          {stage === 'prescription' && visit?.prescription_draft && (
            <PrescriptionEditor
              prescription={visit.prescription_draft}
              onSave={updatePrescription}
              onSend={sendToPatient}
              busy={busy}
            />
          )}

          {/* Stage: sent */}
          {stage === 'sent' && (
            <Section title="Sent ✓">
              <Text style={styles.hint}>Summary and prescription delivered to patient.</Text>
              <Button title="Back to patient" onPress={() => router.back()} variant="secondary" style={{ marginTop: spacing.md }} />
            </Section>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PrescriptionEditor({
  prescription,
  onSave,
  onSend,
  busy,
}: {
  prescription: Prescription;
  onSave: (p: Prescription) => void;
  onSend: () => void;
  busy: boolean;
}) {
  const [p, setP] = useState(prescription);

  const updateMed = (idx: number, patch: Partial<Prescription['medications'][0]>) => {
    setP({
      ...p,
      medications: p.medications.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    });
  };

  const addMed = () => setP({ ...p, medications: [...p.medications, { name: '', dosage: '', frequency: '', duration: '' }] });
  const removeMed = (i: number) => setP({ ...p, medications: p.medications.filter((_, idx) => idx !== i) });

  return (
    <Section title="Prescription draft">
      <FieldInline label="Diagnosis" value={p.diagnosis} onChangeText={(v) => setP({ ...p, diagnosis: v })} />

      <Text style={styles.hint}>Medications</Text>
      {p.medications.map((m, i) => (
        <View key={i} style={styles.medBox}>
          <FieldInline label="Name" value={m.name} onChangeText={(v) => updateMed(i, { name: v })} />
          <FieldInline label="Dosage" value={m.dosage} onChangeText={(v) => updateMed(i, { dosage: v })} />
          <FieldInline label="Frequency" value={m.frequency} onChangeText={(v) => updateMed(i, { frequency: v })} />
          <FieldInline label="Duration" value={m.duration} onChangeText={(v) => updateMed(i, { duration: v })} />
          <Pressable onPress={() => removeMed(i)} style={{ padding: 8 }}>
            <Text style={{ color: colors.danger }}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Button title="+ Add medication" variant="secondary" onPress={addMed} style={{ marginVertical: spacing.sm }} />

      <FieldInline label="Instructions" value={p.instructions || ''} onChangeText={(v) => setP({ ...p, instructions: v })} multiline />
      <FieldInline label="Follow-up" value={p.follow_up || ''} onChangeText={(v) => setP({ ...p, follow_up: v })} />

      <Button title="Save draft" variant="secondary" onPress={() => onSave(p)} loading={busy} style={{ marginTop: spacing.md }} />
      <View style={{ height: spacing.sm }} />
      <Button title="Preview & send to patient" onPress={async () => { await onSave(p); onSend(); }} loading={busy} />
    </Section>
  );
}

function FieldInline({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        style={[styles.inlineInput, multiline && { minHeight: 60, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  bodyText: { color: colors.text, lineHeight: 21, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: spacing.xs },
  editBubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    marginVertical: 4,
    maxWidth: '80%',
  },
  editInputRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.bg,
    marginRight: spacing.sm,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  medBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  inlineLabel: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  inlineInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
});
