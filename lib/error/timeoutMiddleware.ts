/**
 * lib/error/timeoutMiddleware.ts
 *
 * 可配置超时与重试中间件（EARS-21）
 * 覆盖所有 AI 相关功能，默认 T = 60s
 */
import { AI_TIMEOUT_SECONDS, TIMEOUT_MESSAGE } from '@/lib/ai/aiGuideQueries';

export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelayMs?: number;
  /** 是否启用指数退避 */
  exponentialBackoff?: boolean;
}

export interface TimeoutResult<T> {
  data: T | null;
  error: string | null;
  timedOut: boolean;
  retries: number;
}

/**
 * 带超时和重试的请求包装器
 *
 * @param fn 异步请求函数
 * @param options 超时与重试配置
 */
export async function withTimeoutAndRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<TimeoutResult<T>> {
  const {
    maxRetries = 2,
    retryDelayMs = 1000,
    exponentialBackoff = true,
  } = options;

  let lastError: Error | null = null;
  let timedOut = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AI_TIMEOUT_SECONDS * 1000,
    );

    try {
      const result = await fn(controller.signal);
      clearTimeout(timeout);
      return { data: result, error: null, timedOut: false, retries: attempt };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));

      const isTimeout =
        lastError.message.includes('timeout') ||
        lastError.message.includes('aborted') ||
        lastError.message.includes('ETIMEDOUT');

      if (isTimeout) {
        timedOut = true;
      }

      // 如果还有重试机会且不是最后一次
      if (attempt < maxRetries && !timedOut) {
        const delay = exponentialBackoff
          ? retryDelayMs * Math.pow(2, attempt)
          : retryDelayMs;
        await sleep(delay);
      }
    }
  }

  return {
    data: null,
    error: lastError?.message ?? TIMEOUT_MESSAGE,
    timedOut,
    retries: maxRetries,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 对 AI 类请求进行包装（带超时和重试）
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const result = await withTimeoutAndRetry(
    (_signal) => fn(),
    options,
  );
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.data) {
    throw new Error(TIMEOUT_MESSAGE);
  }
  return result.data;
}
