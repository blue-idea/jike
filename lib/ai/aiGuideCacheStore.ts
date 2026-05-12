import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AiGuideResult } from '@/lib/ai/aiGuideQueries';

export type AiGuideCacheMap = Record<string, AiGuideResult>;

const AI_GUIDE_CACHE_KEY = '@ai_guide_cache_v1';

interface PersistedAiGuideCache {
  version: 1;
  data: AiGuideCacheMap;
}

function isAiGuideResult(value: unknown): value is AiGuideResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<AiGuideResult>;
  if (typeof v.disclaimer !== 'string') return false;
  if (typeof v.poi_name !== 'string') return false;
  if (typeof v.generated_at !== 'string') return false;
  if (!Array.isArray(v.sections)) return false;
  return v.sections.every((section) => (
    section
    && typeof section === 'object'
    && typeof (section as { type?: unknown }).type === 'string'
    && typeof (section as { title?: unknown }).title === 'string'
    && typeof (section as { content?: unknown }).content === 'string'
  ));
}

function sanitizeCache(input: unknown): AiGuideCacheMap {
  if (!input || typeof input !== 'object') return {};
  const records = Object.entries(input as Record<string, unknown>);
  return records.reduce<AiGuideCacheMap>((acc, [key, value]) => {
    if (!isAiGuideResult(value)) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

export async function loadAiGuideCache(): Promise<AiGuideCacheMap> {
  try {
    const raw = await AsyncStorage.getItem(AI_GUIDE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedAiGuideCache | null;
    if (!parsed || parsed.version !== 1) return {};
    return sanitizeCache(parsed.data);
  } catch {
    return {};
  }
}

export async function saveAiGuideCache(cache: AiGuideCacheMap): Promise<void> {
  try {
    const payload: PersistedAiGuideCache = {
      version: 1,
      data: cache,
    };
    await AsyncStorage.setItem(AI_GUIDE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 本地缓存写入失败不应影响主流程
  }
}
