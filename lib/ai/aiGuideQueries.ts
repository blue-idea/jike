/**
 * lib/ai/aiGuideQueries.ts
 *
 * AI 导游生成链路（EARS-1：结构化讲解 + 免责声明 + TTS + 超时重试）
 * EARS-2 覆盖：调用大模型时强制登录态 + 超时 T 秒中文说明 + 重试
 *
 * 调用约定：实际请求发至 Supabase Edge Functions /ai-guide，
 * 密钥仅存于 Edge 环境变量，客户端不持有。
 */
import { supabase } from '@/lib/supabase';

export interface GuideSection {
  type: 'background' | 'cultural' | 'poetry' | 'story' | 'timeline' | 'attraction';
  title: string;
  content: string;
}

export interface AiGuideResult {
  sections: GuideSection[];
  disclaimer: string;
  poi_name: string;
  generated_at: string;
}

export type AiGuideStatus = 'idle' | 'requesting' | 'success' | 'timeout' | 'error';

export interface AiGuideState {
  status: AiGuideStatus;
  result: AiGuideResult | null;
  errorMessage: string | null;
}

/** 默认超时时间（秒） */
export const AI_TIMEOUT_SECONDS = 60;

/** 中文超时提示 */
export const TIMEOUT_MESSAGE =
  'AI 生成超时（超过 60 秒），请稍后重试。\n如多次失败请检查网络连接。';

/** 中文错误提示（通用） */
export const GENERAL_ERROR_MESSAGE = 'AI 讲解生成失败，请稍后重试。';

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
    if (msg.includes('network') || msg.includes('fetch')) {
      return '网络连接失败，请检查网络后重试。';
    }
  }
  return GENERAL_ERROR_MESSAGE;
}

/**
 * 调用 AI 导游生成（通过 Supabase Edge Functions）
 * EARS-1: 返回结构化讲解（背景、文化解读、诗词、人物故事、时间线、重要看点）+ 免责声明
 * EARS-2: 登录态强制校验，超时 T 秒中文提示 + 重试
 *
 * @param poiId POI 的 Supabase id
 * @param poiType POI 类型（scenic / heritage / museum）
 * @param abortSignal 可选的 AbortSignal，用于主动取消
 */
export async function generateAiGuide(
  poiId: string,
  poiType: 'scenic' | 'heritage' | 'museum',
  abortSignal?: AbortSignal,
): Promise<AiGuideResult> {
  // 获取当前 session（用于 Edge 鉴权）
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('请先登录后再使用 AI 讲解功能。');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_TIMEOUT_SECONDS * 1000,
  );

  // 合并外部 abortSignal
  let registered = false;
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => controller.abort());
    registered = true;
  }

  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-guide`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ poi_id: poiId, poi_type: poiType }),
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

    return json as AiGuideResult;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  } finally {
    if (registered && abortSignal) {
      abortSignal.removeEventListener('abort', () => controller.abort());
    }
  }
}

/**
 * 简化版：模拟 AI 导游返回（开发阶段 / Edge 未部署时使用）
 * 实际生产须替换为真实的 Edge 调用
 */
export async function generateAiGuideMock(
  _poiId: string,
  _poiType: 'scenic' | 'heritage' | 'museum',
): Promise<AiGuideResult> {
  await new Promise((r) => setTimeout(r, 1200)); // 模拟网络延迟

  return {
    poi_name: '示例文化地标',
    generated_at: new Date().toISOString(),
    disclaimer:
      '以上内容由 AI 生成，仅供参考。\n如有疏漏请以官方权威信息为准。',
    sections: [
      {
        type: 'background',
        title: '历史背景',
        content:
          '这里是深厚历史文化积淀之地，始建于古代，历经千年沧桑变迁，留下了丰富的历史遗迹和文化瑰宝。',
      },
      {
        type: 'cultural',
        title: '文化解读',
        content:
          '该文化遗产承载着中华民族独特的文化基因和精神记忆，是研究古代社会生活、宗教信仰、艺术审美的重要实物资料。',
      },
      {
        type: 'poetry',
        title: '相关诗词',
        content:
          '「江山留胜迹，我辈复登临。」\n—— 孟浩然\n登临此地，古今相望，文化传承生生不息。',
      },
      {
        type: 'story',
        title: '人物故事',
        content:
          '历史上有众多文人墨客曾在此留下足迹，他们的故事与思想至今仍激励着后人。',
      },
      {
        type: 'timeline',
        title: '朝代演变',
        content:
          '· 先秦：溯源时期\n· 唐宋：鼎盛时期\n· 明清：集大成时期\n· 近现代：保护与传承',
      },
      {
        type: 'attraction',
        title: '重要看点',
        content: '1. 核心古建筑群\n2. 碑刻与题记\n3. 周边自然景观\n4. 专题展览',
      },
    ],
  };
}

/** 检查是否已登录（未登录时阻止 AI 调用） */
export async function checkLoginForAi(): Promise<{
  loggedIn: boolean;
  error?: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return {
      loggedIn: false,
      error: '请先登录后再使用 AI 讲解功能。',
    };
  }
  return { loggedIn: true };
}
