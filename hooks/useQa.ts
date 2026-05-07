/**
 * hooks/useQa.ts
 *
 * AI 文化知识问答状态管理 Hook
 * EARS-1: 文化领域回答 + 消息流 + 免责声明
 * EARS-2: 离线时保留输入，网络恢复后重发；超时 T 秒中文提示 + 重试
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sendQaQuestion,
  type AiQaResult,
  type QaMessage,
  type QaState,
} from '@/lib/ai/aiQaQueries';

const OFFLINE_QUEUE_KEY = '@qa_offline_queue';
const OFFLINE_FLUSH_INTERVAL_MS = 10_000;

export type { AiQaResult, QaMessage };

export interface UseQaReturn extends QaState {
  /** 发送问题 */
  ask: (question: string) => Promise<void>;
  /** 重试上次问题 */
  retry: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
  /** 当前会话消息 */
  messages: QaMessage[];
  /** 离线队列中的消息 */
  offlineQueue: QaMessage[];
  /** 清除离线队列 */
  clearOfflineQueue: () => Promise<void>;
  /** 尝试发送离线队列中的消息（网络恢复时调用） */
  flushOfflineQueue: () => Promise<void>;
  /** 上一次发送的用户问题 */
  lastQuestion: string | null;
}

function isOfflineError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('[OFFLINE]');
}

function stripOfflinePrefix(message: string): string {
  return message.replace(/^\[OFFLINE\]/, '');
}

function isTimeoutMessage(message: string): boolean {
  return message.includes('超时');
}

export function useQa(): UseQaReturn {
  const [state, setState] = useState<QaState>({
    status: 'idle',
    result: null,
    errorMessage: null,
  });
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<QaMessage[]>([]);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const historyRef = useRef<QaMessage[]>([]);
  const flushingRef = useRef(false);

  // 加载离线队列
  useEffect(() => {
    AsyncStorage.getItem(OFFLINE_QUEUE_KEY).then((val) => {
      if (!val) return;
      try {
        const queue = JSON.parse(val) as QaMessage[];
        setOfflineQueue(queue);
      } catch {
        // ignore parse errors
      }
    });
  }, []);

  const persistQueue = useCallback((queue: QaMessage[]) => {
    AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)).catch(() => {});
    setOfflineQueue(queue);
  }, []);

  const ask = useCallback(async (question: string) => {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) return;

    setLastQuestion(normalizedQuestion);
    setState({ status: 'sending', result: null, errorMessage: null });

    const historyForRequest = historyRef.current;
    const userMsg: QaMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: normalizedQuestion,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...historyRef.current, userMsg];
    historyRef.current = nextHistory;
    setMessages(nextHistory);

    try {
      const result = await sendQaQuestion(normalizedQuestion, historyForRequest);

      const assistantMsg: QaMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        timestamp: result.generated_at,
      };
      const mergedHistory = [...historyRef.current, assistantMsg];
      historyRef.current = mergedHistory;
      setMessages(mergedHistory);

      setState({ status: 'success', result, errorMessage: null });
    } catch (error) {
      if (isOfflineError(error)) {
        const offlineMsg: QaMessage = {
          id: `offline_${Date.now()}`,
          role: 'user',
          content: normalizedQuestion,
          timestamp: userMsg.timestamp,
        };
        const newQueue = [...offlineQueue, offlineMsg];
        persistQueue(newQueue);
        setState({
          status: 'offline',
          result: null,
          errorMessage:
            `${stripOfflinePrefix(error.message)}\n您的输入已保留，网络恢复后将自动重发。`,
        });
        return;
      }

      const msg = error instanceof Error ? error.message : '问答生成失败，请重试。';
      setState({
        status: isTimeoutMessage(msg) ? 'timeout' : 'error',
        result: null,
        errorMessage: msg,
      });
    }
  }, [offlineQueue, persistQueue]);

  const flushOfflineQueue = useCallback(async () => {
    if (flushingRef.current || offlineQueue.length === 0) return;
    flushingRef.current = true;

    try {
      let remaining = [...offlineQueue];

      for (const queued of offlineQueue) {
        if (queued.role !== 'user') continue;
        try {
          const historyWithoutQueued = historyRef.current.filter((msg) => msg.id !== queued.id);
          const result = await sendQaQuestion(queued.content, historyWithoutQueued);
          const assistantMsg: QaMessage = {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: result.answer,
            timestamp: result.generated_at,
          };
          const mergedHistory = [...historyRef.current, assistantMsg];
          historyRef.current = mergedHistory;
          setMessages(mergedHistory);
          remaining = remaining.filter((msg) => msg.id !== queued.id);
          persistQueue(remaining);
          setState({ status: 'success', result, errorMessage: null });
        } catch (error) {
          if (isOfflineError(error)) {
            setState({
              status: 'offline',
              result: null,
              errorMessage: `${stripOfflinePrefix(error.message)}\n仍有离线消息待重发。`,
            });
          }
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [offlineQueue, persistQueue]);

  // 离线队列存在时，定时尝试自动重发
  useEffect(() => {
    if (offlineQueue.length === 0) return;
    const timer = setInterval(() => {
      void flushOfflineQueue();
    }, OFFLINE_FLUSH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [offlineQueue.length, flushOfflineQueue]);

  const retry = useCallback(async () => {
    if (!lastQuestion) return;
    await ask(lastQuestion);
  }, [lastQuestion, ask]);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, errorMessage: null });
    setLastQuestion(null);
    historyRef.current = [];
    setMessages([]);
  }, []);

  const clearOfflineQueue = useCallback(async () => {
    persistQueue([]);
  }, [persistQueue]);

  return {
    ...state,
    ask,
    retry,
    reset,
    messages,
    offlineQueue,
    clearOfflineQueue,
    lastQuestion,
    flushOfflineQueue,
  };
}
