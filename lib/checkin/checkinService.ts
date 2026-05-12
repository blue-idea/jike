import { supabase } from '@/lib/supabase';
import { calcDistance, type LocationCoords } from '@/lib/location/locationService';
import { type PoiType } from '@/lib/poi/poiQueries';

export type CheckinStatus = 'idle' | 'near' | 'checking_in' | 'success' | 'accuracy_low' | 'error';

export type CheckinFailureCode =
  | 'NOT_LOGGED_IN'
  | 'NOT_ELIGIBLE'
  | 'MISSING_COORDS'
  | 'OUT_OF_RANGE'
  | 'LOW_ACCURACY'
  | 'ALREADY_CHECKED_IN'
  | 'UNKNOWN_ERROR';

export interface CheckinOutcome {
  success: boolean;
  code?: CheckinFailureCode;
  message: string;
  distanceM?: number;
  requiresConfirmation?: boolean;
  unlockedStamps?: UserStampProgress[];
  unlockedAchievements?: UserAchievementProgress[];
}

export interface CheckinRecord {
  id: string;
  user_id: string;
  poi_id: string;
  poi_type: PoiType;
  lng: number | null;
  lat: number | null;
  checked_at: string;
  double_confirmed: boolean;
}

export type RuleConditionType =
  | 'checkin_count'
  | 'poi_type_count'
  | 'province_visit'
  | 'consecutive_days'
  | 'scenic_5a_count';

export interface RuleCondition {
  type: RuleConditionType;
  threshold: number;
  poiType?: PoiType;
}

export interface StampDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  condition: RuleCondition;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  condition: RuleCondition;
}

export interface UserStampProgress extends StampDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  total: number;
}

export interface UserAchievementProgress extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  total: number;
}

export interface PassportStats {
  checkinCount: number;
  provincesCovered: number;
  stampsCollected: number;
  achievementsUnlocked: number;
}

export interface FootprintProvince {
  province: string;
  abbrev: string;
  count: number;
}

export interface PassportProfileData {
  stats: PassportStats;
  stamps: UserStampProgress[];
  achievements: UserAchievementProgress[];
  footprint: FootprintProvince[];
}

interface PoiMeta {
  poi_type: PoiType;
  poi_id: string;
  name: string;
  lng: number;
  lat: number;
  province: string | null;
  scenic_rating: string | null;
}

interface RuleMetrics {
  checkinCount: number;
  scenicCount: number;
  heritageCount: number;
  museumCount: number;
  scenic5ACount: number;
  provinceCount: number;
  consecutiveDays: number;
}

interface UserAchievementState {
  unlocked_stamp_ids: string[];
  unlocked_achievement_ids: string[];
  unlocked_at: Record<string, string>;
  last_evaluated_at?: string;
}

interface AppConfigBundle {
  geofenceRadiusM: number;
  achievementRules: AchievementDefinition[];
  rulesVersion: number;
}

const DEFAULT_GEOFENCE_RADIUS_M = 500;
const DEFAULT_ACCURACY_THRESHOLD_M = 50;

const APP_CONFIG_KEY_GEOFENCE_RADIUS = 'geofence_radius_m';
const APP_CONFIG_KEY_ACHIEVEMENT_RULES = 'achievement_rules';

const DEFAULT_STAMP_DEFINITIONS: StampDefinition[] = [
  {
    id: 'stamp_scenic_first',
    name: '初探景区',
    icon: '🏔️',
    color: '#C8914A',
    description: '完成首次景区打卡',
    condition: { type: 'poi_type_count', poiType: 'scenic', threshold: 1 },
  },
  {
    id: 'stamp_heritage_first',
    name: '文保新人',
    icon: '🏛️',
    color: '#813520',
    description: '完成首次国保单位打卡',
    condition: { type: 'poi_type_count', poiType: 'heritage', threshold: 1 },
  },
  {
    id: 'stamp_museum_first',
    name: '博古通今',
    icon: '🏺',
    color: '#2C4A3E',
    description: '完成首次博物馆打卡',
    condition: { type: 'poi_type_count', poiType: 'museum', threshold: 1 },
  },
  {
    id: 'stamp_5a_finder',
    name: '五星旅程',
    icon: '⭐',
    color: '#C8914A',
    description: '累计打卡 5 个 5A 景区',
    condition: { type: 'scenic_5a_count', threshold: 5 },
  },
  {
    id: 'stamp_10_checkins',
    name: '足迹初成',
    icon: '👣',
    color: '#8A9A7B',
    description: '累计打卡 10 次',
    condition: { type: 'checkin_count', threshold: 10 },
  },
  {
    id: 'stamp_3_provinces',
    name: '三省游历',
    icon: '🌏',
    color: '#2C5F6B',
    description: '打卡覆盖 3 个不同省份',
    condition: { type: 'province_visit', threshold: 3 },
  },
];

const DEFAULT_ACHIEVEMENT_RULES: AchievementDefinition[] = [
  {
    id: 'ach_first_checkin',
    title: '初次打卡',
    description: '完成首次文旅地标打卡',
    icon: 'check',
    color: '#4A8C6F',
    condition: { type: 'checkin_count', threshold: 1 },
  },
  {
    id: 'ach_checkin_10',
    title: '打卡达人',
    description: '累计完成 10 次打卡',
    icon: 'award',
    color: '#C8914A',
    condition: { type: 'checkin_count', threshold: 10 },
  },
  {
    id: 'ach_museum_5',
    title: '博物馆常客',
    description: '累计打卡 5 家博物馆',
    icon: 'building',
    color: '#B5352A',
    condition: { type: 'poi_type_count', poiType: 'museum', threshold: 5 },
  },
  {
    id: 'ach_province_5',
    title: '山河行者',
    description: '打卡覆盖 5 个省份',
    icon: 'star',
    color: '#2C5F6B',
    condition: { type: 'province_visit', threshold: 5 },
  },
  {
    id: 'ach_streak_3',
    title: '连续探索者',
    description: '连续 3 天完成打卡',
    icon: 'star',
    color: '#8A9A7B',
    condition: { type: 'consecutive_days', threshold: 3 },
  },
];

const PROVINCE_ABBREVIATION_MAP: Record<string, string> = {
  北京: '京',
  天津: '津',
  上海: '沪',
  重庆: '渝',
  河北: '冀',
  山西: '晋',
  辽宁: '辽',
  吉林: '吉',
  黑龙江: '黑',
  江苏: '苏',
  浙江: '浙',
  安徽: '皖',
  福建: '闽',
  江西: '赣',
  山东: '鲁',
  河南: '豫',
  湖北: '鄂',
  湖南: '湘',
  广东: '粤',
  海南: '琼',
  四川: '川',
  贵州: '贵',
  云南: '滇',
  陕西: '陕',
  甘肃: '甘',
  青海: '青',
  台湾: '台',
  内蒙古: '蒙',
  广西: '桂',
  西藏: '藏',
  宁夏: '宁',
  新疆: '新',
  香港: '港',
  澳门: '澳',
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeUserAchievementState(raw: unknown): UserAchievementState {
  if (!raw || typeof raw !== 'object') {
    return {
      unlocked_stamp_ids: [],
      unlocked_achievement_ids: [],
      unlocked_at: {},
    };
  }

  const obj = raw as Partial<UserAchievementState>;
  return {
    unlocked_stamp_ids: Array.isArray(obj.unlocked_stamp_ids)
      ? obj.unlocked_stamp_ids.filter((v): v is string => typeof v === 'string')
      : [],
    unlocked_achievement_ids: Array.isArray(obj.unlocked_achievement_ids)
      ? obj.unlocked_achievement_ids.filter((v): v is string => typeof v === 'string')
      : [],
    unlocked_at:
      obj.unlocked_at && typeof obj.unlocked_at === 'object'
        ? Object.fromEntries(
            Object.entries(obj.unlocked_at).filter(
              ([k, v]) => typeof k === 'string' && typeof v === 'string',
            ),
          )
        : {},
    last_evaluated_at: typeof obj.last_evaluated_at === 'string' ? obj.last_evaluated_at : undefined,
  };
}

function toAbbrevProvince(province: string) {
  return PROVINCE_ABBREVIATION_MAP[province] ?? province.slice(0, 1);
}

function metricValueByCondition(metrics: RuleMetrics, condition: RuleCondition): number {
  switch (condition.type) {
    case 'checkin_count':
      return metrics.checkinCount;
    case 'province_visit':
      return metrics.provinceCount;
    case 'consecutive_days':
      return metrics.consecutiveDays;
    case 'scenic_5a_count':
      return metrics.scenic5ACount;
    case 'poi_type_count': {
      if (condition.poiType === 'scenic') return metrics.scenicCount;
      if (condition.poiType === 'heritage') return metrics.heritageCount;
      return metrics.museumCount;
    }
    default:
      return 0;
  }
}

function evaluateRule(metrics: RuleMetrics, condition: RuleCondition) {
  const value = metricValueByCondition(metrics, condition);
  return {
    value,
    total: condition.threshold,
    unlocked: value >= condition.threshold,
  };
}

function isValidPoiType(value: unknown): value is PoiType {
  return value === 'scenic' || value === 'heritage' || value === 'museum';
}

function isValidRuleCondition(condition: unknown): condition is RuleCondition {
  if (!condition || typeof condition !== 'object') return false;
  const c = condition as Partial<RuleCondition>;
  if (typeof c.threshold !== 'number' || c.threshold <= 0) return false;
  if (
    c.type !== 'checkin_count' &&
    c.type !== 'poi_type_count' &&
    c.type !== 'province_visit' &&
    c.type !== 'consecutive_days' &&
    c.type !== 'scenic_5a_count'
  ) {
    return false;
  }
  if (c.type === 'poi_type_count' && !isValidPoiType(c.poiType)) {
    return false;
  }
  return true;
}

function mergeAchievementRules(
  baseRules: AchievementDefinition[],
  configRules: AchievementDefinition[],
): AchievementDefinition[] {
  const merged = new Map<string, AchievementDefinition>();
  for (const rule of baseRules) {
    merged.set(rule.id, rule);
  }
  for (const rule of configRules) {
    merged.set(rule.id, rule);
  }
  return Array.from(merged.values());
}

function parseAchievementRulesFromConfig(raw: unknown): {
  rules: AchievementDefinition[];
  version: number;
} {
  if (!raw) {
    return {
      rules: [],
      version: 1,
    };
  }

  let rulesRaw: unknown[] = [];
  let version = 1;

  if (Array.isArray(raw)) {
    rulesRaw = raw;
  } else if (typeof raw === 'object') {
    const value = raw as { rules?: unknown[]; version?: number; rules_version?: number };
    rulesRaw = Array.isArray(value.rules) ? value.rules : [];
    version =
      typeof value.rules_version === 'number'
        ? value.rules_version
        : typeof value.version === 'number'
          ? value.version
          : 1;
  }

  const rules: AchievementDefinition[] = rulesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Partial<AchievementDefinition>;
      if (
        typeof r.id !== 'string' ||
        typeof r.title !== 'string' ||
        typeof r.description !== 'string' ||
        typeof r.icon !== 'string' ||
        typeof r.color !== 'string' ||
        !isValidRuleCondition(r.condition)
      ) {
        return null;
      }
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        icon: r.icon,
        color: r.color,
        condition: r.condition,
      } as AchievementDefinition;
    })
    .filter((rule): rule is AchievementDefinition => Boolean(rule));

  return {
    rules,
    version: Number.isFinite(version) && version > 0 ? Math.floor(version) : 1,
  };
}

async function loadAppConfigBundle(): Promise<AppConfigBundle> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key,value')
    .in('key', [APP_CONFIG_KEY_GEOFENCE_RADIUS, APP_CONFIG_KEY_ACHIEVEMENT_RULES]);

  if (error || !data) {
    return {
      geofenceRadiusM: DEFAULT_GEOFENCE_RADIUS_M,
      achievementRules: DEFAULT_ACHIEVEMENT_RULES,
      rulesVersion: 1,
    };
  }

  let geofenceRadiusM = DEFAULT_GEOFENCE_RADIUS_M;
  let configAchievementRules: AchievementDefinition[] = [];
  let rulesVersion = 1;

  for (const item of data as { key: string; value: unknown }[]) {
    if (item.key === APP_CONFIG_KEY_GEOFENCE_RADIUS) {
      if (typeof item.value === 'number' && item.value > 0) {
        geofenceRadiusM = item.value;
      } else if (
        item.value &&
        typeof item.value === 'object' &&
        typeof (item.value as { meters?: number }).meters === 'number' &&
        (item.value as { meters: number }).meters > 0
      ) {
        geofenceRadiusM = (item.value as { meters: number }).meters;
      }
    }

    if (item.key === APP_CONFIG_KEY_ACHIEVEMENT_RULES) {
      const parsed = parseAchievementRulesFromConfig(item.value);
      configAchievementRules = parsed.rules;
      rulesVersion = parsed.version;
    }
  }

  return {
    geofenceRadiusM,
    achievementRules: mergeAchievementRules(DEFAULT_ACHIEVEMENT_RULES, configAchievementRules),
    rulesVersion,
  };
}

async function getPoiMeta(poiId: string, poiType: PoiType): Promise<PoiMeta | null> {
  if (poiType === 'scenic') {
    const { data } = await supabase
      .from('catalog_scenic_spots')
      .select('id,name,lng_wgs84,lat_wgs84,provincial,rating')
      .eq('id', poiId)
      .maybeSingle();

    if (!data || typeof data.lng_wgs84 !== 'number' || typeof data.lat_wgs84 !== 'number') {
      return null;
    }

    const isEligibleScenic = typeof data.rating === 'string' && ['4A', '5A'].includes(data.rating.trim());
    if (!isEligibleScenic) {
      return null;
    }

    return {
      poi_type: 'scenic',
      poi_id: data.id,
      name: data.name,
      lng: data.lng_wgs84,
      lat: data.lat_wgs84,
      province: data.provincial ?? null,
      scenic_rating: data.rating,
    };
  }

  if (poiType === 'heritage') {
    const { data } = await supabase
      .from('catalog_heritage_sites')
      .select('id,name,longitude,latitude,provincial')
      .eq('id', poiId)
      .maybeSingle();

    if (!data || typeof data.longitude !== 'number' || typeof data.latitude !== 'number') {
      return null;
    }

    return {
      poi_type: 'heritage',
      poi_id: data.id,
      name: data.name,
      lng: data.longitude,
      lat: data.latitude,
      province: data.provincial ?? null,
      scenic_rating: null,
    };
  }

  const { data } = await supabase
    .from('catalog_museums')
    .select('id,name,lng,lat,pname')
    .eq('id', poiId)
    .maybeSingle();

  if (!data || typeof data.lng !== 'number' || typeof data.lat !== 'number') {
    return null;
  }

  return {
    poi_type: 'museum',
    poi_id: data.id,
    name: data.name,
    lng: data.lng,
    lat: data.lat,
    province: data.pname ?? null,
    scenic_rating: null,
  };
}

async function loadPoiMetaForCheckins(records: CheckinRecord[]): Promise<Map<string, PoiMeta>> {
  const scenicIds = Array.from(
    new Set(records.filter((r) => r.poi_type === 'scenic').map((r) => r.poi_id)),
  );
  const heritageIds = Array.from(
    new Set(records.filter((r) => r.poi_type === 'heritage').map((r) => r.poi_id)),
  );
  const museumIds = Array.from(
    new Set(records.filter((r) => r.poi_type === 'museum').map((r) => r.poi_id)),
  );

  const map = new Map<string, PoiMeta>();

  if (scenicIds.length > 0) {
    const { data } = await supabase
      .from('catalog_scenic_spots')
      .select('id,name,lng_wgs84,lat_wgs84,provincial,rating')
      .in('id', scenicIds);

    for (const row of data ?? []) {
      if (typeof row.lng_wgs84 !== 'number' || typeof row.lat_wgs84 !== 'number') continue;
      map.set(`scenic:${row.id}`, {
        poi_type: 'scenic',
        poi_id: row.id,
        name: row.name,
        lng: row.lng_wgs84,
        lat: row.lat_wgs84,
        province: row.provincial ?? null,
        scenic_rating: row.rating ?? null,
      });
    }
  }

  if (heritageIds.length > 0) {
    const { data } = await supabase
      .from('catalog_heritage_sites')
      .select('id,name,longitude,latitude,provincial')
      .in('id', heritageIds);

    for (const row of data ?? []) {
      if (typeof row.longitude !== 'number' || typeof row.latitude !== 'number') continue;
      map.set(`heritage:${row.id}`, {
        poi_type: 'heritage',
        poi_id: row.id,
        name: row.name,
        lng: row.longitude,
        lat: row.latitude,
        province: row.provincial ?? null,
        scenic_rating: null,
      });
    }
  }

  if (museumIds.length > 0) {
    const { data } = await supabase
      .from('catalog_museums')
      .select('id,name,lng,lat,pname')
      .in('id', museumIds);

    for (const row of data ?? []) {
      if (typeof row.lng !== 'number' || typeof row.lat !== 'number') continue;
      map.set(`museum:${row.id}`, {
        poi_type: 'museum',
        poi_id: row.id,
        name: row.name,
        lng: row.lng,
        lat: row.lat,
        province: row.pname ?? null,
        scenic_rating: null,
      });
    }
  }

  return map;
}

function dayDiffInUtc(olderDayIso: string, newerDayIso: string): number {
  const older = Date.parse(`${olderDayIso}T00:00:00.000Z`);
  const newer = Date.parse(`${newerDayIso}T00:00:00.000Z`);
  return Math.round((newer - older) / 86400000);
}

function calculateConsecutiveDays(records: CheckinRecord[]): number {
  if (records.length === 0) return 0;
  const uniqueDaysDesc = Array.from(
    new Set(
      records
        .map((r) => r.checked_at.slice(0, 10))
        .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)),
    ),
  ).sort((a, b) => (a > b ? -1 : 1));

  if (uniqueDaysDesc.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDaysDesc.length; i += 1) {
    const diff = dayDiffInUtc(uniqueDaysDesc[i], uniqueDaysDesc[i - 1]);
    if (diff === 1) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

function buildRuleMetrics(records: CheckinRecord[], poiMetaMap: Map<string, PoiMeta>): {
  metrics: RuleMetrics;
  provinceCountMap: Map<string, number>;
} {
  let scenicCount = 0;
  let heritageCount = 0;
  let museumCount = 0;
  let scenic5ACount = 0;
  const provinceCountMap = new Map<string, number>();

  for (const record of records) {
    if (record.poi_type === 'scenic') scenicCount += 1;
    if (record.poi_type === 'heritage') heritageCount += 1;
    if (record.poi_type === 'museum') museumCount += 1;

    const meta = poiMetaMap.get(`${record.poi_type}:${record.poi_id}`);
    if (!meta) continue;

    if (meta.poi_type === 'scenic' && meta.scenic_rating?.trim() === '5A') {
      scenic5ACount += 1;
    }

    const province = meta.province?.trim();
    if (province) {
      provinceCountMap.set(province, (provinceCountMap.get(province) ?? 0) + 1);
    }
  }

  const metrics: RuleMetrics = {
    checkinCount: records.length,
    scenicCount,
    heritageCount,
    museumCount,
    scenic5ACount,
    provinceCount: provinceCountMap.size,
    consecutiveDays: calculateConsecutiveDays(records),
  };

  return { metrics, provinceCountMap };
}

function buildStampProgress(
  metrics: RuleMetrics,
  state: UserAchievementState,
): UserStampProgress[] {
  return DEFAULT_STAMP_DEFINITIONS.map((stamp) => {
    const rule = evaluateRule(metrics, stamp.condition);
    const unlocked = state.unlocked_stamp_ids.includes(stamp.id) || rule.unlocked;
    return {
      ...stamp,
      unlocked,
      unlockedAt: state.unlocked_at[stamp.id] ?? null,
      progress: Math.min(rule.value, rule.total),
      total: rule.total,
    };
  });
}

function buildAchievementProgress(
  metrics: RuleMetrics,
  definitions: AchievementDefinition[],
  state: UserAchievementState,
): UserAchievementProgress[] {
  return definitions.map((achievement) => {
    const rule = evaluateRule(metrics, achievement.condition);
    const unlocked = state.unlocked_achievement_ids.includes(achievement.id) || rule.unlocked;
    return {
      ...achievement,
      unlocked,
      unlockedAt: state.unlocked_at[achievement.id] ?? null,
      progress: Math.min(rule.value, rule.total),
      total: rule.total,
    };
  });
}

async function loadCheckinRecords(userId: string): Promise<CheckinRecord[]> {
  const { data, error } = await supabase
    .from('user_check_ins')
    .select('id,user_id,poi_id,poi_type,lng,lat,checked_at,double_confirmed')
    .eq('user_id', userId)
    .order('checked_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as CheckinRecord[];
}

async function loadAchievementState(userId: string): Promise<{
  state: UserAchievementState;
}> {
  const { data } = await supabase
    .from('user_achievement_state')
    .select('id,state')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return {
      state: normalizeUserAchievementState(null),
    };
  }

  return {
    state: normalizeUserAchievementState(data.state),
  };
}

function buildUpdatedState(
  previous: UserAchievementState,
  stamps: UserStampProgress[],
  achievements: UserAchievementProgress[],
): UserAchievementState {
  const unlocked_at = { ...previous.unlocked_at };
  const unlocked_stamp_ids = Array.from(
    new Set(stamps.filter((s) => s.unlocked).map((s) => s.id).concat(previous.unlocked_stamp_ids)),
  );
  const unlocked_achievement_ids = Array.from(
    new Set(
      achievements
        .filter((a) => a.unlocked)
        .map((a) => a.id)
        .concat(previous.unlocked_achievement_ids),
    ),
  );

  const now = nowIso();
  for (const id of unlocked_stamp_ids) {
    if (!unlocked_at[id]) unlocked_at[id] = now;
  }
  for (const id of unlocked_achievement_ids) {
    if (!unlocked_at[id]) unlocked_at[id] = now;
  }

  return {
    unlocked_stamp_ids,
    unlocked_achievement_ids,
    unlocked_at,
    last_evaluated_at: now,
  };
}

async function upsertAchievementState(
  userId: string,
  state: UserAchievementState,
  rulesVersion: number,
): Promise<void> {
  await supabase.from('user_achievement_state').upsert(
    {
      user_id: userId,
      rules_version: rulesVersion,
      state,
    },
    {
      onConflict: 'user_id',
    },
  );
}

function diffUnlocked<T extends { id: string }>(
  previousUnlockedIds: string[],
  current: T[],
  isUnlocked: (item: T) => boolean,
): T[] {
  const previousSet = new Set(previousUnlockedIds);
  return current.filter((item) => isUnlocked(item) && !previousSet.has(item.id));
}

async function rebuildPassportState(userId: string): Promise<{
  profile: PassportProfileData;
  unlockedStamps: UserStampProgress[];
  unlockedAchievements: UserAchievementProgress[];
}> {
  const [records, statePayload, config] = await Promise.all([
    loadCheckinRecords(userId),
    loadAchievementState(userId),
    loadAppConfigBundle(),
  ]);

  const poiMetaMap = await loadPoiMetaForCheckins(records);
  const { metrics, provinceCountMap } = buildRuleMetrics(records, poiMetaMap);

  const stamps = buildStampProgress(metrics, statePayload.state);
  const achievements = buildAchievementProgress(metrics, config.achievementRules, statePayload.state);

  const nextState = buildUpdatedState(statePayload.state, stamps, achievements);
  await upsertAchievementState(userId, nextState, config.rulesVersion);

  const resolvedStamps = stamps.map((stamp) => ({
    ...stamp,
    unlockedAt: nextState.unlocked_at[stamp.id] ?? stamp.unlockedAt,
    unlocked: nextState.unlocked_stamp_ids.includes(stamp.id),
  }));
  const resolvedAchievements = achievements.map((achievement) => ({
    ...achievement,
    unlockedAt: nextState.unlocked_at[achievement.id] ?? achievement.unlockedAt,
    unlocked: nextState.unlocked_achievement_ids.includes(achievement.id),
  }));

  const footprint: FootprintProvince[] = Array.from(provinceCountMap.entries())
    .map(([province, count]) => ({
      province,
      abbrev: toAbbrevProvince(province),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.province.localeCompare(b.province, 'zh-Hans-CN'));

  const profile: PassportProfileData = {
    stats: {
      checkinCount: records.length,
      provincesCovered: provinceCountMap.size,
      stampsCollected: resolvedStamps.filter((stamp) => stamp.unlocked).length,
      achievementsUnlocked: resolvedAchievements.filter((achievement) => achievement.unlocked).length,
    },
    stamps: resolvedStamps,
    achievements: resolvedAchievements,
    footprint,
  };

  return {
    profile,
    unlockedStamps: diffUnlocked(
      statePayload.state.unlocked_stamp_ids,
      resolvedStamps,
      (item) => item.unlocked,
    ),
    unlockedAchievements: diffUnlocked(
      statePayload.state.unlocked_achievement_ids,
      resolvedAchievements,
      (item) => item.unlocked,
    ),
  };
}

/** 判定是否在 POI 围栏内 */
export function isWithinGeofence(
  userLoc: LocationCoords,
  poiLoc: LocationCoords,
  radiusM = DEFAULT_GEOFENCE_RADIUS_M,
): boolean {
  return calcDistance(userLoc.lat, userLoc.lng, poiLoc.lat, poiLoc.lng) <= radiusM;
}

/** 判定精度是否足够 */
export function isAccuracySufficient(
  accuracy: number | null,
  thresholdM = DEFAULT_ACCURACY_THRESHOLD_M,
): boolean {
  return typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy <= thresholdM;
}

/** 获取当前用户护照资料（统计/印章/成就/足迹） */
export async function getPassportProfile(userId: string): Promise<PassportProfileData> {
  const { profile } = await rebuildPassportState(userId);
  return profile;
}

/** 获取用户打卡记录 */
export async function getCheckinRecords(userId: string, limit = 50): Promise<CheckinRecord[]> {
  const records = await loadCheckinRecords(userId);
  return records.slice(0, Math.max(0, limit));
}

interface CheckinInput {
  poiId: string;
  poiType: PoiType;
  userLocation: LocationCoords;
  accuracy: number | null;
  confirmLowAccuracy?: boolean;
}

/**
 * 触发打卡：
 * - 仅允许 4A/5A 景区、国保、博物馆
 * - 半径默认 500m，可由 app_config.geofence_radius_m 覆盖
 * - 低精度场景返回 requiresConfirmation，需用户二次确认再写入
 */
export async function checkInToPoi(input: CheckinInput): Promise<CheckinOutcome> {
  try {
    const { data: authData } = await supabase.auth.getSession();
    const userId = authData.session?.user?.id;
    if (!userId) {
      return {
        success: false,
        code: 'NOT_LOGGED_IN',
        message: '请先登录后再打卡。',
      };
    }

    const poiMeta = await getPoiMeta(input.poiId, input.poiType);
    if (!poiMeta) {
      return {
        success: false,
        code: 'NOT_ELIGIBLE',
        message: '该地标当前不支持打卡（仅支持 4A/5A 景区、国保、博物馆）。',
      };
    }

    const config = await loadAppConfigBundle();
    const distanceM = calcDistance(
      input.userLocation.lat,
      input.userLocation.lng,
      poiMeta.lat,
      poiMeta.lng,
    );

    if (distanceM > config.geofenceRadiusM) {
      return {
        success: false,
        code: 'OUT_OF_RANGE',
        message: `不在打卡范围内（当前距离约 ${Math.round(distanceM)} 米，需在 ${Math.round(config.geofenceRadiusM)} 米内）。`,
        distanceM,
      };
    }

    if (!isAccuracySufficient(input.accuracy) && !input.confirmLowAccuracy) {
      return {
        success: false,
        code: 'LOW_ACCURACY',
        message: `定位精度不足（约 ${Math.round(input.accuracy ?? 0)} 米），请到室外或开阔区域后重试；如确认位置准确，可继续二次确认打卡。`,
        distanceM,
        requiresConfirmation: true,
      };
    }

    const { data: existed } = await supabase
      .from('user_check_ins')
      .select('id')
      .eq('user_id', userId)
      .eq('poi_type', input.poiType)
      .eq('poi_id', input.poiId)
      .maybeSingle();

    if (existed?.id) {
      return {
        success: false,
        code: 'ALREADY_CHECKED_IN',
        message: '该地标已经打卡过了，快去探索下一个吧。',
        distanceM,
      };
    }

    const { error: insertError } = await supabase.from('user_check_ins').insert({
      user_id: userId,
      poi_type: input.poiType,
      poi_id: input.poiId,
      lng: input.userLocation.lng,
      lat: input.userLocation.lat,
      checked_at: nowIso(),
      double_confirmed: !isAccuracySufficient(input.accuracy),
    });

    if (insertError) {
      return {
        success: false,
        code: 'UNKNOWN_ERROR',
        message: '打卡失败，请稍后重试。',
      };
    }

    const { unlockedStamps, unlockedAchievements } = await rebuildPassportState(userId);

    return {
      success: true,
      message: `打卡成功：${poiMeta.name}`,
      distanceM,
      unlockedStamps,
      unlockedAchievements,
    };
  } catch {
    return {
      success: false,
      code: 'UNKNOWN_ERROR',
      message: '打卡失败，请稍后重试。',
    };
  }
}
