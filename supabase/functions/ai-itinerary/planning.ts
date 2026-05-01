export type PoiType = 'scenic' | 'heritage' | 'museum';
export type Intensity = 1 | 2 | 3;
export type DayPreferences = Record<number, PoiType[]>;

export interface CandidatePoi {
  poi_id: string;
  poi_name: string;
  poi_type: PoiType;
  lng: number;
  lat: number;
  label?: string;
  score: number;
}

export interface ItineraryStop {
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

export interface ItineraryDay {
  day: number;
  theme: string;
  stops: ItineraryStop[];
}

export interface PlanningConstraints {
  query: string;
  days: number;
  dailyHours: number;
  intensity: Intensity;
  themeTags: string[];
  preferredPoiTypes: PoiType[];
  dayPreferences: DayPreferences;
  mustVisitIds: string[];
  excludeIds: string[];
}

const POI_TYPE_KEYWORDS: Record<PoiType, RegExp> = {
  scenic: /(景点|景区|风景|山水|自然|户外|名胜)/,
  museum: /(博物馆|博物院|展览|纪念馆|陈列馆)/,
  heritage: /(文保|国保|古建|古迹|遗址|寺庙|历史建筑|保护单位)/,
};

function uniquePoiTypes(types: PoiType[]): PoiType[] {
  return [...new Set(types)];
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

function inferPoiTypesFromText(text: string): PoiType[] {
  const types: PoiType[] = [];
  for (const [poiType, pattern] of Object.entries(POI_TYPE_KEYWORDS) as [PoiType, RegExp][]) {
    if (pattern.test(text)) {
      types.push(poiType);
    }
  }
  return uniquePoiTypes(types);
}

export function inferPreferredPoiTypes(themeTags: string[]): PoiType[] {
  return inferPoiTypesFromText(themeTags.join('、'));
}

function stripComposedPromptSections(text: string): string {
  return text.split(/(?:^|\s)(?:偏好类型|行程节奏)[:：]/)[0] ?? text;
}

export function parseDayPreferencesFromText(text: string): DayPreferences {
  const userPrompt = stripComposedPromptSections(text);
  const preferences: DayPreferences = {};
  const pattern = /(?:第\s*([一二两三四五六七八九十\d]+)\s*天|D\s*([1-7])|day\s*([1-7]))([^。；;\n]*)/gi;
  const matches = userPrompt.matchAll(pattern);

  for (const match of matches) {
    const day = parseChineseNumber(match[1] ?? match[2] ?? match[3] ?? '');
    if (!day || day < 1 || day > 7) continue;

    const clause = match[4] ?? '';
    const hasPreferenceIntent = /(以|为主|主要|多安排|偏向|重点|优先)/.test(clause);
    const types = inferPoiTypesFromText(clause);
    if (!hasPreferenceIntent || types.length === 0) continue;

    preferences[day] = types;
  }

  return preferences;
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

function buildDayTheme(index: number, constraints: PlanningConstraints): string {
  const dayPreference = constraints.dayPreferences[index + 1];
  if (dayPreference?.length) {
    const labels: Record<PoiType, string> = {
      scenic: '景点',
      museum: '博物馆',
      heritage: '文保',
    };
    return `${dayPreference.map((type) => labels[type]).join('与')}主题`;
  }

  if (constraints.themeTags.length === 0) {
    return ['历史探索', '文化沉浸', '城市漫游', '经典地标'][index % 4];
  }
  return `${constraints.themeTags[index % constraints.themeTags.length]}主题`;
}

function estimateStopsPerDay(dailyHours: number, intensity: Intensity): number {
  const base = intensity === 1 ? 3 : intensity === 2 ? 4 : 5;
  if (dailyHours <= 6) return Math.max(2, base - 1);
  if (dailyHours >= 10) return base + 1;
  return base;
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

function shouldEnsureScenicCoverage(constraints: PlanningConstraints): boolean {
  if (/(只看博物馆|纯博物馆|博物馆专场|全程博物馆|博物馆为主)/.test(constraints.query)) {
    return false;
  }
  if (/(只看文保|纯文保|遗址为主|古迹为主|文保为主|国保为主)/.test(constraints.query)) {
    return false;
  }
  if (constraints.preferredPoiTypes.length > 0 && !constraints.preferredPoiTypes.includes('scenic')) {
    return false;
  }
  if (/(城市旅游|城市游|citywalk|自由行|行程|路线|深度游|打卡|一日游|二日游|两日游|三日游|四日游|五日游)/i.test(constraints.query)) {
    return true;
  }
  return !constraints.themeTags.includes('博物馆') || constraints.themeTags.length > 1;
}

function targetScenicCount(
  scenicPoolSize: number,
  totalNeed: number,
  constraints: PlanningConstraints,
): number {
  if (scenicPoolSize <= 0 || !shouldEnsureScenicCoverage(constraints)) {
    return 0;
  }
  return Math.min(
    scenicPoolSize,
    Math.max(1, Math.min(constraints.days, Math.floor((totalNeed + 2) / 4))),
  );
}

function addCandidate(
  selected: CandidatePoi[],
  used: Set<string>,
  candidate: CandidatePoi,
  totalNeed: number,
): void {
  if (used.has(candidate.poi_id) || selected.length >= totalNeed) return;
  selected.push(candidate);
  used.add(candidate.poi_id);
}

function findReplaceableNonScenicIndex(
  selected: CandidatePoi[],
  mustVisitSet: Set<string>,
): number {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const item = selected[index];
    if (item.poi_type !== 'scenic' && !mustVisitSet.has(item.poi_id)) {
      return index;
    }
  }
  return -1;
}

function buildBalancedTypeTargets(types: PoiType[], totalNeed: number): Map<PoiType, number> {
  const targets = new Map<PoiType, number>();
  if (types.length === 0) return targets;

  const base = Math.floor(totalNeed / types.length);
  const remainder = totalNeed % types.length;
  types.forEach((type, index) => {
    targets.set(type, base + (index < remainder ? 1 : 0));
  });
  return targets;
}

function countSelectedByType(selected: CandidatePoi[]): Map<PoiType, number> {
  const counts = new Map<PoiType, number>();
  for (const item of selected) {
    counts.set(item.poi_type, (counts.get(item.poi_type) ?? 0) + 1);
  }
  return counts;
}

function pickByExplicitPreferences(
  candidates: CandidatePoi[],
  selected: CandidatePoi[],
  used: Set<string>,
  preferredTypes: PoiType[],
  totalNeed: number,
): CandidatePoi[] {
  const targets = buildBalancedTypeTargets(preferredTypes, totalNeed);
  const counts = countSelectedByType(selected);

  for (const type of preferredTypes) {
    const target = targets.get(type) ?? 0;
    const alreadyPicked = counts.get(type) ?? 0;
    const needed = Math.max(0, target - alreadyPicked);
    const pool = candidates.filter((item) => item.poi_type === type);

    let pickedForType = 0;
    for (const candidate of pool) {
      if (pickedForType >= needed) break;
      const before = selected.length;
      addCandidate(selected, used, candidate, totalNeed);
      if (selected.length > before) {
        pickedForType += 1;
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
  }

  for (const candidate of candidates) {
    if (!preferredTypes.includes(candidate.poi_type)) continue;
    addCandidate(selected, used, candidate, totalNeed);
  }

  return selected;
}

export function pickSelectedCandidates(
  candidates: CandidatePoi[],
  constraints: PlanningConstraints,
): CandidatePoi[] {
  const totalNeed = constraints.days * estimateStopsPerDay(
    constraints.dailyHours,
    constraints.intensity,
  );
  const map = new Map(candidates.map((item) => [item.poi_id, item]));
  const selected: CandidatePoi[] = [];
  const used = new Set<string>();

  for (const id of constraints.mustVisitIds) {
    const hit = map.get(id);
    if (hit) addCandidate(selected, used, hit, totalNeed);
  }

  const dayPreferredTypes = uniquePoiTypes(Object.values(constraints.dayPreferences).flat());
  const allPreferredTypes = uniquePoiTypes([
    ...constraints.preferredPoiTypes,
    ...dayPreferredTypes,
  ]);

  if (allPreferredTypes.length > 0) {
    return pickByExplicitPreferences(candidates, selected, used, allPreferredTypes, totalNeed);
  }

  for (const candidate of candidates) {
    addCandidate(selected, used, candidate, totalNeed);
  }

  const scenicPool = candidates.filter((item) => item.poi_type === 'scenic');
  const scenicNeed = targetScenicCount(scenicPool.length, totalNeed, constraints);
  let scenicCount = selected.filter((item) => item.poi_type === 'scenic').length;
  const mustVisitSet = new Set(constraints.mustVisitIds);

  if (scenicNeed > scenicCount) {
    for (const scenic of scenicPool) {
      if (used.has(scenic.poi_id)) continue;

      const replaceIndex = findReplaceableNonScenicIndex(selected, mustVisitSet);

      if (replaceIndex >= 0) {
        used.delete(selected[replaceIndex].poi_id);
        selected[replaceIndex] = scenic;
        used.add(scenic.poi_id);
        scenicCount += 1;
      } else if (selected.length < totalNeed) {
        selected.push(scenic);
        used.add(scenic.poi_id);
        scenicCount += 1;
      }

      if (scenicCount >= scenicNeed) break;
    }
  }

  return selected.length > 0 ? selected : candidates.slice(0, 6);
}

function pickForDay(
  remaining: CandidatePoi[],
  dayIndex: number,
  perDay: number,
  constraints: PlanningConstraints,
): CandidatePoi[] {
  const dayPreference = constraints.dayPreferences[dayIndex + 1];
  if (!dayPreference?.length) {
    const reservedForFuture = reserveFutureDayPreferenceCandidates(
      remaining,
      dayIndex,
      perDay,
      constraints,
    );
    const nonReserved = remaining.filter((item) => !reservedForFuture.has(item.poi_id));
    return [...nonReserved.slice(0, perDay), ...remaining].slice(0, perDay);
  }

  return pickPreferredCandidatesForDay(remaining, dayPreference, perDay);
}

function pickPreferredCandidatesForDay(
  candidates: CandidatePoi[],
  preferredTypes: PoiType[],
  perDay: number,
): CandidatePoi[] {
  const targets = buildBalancedTypeTargets(preferredTypes, perDay);
  const picked: CandidatePoi[] = [];
  const pickedIds = new Set<string>();

  for (const type of preferredTypes) {
    const target = targets.get(type) ?? 0;
    const pool = candidates.filter((item) => item.poi_type === type);
    for (const candidate of pool) {
      const pickedOfType = picked.filter((item) => item.poi_type === type).length;
      if (pickedOfType >= target) break;
      if (pickedIds.has(candidate.poi_id)) continue;
      picked.push(candidate);
      pickedIds.add(candidate.poi_id);
    }
  }

  const preferred = candidates.filter(
    (item) => preferredTypes.includes(item.poi_type) && !pickedIds.has(item.poi_id),
  );
  const fallback = candidates.filter((item) => !pickedIds.has(item.poi_id));
  return [...picked, ...preferred, ...fallback].slice(0, perDay);
}

function reserveFutureDayPreferenceCandidates(
  remaining: CandidatePoi[],
  dayIndex: number,
  perDay: number,
  constraints: PlanningConstraints,
): Set<string> {
  const reserved = new Set<string>();

  for (let futureDay = dayIndex + 2; futureDay <= constraints.days; futureDay += 1) {
    const futurePreference = constraints.dayPreferences[futureDay];
    if (!futurePreference?.length) continue;

    const available = remaining.filter((item) => !reserved.has(item.poi_id));
    const futurePicks = pickPreferredCandidatesForDay(available, futurePreference, perDay);
    for (const candidate of futurePicks) {
      if (futurePreference.includes(candidate.poi_type)) {
        reserved.add(candidate.poi_id);
      }
    }
  }

  return reserved;
}

export function buildDays(
  selected: CandidatePoi[],
  constraints: PlanningConstraints,
): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  const perDay = estimateStopsPerDay(constraints.dailyHours, constraints.intensity);
  const deduped: CandidatePoi[] = [];
  const usedPoiIds = new Set<string>();

  for (const poi of selected) {
    if (usedPoiIds.has(poi.poi_id)) continue;
    deduped.push(poi);
    usedPoiIds.add(poi.poi_id);
  }

  let remaining = sortByNearestNeighbor(deduped);

  for (let dayIndex = 0; dayIndex < constraints.days; dayIndex += 1) {
    const pool = pickForDay(remaining, dayIndex, perDay, constraints);
    if (pool.length === 0) break;
    const poolIds = new Set(pool.map((item) => item.poi_id));
    remaining = remaining.filter((item) => !poolIds.has(item.poi_id));

    let minute = 9 * 60;
    const stops = sortByNearestNeighbor(pool).map((poi) => {
      const duration = stayMinutesByType(poi.poi_type, constraints.intensity);
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

    days.push({
      day: dayIndex + 1,
      theme: buildDayTheme(dayIndex, constraints),
      stops,
    });
  }

  return days;
}
