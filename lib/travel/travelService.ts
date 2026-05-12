/**
 * lib/travel/travelService.ts
 *
 * 需求12：轨迹记录与 AI 游记生成同步
 * - 行程会话按采样策略记录轨迹点与时间戳
 * - 轨迹点就近关联 POI
 * - 已登录：仅通过 Supabase Edge 生成游记，并可同步 user_journey / user_travel_logs
 * - 未登录：仅本地保存，禁止云端生成
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import {
  calcDistance,
  getCurrentLocationWithPermission,
  type LocationCoords,
} from '@/lib/location/locationService';
import { queryNearbyPoisRPC, type PoiType } from '@/lib/location/nearbyQueries';
import { AI_TIMEOUT_SECONDS, TIMEOUT_MESSAGE } from '@/lib/ai/aiGuideQueries';

export interface TrajectoryPoint {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: string;
  poi_id?: string;
  poi_name?: string;
  poi_type?: PoiType;
  poi_distance_m?: number;
}

export interface TravelSession {
  id: string;
  title: string;
  started_at: string;
  ended_at?: string;
  points: TrajectoryPoint[];
  sample_interval_seconds: number;
  sample_min_distance_m: number;
  updated_at: string;
  cloud_journey_id?: string;
}

export interface TravelJournalDraft {
  id: string;
  session_id: string;
  title: string;
  content: string;
  excerpt: string;
  point_count: number;
  poi_count: number;
  created_at: string;
  updated_at: string;
  synced: boolean;
  cloud_log_id?: string;
}

interface GenerateTravelJournalResponse {
  title?: string;
  content?: string;
  excerpt?: string;
  point_count?: number;
  poi_count?: number;
  generated_at?: string;
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

interface UserJourneyRow {
  id: string;
}

interface UserTravelLogRow {
  id: string;
}

export const TRACK_SAMPLE_INTERVAL_SECONDS = (() => {
  const raw = Number(process.env.EXPO_PUBLIC_TRACK_SAMPLE_INTERVAL_SECONDS ?? '30');
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.floor(raw);
})();

export const TRACK_SAMPLE_MIN_DISTANCE_M = (() => {
  const raw = Number(process.env.EXPO_PUBLIC_TRACK_SAMPLE_MIN_DISTANCE_M ?? '80');
  if (!Number.isFinite(raw) || raw <= 0) return 80;
  return Math.floor(raw);
})();

const TRAJECTORY_STORAGE_KEY = '@travel_sessions_v1';
const JOURNAL_STORAGE_KEY = '@travel_journals_v1';
const POI_ASSOCIATION_RADIUS_M = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function generateTrajectoryPointId(): string {
  return `tp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateDraftId(): string {
  return `journal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getUserContext(): Promise<{ userId: string; accessToken: string } | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  if (!userId || !accessToken) return null;
  return { userId, accessToken };
}

async function readLocalSessions(): Promise<TravelSession[]> {
  const raw = await AsyncStorage.getItem(TRAJECTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TravelSession => {
      return Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as TravelSession).id === 'string' &&
          Array.isArray((item as TravelSession).points),
      );
    });
  } catch {
    return [];
  }
}

async function writeLocalSessions(sessions: TravelSession[]): Promise<void> {
  await AsyncStorage.setItem(TRAJECTORY_STORAGE_KEY, JSON.stringify(sessions));
}

async function upsertLocalSession(session: TravelSession): Promise<void> {
  const sessions = await readLocalSessions();
  const index = sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  await writeLocalSessions(sessions);
}

async function readLocalJournals(): Promise<TravelJournalDraft[]> {
  const raw = await AsyncStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TravelJournalDraft => {
      return Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as TravelJournalDraft).id === 'string' &&
          typeof (item as TravelJournalDraft).session_id === 'string',
      );
    });
  } catch {
    return [];
  }
}

async function writeLocalJournals(journals: TravelJournalDraft[]): Promise<void> {
  await AsyncStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journals));
}

function uniquePoiCount(points: TrajectoryPoint[]): number {
  return new Set(points.filter((item) => item.poi_id).map((item) => item.poi_id)).size;
}

function shouldSamplePoint(
  previous: TrajectoryPoint | undefined,
  nextCoords: LocationCoords,
  nextTimestamp: string,
  session: TravelSession,
): boolean {
  if (!previous) return true;

  const prevTime = Date.parse(previous.timestamp);
  const nextTime = Date.parse(nextTimestamp);
  const elapsedSeconds = Number.isFinite(prevTime) && Number.isFinite(nextTime)
    ? Math.max(0, (nextTime - prevTime) / 1000)
    : session.sample_interval_seconds;

  const distance = calcDistance(previous.lat, previous.lng, nextCoords.lat, nextCoords.lng);

  return (
    elapsedSeconds >= session.sample_interval_seconds ||
    distance >= session.sample_min_distance_m
  );
}

async function attachNearbyPoi(point: TrajectoryPoint): Promise<TrajectoryPoint> {
  try {
    const nearby = await queryNearbyPoisRPC(
      { lng: point.lng, lat: point.lat },
      { radiusM: POI_ASSOCIATION_RADIUS_M, limit: 1 },
    );
    const nearest = nearby[0];
    if (!nearest) return point;
    return {
      ...point,
      poi_id: nearest.id,
      poi_name: nearest.name,
      poi_type: nearest.poi_type,
      poi_distance_m: nearest.distance_m,
    };
  } catch {
    return point;
  }
}

function normalizeJournalPayload(payload: unknown, session: TravelSession): TravelJournalDraft {
  if (!payload || typeof payload !== 'object') {
    throw new Error('游记服务返回为空，请稍后重试。');
  }

  const value = payload as GenerateTravelJournalResponse;
  const title = typeof value.title === 'string' && value.title.trim().length > 0
    ? value.title.trim()
    : session.title || '我的文化行程游记';
  const content = typeof value.content === 'string' && value.content.trim().length > 0
    ? value.content.trim()
    : '本次游记内容暂不可用，请稍后重试生成。';

  const excerpt = typeof value.excerpt === 'string' && value.excerpt.trim().length > 0
    ? value.excerpt.trim()
    : content.slice(0, 120);

  return {
    id: generateDraftId(),
    session_id: session.id,
    title,
    content,
    excerpt,
    point_count:
      typeof value.point_count === 'number' && Number.isFinite(value.point_count)
        ? Math.max(0, Math.floor(value.point_count))
        : session.points.length,
    poi_count:
      typeof value.poi_count === 'number' && Number.isFinite(value.poi_count)
        ? Math.max(0, Math.floor(value.poi_count))
        : uniquePoiCount(session.points),
    created_at: nowIso(),
    updated_at: nowIso(),
    synced: false,
  };
}

function mapTravelErrorToChinese(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('请先登录') || msg.includes('401') || msg.includes('unauthorized')) {
      return '请先登录后再生成游记。';
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return 'AI 游记服务未部署（ai-travel-journal）。请先在 Supabase 部署 Edge Function 后再试。';
    }
    if (
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('etimedout')
    ) {
      return TIMEOUT_MESSAGE;
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return '网络连接失败，请检查网络后重试。';
    }
    if (error.message.trim().length > 0) {
      return error.message;
    }
  }
  return '游记生成失败，请稍后重试。';
}

async function readEdgeError(response: Response): Promise<string> {
  let body: EdgeResponseShape | null = null;
  try {
    body = (await response.json()) as EdgeResponseShape;
  } catch {
    body = null;
  }

  if (response.status === 401) return '请先登录后再生成游记。';
  if (response.status === 404) return 'AI 游记服务未部署（ai-travel-journal）。请先在 Supabase 部署 Edge Function 后再试。';
  if (response.status === 408 || response.status === 504) return TIMEOUT_MESSAGE;

  const err = body?.error;
  if (!err) return `HTTP ${response.status}`;
  if (typeof err === 'string') return err;
  return err.message_zh ?? err.message ?? err.code ?? `HTTP ${response.status}`;
}

async function findJourneyCloudId(userId: string, sessionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_journey')
    .select('id')
    .eq('user_id', userId)
    .contains('payload', { session_id: sessionId })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as UserJourneyRow | null)?.id ?? null;
}

async function findTravelLogCloudId(userId: string, sessionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_travel_logs')
    .select('id')
    .eq('user_id', userId)
    .contains('metadata', { session_id: sessionId })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as UserTravelLogRow | null)?.id ?? null;
}

export async function createTravelSession(title?: string): Promise<TravelSession> {
  const timestamp = nowIso();
  const session: TravelSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: title?.trim() || `文化行程 ${new Date().toLocaleDateString('zh-CN')}`,
    started_at: timestamp,
    points: [],
    sample_interval_seconds: TRACK_SAMPLE_INTERVAL_SECONDS,
    sample_min_distance_m: TRACK_SAMPLE_MIN_DISTANCE_M,
    updated_at: timestamp,
  };
  await upsertLocalSession(session);
  return session;
}

export async function getTravelSession(sessionId: string): Promise<TravelSession | null> {
  const sessions = await readLocalSessions();
  return sessions.find((item) => item.id === sessionId) ?? null;
}

export async function getLocalTravelSessions(): Promise<TravelSession[]> {
  const sessions = await readLocalSessions();
  return [...sessions].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export async function finishTravelSession(sessionId: string): Promise<TravelSession | null> {
  const session = await getTravelSession(sessionId);
  if (!session) return null;

  const updated: TravelSession = {
    ...session,
    ended_at: session.ended_at ?? nowIso(),
    updated_at: nowIso(),
  };
  await upsertLocalSession(updated);

  const user = await getUserContext();
  if (user) {
    try {
      const cloudJourneyId = await syncSessionToCloud(updated.id);
      if (cloudJourneyId) {
        const refreshed: TravelSession = { ...updated, cloud_journey_id: cloudJourneyId };
        await upsertLocalSession(refreshed);
        return refreshed;
      }
    } catch {
      // 本地会话已保存，云同步失败时不阻断
    }
  }

  return updated;
}

export async function sampleTrajectoryPoint(
  sessionId: string,
  options: { force?: boolean } = {},
): Promise<{ sampled: boolean; session: TravelSession | null; reason?: string }> {
  const session = await getTravelSession(sessionId);
  if (!session) {
    return { sampled: false, session: null, reason: '未找到行程会话。' };
  }

  const location = await getCurrentLocationWithPermission();
  if (!location.coords) {
    return {
      sampled: false,
      session,
      reason: location.error ?? '定位不可用，无法记录轨迹。',
    };
  }

  const timestamp = nowIso();
  const previous = session.points[session.points.length - 1];

  if (!options.force && !shouldSamplePoint(previous, location.coords, timestamp, session)) {
    return {
      sampled: false,
      session,
      reason: '未达到采样间隔或位移阈值，本次跳过。',
    };
  }

  const basePoint: TrajectoryPoint = {
    id: generateTrajectoryPointId(),
    lat: location.coords.lat,
    lng: location.coords.lng,
    accuracy: null,
    timestamp,
  };

  const point = await attachNearbyPoi(basePoint);

  const updated: TravelSession = {
    ...session,
    points: [...session.points, point],
    updated_at: timestamp,
  };

  await upsertLocalSession(updated);

  const user = await getUserContext();
  if (user) {
    try {
      await syncSessionToCloud(updated.id);
    } catch {
      // 忽略云同步失败，保证本地记录连续性
    }
  }

  return { sampled: true, session: updated };
}

export async function syncSessionToCloud(sessionId: string): Promise<string | null> {
  const session = await getTravelSession(sessionId);
  if (!session) {
    throw new Error('未找到对应行程记录。');
  }

  const user = await getUserContext();
  if (!user) {
    return null;
  }

  const payload = {
    session_id: session.id,
    started_at: session.started_at,
    ended_at: session.ended_at ?? null,
    points: session.points,
    sample_strategy: {
      sample_interval_seconds: session.sample_interval_seconds,
      sample_min_distance_m: session.sample_min_distance_m,
    },
    poi_count: uniquePoiCount(session.points),
  };

  const status = session.ended_at ? 'completed' : 'recording';
  const existedId = session.cloud_journey_id ?? (await findJourneyCloudId(user.userId, session.id));

  if (existedId) {
    const { error } = await supabase
      .from('user_journey')
      .update({
        title: session.title,
        status,
        payload,
        updated_at: nowIso(),
      })
      .eq('id', existedId)
      .eq('user_id', user.userId);
    if (error) throw error;

    const refreshed: TravelSession = {
      ...session,
      cloud_journey_id: existedId,
      updated_at: nowIso(),
    };
    await upsertLocalSession(refreshed);
    return existedId;
  }

  const { data, error } = await supabase
    .from('user_journey')
    .insert({
      user_id: user.userId,
      title: session.title,
      status,
      payload,
    })
    .select('id')
    .single();

  if (error) throw error;
  const cloudId = (data as UserJourneyRow).id;

  const refreshed: TravelSession = {
    ...session,
    cloud_journey_id: cloudId,
    updated_at: nowIso(),
  };
  await upsertLocalSession(refreshed);

  return cloudId;
}

export async function generateTravelJournal(
  sessionId: string,
): Promise<TravelJournalDraft> {
  const user = await getUserContext();
  if (!user) {
    throw new Error('请先登录后再生成游记。');
  }

  const session = await getTravelSession(sessionId);
  if (!session) {
    throw new Error('未找到对应行程记录。');
  }
  if (session.points.length < 2) {
    throw new Error('轨迹点过少，请先开始行程记录后再生成游记。');
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('未配置 Supabase 地址，无法调用 AI 游记服务。');
  }

  await syncSessionToCloud(session.id);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_SECONDS * 1000);

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/ai-travel-journal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          session: {
            id: session.id,
            title: session.title,
            started_at: session.started_at,
            ended_at: session.ended_at,
            points: session.points,
          },
          locale: 'zh-CN',
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(await readEdgeError(response));
    }

    const json = (await response.json()) as EdgeResponseShape | GenerateTravelJournalResponse;

    if ('error' in (json as EdgeResponseShape) && (json as EdgeResponseShape).error) {
      const err = (json as EdgeResponseShape).error;
      if (typeof err === 'string') throw new Error(err);
      throw new Error(err?.message_zh ?? err?.message ?? err?.code ?? '游记生成失败，请稍后重试。');
    }

    const payload = 'data' in (json as EdgeResponseShape)
      ? (json as EdgeResponseShape).data
      : json;

    const draft = normalizeJournalPayload(payload, session);
    await saveTravelJournalLocal(draft);
    return draft;
  } catch (error) {
    throw new Error(mapTravelErrorToChinese(error));
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveTravelJournalLocal(draft: TravelJournalDraft): Promise<void> {
  const journals = await readLocalJournals();
  const updatedDraft: TravelJournalDraft = {
    ...draft,
    updated_at: nowIso(),
  };
  const index = journals.findIndex((item) => item.id === draft.id);
  if (index >= 0) {
    journals[index] = updatedDraft;
  } else {
    journals.unshift(updatedDraft);
  }
  await writeLocalJournals(journals);
}

export async function getLocalTravelJournal(
  journalId: string,
): Promise<TravelJournalDraft | null> {
  const journals = await readLocalJournals();
  return journals.find((item) => item.id === journalId) ?? null;
}

export async function getLocalTravelJournals(): Promise<TravelJournalDraft[]> {
  const journals = await readLocalJournals();
  return [...journals].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export async function saveTravelJournalToCloud(
  draft: TravelJournalDraft,
): Promise<TravelJournalDraft> {
  const user = await getUserContext();
  if (!user) {
    throw new Error('请先登录后再保存游记。');
  }

  const cloudJourneyId = await syncSessionToCloud(draft.session_id);
  const body = {
    title: draft.title,
    content: draft.content,
    excerpt: draft.excerpt,
  };
  const metadata = {
    session_id: draft.session_id,
    journey_id: cloudJourneyId,
    point_count: draft.point_count,
    poi_count: draft.poi_count,
    draft_id: draft.id,
  };

  const existedId = draft.cloud_log_id ?? (await findTravelLogCloudId(user.userId, draft.session_id));

  let cloudLogId = existedId ?? null;

  if (existedId) {
    const { error } = await supabase
      .from('user_travel_logs')
      .update({
        title: draft.title,
        body,
        metadata,
        updated_at: nowIso(),
      })
      .eq('id', existedId)
      .eq('user_id', user.userId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('user_travel_logs')
      .insert({
        user_id: user.userId,
        title: draft.title,
        body,
        metadata,
      })
      .select('id')
      .single();
    if (error) throw error;
    cloudLogId = (data as UserTravelLogRow).id;
  }

  const syncedDraft: TravelJournalDraft = {
    ...draft,
    synced: true,
    cloud_log_id: cloudLogId ?? undefined,
    updated_at: nowIso(),
  };

  await saveTravelJournalLocal(syncedDraft);
  return syncedDraft;
}
