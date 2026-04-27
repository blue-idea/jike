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

export type PoiType = 'scenic' | 'heritage' | 'museum';

export interface GuideSection {
  type:
    | 'background'
    | 'cultural'
    | 'poetry'
    | 'story'
    | 'timeline'
    | 'attraction';
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
export const AI_TIMEOUT_SECONDS = (() => {
  const raw = Number(process.env.EXPO_PUBLIC_AI_TIMEOUT_SECONDS ?? '60');
  if (!Number.isFinite(raw) || raw <= 0) return 60;
  return Math.floor(raw);
})();

/** 中文超时提示 */
export const TIMEOUT_MESSAGE =
  `AI 生成超时（超过 ${AI_TIMEOUT_SECONDS} 秒），请稍后重试。\n如多次失败请检查网络连接。`;

/** 中文错误提示（通用） */
export const GENERAL_ERROR_MESSAGE = 'AI 讲解生成失败，请稍后重试。';
export const DEFAULT_GUIDE_DISCLAIMER =
  '以上内容由 AI 生成，仅供参考。\n如有疏漏请以官方权威信息为准。';

export function mapAiGuideErrorToChinese(error: unknown): string {
  if (error instanceof Error) {
    const raw = error.message;
    const msg = raw.toLowerCase();
    if (msg.includes('未部署') || msg.includes('未配置')) {
      return raw;
    }
    if (msg.includes('请先登录') || msg.includes('401') || msg.includes('auth')) {
      return '请先登录后再使用 AI 讲解功能。';
    }
    if (
      msg.includes('requested function was not found') ||
      msg.includes('not_found') ||
      msg.includes('http 404')
    ) {
      return 'AI 导游服务未部署（ai-guide）。请先在 Supabase 部署 Edge Function 后再试。';
    }
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
    if (msg.includes('429') || msg.includes('rate')) {
      return '当前请求过于频繁，请稍后重试。';
    }
  }
  return GENERAL_ERROR_MESSAGE;
}

interface GenerateAiGuideRequest {
  poi_id: string;
  poi_type: PoiType;
  poi_name?: string;
  locale?: string;
}

interface EdgeErrorShape {
  code?: string;
  message_zh?: string;
  message?: string;
}

interface EdgeResponseShape {
  data?: unknown;
  error?: string | EdgeErrorShape | null;
}

function parseGuideSections(input: unknown): GuideSection[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const section = item as Partial<GuideSection>;
      if (
        typeof section.type !== 'string' ||
        typeof section.title !== 'string' ||
        typeof section.content !== 'string'
      ) {
        return null;
      }
      return {
        type: section.type as GuideSection['type'],
        title: section.title,
        content: section.content,
      };
    })
    .filter((item): item is GuideSection => Boolean(item));
}

function normalizeAiGuideResult(payload: unknown): AiGuideResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('AI 服务返回内容为空，请稍后重试。');
  }

  const raw = payload as Partial<AiGuideResult>;
  const sections = parseGuideSections(raw.sections);
  if (sections.length === 0) {
    throw new Error('AI 服务未返回可展示讲解内容，请重试。');
  }

  return {
    sections,
    disclaimer:
      typeof raw.disclaimer === 'string' && raw.disclaimer.trim().length > 0
        ? raw.disclaimer
        : DEFAULT_GUIDE_DISCLAIMER,
    poi_name:
      typeof raw.poi_name === 'string' && raw.poi_name.trim().length > 0
        ? raw.poi_name
        : '文化地标',
    generated_at:
      typeof raw.generated_at === 'string' && raw.generated_at.trim().length > 0
        ? raw.generated_at
        : new Date().toISOString(),
  };
}

async function readEdgeError(response: Response): Promise<string> {
  let body: EdgeResponseShape | null = null;
  try {
    body = (await response.json()) as EdgeResponseShape;
  } catch {
    body = null;
  }

  if (response.status === 401) {
    return '请先登录后再使用 AI 讲解功能。';
  }
  if (response.status === 404) {
    return 'AI 导游服务未部署（ai-guide）。请先在 Supabase 部署 Edge Function 后再试。';
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

/**
 * 调用 AI 导游生成（通过 Supabase Edge Functions）
 * EARS-1: 返回结构化讲解（背景、文化解读、主要看点、人物故事、时间线、参观建议）+ 免责声明
 * EARS-2: 登录态强制校验，超时 T 秒中文提示 + 重试
 *
 * @param poiId POI 的 Supabase id
 * @param poiType POI 类型（scenic / heritage / museum）
 * @param locale 语言区域
 * @param abortSignal 可选的 AbortSignal，用于主动取消
 */
export async function generateAiGuide(
  poiId: string,
  poiType: PoiType,
  poiName?: string,
  locale = 'zh-CN',
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
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('未配置 Supabase 地址，无法调用 AI 服务。');
  }

  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  const timeout = setTimeout(
    handleAbort,
    AI_TIMEOUT_SECONDS * 1000,
  );

  // 合并外部 abortSignal
  if (abortSignal) {
    abortSignal.addEventListener('abort', handleAbort);
  }

  try {
    const body: GenerateAiGuideRequest = {
      poi_id: poiId,
      poi_type: poiType,
      ...(poiName ? { poi_name: poiName } : {}),
      locale,
    };

    const response = await fetch(
      `${supabaseUrl}/functions/v1/ai-guide`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const edgeError = await readEdgeError(response);
      throw new Error(edgeError);
    }

    const json = (await response.json()) as EdgeResponseShape | AiGuideResult;
    if ('error' in (json as EdgeResponseShape) && (json as EdgeResponseShape).error) {
      const err = (json as EdgeResponseShape).error;
      if (typeof err === 'string') throw new Error(err);
      throw new Error(err?.message_zh ?? err?.message ?? err?.code ?? GENERAL_ERROR_MESSAGE);
    }

    const payload = 'data' in (json as EdgeResponseShape)
      ? (json as EdgeResponseShape).data
      : json;
    return normalizeAiGuideResult(payload);
  } catch (error) {
    throw new Error(mapAiGuideErrorToChinese(error));
  } finally {
    clearTimeout(timeout);
    if (abortSignal) {
      abortSignal.removeEventListener('abort', handleAbort);
    }
  }
}

/**
 * 简化版：模拟 AI 导游返回（开发阶段 / Edge 未部署时使用）
 * 实际生产须替换为真实的 Edge 调用
 */
export async function generateAiGuideMock(
  _poiId: string,
  _poiType: PoiType,
): Promise<AiGuideResult> {
  await new Promise((r) => setTimeout(r, 1200)); // 模拟网络延迟

  return {
    poi_name: '示例文化地标',
    generated_at: new Date().toISOString(),
    disclaimer: DEFAULT_GUIDE_DISCLAIMER,
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
        title: '主要看点',
        content:
          '建议优先关注最具代表性的主体建筑、标志性展陈、空间轴线和最能体现地方文化特征的细节，这些通常是理解整个景点的最佳切入口。',
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
        title: '参观建议',
        content:
          '1. 先看核心区域，再补充边缘空间\n2. 优先阅读现场说明牌\n3. 适合结合讲解或语音播报慢速参观\n4. 若时间有限，可围绕一条主线深看而非走马观花',
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
