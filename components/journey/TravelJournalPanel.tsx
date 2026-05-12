import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BookText, CloudUpload, LocateFixed, Pause, Play, Route } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import {
  TRACK_SAMPLE_INTERVAL_SECONDS,
  TRACK_SAMPLE_MIN_DISTANCE_M,
  createTravelSession,
  finishTravelSession,
  generateTravelJournal,
  getLocalTravelJournals,
  getLocalTravelSessions,
  getTravelSession,
  sampleTrajectoryPoint,
  saveTravelJournalLocal,
  saveTravelJournalToCloud,
  type TravelJournalDraft,
  type TravelSession,
} from '@/lib/travel/travelService';

function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countSessionPois(session: TravelSession | null): number {
  if (!session) return 0;
  return new Set(
    session.points
      .filter((item) => item.poi_id)
      .map((item) => item.poi_id as string),
  ).size;
}

export function TravelJournalPanel() {
  const router = useRouter();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<TravelSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<TravelSession | null>(null);
  const [draft, setDraft] = useState<TravelJournalDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const samplingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const samplingBusyRef = useRef(false);

  const isRecording = Boolean(activeSession && !activeSession.ended_at && samplingTimerRef.current);

  const selectedSessionStats = useMemo(() => {
    return {
      pointCount: activeSession?.points.length ?? 0,
      poiCount: countSessionPois(activeSession),
    };
  }, [activeSession]);

  const refreshSessions = useCallback(async () => {
    const localSessions = await getLocalTravelSessions();
    setSessions(localSessions);

    const candidateId =
      selectedSessionId && localSessions.some((item) => item.id === selectedSessionId)
        ? selectedSessionId
        : localSessions[0]?.id ?? null;

    setSelectedSessionId(candidateId);

    if (candidateId) {
      const session = await getTravelSession(candidateId);
      setActiveSession(session);

      const journals = await getLocalTravelJournals();
      const relatedDraft = journals.find((item) => item.session_id === candidateId) ?? null;
      setDraft(relatedDraft);
    } else {
      setActiveSession(null);
      setDraft(null);
    }
  }, [selectedSessionId]);

  const refreshActiveSession = useCallback(async (sessionId: string) => {
    const session = await getTravelSession(sessionId);
    setActiveSession(session);
  }, []);

  const sampleOnce = useCallback(
    async (sessionId: string, force = false) => {
      if (samplingBusyRef.current) return;
      samplingBusyRef.current = true;
      try {
        const result = await sampleTrajectoryPoint(sessionId, { force });
        if (!result.sampled && result.reason) {
          setMessage(result.reason);
        }
        await refreshActiveSession(sessionId);
        await refreshSessions();
      } finally {
        samplingBusyRef.current = false;
      }
    },
    [refreshActiveSession, refreshSessions],
  );

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!selectedSessionId) return;
    void refreshActiveSession(selectedSessionId);
  }, [refreshActiveSession, selectedSessionId]);

  useEffect(() => {
    return () => {
      if (samplingTimerRef.current) {
        clearInterval(samplingTimerRef.current);
      }
    };
  }, []);

  const handleStartRecord = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      const session = await createTravelSession();
      setSelectedSessionId(session.id);
      setActiveSession(session);
      await refreshSessions();

      await sampleOnce(session.id, true);

      samplingTimerRef.current = setInterval(() => {
        void sampleOnce(session.id, false);
      }, TRACK_SAMPLE_INTERVAL_SECONDS * 1000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '启动行程记录失败，请稍后重试。';
      setMessage(msg);
      Alert.alert('启动失败', msg);
    } finally {
      setLoading(false);
    }
  }, [refreshSessions, sampleOnce]);

  const handleStopRecord = useCallback(async () => {
    const sessionId = selectedSessionId;
    if (!sessionId) return;

    if (samplingTimerRef.current) {
      clearInterval(samplingTimerRef.current);
      samplingTimerRef.current = null;
    }

    try {
      setLoading(true);
      await finishTravelSession(sessionId);
      await refreshSessions();
      setMessage('行程记录已停止，轨迹已保存。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '停止记录失败，请稍后重试。';
      setMessage(msg);
      Alert.alert('停止失败', msg);
    } finally {
      setLoading(false);
    }
  }, [refreshSessions, selectedSessionId]);

  const handleGenerateJournal = useCallback(async () => {
    if (!selectedSessionId) {
      Alert.alert('暂无会话', '请先开始一次行程记录，再生成游记。');
      return;
    }

    if (!user) {
      Alert.alert('请先登录', '生成 AI 游记需要登录账号。', [
        {
          text: '去登录',
          onPress: () => router.replace('/(auth)/login'),
        },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }

    try {
      setGenerating(true);
      setMessage(null);
      const nextDraft = await generateTravelJournal(selectedSessionId);
      setDraft(nextDraft);
      setMessage('AI 游记草稿已生成，可继续编辑后保存。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '游记生成失败，请稍后重试。';
      setMessage(msg);
      Alert.alert('生成失败', msg);
    } finally {
      setGenerating(false);
    }
  }, [router, selectedSessionId, user]);

  const handleSaveDraft = useCallback(async () => {
    if (!draft) {
      Alert.alert('暂无草稿', '请先生成或编辑游记草稿。');
      return;
    }

    try {
      setSaving(true);
      const localDraft: TravelJournalDraft = {
        ...draft,
        updated_at: new Date().toISOString(),
      };
      await saveTravelJournalLocal(localDraft);

      if (!user) {
        setDraft({ ...localDraft, synced: false });
        setMessage('已本地保存草稿。未登录状态下不会上云或触发云端生成。');
        Alert.alert('本地保存成功', '当前未登录，草稿仅保存在本地设备。');
        return;
      }

      const syncedDraft = await saveTravelJournalToCloud(localDraft);
      setDraft(syncedDraft);
      setMessage('游记已同步至云端。');
      Alert.alert('保存成功', '游记草稿已保存并同步到 Supabase。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存失败，请稍后重试。';
      setMessage(msg);
      Alert.alert('保存失败', msg);
    } finally {
      setSaving(false);
    }
  }, [draft, user]);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const session = await getTravelSession(sessionId);
    setActiveSession(session);

    const journals = await getLocalTravelJournals();
    const relatedDraft = journals.find((item) => item.session_id === sessionId) ?? null;
    setDraft(relatedDraft);
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Route size={19} color={Colors.goldLight} />
            <Text style={styles.title}>轨迹记录与 AI 游记</Text>
          </View>
          <Text style={styles.strategyText}>
            每 {TRACK_SAMPLE_INTERVAL_SECONDS}s 或位移 {TRACK_SAMPLE_MIN_DISTANCE_M}m 采样
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, isRecording && styles.primaryBtnDanger]}
            onPress={isRecording ? handleStopRecord : handleStartRecord}
            disabled={loading || generating || saving}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                {isRecording ? <Pause size={14} color={Colors.white} /> : <Play size={14} color={Colors.white} />}
                <Text style={styles.primaryBtnText}>{isRecording ? '停止记录' : '开始记录'}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleGenerateJournal}
            disabled={loading || generating || saving}
          >
            {generating ? <ActivityIndicator color={Colors.primary} /> : <BookText size={14} color={Colors.primary} />}
            <Text style={styles.secondaryBtnText}>生成游记</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleSaveDraft}
            disabled={loading || generating || saving}
          >
            {saving ? <ActivityIndicator color={Colors.primary} /> : <CloudUpload size={14} color={Colors.primary} />}
            <Text style={styles.secondaryBtnText}>保存同步</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metaWrap}>
          <View style={styles.metaItem}>
            <LocateFixed size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>轨迹点 {selectedSessionStats.pointCount}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>关联 POI {selectedSessionStats.poiCount}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>
              开始 {formatDateTime(activeSession?.started_at)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>
              结束 {formatDateTime(activeSession?.ended_at)}
            </Text>
          </View>
        </View>

        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        <View style={styles.sessionBlock}>
          <Text style={styles.blockTitle}>本地行程会话</Text>
          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>暂无行程记录，点击“开始记录”即可创建。</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionList}>
              {sessions.map((session) => {
                const selected = selectedSessionId === session.id;
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[styles.sessionChip, selected && styles.sessionChipActive]}
                    onPress={() => {
                      void handleSelectSession(session.id);
                    }}
                  >
                    <Text style={[styles.sessionChipTitle, selected && styles.sessionChipTitleActive]} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text style={[styles.sessionChipMeta, selected && styles.sessionChipMetaActive]}>
                      {session.points.length} 点
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.sessionBlock}>
          <Text style={styles.blockTitle}>游记草稿（可编辑）</Text>
          {draft ? (
            <>
              <TextInput
                value={draft.title}
                onChangeText={(title) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          title,
                        }
                      : prev,
                  )
                }
                style={styles.titleInput}
                placeholder="输入游记标题"
                placeholderTextColor={Colors.textMuted}
              />
              <TextInput
                value={draft.content}
                onChangeText={(content) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          content,
                          excerpt: content.slice(0, 120),
                        }
                      : prev,
                  )
                }
                style={styles.contentInput}
                multiline
                textAlignVertical="top"
                placeholder="生成后可在此编辑游记正文"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.draftMetaText}>
                {draft.synced ? '已同步云端' : '仅本地保存'} · 轨迹点 {draft.point_count} · POI {draft.poi_count}
              </Text>
            </>
          ) : (
            <Text style={styles.emptyText}>暂未生成游记草稿。</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.primaryDark,
    gap: 10,
  },
  headerRow: {
    gap: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.white,
  },
  strategyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryBtn: {
    minWidth: 110,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  primaryBtnDanger: {
    backgroundColor: '#B54D3E',
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  secondaryBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
  },
  messageText: {
    color: Colors.goldLight,
    fontSize: 12,
    lineHeight: 18,
  },
  sessionBlock: {
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  blockTitle: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  sessionList: {
    gap: 8,
    paddingRight: 4,
  },
  sessionChip: {
    minWidth: 130,
    maxWidth: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8D8D8',
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  sessionChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F5EEE5',
  },
  sessionChipTitle: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionChipTitleActive: {
    color: Colors.primary,
  },
  sessionChipMeta: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  sessionChipMetaActive: {
    color: Colors.primary,
  },
  titleInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D2D8DD',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    backgroundColor: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  contentInput: {
    minHeight: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D2D8DD',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    backgroundColor: Colors.white,
    fontSize: 13,
    lineHeight: 20,
  },
  draftMetaText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
});
