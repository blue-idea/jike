/**
 * lib/ai/aiQaQueries.ts
 *
 * AI 文化知识问答链路（EARS-1：文化领域回答 + 免责声明）
 * EARS-2 覆盖：离线输入保留 + 网络恢复重发，超时 T 秒中文提示 + 重试
 *
 * 调用约定：实际请求发至 Supabase Edge Functions /ai-qa，
 * 密钥仅存于 Edge 环境变量，客户端不持有。
 */
import { supabase } from '@/lib/supabase';
import {
  AI_TIMEOUT_SECONDS,
  TIMEOUT_MESSAGE,
} from '@/lib/ai/aiGuideQueries';

export interface QaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AiQaResult {
  answer: string;
  disclaimer: string;
  sources?: string[];
  generated_at: string;
}

export type QaStatus = 'idle' | 'sending' | 'success' | 'offline' | 'timeout' | 'error';

export interface QaState {
  status: QaStatus;
  result: AiQaResult | null;
  errorMessage: string | null;
}

export const QA_DISCLAIMER =
  '以上回答由 AI 生成，仅供参考。\n如有重要用途请查阅官方权威资料。';

function mapErrorToChinese(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('timeout') ||
      msg.includes('etimedout') ||
      msg.includes('aborted')
    ) {
      return TIMEOUT_MESSAGE;
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
      return '当前网络不可用，请检查网络连接后重试。';
    }
  }
  return '问答生成失败，请稍后重试。';
}

/** 判断是否网络错误 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('offline') ||
      msg.includes('failed to fetch') ||
      msg.includes('net::')
    );
  }
  return false;
}

/**
 * 发送问答请求（通过 Supabase Edge Functions）
 * EARS-1: 返回文化领域回答 + 免责声明
 * EARS-2: 网络不可用时抛出特殊错误以触发离线保留逻辑
 */
export async function sendQaQuestion(
  question: string,
  history: QaMessage[] = [],
  abortSignal?: AbortSignal,
): Promise<AiQaResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('请先登录后再使用问答功能。');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_TIMEOUT_SECONDS * 1000,
  );

  let registered = false;
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => controller.abort());
    registered = true;
  }

  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-qa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ question, history }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }

    return json as AiQaResult;
  } catch (error) {
    clearTimeout(timeout);
    // 标记网络错误，用于触发离线保留
    if (isNetworkError(error)) {
      (error as Error).message = `[OFFLINE]${(error as Error).message}`;
    }
    throw error;
  } finally {
    if (registered && abortSignal) {
      abortSignal.removeEventListener('abort', () => controller.abort());
    }
  }
}

/**
 * 模拟问答返回（开发阶段 / Edge 未部署时使用）
 */
export async function sendQaQuestionMock(
  question: string,
): Promise<AiQaResult> {
  await new Promise((r) => setTimeout(r, 1000));

  return {
    answer: `您的问题是「${question}」，这是一个很有趣的文化知识话题。\n\n根据现有资料，该问题涉及中国历史文化中的重要内容。AI 会结合权威资料给出尽可能准确的回答，同时建议您查阅官方最新资料以获取最准确的信息。\n\n温馨提示：文化旅游相关问题建议结合实地探访与官方权威解读。`,
    disclaimer: QA_DISCLAIMER,
    generated_at: new Date().toISOString(),
  };
}
