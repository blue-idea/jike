/**
 * lib/ai/aiItineraryQueries.ts
 *
 * AI 智能行程生成链路（需求9）
 * 1) 已登录用户自然语言生成多日行程草案
 * 2) 支持偏好调整重生
 * 3) 支持手动增删点后的本地重算
 * 4) 超时 T 秒中文提示 + 重试
 *
 * 调用约定：实际请求发至 Supabase Edge Functions /ai-itinerary，
 * 密钥仅存于 Edge 环境变量，客户端不持有。
 */
import { supabase } from '@/lib/supabase';
import {
  AI_TIMEOUT_SECONDS,
  TIMEOUT_MESSAGE,
} from './aiGuideQueries';

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
  lng?: number;
  lat?: number;
}

export interface ItineraryCandidatePoi {
  poi_id: string;
  poi_name: string;
  poi_type: 'scenic' | 'heritage' | 'museum';
  lng: number;
  lat: number;
  label?: string;
  score?: number;
}

export interface ItineraryConstraint {
  /** 自然语言需求，例如："喜欢历史，不要太累，西安两天" */
  query: string;
  /** 目的地关键词，如"西安"、"山西" */
  destination?: string;
  /** 出行天数 */
  days?: number;
  /** 每日时长上限（小时），默认 8 */
  dailyHours?: number;
  /** 体力强度 1-3，默认 2 */
  intensity?: 1 | 2 | 3;
  /** 主题标签，例如 ['历史', '古建'] */
  themeTags?: string[];
  /** 必去 POI id 列表 */
  mustVisitIds?: string[];
  /** 排除 POI id 列表 */
  excludeIds?: string[];
}

export interface AiItineraryResult {
  title: string;
  summary?: string;
  days: ItineraryDay[];
  total_pois: number;
  estimated_days: number;
  generated_at: string;
  candidate_pois?: ItineraryCandidatePoi[];
  constraints?: {
    destination?: string;
    days?: number;
    dailyHours?: number;
    intensity?: 1 | 2 | 3;
    themeTags?: string[];
  };
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
    if (msg.includes('请先登录') || msg.includes('401') || msg.includes('auth')) {
      return '请先登录后再使用智能行程功能。';
    }
    if (
      msg.includes('requested function was not found') ||
      msg.includes('not_found') ||
      msg.includes('http 404')
    ) {
      return 'AI 行程服务未部署（ai-itinerary）。请先在 Supabase 部署 Edge Function 后再试。';
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
  }
  return '行程生成失败，请稍后重试。';
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

function formatStayDuration(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(30, Math.floor(minutes)) : 30;
  const hours = Math.floor(safe / 60);
  const remain = safe % 60;
  if (hours <= 0) return `${remain}分钟`;
  if (remain === 0) return `${hours}小时`;
  return `${hours}小时${remain}分钟`;
}

function normalizeStop(raw: unknown): ItineraryStop | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ItineraryStop>;
  if (
    typeof value.poi_id !== 'string' ||
    typeof value.poi_name !== 'string' ||
    typeof value.poi_type !== 'string'
  ) {
    return null;
  }
  const duration = Number.isFinite(value.duration_minutes)
    ? Math.max(30, Math.floor(value.duration_minutes as number))
    : 60;

  return {
    poi_id: value.poi_id,
    poi_name: value.poi_name,
    poi_type: value.poi_type as ItineraryStop['poi_type'],
    arrival_time:
      typeof value.arrival_time === 'string' && value.arrival_time.trim().length > 0
        ? value.arrival_time
        : '09:00',
    duration_minutes: duration,
    stay_duration:
      typeof value.stay_duration === 'string' && value.stay_duration.trim().length > 0
        ? value.stay_duration
        : formatStayDuration(duration),
    notes: typeof value.notes === 'string' ? value.notes : undefined,
    lng: typeof value.lng === 'number' ? value.lng : undefined,
    lat: typeof value.lat === 'number' ? value.lat : undefined,
  };
}

function normalizeDay(raw: unknown, index: number): ItineraryDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ItineraryDay>;
  const normalizedStops = Array.isArray(value.stops)
    ? value.stops.map((stop) => normalizeStop(stop)).filter((stop): stop is ItineraryStop => Boolean(stop))
    : [];
  if (normalizedStops.length === 0) return null;

  return {
    day: Number.isFinite(value.day) ? Number(value.day) : index + 1,
    date: typeof value.date === 'string' ? value.date : undefined,
    theme: typeof value.theme === 'string' && value.theme.trim().length > 0 ? value.theme : '文化探索',
    stops: normalizedStops,
  };
}

function normalizeCandidate(raw: unknown): ItineraryCandidatePoi | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ItineraryCandidatePoi>;
  if (
    typeof value.poi_id !== 'string' ||
    typeof value.poi_name !== 'string' ||
    typeof value.poi_type !== 'string' ||
    typeof value.lng !== 'number' ||
    typeof value.lat !== 'number'
  ) {
    return null;
  }
  return {
    poi_id: value.poi_id,
    poi_name: value.poi_name,
    poi_type: value.poi_type as ItineraryCandidatePoi['poi_type'],
    lng: value.lng,
    lat: value.lat,
    label: typeof value.label === 'string' ? value.label : undefined,
    score: typeof value.score === 'number' ? value.score : undefined,
  };
}

function normalizeItineraryResult(payload: unknown): AiItineraryResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('行程服务返回为空，请稍后重试。');
  }

  const value = payload as Partial<AiItineraryResult>;
  const days = Array.isArray(value.days)
    ? value.days.map((day, index) => normalizeDay(day, index)).filter((day): day is ItineraryDay => Boolean(day))
    : [];

  if (days.length === 0) {
    throw new Error('行程服务未返回可展示的行程，请重试。');
  }

  const candidatePois = Array.isArray(value.candidate_pois)
    ? value.candidate_pois
        .map((item) => normalizeCandidate(item))
        .filter((item): item is ItineraryCandidatePoi => Boolean(item))
    : [];

  const totalPois = days.reduce((sum, day) => sum + day.stops.length, 0);

  return {
    title:
      typeof value.title === 'string' && value.title.trim().length > 0
        ? value.title
        : '智能行程草案',
    summary: typeof value.summary === 'string' ? value.summary : undefined,
    days,
    total_pois: Number.isFinite(value.total_pois) ? Number(value.total_pois) : totalPois,
    estimated_days: Number.isFinite(value.estimated_days) ? Number(value.estimated_days) : days.length,
    generated_at:
      typeof value.generated_at === 'string' && value.generated_at.trim().length > 0
        ? value.generated_at
        : new Date().toISOString(),
    candidate_pois: candidatePois,
    constraints:
      value.constraints && typeof value.constraints === 'object'
        ? {
            destination:
              typeof value.constraints.destination === 'string'
                ? value.constraints.destination
                : undefined,
            days:
              typeof value.constraints.days === 'number'
                ? value.constraints.days
                : undefined,
            dailyHours:
              typeof value.constraints.dailyHours === 'number'
                ? value.constraints.dailyHours
                : undefined,
            intensity:
              typeof value.constraints.intensity === 'number'
                ? (value.constraints.intensity as 1 | 2 | 3)
                : undefined,
            themeTags: Array.isArray(value.constraints.themeTags)
              ? value.constraints.themeTags.filter((item): item is string => typeof item === 'string')
              : undefined,
          }
        : undefined,
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
    return '请先登录后再使用智能行程功能。';
  }
  if (response.status === 404) {
    return 'AI 行程服务未部署（ai-itinerary）。请先在 Supabase 部署 Edge Function 后再试。';
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
 * 调用 AI 行程生成（通过 Supabase Edge Functions）
 * 需求9：解析自然语言偏好约束，生成多日行程草案，支持偏好调整重生
 * 需求17：超时 T 秒中文提示 + 重试
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
  if (!constraints.query?.trim()) {
    throw new Error('请输入自然语言出行需求后再生成行程。');
  }
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('未配置 Supabase 地址，无法调用 AI 行程服务。');
  }

  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  const timeout = setTimeout(handleAbort, AI_TIMEOUT_SECONDS * 1000);

  if (abortSignal) {
    abortSignal.addEventListener('abort', handleAbort);
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/ai-itinerary`,
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

    if (!response.ok) {
      throw new Error(await readEdgeError(response));
    }

    const json = (await response.json()) as EdgeResponseShape | AiItineraryResult;
    if ('error' in (json as EdgeResponseShape) && (json as EdgeResponseShape).error) {
      const err = (json as EdgeResponseShape).error;
      if (typeof err === 'string') throw new Error(err);
      throw new Error(err?.message_zh ?? err?.message ?? err?.code ?? '行程生成失败，请稍后重试。');
    }

    const payload = 'data' in (json as EdgeResponseShape)
      ? (json as EdgeResponseShape).data
      : json;
    return normalizeItineraryResult(payload);
  } catch (error) {
    throw new Error(mapErrorToChinese(error));
  } finally {
    clearTimeout(timeout);
    if (abortSignal) {
      abortSignal.removeEventListener('abort', handleAbort);
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
    summary: constraints.query,
    days: result,
    total_pois: pois.length,
    estimated_days: days,
    generated_at: new Date().toISOString(),
    candidate_pois: pois.map((item) => ({
      poi_id: item.id,
      poi_name: item.name,
      poi_type: item.type,
      lng: 108.95,
      lat: 34.26,
    })),
    constraints: {
      destination: constraints.destination,
      days,
      dailyHours: constraints.dailyHours,
      intensity: constraints.intensity,
      themeTags: constraints.themeTags,
    },
  };
}

/** 偏好调整后重新生成 */
export async function regenerateItinerary(
  previousConstraints: ItineraryConstraint,
  newConstraints: Partial<ItineraryConstraint>,
): Promise<AiItineraryResult> {
  return generateItinerary({
    ...previousConstraints,
    ...newConstraints,
    query: newConstraints.query ?? previousConstraints.query,
  });
}

export function recomputeDayStops(stops: ItineraryStop[]): ItineraryStop[] {
  const ordered = optimizeStopsOrder(stops);
  let minute = 9 * 60;
  return ordered.map((stop) => {
    const duration = Number.isFinite(stop.duration_minutes)
      ? Math.max(30, Math.floor(stop.duration_minutes))
      : 60;
    const arrival = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    minute += duration + 30;
    return {
      ...stop,
      arrival_time: arrival,
      duration_minutes: duration,
      stay_duration: formatStayDuration(duration),
    };
  });
}

function optimizeStopsOrder(stops: ItineraryStop[]): ItineraryStop[] {
  if (stops.length <= 2) return [...stops];
  const hasGeo = stops.every(
    (stop) => typeof stop.lng === 'number' && typeof stop.lat === 'number',
  );
  if (!hasGeo) return [...stops];

  const remaining = new Set(stops.map((_, index) => index));
  const result: ItineraryStop[] = [];
  let current = 0;
  result.push(stops[current]);
  remaining.delete(current);

  while (remaining.size > 0) {
    const currentStop = result[result.length - 1];
    let nextIndex = -1;
    let nearest = Number.POSITIVE_INFINITY;

    for (const index of remaining) {
      const candidate = stops[index];
      const distance = simpleDistance(
        currentStop.lat as number,
        currentStop.lng as number,
        candidate.lat as number,
        candidate.lng as number,
      );
      if (distance < nearest) {
        nearest = distance;
        nextIndex = index;
      }
    }
    if (nextIndex < 0) break;
    result.push(stops[nextIndex]);
    remaining.delete(nextIndex);
  }

  return result;
}

function simpleDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return dLat * dLat + dLng * dLng;
}

export function recomputeItineraryResult(result: AiItineraryResult): AiItineraryResult {
  const days = result.days.map((day) => ({
    ...day,
    stops: recomputeDayStops(day.stops),
  }));
  const total_pois = days.reduce((sum, day) => sum + day.stops.length, 0);
  return {
    ...result,
    days,
    total_pois,
    estimated_days: days.length,
  };
}
