import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Info, MessageCircle, Send } from 'lucide-react-native';
import { CommonTopBar } from '@/components/ui/CommonTopBar';
import { Colors } from '@/constants/Colors';
import { useQa } from '@/hooks/useQa';
import { QA_DISCLAIMER } from '@/lib/ai/aiQaQueries';

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

export default function AiQaChatScreen() {
  const router = useRouter();
  const loginAlertShown = useRef(false);
  const [draft, setDraft] = useState('');
  const {
    status,
    result,
    errorMessage,
    messages,
    offlineQueue,
    ask,
    retry,
    reset,
    flushOfflineQueue,
    clearOfflineQueue,
  } = useQa();

  const sending = status === 'sending';
  const canSend = draft.trim().length > 0 && !sending;
  const hasError = status === 'offline' || status === 'timeout' || status === 'error';

  useEffect(() => {
    void flushOfflineQueue();
  }, [flushOfflineQueue]);

  useEffect(() => {
    if (!errorMessage?.includes('请先登录') || loginAlertShown.current) return;
    loginAlertShown.current = true;
    Alert.alert('请先登录', '使用文化知识问答前需要先登录账号。', [
      {
        text: '去登录',
        onPress: () => {
          loginAlertShown.current = false;
          router.replace('/(auth)/login');
        },
      },
      {
        text: '取消',
        style: 'cancel',
        onPress: () => {
          loginAlertShown.current = false;
        },
      },
    ]);
  }, [errorMessage, router]);

  const messagesWithIntro = useMemo(() => {
    if (messages.length > 0) return messages;
    return [
      {
        id: 'assistant_welcome',
        role: 'assistant' as const,
        content:
          '你好，我是文化知识问答助手。你可以问我关于历史文化地标、朝代背景、文博知识和参观建议的问题。',
        timestamp: new Date().toISOString(),
      },
    ];
  }, [messages]);

  const handleSend = async () => {
    const question = draft.trim();
    if (!question || sending) return;
    setDraft('');
    await ask(question);
  };

  return (
    <View style={styles.root}>
      <CommonTopBar
        title="文化知识问答"
        showBack
        rightElement={(
          <TouchableOpacity style={styles.clearBtn} onPress={reset}>
            <Text style={styles.clearBtnText}>清空</Text>
          </TouchableOpacity>
        )}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <MessageCircle size={14} color={Colors.white} />
            <Text style={styles.heroBadgeText}>AI 问答</Text>
          </View>
          <Text style={styles.heroTitle}>文化知识快速问答</Text>
          <Text style={styles.heroSubtitle}>
            仅通过 Supabase Edge Functions 调用大模型，支持离线输入保留与恢复后重发。
          </Text>
        </View>

        {offlineQueue.length > 0 ? (
          <View style={styles.queueCard}>
            <Text style={styles.queueTitle}>离线待发送 {offlineQueue.length} 条</Text>
            <Text style={styles.queueText}>网络恢复后会自动重发，你也可以手动立即重发。</Text>
            <View style={styles.queueActions}>
              <TouchableOpacity style={styles.queueBtn} onPress={() => void flushOfflineQueue()}>
                <Text style={styles.queueBtnText}>立即重发</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.queueGhostBtn} onPress={() => void clearOfflineQueue()}>
                <Text style={styles.queueGhostBtnText}>清空离线</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <ScrollView style={styles.chatList} contentContainerStyle={styles.chatContent}>
          {messagesWithIntro.map((item) => {
            const isUser = item.role === 'user';
            return (
              <View
                key={item.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowAssistant,
                ]}
              >
                <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.timeText, isUser ? styles.userTimeText : styles.assistantTimeText]}>
                    {formatDateTime(item.timestamp)}
                  </Text>
                </View>
              </View>
            );
          })}

          {sending ? (
            <View style={styles.sendingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.sendingText}>正在生成回答...</Text>
            </View>
          ) : null}
        </ScrollView>

        {hasError && errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void retry()}>
              <Text style={styles.retryBtnText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.disclaimerCard}>
          <Info size={14} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>{result?.disclaimer ?? QA_DISCLAIMER}</Text>
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            style={styles.input}
            placeholder="请输入文化旅游相关问题，例如：唐代佛教艺术为何繁盛？"
            placeholderTextColor={Colors.textLight}
            multiline
            maxLength={280}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            disabled={!canSend}
            onPress={() => void handleSend()}
          >
            <Send size={16} color={Colors.white} />
            <Text style={styles.sendBtnText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  clearBtn: {
    backgroundColor: Colors.cardMuted,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    padding: 14,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.accent,
  },
  heroBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 19,
  },
  queueCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent + '66',
    backgroundColor: Colors.accent + '14',
    padding: 12,
    gap: 6,
  },
  queueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentDark,
  },
  queueText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  queueActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  queueBtn: {
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  queueBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  queueGhostBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  queueGhostBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  chatList: {
    flex: 1,
    marginTop: 10,
  },
  chatContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 12,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
  },
  userText: {
    color: Colors.white,
  },
  assistantText: {
    color: Colors.textSecondary,
  },
  timeText: {
    fontSize: 11,
  },
  userTimeText: {
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'right',
  },
  assistantTimeText: {
    color: Colors.textLight,
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  sendingText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D97171',
    backgroundColor: '#FFF3F3',
    padding: 10,
    gap: 8,
  },
  errorText: {
    color: '#803434',
    fontSize: 13,
    lineHeight: 20,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.cardMuted,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  inputWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
    gap: 8,
  },
  input: {
    minHeight: 72,
    maxHeight: 132,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.card,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  sendBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
