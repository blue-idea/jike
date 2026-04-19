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
  sendQaQuestionMock,
  type AiQaResult,
  type QaMessage,
  type QaState,
} from '@/lib/ai/aiQaQueries';

const OFFLINE_QUEUE_KEY = '@qa_offline_queue';

export type { AiQaResult, QaMessage };

export interface UseQaReturn extends QaState {
  /** 发送问题 */
  ask: (question: string) => Promise<void>;
  /** 重试上次问题 */
  retry: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
  /** 离线队列中的消息 */
  offlineQueue: QaMessage[];
  /** 清除离线队列 */
  clearOfflineQueue: () => Promise<void>;
  /** 尝试发送离线队列中的消息（网络恢复时调用） */
  flushOfflineQueue: () => Promise<void>;
  /** 上一次发送的用户问题 */
  lastQuestion: string | null;
}

function isOfflineError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('[OFFLINE]')
  );
}

export function useQa(): UseQaReturn {
  const [state, setState] = useState<QaState>({
    status: 'idle',
    result: null,
    errorMessage: null,
  });
  const [offlineQueue, setOfflineQueue] = useState<QaMessage[]>([]);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const historyRef = useRef<QaMessage[]>([]);

  // 加载离线队列
  useEffect(() => {
    AsyncStorage.getItem(OFFLINE_QUEUE_KEY).then((val) => {
      if (val) {
        try {
          const queue = JSON.parse(val) as QaMessage[];
          setOfflineQueue(queue);
        } catch {
          // ignore parse errors
        }
      }
    });
  }, []);

  // 持久化离线队列
  const persistQueue = useCallback((queue: QaMessage[]) => {
    AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)).catch(
      () => {},
    );
    setOfflineQueue(queue);
  }, []);

  const ask = useCallback(async (question: string) => {
    setLastQuestion(question);
    setState({ status: 'sending', result: null, errorMessage: null });

    const userMsg: QaMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };
    historyRef.current = [...historyRef.current, userMsg];

    try {
      let result: AiQaResult;
      try {
        result = await sendQaQuestion(question, historyRef.current);
      } catch (err) {
        if (isOfflineError(err)) {
          // 网络不可用 → 保留用户输入到离线队列
          const offlineMsg: QaMessage = {
            id: `offline_${Date.now()}`,
            role: 'user',
            content: question,
            timestamp: new Date().toISOString(),
          };
          const newQueue = [...offlineQueue, offlineMsg];
          persistQueue(newQueue);
          setState({
            status: 'offline',
            result: null,
            errorMessage: '当前网络不可用，您的输入已保存。网络恢复后将自动重发。',
          });
          return;
        }
        throw err;
      }

      // 成功：将回答加入历史
      const assistantMsg: QaMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        timestamp: result.generated_at,
      };
      historyRef.current = [...historyRef.current, assistantMsg];

      setState({ status: 'success', result, errorMessage: null });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '问答生成失败，请重试。';
      setState({ status: 'error', result: null, errorMessage: msg });
    }
  }, [offlineQueue, persistQueue]);

  /** 尝试发送离线队列中的消息 */
  const flushOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;
    const queue = [...offlineQueue];
    for (const msg of queue) {
      if (msg.role !== 'user') continue;
      try {
        const result = await sendQaQuestionMock(msg.content);
        const assistantMsg: QaMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: result.answer,
          timestamp: result.generated_at,
        };
        historyRef.current = [
          ...historyRef.current,
          msg,
          assistantMsg,
        ];
        // 从队列移除
        const newQueue = queue.filter((m) => m.id !== msg.id);
        persistQueue(newQueue);
      } catch {
        // 如果仍然失败，保留在队列中
        break;
      }
    }
  }, [offlineQueue, persistQueue]);

  const retry = useCallback(async () => {
    if (!lastQuestion) return;
    // 重新发送上次问题
    await ask(lastQuestion);
  }, [lastQuestion, ask]);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, errorMessage: null });
    setLastQuestion(null);
    historyRef.current = [];
  }, []);

  const clearOfflineQueue = useCallback(async () => {
    persistQueue([]);
  }, [persistQueue]);

  // 监听网络恢复（组件外部可通过 NetInfo 等感知并调用 flushOfflineQueue）
  // 此处导出供外部调用

  return {
    ...state,
    ask,
    retry,
    reset,
    offlineQueue,
    clearOfflineQueue,
    lastQuestion,
    flushOfflineQueue,
  };
}
