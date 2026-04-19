/**
 * lib/ai/aiItineraryQueries.ts
 *
 * AI 智能行程生成链路（EARS-1：自然语言解析 + 多日行程草案 + 偏好调整）
 * EARS-2 覆盖：超时 T 秒中文提示 + 重试
 *
 * 调用约定：实际请求发至 Supabase Edge Functions /ai-itinerary，
 * 密钥仅存于 Edge 环境变量，客户端不持有。
 */
import { supabase } from '@/lib/supabase';
import { AI_TIMEOUT_SECONDS, TIMEOUT_MESSAGE } from './aiGuideQueries';

export interface ItineraryDay {
  day: number;
  date?: string;
  theme: string;
  stops: ItineraryStop[];
}

export interface ItineraryStop {
  poi_id: string;
  poi_name: string;
  poi_type: 'scenic' | 'heritage' | 'museum';
  arrival_time: string;
  duration_minutes: number;
  stay_duration: string; // e.g. "2小时"
  notes?: string;
}

export interface ItineraryConstraint {
  /** 目的地关键词，如"西安"、"山西" */
  destination?: string;
  /** 出行天数 */
  days?: number;
  /** 每日时长上限（小时），默认 8 */
  dailyHours?: number;
  /** 体力强度 1-3，默认 2 */
  intensity?: 1 | 2 | 3;
  /** 必去 POI id 列表 */
  mustVisitIds?: string[];
  /** 排除 POI id 列表 */
  excludeIds?: string[];
  /** 其他偏好（文本） */
  otherPreferences?: string;
}

export interface AiItineraryResult {
  title: string;
  days: ItineraryDay[];
  total_pois: number;
  estimated_days: number;
  generated_at: string;
}

export type ItineraryStatus = 'idle' | 'generating' | 'success' | 'timeout' | 'error';

export interface ItineraryState {
  status: ItineraryStatus;
  result: AiItineraryResult | null;
  errorMessage: string | null;
}

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
  return '行程生成失败，请稍后重试。';
}

/**
 * 调用 AI 行程生成（通过 Supabase Edge Functions）
 * EARS-1: 解析自然语言偏好约束，生成多日行程草案，支持偏好调整重生
 * EARS-2: 超时 T 秒中文提示 + 重试
 */
export async function generateItinerary(
  constraints: ItineraryConstraint,
  abortSignal?: AbortSignal,
): Promise<AiItineraryResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('请先登录后再使用智能行程功能。');
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
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-itinerary`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ constraints }),
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

    return json as AiItineraryResult;
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
 * 模拟 AI 行程返回（开发阶段 / Edge 未部署时使用）
 */
export async function generateItineraryMock(
  constraints: ItineraryConstraint,
): Promise<AiItineraryResult> {
  await new Promise((r) => setTimeout(r, 1500));

  const days = constraints.days ?? 3;
  const pois = [
    { id: 's1', name: '秦始皇帝陵博物院', type: 'scenic' as const, dur: 180 },
    { id: 'h1', name: '大雁塔', type: 'heritage' as const, dur: 90 },
    { id: 'm1', name: '陕西历史博物馆', type: 'museum' as const, dur: 150 },
    { id: 's2', name: '西安城墙', type: 'scenic' as const, dur: 90 },
    { id: 'h2', name: '华清池', type: 'heritage' as const, dur: 120 },
    { id: 's3', name: '华山风景名胜区', type: 'scenic' as const, dur: 240 },
  ];

  const result: ItineraryDay[] = [];
  for (let d = 0; d < days; d++) {
    const dayPois = pois.slice((d * 2) % pois.length, (d * 2) % pois.length + 2);
    let cumulative = 9 * 60; // start at 9:00 AM
    result.push({
      day: d + 1,
      theme: ['历史探秘', '文化沉浸', '自然揽胜'][d % 3],
      stops: dayPois.map((p, i) => {
        const arrival = `${String(Math.floor(cumulative / 60)).padStart(2, '0')}:${String(cumulative % 60).padStart(2, '0')}`;
        const dur = p.dur;
        cumulative += dur + 30; // +30 min transit
        return {
          poi_id: p.id,
          poi_name: p.name,
          poi_type: p.type,
          arrival_time: arrival,
          duration_minutes: dur,
          stay_duration: `${Math.round(dur / 60)}小时`,
          notes: i === 0 ? '建议提前预约' : undefined,
        };
      }),
    });
  }

  return {
    title: `${constraints.destination ?? '西安'}·${days}日文化之旅`,
    days: result,
    total_pois: pois.length,
    estimated_days: days,
    generated_at: new Date().toISOString(),
  };
}

/** 重新生成时在原约束基础上更新 */
export async function regenerateItinerary(
  previousResult: AiItineraryResult,
  newConstraints: Partial<ItineraryConstraint>,
): Promise<AiItineraryResult> {
  // 从上一次结果中提取必去点
  const mustVisitIds = [
    ...(newConstraints.mustVisitIds ?? []),
    ...previousResult.days.flatMap((d) =>
      d.stops.map((s) => s.poi_id),
    ),
  ];
  return generateItinerary(
    { ...newConstraints, mustVisitIds },
  );
}
