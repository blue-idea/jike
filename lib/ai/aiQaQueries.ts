/**
 * lib/ai/aiQaQueries.ts
 *
 * AI 文化知识问答链路（EARS-1：文化领域回答 + 免责声明）
 * EARS-2 覆盖：离线输入保留 + 网络恢复重发，超时 T 秒中文提示 + 重试
 *
 * 调用约定：实际请求发至 Supabase Edge Functions /ai-chat，
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

interface EdgeErrorShape {
  code?: string;
  message_zh?: string;
  message?: string;
}

interface EdgeResponseShape {
  data?: unknown;
  error?: string | EdgeErrorShape | null;
}

interface QaRequestPayload {
  query: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
}

function isLikelyNetworkError(error: unknown): boolean {
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

function getNavigatorOnLine(): boolean | null {
  const maybeNavigator = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  if (typeof maybeNavigator?.onLine === 'boolean') {
    return maybeNavigator.onLine;
  }
  return null;
}

function isLikelyOfflineTransportError(error: unknown): boolean {
  if (!isLikelyNetworkError(error)) return false;

  const navigatorOnLine = getNavigatorOnLine();
  if (navigatorOnLine === false) {
    return true;
  }

  // In web, "online + fetch failed" usually means CORS/preflight/deploy issues, not offline.
  const hasWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const hasDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');
  if (hasWindow && hasDocument && navigatorOnLine === true) {
    return false;
  }

  // In native RN there is no browser preflight; transport failures are usually real network issues.
  return true;
}

export function mapQaErrorToChinese(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('请先登录') || msg.includes('401') || msg.includes('auth')) {
      return '请先登录后再使用问答功能。';
    }
    if (
      msg.includes('requested function was not found') ||
      msg.includes('not_found') ||
      msg.includes('http 404')
    ) {
      return 'AI 问答服务未部署（ai-chat）。请先在 Supabase 部署 Edge Function 后再试。';
    }
    if (
      msg.includes('timeout') ||
      msg.includes('etimedout') ||
      msg.includes('aborted')
    ) {
      return TIMEOUT_MESSAGE;
    }
    if (isLikelyOfflineTransportError(error)) {
      return '\u5f53\u524d\u7f51\u7edc\u4e0d\u53ef\u7528\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u540e\u91cd\u8bd5\u3002';
    }
    if (isLikelyNetworkError(error)) {
      return 'AI \u95ee\u7b54\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\uff08\u53ef\u80fd\u672a\u90e8\u7f72 ai-chat \u6216\u8de8\u57df\u9884\u68c0\u5931\u8d25\uff09\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002';
    }
    if (msg.includes('429') || msg.includes('rate')) {
      return '当前请求过于频繁，请稍后重试。';
    }
  }
  return '问答生成失败，请稍后重试。';
}

async function readEdgeError(response: Response): Promise<string> {
  let body: EdgeResponseShape | null = null;
  try {
    body = (await response.json()) as EdgeResponseShape;
  } catch {
    body = null;
  }

  if (response.status === 401) {
    return '请先登录后再使用问答功能。';
  }
  if (response.status === 404) {
    return 'AI 问答服务未部署（ai-chat）。请先在 Supabase 部署 Edge Function 后再试。';
  }
  if (response.status === 408 || response.status === 504) {
    return TIMEOUT_MESSAGE;
  }

  if (!body?.error) {
    return `HTTP ${response.status}`;
  }

  if (typeof body.error === 'string') {
    return body.error;
  }

  if (body.error.message_zh) return body.error.message_zh;
  if (body.error.message) return body.error.message;
  if (body.error.code) return body.error.code;
  return `HTTP ${response.status}`;
}

function normalizeQaResult(payload: unknown): AiQaResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('AI 服务返回内容为空，请稍后重试。');
  }

  const raw = payload as Partial<AiQaResult>;
  const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
  if (!answer) {
    throw new Error('AI 服务未返回有效回答，请重试。');
  }

  const disclaimer =
    typeof raw.disclaimer === 'string' && raw.disclaimer.trim().length > 0
      ? raw.disclaimer
      : QA_DISCLAIMER;

  const sources =
    Array.isArray(raw.sources) && raw.sources.every((item) => typeof item === 'string')
      ? raw.sources
      : undefined;

  return {
    answer,
    disclaimer,
    sources,
    generated_at:
      typeof raw.generated_at === 'string' && raw.generated_at.trim().length > 0
        ? raw.generated_at
        : new Date().toISOString(),
  };
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
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('未配置 Supabase 地址，无法调用 AI 问答服务。');
  }

  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  const timeout = setTimeout(handleAbort, AI_TIMEOUT_SECONDS * 1000);

  const payload: QaRequestPayload = {
    query: question,
    messages: history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
  };

  if (abortSignal) {
    abortSignal.addEventListener('abort', handleAbort);
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/ai-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(await readEdgeError(response));
    }

    const json = (await response.json()) as EdgeResponseShape | AiQaResult;
    if ('error' in (json as EdgeResponseShape) && (json as EdgeResponseShape).error) {
      const err = (json as EdgeResponseShape).error;
      if (typeof err === 'string') throw new Error(err);
      throw new Error(err?.message_zh ?? err?.message ?? err?.code ?? '问答生成失败，请稍后重试。');
    }

    const responseData = 'data' in (json as EdgeResponseShape)
      ? (json as EdgeResponseShape).data
      : json;
    return normalizeQaResult(responseData);
  } catch (error) {
    const message = mapQaErrorToChinese(error);
    if (isLikelyOfflineTransportError(error)) {
      throw new Error(`[OFFLINE]${message}`);
    }
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
    if (abortSignal) {
      abortSignal.removeEventListener('abort', handleAbort);
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
