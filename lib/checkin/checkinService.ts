/**
 * lib/checkin/checkinService.ts
 *
 * 地理围栏打卡、印章与成就规则引擎
 * EARS-1: 500m 可配置围栏判定、打卡确认、印章发放、足迹热力
 * EARS-2: 定位精度不足时提示并要求二次确认
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { calcDistance, type LocationCoords } from '@/lib/location/locationService';
import { type PoiType } from '@/lib/poi/poiQueries';

export type CheckinStatus = 'idle' | 'near' | 'checking_in' | 'success' | 'accuracy_low' | 'error';

export interface CheckinRecord {
  id: string;
  user_id: string;
  poi_id: string;
  poi_name: string;
  poi_type: PoiType;
  lng: number;
  lat: number;
  accuracy: number | null;
  checked_in_at: string;
  stamp_id: string;
}

export interface Stamp {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  unlocked_at: string | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  unlocked_at: string | null;
}

export type AchievementConditionType =
  | 'checkin_count'
  | 'poi_type_count'
  | 'province_visit'
  | 'consecutive_days';

export interface AchievementCondition {
  type: AchievementConditionType;
  threshold: number;
  poi_type?: PoiType;
  province?: string;
}

/** 默认打卡半径（米） */
export const DEFAULT_CHECKIN_RADIUS_M = 500;

/** 精度阈值（米），低于此值认为精度不足 */
export const ACCURACY_THRESHOLD_M = 50;

const STAMPS_CONFIG: Stamp[] = [
  {
    id: 'stamp_scenic_first',
    name: '初探景区',
    icon: '🏔️',
    color: '#C8914A',
    description: '完成首次景区打卡',
    unlocked_at: null,
  },
  {
    id: 'stamp_heritage_first',
    name: '文保新人',
    icon: '🏛️',
    color: '#813520',
    description: '完成首次国保单位打卡',
    unlocked_at: null,
  },
  {
    id: 'stamp_museum_first',
    name: '博古通今',
    icon: '🏺',
    color: '#2C4A3E',
    description: '完成首次博物馆打卡',
    unlocked_at: null,
  },
  {
    id: 'stamp_5x',
    name: '五星旅程',
    icon: '⭐',
    color: '#C8914A',
    description: '打卡 5 个 5A 景区',
    unlocked_at: null,
  },
  {
    id: 'stamp_10_checkins',
    name: '足迹初成',
    icon: '👣',
    color: '#8A9A7B',
    description: '累计打卡 10 次',
    unlocked_at: null,
  },
  {
    id: 'stamp_3_provinces',
    name: '三省游历',
    icon: '🌏',
    color: '#2C5F6B',
    description: '打卡覆盖 3 个不同省份',
    unlocked_at: null,
  },
];

/** 判定是否在 POI 围栏内 */
export function isWithinGeofence(
  userLoc: LocationCoords,
  poiLoc: LocationCoords,
  radiusM = DEFAULT_CHECKIN_RADIUS_M,
): boolean {
  const dist = calcDistance(userLoc.lat, userLoc.lng, poiLoc.lat, poiLoc.lng);
  return dist <= radiusM;
}

/** 判定精度是否足够 */
export function isAccuracySufficient(accuracy: number | null): boolean {
  if (accuracy === null) return false;
  return accuracy <= ACCURACY_THRESHOLD_M;
}

/** 打卡（须在围栏内且精度足够或用户确认） */
export async function checkIn(
  poiId: string,
  poiName: string,
  poiType: PoiType,
  poiLoc: LocationCoords,
  userLoc: LocationCoords,
  accuracy: number | null,
  requireConfirm = false,
): Promise<{ success: boolean; record?: CheckinRecord; error?: string }> {
  // 围栏判定
  if (!isWithinGeofence(userLoc, poiLoc)) {
    return { success: false, error: '不在打卡范围内（需在目标 500 米内）' };
  }

  // 精度判定
  const lowAccuracy = !isAccuracySufficient(accuracy);
  if (lowAccuracy && !requireConfirm) {
    return {
      success: false,
      error: `定位精度不足（${Math.round(accuracy ?? 0)} 米），请到室外或开阔地带重试。`,
    };
  }

  // 获取登录态
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return { success: false, error: '请先登录后再打卡' };

  // 写入打卡记录
  const record: CheckinRecord = {
    id: `checkin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    poi_id: poiId,
    poi_name: poiName,
    poi_type: poiType,
    lng: poiLoc.lng,
    lat: poiLoc.lat,
    accuracy,
    checked_in_at: new Date().toISOString(),
    stamp_id: '', // 印章后续计算
  };

  const { error } = await supabase.from('checkin_records').insert(record);
  if (error) return { success: false, error: '打卡记录保存失败，请重试' };

  // 计算印章
  const stamps = await evaluateStamps(userId, poiType);
  if (stamps.length > 0) {
    record.stamp_id = stamps[0].id;
    await supabase
      .from('checkin_records')
      .update({ stamp_id: stamps[0].id })
      .eq('id', record.id);
  }

  // 计算成就
  await evaluateAchievements(userId);

  return { success: true, record };
}

/** 强制打卡（二次确认场景） */
export async function forceCheckIn(
  poiId: string,
  poiName: string,
  poiType: PoiType,
  poiLoc: LocationCoords,
  userLoc: LocationCoords,
  accuracy: number | null,
): Promise<{ success: boolean; record?: CheckinRecord; error?: string }> {
  return checkIn(poiId, poiName, poiType, poiLoc, userLoc, accuracy, true);
}

/** 计算可获得的印章 */
export async function evaluateStamps(
  userId: string,
  poiType: PoiType,
): Promise<Stamp[]> {
  const unlocked: Stamp[] = [];

  // 查询用户历史打卡
  const { data: records } = await supabase
    .from('checkin_records')
    .select('*')
    .eq('user_id', userId);

  if (!records || records.length === 0) return unlocked;

  const checkins = records as CheckinRecord[];

  // 初探景区
  if (poiType === 'scenic' && !checkins.some((c) => c.poi_type === 'scenic')) {
    unlocked.push({ ...STAMPS_CONFIG[0], unlocked_at: new Date().toISOString() });
  }
  // 文保新人
  if (poiType === 'heritage' && !checkins.some((c) => c.poi_type === 'heritage')) {
    unlocked.push({ ...STAMPS_CONFIG[1], unlocked_at: new Date().toISOString() });
  }
  // 博物馆
  if (poiType === 'museum' && !checkins.some((c) => c.poi_type === 'museum')) {
    unlocked.push({ ...STAMPS_CONFIG[2], unlocked_at: new Date().toISOString() });
  }
  // 五次打卡
  const totalCheckins = checkins.length + 1;
  if (totalCheckins >= 5) {
    unlocked.push({ ...STAMPS_CONFIG[3], unlocked_at: new Date().toISOString() });
  }
  // 十次打卡
  if (totalCheckins >= 10) {
    unlocked.push({ ...STAMPS_CONFIG[4], unlocked_at: new Date().toISOString() });
  }
  // 三省游历
  const provinces = new Set(checkins.map((c) => c.poi_id.split('-')[0]));
  if (provinces.size >= 3) {
    unlocked.push({ ...STAMPS_CONFIG[5], unlocked_at: new Date().toISOString() });
  }

  // 写入印章表
  for (const stamp of unlocked) {
    await supabase.from('user_stamps').upsert({
      user_id: userId,
      stamp_id: stamp.id,
      unlocked_at: stamp.unlocked_at,
    });
  }

  return unlocked;
}

/** 计算成就（固定规则 + JSON 配置） */
export async function evaluateAchievements(userId: string): Promise<Achievement[]> {
  const { data: records } = await supabase
    .from('checkin_records')
    .select('*')
    .eq('user_id', userId);

  const achievements: Achievement[] = [];
  const checkins = (records ?? []) as CheckinRecord[];
  const checkinCount = checkins.length;

  // 固定规则：打卡次数成就
  if (checkinCount >= 1) {
    achievements.push({
      id: 'ach_checkin_1',
      title: '初次打卡',
      description: '完成首次打卡',
      icon: '🎯',
      condition: { type: 'checkin_count', threshold: 1 },
      unlocked_at: new Date().toISOString(),
    });
  }
  if (checkinCount >= 10) {
    achievements.push({
      id: 'ach_checkin_10',
      title: '打卡达人',
      description: '累计打卡 10 次',
      icon: '🏅',
      condition: { type: 'checkin_count', threshold: 10 },
      unlocked_at: new Date().toISOString(),
    });
  }
  if (checkinCount >= 50) {
    achievements.push({
      id: 'ach_checkin_50',
      title: '文化探索者',
      description: '累计打卡 50 次',
      icon: '🎖️',
      condition: { type: 'checkin_count', threshold: 50 },
      unlocked_at: new Date().toISOString(),
    });
  }

  // 写入成就表
  for (const ach of achievements) {
    await supabase.from('user_achievements').upsert({
      user_id: userId,
      achievement_id: ach.id,
      unlocked_at: ach.unlocked_at,
    });
  }

  return achievements;
}

/** 获取用户印章列表 */
export async function getUserStamps(userId: string): Promise<Stamp[]> {
  const { data } = await supabase
    .from('user_stamps')
    .select('*')
    .eq('user_id', userId);

  const unlockedIds = new Set((data ?? []).map((r: { stamp_id: string }) => r.stamp_id));
  return STAMPS_CONFIG.map((s) => ({
    ...s,
    unlocked_at: unlockedIds.has(s.id) ? new Date().toISOString() : null,
  }));
}

/** 获取用户成就列表 */
export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  const { data } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId);

  const unlockedIds = new Set((data ?? []).map((r: { achievement_id: string }) => r.achievement_id));

  // 所有可能的成就定义
  const ALL_ACHIEVEMENTS: Achievement[] = [
    {
      id: 'ach_checkin_1',
      title: '初次打卡',
      description: '完成首次打卡',
      icon: '🎯',
      condition: { type: 'checkin_count', threshold: 1 },
      unlocked_at: null,
    },
    {
      id: 'ach_checkin_10',
      title: '打卡达人',
      description: '累计打卡 10 次',
      icon: '🏅',
      condition: { type: 'checkin_count', threshold: 10 },
      unlocked_at: null,
    },
    {
      id: 'ach_checkin_50',
      title: '文化探索者',
      description: '累计打卡 50 次',
      icon: '🎖️',
      condition: { type: 'checkin_count', threshold: 50 },
      unlocked_at: null,
    },
  ];

  return ALL_ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked_at: unlockedIds.has(a.id) ? new Date().toISOString() : null,
  }));
}

/** 获取用户打卡记录 */
export async function getCheckinRecords(
  userId: string,
  limit = 50,
): Promise<CheckinRecord[]> {
  const { data } = await supabase
    .from('checkin_records')
    .select('*')
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as CheckinRecord[];
}
