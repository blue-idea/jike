/**
 * lib/travel/travelService.ts
 *
 * 轨迹记录与 AI 游记生成（EARS-1：轨迹采样 + POI 关联 + AI 游记草稿）
 * EARS-2 覆盖：未登录本地保存，云端 AI 生成须登录态
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { calcDistance, type LocationCoords } from '@/lib/location/locationService';

export interface TrajectoryPoint {
  id: string;
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: string;
  poi_id?: string;
  poi_name?: string;
}

export interface TravelSession {
  id: string;
  started_at: string;
  ended_at?: string;
  points: TrajectoryPoint[];
  title?: string;
}

export interface TravelJournal {
  id: string;
  user_id: string;
  session_id: string;
  title: string;
  content: string;
  image_urls: string[];
  draft: boolean;
  created_at: string;
  updated_at: string;
}

const TRAJECTORY_STORAGE_KEY = '@travel_offline_sessions';

/** 保存轨迹会话到本地 */
export async function saveTravelSession(session: TravelSession): Promise<void> {
  const key = `${TRAJECTORY_STORAGE_KEY}_${session.id}`;
  await AsyncStorage.setItem(key, JSON.stringify(session));
}

/** 读取本地所有轨迹会话 */
export async function getLocalTravelSessions(): Promise<TravelSession[]> {
  const keys = await AsyncStorage.getAllKeys();
  const sessionKeys = keys.filter((k) => k.startsWith(TRAJECTORY_STORAGE_KEY));
  const pairs = await AsyncStorage.multiGet(sessionKeys);
  return pairs
    .map(([, val]) => (val ? JSON.parse(val) : null))
    .filter(Boolean) as TravelSession[];
}

/** 读取指定会话 */
export async function getTravelSession(
  sessionId: string,
): Promise<TravelSession | null> {
  const key = `${TRAJECTORY_STORAGE_KEY}_${sessionId}`;
  const val = await AsyncStorage.getItem(key);
  return val ? JSON.parse(val) : null;
}

/** 将 POI id 关联到最近的轨迹点（500 米内） */
export async function associatePoiToSession(
  sessionId: string,
  poiId: string,
  poiName: string,
  poiCoords: LocationCoords,
): Promise<void> {
  const session = await getTravelSession(sessionId);
  if (!session) return;

  let nearestIdx = -1;
  let nearestDist = Infinity;
  for (let i = 0; i < session.points.length; i++) {
    const p = session.points[i];
    const d = calcDistance(poiCoords.lat, poiCoords.lng, p.lat, p.lng);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }

  if (nearestIdx >= 0 && nearestDist < 500) {
    session.points[nearestIdx].poi_id = poiId;
    session.points[nearestIdx].poi_name = poiName;
    await saveTravelSession(session);
  }
}

/** 获取 Supabase Access Token */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** AI 游记生成（登录态） */
export async function generateTravelJournal(
  sessionId: string,
): Promise<TravelJournal> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('请先登录后再生成游记。');

  const sessionData = await getTravelSession(sessionId);
  if (!sessionData) throw new Error('未找到对应行程记录。');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60 * 1000);

  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-travel-journal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          points: sessionData.points,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.error) throw new Error(json.error);
    return json as TravelJournal;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/** AI 游记生成 Mock（开发阶段） */
export async function generateTravelJournalMock(
  sessionId: string,
): Promise<TravelJournal> {
  await new Promise((r) => setTimeout(r, 1500));
  const session = await getTravelSession(sessionId);
  const poiNames =
    session?.points
      .filter((p) => p.poi_name)
      .map((p) => p.poi_name)
      .join('、') ?? '主要景点';

  return {
    id: `journal_${Date.now()}`,
    user_id: '',
    session_id: sessionId,
    title: '我的文化之旅',
    content: `这次旅行我们走访了${poiNames}等文化地标。\n\n一路上，我们深深感受到了中华文化的博大精深。\n\n每个地方都有其独特的历史故事和文化内涵，让我对这片土地有了更深的理解和热爱。\n\n期待下一次出发！`,
    image_urls: [],
    draft: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** 上传游记到 Supabase（登录态） */
export async function saveTravelJournalToCloud(
  journal: TravelJournal,
): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('请先登录后再保存游记。');

  const { error } = await supabase.from('travel_journals').upsert({
    id: journal.id,
    user_id: journal.user_id,
    session_id: journal.session_id,
    title: journal.title,
    content: journal.content,
    image_urls: journal.image_urls,
    draft: journal.draft,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** 生成新轨迹会话 ID */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 添加轨迹点到会话 */
export async function addPointToSession(
  sessionId: string,
  point: TrajectoryPoint,
): Promise<void> {
  const session = (await getTravelSession(sessionId)) ?? {
    id: sessionId,
    started_at: new Date().toISOString(),
    points: [],
  };
  session.points.push(point);
  await saveTravelSession(session as TravelSession);
}
