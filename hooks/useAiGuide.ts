/**
 * hooks/useAiGuide.ts
 *
 * AI 导游状态管理 Hook
 * EARS-1: 结构化讲解 + 免责声明 + TTS 文本拼接
 * EARS-2: 登录态门禁 + 超时中文提示 + 重试
 */
import { useCallback, useMemo, useState } from 'react';
import {
  checkLoginForAi,
  generateAiGuide,
  mapAiGuideErrorToChinese,
  type AiGuideResult,
  type AiGuideState,
  type PoiType,
} from '@/lib/ai/aiGuideQueries';

export interface AiGuideRequest {
  poiId: string;
  poiType: PoiType;
  poiName?: string;
  locale?: string;
}

export interface UseAiGuideReturn extends AiGuideState {
  /** 触发讲解生成 */
  generate: (request: AiGuideRequest) => Promise<void>;
  /** 重试上一次请求 */
  retry: () => Promise<void>;
  /** 清空当前结果 */
  reset: () => void;
  /** 上一次请求参数 */
  lastRequest: AiGuideRequest | null;
  /** 当前错误是否为登录门禁 */
  needsLogin: boolean;
  /** 当前结果可播报的完整文本 */
  speakableText: string;
}

function buildSpeakableText(result: AiGuideResult | null): string {
  if (!result) return '';
  const blocks = result.sections.map(
    (section) => `${section.title}。${section.content}`,
  );
  return [...blocks, result.disclaimer].filter(Boolean).join('\n');
}

export function useAiGuide(): UseAiGuideReturn {
  const [state, setState] = useState<AiGuideState>({
    status: 'idle',
    result: null,
    errorMessage: null,
  });
  const [lastRequest, setLastRequest] = useState<AiGuideRequest | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const generate = useCallback(async (request: AiGuideRequest) => {
    setState({ status: 'requesting', result: null, errorMessage: null });
    setLastRequest(request);

    const login = await checkLoginForAi();
    if (!login.loggedIn) {
      setNeedsLogin(true);
      setState({
        status: 'error',
        result: null,
        errorMessage: login.error ?? '请先登录后再使用 AI 讲解功能。',
      });
      return;
    }

    setNeedsLogin(false);
    try {
      const result = await generateAiGuide(
        request.poiId,
        request.poiType,
        request.poiName,
        request.locale,
      );
      setState({ status: 'success', result, errorMessage: null });
    } catch (error) {
      const message = mapAiGuideErrorToChinese(error);
      const loginRequired = message.includes('请先登录');
      setNeedsLogin(loginRequired);
      setState({
        status: message.includes('超时') ? 'timeout' : 'error',
        result: null,
        errorMessage: message,
      });
    }
  }, []);

  const retry = useCallback(async () => {
    if (!lastRequest) return;
    await generate(lastRequest);
  }, [generate, lastRequest]);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, errorMessage: null });
    setLastRequest(null);
    setNeedsLogin(false);
  }, []);

  const speakableText = useMemo(
    () => buildSpeakableText(state.result),
    [state.result],
  );

  return {
    ...state,
    generate,
    retry,
    reset,
    lastRequest,
    needsLogin,
    speakableText,
  };
}
