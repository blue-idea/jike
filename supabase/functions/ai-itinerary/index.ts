import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildDays as buildPlanningDays,
  inferPreferredPoiTypes,
  parseDayPreferencesFromText,
  pickSelectedCandidates as pickPlanningCandidates,
  type DayPreferences,
} from './planning.ts';

type PoiType = 'scenic' | 'heritage' | 'museum';
type Intensity = 1 | 2 | 3;

interface ItineraryConstraintInput {
  query?: string;
  destination?: string;
  days?: number;
  dailyHours?: number;
  intensity?: Intensity;
  themeTags?: string[];
  mustVisitIds?: string[];
  excludeIds?: string[];
}

interface ItineraryRequest {
  constraints?: ItineraryConstraintInput;
}

interface ResolvedConstraints {
  query: string;
  destination?: string;
  days: number;
  dailyHours: number;
  intensity: Intensity;
  themeTags: string[];
  preferredPoiTypes: PoiType[];
  dayPreferences: DayPreferences;
  mustVisitIds: string[];
  excludeIds: string[];
}

interface CandidatePoi {
  poi_id: string;
  poi_name: string;
  poi_type: PoiType;
  lng: number;
  lat: number;
  label?: string;
  score: number;
}

interface ItineraryStop {
  poi_id: string;
  poi_name: string;
  poi_type: PoiType;
  arrival_time: string;
  duration_minutes: number;
  stay_duration: string;
  notes?: string;
  lng: number;
  lat: number;
}

interface ItineraryDay {
  day: number;
  theme: string;
  stops: ItineraryStop[];
}

interface ItineraryResult {
  title: string;
  summary: string;
  days: ItineraryDay[];
  total_pois: number;
  estimated_days: number;
  generated_at: string;
  candidate_pois: CandidatePoi[];
  constraints: {
    destination?: string;
    days: number;
    dailyHours: number;
    intensity: Intensity;
    themeTags: string[];
  };
}

interface ModelItineraryStop {
  poi_id: string;
  notes?: string;
}

interface ModelItineraryDay {
  day: number;
  theme?: string;
  stops: ModelItineraryStop[];
}

interface ModelItineraryPayload {
  summary?: string;
  days: ModelItineraryDay[];
}

interface EdgeError {
  code: string;
  message_zh: string;
}

interface ScenicRow {
  id: string;
  name: string;
  rating: string | null;
  city: string | null;
  provincial: string | null;
  full_address: string | null;
  lng_wgs84: number | null;
  lat_wgs84: number | null;
  recommend: string | null;
}

interface HeritageRow {
  id: string;
  name: string;
  batch: string | null;
  era: string | null;
  category: string | null;
  city: string | null;
  provincial: string | null;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
  recommend: string | null;
}

interface MuseumRow {
  id: string;
  name: string;
  level: string | null;
  pname: string | null;
  cityname: string | null;
  address: string | null;
  lng: number | null;
  lat: number | null;
  recommend: string | null;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL_TIMEOUT_MS = 60_000;
const MODEL_CANDIDATE_LIMIT = 120;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(code: string, messageZh: string, status = 400): Response {
  const error: EdgeError = { code, message_zh: messageZh };
  return jsonResponse({ error }, status);
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseChineseNumber(raw: string): number | null {
  const normalized = raw.trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (normalized === '十') return 10;
  if (normalized.startsWith('十') && normalized.length === 2) {
    return 10 + (map[normalized[1]] ?? 0);
  }
  if (normalized.endsWith('十') && normalized.length === 2) {
    return (map[normalized[0]] ?? 0) * 10;
  }
  if (normalized.length === 3 && normalized[1] === '十') {
    return (map[normalized[0]] ?? 0) * 10 + (map[normalized[2]] ?? 0);
  }
  return map[normalized] ?? null;
}

function parseIntensityFromText(text: string): Intensity {
  if (/(轻松|不要太累|悠闲|慢节奏)/.test(text)) return 1;
  if (/(暴走|硬核|紧凑|高强度)/.test(text)) return 3;
  return 2;
}

function parseThemesFromText(text: string): string[] {
  const themes: string[] = [];
  const mapping: [RegExp, string][] = [
    [/(历史|朝代|古迹|文保)/, '历史'],
    [/(博物馆|展览|文物)/, '博物馆'],
    [/(建筑|古建|寺庙|城墙)/, '古建'],
    [/(自然|山水|风景|户外)/, '自然'],
  ];
  for (const [pattern, tag] of mapping) {
    if (pattern.test(text)) themes.push(tag);
  }
  return [...new Set(themes)];
}

function normalizeDestinationCandidate(raw: string): string | undefined {
  const cleaned = raw
    .trim()
    .replace(/^[，。；、,.!?！？\s]+|[，。；、,.!?！？\s]+$/g, '')
    .replace(
      /^(?:请帮我|帮我|给我|替我|我想要|我想去|我想|想去|想要|想|做一个|做个|生成|规划|安排|推荐|来一份|来个|一份|一个)+/,
      '',
    )
    .replace(/(?:的)?(?:城市)?(?:旅游|旅行|行程|路线|自由行|深度游|打卡|攻略)+$/i, '')
    .replace(/(?:市)?(?:一日游|二日游|两日游|三日游|四日游|五日游)$/i, '')
    .replace(/的$/g, '');

  const normalized = cleaned.endsWith('市') && cleaned.length > 2 ? cleaned.slice(0, -1) : cleaned;
  if (normalized.length < 2 || normalized.length > 8) {
    return undefined;
  }
  return normalized;
}

function extractDestinationByPattern(text: string, pattern: RegExp): string | undefined {
  const matches = Array.from(text.matchAll(pattern));
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const candidate = normalizeDestinationCandidate(matches[index]?.[1] ?? '');
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}

function parseDestinationFromText(text: string): string | undefined {
  const byAction = extractDestinationByPattern(
    text,
    /(?:在|去|到|想去|前往|来|逛)\s*([\u4e00-\u9fa5]{2,12}?)(?=玩|旅行|旅游|逛|出行|citywalk|行程|路线|自由行|深度游|打卡|攻略|一日游|二日游|两日游|三日游|四日游|五日游)/gi,
  );
  if (byAction) return byAction;

  const byTravelForm = extractDestinationByPattern(
    text,
    /(?:^|[，。；、\s])([\u4e00-\u9fa5]{2,12}?)(?=的?(?:城市)?(?:旅游|旅行|行程|路线|自由行|深度游|打卡|攻略))/gi,
  );
  if (byTravelForm) return byTravelForm;

  const byDays = extractDestinationByPattern(
    text,
    /(?:^|[，。；、\s])([\u4e00-\u9fa5]{2,12}?)(?=(?:一|二|两|三|四|五|六|七|八|九|十|\d+)\s*天|一日游|二日游|两日游|三日游|四日游|五日游)/g,
  );
  if (byDays) return byDays;

  return undefined;
}

function parseDaysFromText(text: string): number | undefined {
  const dayText = text.match(/([一二两三四五六七八九十\d]+)\s*天/);
  if (!dayText?.[1]) return undefined;
  const parsed = parseChineseNumber(dayText[1]);
  if (!parsed || !Number.isFinite(parsed)) return undefined;
  return clamp(parsed, 1, 7);
}

function parseDailyHoursFromText(text: string): number | undefined {
  const match = text.match(/每天(?:最多|不超过)?\s*([1-9]|1[0-2])\s*小时/);
  if (!match?.[1]) return undefined;
  return clamp(Number(match[1]), 4, 12);
}

function fallbackResolveFromQuery(query: string): Partial<ResolvedConstraints> {
  return {
    destination: parseDestinationFromText(query),
    days: parseDaysFromText(query) ?? 2,
    dailyHours: parseDailyHoursFromText(query) ?? 8,
    intensity: parseIntensityFromText(query),
    themeTags: parseThemesFromText(query),
  };
}

function extractJsonObject(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (blockMatch?.[1]) {
      return JSON.parse(blockMatch[1].trim());
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('无法解析模型返回 JSON');
  }
}

function normalizeModelConstraint(payload: unknown): Partial<ResolvedConstraints> {
  if (!payload || typeof payload !== 'object') return {};
  const value = payload as Record<string, unknown>;
  return {
    destination: typeof value.destination === 'string' ? value.destination.trim() : undefined,
    days:
      typeof value.days === 'number'
        ? clamp(Math.floor(value.days), 1, 7)
        : undefined,
    dailyHours:
      typeof value.dailyHours === 'number'
        ? clamp(Math.floor(value.dailyHours), 4, 12)
        : undefined,
    intensity:
      typeof value.intensity === 'number'
        ? (clamp(Math.floor(value.intensity), 1, 3) as Intensity)
        : undefined,
    themeTags: safeStringArray(value.themeTags),
  };
}

async function parseByModel(query: string, apiKey: string): Promise<Partial<ResolvedConstraints>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  const system = [
    '你是行程规划参数解析器。',
    '你只负责把中文自然语言需求解析成 JSON 约束，不要回答解释。',
    '输出必须为严格 JSON，且仅包含：destination, days, dailyHours, intensity, themeTags。',
    'days 范围 1-7；dailyHours 范围 4-12；intensity 仅 1/2/3。',
    'themeTags 是中文短标签数组，最多 4 个。',
  ].join(' ');
  const user = `请解析这段需求：${query}`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.1,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return {};
    }
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return {};
    }
    const parsed = extractJsonObject(content);
    return normalizeModelConstraint(parsed);
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveConstraints(input: ItineraryConstraintInput): Promise<ResolvedConstraints> {
  const query = input.query?.trim();
  if (!query) {
    throw new Error('请先输入自然语言出行需求。');
  }

  const byRule = fallbackResolveFromQuery(query);
  let byModel: Partial<ResolvedConstraints> = {};
  const deepSeekKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (deepSeekKey) {
    byModel = await parseByModel(query, deepSeekKey);
  }

  const destination = input.destination?.trim() || byModel.destination || byRule.destination;
  const days = clamp(input.days ?? byModel.days ?? byRule.days ?? 2, 1, 7);
  const dailyHours = clamp(input.dailyHours ?? byModel.dailyHours ?? byRule.dailyHours ?? 8, 4, 12);
  const intensity = clamp(
    input.intensity ?? byModel.intensity ?? byRule.intensity ?? 2,
    1,
    3,
  ) as Intensity;
  const themeTags = [
    ...safeStringArray(input.themeTags),
    ...safeStringArray(byModel.themeTags),
    ...safeStringArray(byRule.themeTags),
  ];
  const uniqueThemeTags = [...new Set(themeTags)].slice(0, 4);

  return {
    query,
    destination,
    days,
    dailyHours,
    intensity,
    themeTags: uniqueThemeTags,
    preferredPoiTypes: inferPreferredPoiTypes(uniqueThemeTags),
    dayPreferences: parseDayPreferencesFromText(query),
    mustVisitIds: safeStringArray(input.mustVisitIds),
    excludeIds: safeStringArray(input.excludeIds),
  };
}

function estimateStopsPerDay(dailyHours: number, intensity: Intensity): number {
  const base = intensity === 1 ? 3 : intensity === 2 ? 4 : 5;
  if (dailyHours <= 6) return Math.max(2, base - 1);
  if (dailyHours >= 10) return base + 1;
  return base;
}

function stayMinutesByType(type: PoiType, intensity: Intensity): number {
  const base = type === 'scenic' ? 150 : type === 'museum' ? 120 : 100;
  if (intensity === 1) return base + 20;
  if (intensity === 3) return Math.max(60, base - 20);
  return base;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

function distanceSquare(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const dLng = a.lng - b.lng;
  const dLat = a.lat - b.lat;
  return dLng * dLng + dLat * dLat;
}

function sortByNearestNeighbor(candidates: CandidatePoi[]): CandidatePoi[] {
  if (candidates.length <= 2) return [...candidates];

  const result: CandidatePoi[] = [];
  const remaining = new Map(candidates.map((item) => [item.poi_id, item]));
  const start = [...remaining.values()].sort((a, b) => b.score - a.score)[0];
  if (!start) return [];

  result.push(start);
  remaining.delete(start.poi_id);

  while (remaining.size > 0) {
    const current = result[result.length - 1];
    let next: CandidatePoi | null = null;
    let nearest = Number.POSITIVE_INFINITY;

    for (const item of remaining.values()) {
      const dist = distanceSquare(current, item);
      if (dist < nearest) {
        nearest = dist;
        next = item;
      }
    }

    if (!next) break;
    result.push(next);
    remaining.delete(next.poi_id);
  }

  return result;
}

function poiTypeLabel(type: PoiType): string {
  if (type === 'scenic') return '景区';
  if (type === 'museum') return '博物馆';
  return '文保';
}

function buildPriorityHints(themeTags: string[]): string[] {
  const hints: string[] = [];
  if (themeTags.includes('景点')) {
    hints.push('景区优先：5A > 4A。');
  }
  if (themeTags.includes('博物馆')) {
    hints.push('博物馆优先：一级博物馆 > 二级博物馆。');
  }
  if (themeTags.includes('文保')) {
    hints.push('文保优先：第一批 > 第二批。');
  }
  return hints;
}

function buildCandidatePromptList(candidates: CandidatePoi[]): string {
  return candidates
    .map(
      (item, index) =>
        `${index + 1}. poi_id=${item.poi_id}; name=${item.poi_name}; type=${poiTypeLabel(item.poi_type)}; priority=${item.label ?? '未标注'}; score=${item.score}; lng=${item.lng}; lat=${item.lat}`,
    )
    .join('\n');
}

function buildModelPrompt(constraints: ResolvedConstraints, candidates: CandidatePoi[]): string {
  const dayPreferenceLines = Object.entries(constraints.dayPreferences)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([day, types]) => `第${day}天偏好：${types.map((type) => poiTypeLabel(type)).join('、')}为主。`);
  const priorityHints = buildPriorityHints(constraints.themeTags);
  const perDay = estimateStopsPerDay(constraints.dailyHours, constraints.intensity);

  return [
    `用户原始需求：${constraints.query}`,
    `目的地：${constraints.destination ?? '未指定'}`,
    `天数：${constraints.days}天`,
    `每日可用时长：${constraints.dailyHours}小时`,
    `行程节奏：${constraints.intensity === 1 ? '轻松' : constraints.intensity === 2 ? '适中' : '紧凑'}`,
    `偏好类型：${constraints.themeTags.length > 0 ? constraints.themeTags.join('、') : '未指定'}`,
    ...priorityHints,
    ...dayPreferenceLines,
    `排布原则：按点位坐标就近串联，减少往返折返。`,
    `每日日程建议点位数量约 ${perDay} 个，可上下浮动 1 个。`,
    '你必须仅从候选点中选点，不得虚构新点位，不得使用不存在的 poi_id。',
    '候选点如下：',
    buildCandidatePromptList(candidates),
  ].join('\n');
}

function normalizeModelDay(raw: unknown): ModelItineraryDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ModelItineraryDay>;
  if (!Array.isArray(value.stops)) return null;
  const stops = value.stops
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const stop = item as Partial<ModelItineraryStop>;
      if (typeof stop.poi_id !== 'string' || stop.poi_id.trim().length === 0) return null;
      return {
        poi_id: stop.poi_id.trim(),
        notes: typeof stop.notes === 'string' ? stop.notes : undefined,
      };
    })
    .filter((item): item is ModelItineraryStop => Boolean(item));

  if (stops.length === 0) return null;
  return {
    day: typeof value.day === 'number' && Number.isFinite(value.day) ? Math.floor(value.day) : 0,
    theme: typeof value.theme === 'string' ? value.theme : undefined,
    stops,
  };
}

function normalizeModelItineraryPayload(raw: unknown): ModelItineraryPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ModelItineraryPayload>;
  if (!Array.isArray(value.days)) return null;
  const days = value.days
    .map((item) => normalizeModelDay(item))
    .filter((item): item is ModelItineraryDay => Boolean(item));
  if (days.length === 0) return null;
  return {
    summary: typeof value.summary === 'string' ? value.summary : undefined,
    days,
  };
}

function buildStopsFromCandidates(
  dayCandidates: CandidatePoi[],
  intensity: Intensity,
): ItineraryStop[] {
  const ordered = sortByNearestNeighbor(dayCandidates);
  let minute = 9 * 60;
  return ordered.map((poi) => {
    const duration = stayMinutesByType(poi.poi_type, intensity);
    const arrival = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    minute += duration + 30;
    return {
      poi_id: poi.poi_id,
      poi_name: poi.poi_name,
      poi_type: poi.poi_type,
      arrival_time: arrival,
      duration_minutes: duration,
      stay_duration: formatDuration(duration),
      notes: poi.label ? `优先级：${poi.label}` : undefined,
      lng: poi.lng,
      lat: poi.lat,
    };
  });
}

function dayMatchesPreference(
  stops: ItineraryStop[],
  preferredTypes: PoiType[],
): boolean {
  if (preferredTypes.length === 0 || stops.length === 0) return true;
  const matched = stops.filter((stop) => preferredTypes.includes(stop.poi_type)).length;
  return matched >= Math.ceil(stops.length / 2);
}

function mapModelDaysToItineraryDays(
  payload: ModelItineraryPayload,
  constraints: ResolvedConstraints,
  candidates: CandidatePoi[],
): ItineraryDay[] | null {
  const poiMap = new Map(candidates.map((item) => [item.poi_id, item]));
  const used = new Set<string>();
  const days: ItineraryDay[] = [];

  for (let dayIndex = 0; dayIndex < constraints.days; dayIndex += 1) {
    const modelDay = payload.days.find((item) => item.day === dayIndex + 1) ?? payload.days[dayIndex];
    if (!modelDay) return null;

    const dayCandidates: CandidatePoi[] = [];
    for (const stop of modelDay.stops) {
      const candidate = poiMap.get(stop.poi_id);
      if (!candidate || used.has(candidate.poi_id)) continue;
      dayCandidates.push(candidate);
      used.add(candidate.poi_id);
    }

    if (dayCandidates.length === 0) return null;

    const stops = buildStopsFromCandidates(dayCandidates, constraints.intensity);
    const preferredTypes = constraints.dayPreferences[dayIndex + 1] ?? [];
    if (!dayMatchesPreference(stops, preferredTypes)) {
      return null;
    }

    days.push({
      day: dayIndex + 1,
      theme: modelDay.theme?.trim() || `第${dayIndex + 1}天`,
      stops,
    });
  }

  return days;
}

async function generateDaysByModel(
  constraints: ResolvedConstraints,
  candidates: CandidatePoi[],
  apiKey: string,
): Promise<{ days: ItineraryDay[]; summary?: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  const modelCandidates = candidates.slice(0, MODEL_CANDIDATE_LIMIT);
  const system = [
    '你是文旅行程规划助手。',
    '你需要根据用户需求和候选点位，输出严格 JSON。',
    'JSON 顶层字段必须且仅包含：summary, days。',
    'days 为数组，每项包含：day(数字), theme(字符串), stops(数组)。',
    'stops 每项必须包含：poi_id；可选 notes。',
    '严禁输出候选列表之外的 poi_id。',
  ].join(' ');

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: buildModelPrompt(constraints, modelCandidates) },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return null;
    }

    const parsed = extractJsonObject(content);
    const payload = normalizeModelItineraryPayload(parsed);
    if (!payload) return null;

    const days = mapModelDaysToItineraryDays(payload, constraints, modelCandidates);
    if (!days || days.length === 0) return null;

    return { days, summary: payload.summary };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function containsDestination(fields: (string | null | undefined)[], destination?: string): boolean {
  if (!destination) return true;
  return fields.some((item) => item?.includes(destination));
}

function sanitizeDestinationForFilter(destination?: string): string | undefined {
  if (!destination) return undefined;
  const sanitized = destination.trim().replace(/[,%()]/g, '');
  return sanitized.length > 0 ? sanitized : undefined;
}

function scenicPriorityScore(row: ScenicRow): number {
  const normalized = (row.rating ?? '').replace(/\s+/g, '').toUpperCase();
  if (normalized === '5A') return 100;
  if (normalized === '4A') return 90;
  return 0;
}

function museumPriorityScore(level: string | null): number {
  const text = level ?? '';
  if (text.includes('一级') || text.includes('一級') || text.includes('一级馆')) return 100;
  if (text.includes('二级') || text.includes('二級') || text.includes('二级馆')) return 88;
  return 70;
}

function heritagePriorityScore(batch: string | null): number {
  const text = batch ?? '';
  if (text.includes('第一批')) return 100;
  if (text.includes('第二批')) return 86;
  return 72;
}

async function fetchCandidates(
  userClient: ReturnType<typeof createClient>,
  constraints: ResolvedConstraints,
): Promise<CandidatePoi[]> {
  const destinationFilter = sanitizeDestinationForFilter(constraints.destination);

  let scenicQuery = userClient
    .from('catalog_scenic_spots')
    .select('id,name,rating,city,provincial,full_address,lng_wgs84,lat_wgs84,recommend')
    .in('rating', ['5A', '4A'])
    .not('lng_wgs84', 'is', null)
    .not('lat_wgs84', 'is', null);
  let heritageQuery = userClient
    .from('catalog_heritage_sites')
    .select('id,name,batch,era,category,city,provincial,address,longitude,latitude,recommend')
    .not('longitude', 'is', null)
    .not('latitude', 'is', null);
  let museumQuery = userClient
    .from('catalog_museums')
    .select('id,name,level,pname,cityname,address,lng,lat,recommend')
    .not('lng', 'is', null)
    .not('lat', 'is', null);

  if (destinationFilter) {
    scenicQuery = scenicQuery.or(
      `provincial.ilike.%${destinationFilter}%,city.ilike.%${destinationFilter}%,full_address.ilike.%${destinationFilter}%,name.ilike.%${destinationFilter}%`,
    );
    heritageQuery = heritageQuery.or(
      `provincial.ilike.%${destinationFilter}%,city.ilike.%${destinationFilter}%,address.ilike.%${destinationFilter}%,name.ilike.%${destinationFilter}%`,
    );
    museumQuery = museumQuery.or(
      `pname.ilike.%${destinationFilter}%,cityname.ilike.%${destinationFilter}%,address.ilike.%${destinationFilter}%,name.ilike.%${destinationFilter}%`,
    );
  }

  const [scenicRes, heritageRes, museumRes] = await Promise.all([
    scenicQuery.limit(240),
    heritageQuery.limit(240),
    museumQuery.limit(240),
  ]);

  if (scenicRes.error || heritageRes.error || museumRes.error) {
    throw new Error('名录查询失败，请稍后重试。');
  }

  const scenicRows = (scenicRes.data ?? []) as ScenicRow[];
  const heritageRows = (heritageRes.data ?? []) as HeritageRow[];
  const museumRows = (museumRes.data ?? []) as MuseumRow[];

  const scenic = scenicRows
    .filter((row) =>
      containsDestination(
        [row.provincial, row.city, row.full_address, row.name],
        constraints.destination,
      )
    )
    .map((row) => ({
      poi_id: row.id,
      poi_name: row.name,
      poi_type: 'scenic' as const,
      lng: row.lng_wgs84 as number,
      lat: row.lat_wgs84 as number,
      label: row.rating ?? undefined,
      score: scenicPriorityScore(row) + (row.recommend ? 2 : 0),
    }));

  const heritage = heritageRows
    .filter((row) =>
      containsDestination(
        [row.provincial, row.city, row.address, row.name],
        constraints.destination,
      )
    )
    .map((row) => ({
      poi_id: row.id,
      poi_name: row.name,
      poi_type: 'heritage' as const,
      lng: row.longitude as number,
      lat: row.latitude as number,
      label: row.batch ?? row.era ?? row.category ?? undefined,
      score: heritagePriorityScore(row.batch) + (row.recommend ? 2 : 0),
    }));

  const museum = museumRows
    .filter((row) =>
      containsDestination(
        [row.pname, row.cityname, row.address, row.name],
        constraints.destination,
      )
    )
    .map((row) => ({
      poi_id: row.id,
      poi_name: row.name,
      poi_type: 'museum' as const,
      lng: row.lng as number,
      lat: row.lat as number,
      label: row.level ?? undefined,
      score: museumPriorityScore(row.level) + (row.recommend ? 2 : 0),
    }));

  const merged = [...scenic, ...museum, ...heritage]
    .filter((item) => !constraints.excludeIds.includes(item.poi_id))
    .sort((a, b) => b.score - a.score);

  if (merged.length === 0) {
    throw new Error('未找到符合条件的候选点位，请调整目的地或偏好后重试。');
  }
  return merged;
}

function buildTitle(constraints: ResolvedConstraints): string {
  const destination = constraints.destination ?? '目的地';
  return `${destination} · ${constraints.days}日智能行程`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', '仅支持 POST 请求。', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse('MISSING_SUPABASE_ENV', '服务端缺少 Supabase 环境变量配置。', 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('UNAUTHORIZED', '请先登录后再使用智能行程功能。', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse('UNAUTHORIZED', '登录状态已失效，请重新登录。', 401);
    }

    const body = (await req.json()) as ItineraryRequest;
    const constraints = await resolveConstraints(body.constraints ?? {});
    const candidates = await fetchCandidates(userClient, constraints);
    const deepSeekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const modelPlan = deepSeekKey
      ? await generateDaysByModel(constraints, candidates, deepSeekKey)
      : null;

    const days = modelPlan?.days ?? (() => {
      const selected = pickPlanningCandidates(candidates, constraints);
      return buildPlanningDays(selected, constraints);
    })();
    if (days.length === 0) {
      return errorResponse('NO_ITINERARY', '未能生成可展示行程，请调整条件后重试。', 422);
    }

    const result: ItineraryResult = {
      title: buildTitle(constraints),
      summary: modelPlan?.summary?.trim() || constraints.query,
      days,
      total_pois: days.reduce((sum, day) => sum + day.stops.length, 0),
      estimated_days: days.length,
      generated_at: new Date().toISOString(),
      candidate_pois: candidates.slice(0, 30),
      constraints: {
        destination: constraints.destination,
        days: constraints.days,
        dailyHours: constraints.dailyHours,
        intensity: constraints.intensity,
        themeTags: constraints.themeTags,
      },
    };

    return jsonResponse({ data: result, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : '智能行程服务暂时不可用，请稍后重试。';
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
});
