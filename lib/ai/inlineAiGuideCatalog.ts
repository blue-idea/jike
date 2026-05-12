import type { MuseumCardItem, ScenicFeature } from '@/constants/CatalogData';
import { FEATURED_SITES } from '@/constants/MockData';
import type { InlineAiGuidePoiInput } from '@/lib/ai/inlineAiGuideTypes';

export const INLINE_AI_GUIDE_FALLBACK_IMAGE = FEATURED_SITES[0].image;

function joinRegion(parts: (string | undefined | null)[]): string | null {
  const bits = parts.map((s) => s?.trim()).filter(Boolean) as string[];
  return bits.length > 0 ? bits.join(' · ') : null;
}

export function catalogMuseumItemToInlineInput(
  item: MuseumCardItem,
  poiType: 'heritage' | 'museum',
): InlineAiGuidePoiInput {
  const regionLabel =
    joinRegion([item.provinceFull, item.cityLabel, item.districtLabel]) ??
    (item.location?.trim() ? item.location.trim() : null);
  const tagBits = item.tags.filter(Boolean).slice(0, 2);
  const heroTagLeft = tagBits.length
    ? tagBits.join(' · ')
    : poiType === 'museum'
      ? item.nature?.trim() || '博物馆'
      : '重点文保';
  const heroTagRight =
    poiType === 'museum'
      ? item.qualityLevel?.trim() || '国家一级博物馆'
      : '全国重点文保';
  const typeLabel = poiType === 'museum' ? '博物馆' : '重点文保';
  return {
    id: item.id,
    name: item.title,
    poiType,
    image: item.image?.trim() ? item.image : INLINE_AI_GUIDE_FALLBACK_IMAGE,
    typeLabel,
    regionLabel,
    heroTagLeft,
    heroTagRight,
    nameSubtitle: null,
  };
}

export function scenicFeatureToInlineInput(item: ScenicFeature): InlineAiGuidePoiInput {
  const regionLabel = joinRegion([item.province, item.city, item.district]);
  const lvl = item.level?.trim() ?? '';
  const heroTagRight =
    lvl && (lvl.includes('A') || /[345]A/i.test(lvl)) ? `${lvl}景区` : lvl.length > 0 ? lvl : 'A级景区';
  const heroTagLeft = item.subtitle?.trim() || item.tags[0] || 'A级景区';
  return {
    id: item.id,
    name: item.title,
    poiType: 'scenic',
    image: item.image?.trim() ? item.image : INLINE_AI_GUIDE_FALLBACK_IMAGE,
    typeLabel: 'A 级景区',
    regionLabel,
    heroTagLeft,
    heroTagRight,
    nameSubtitle: null,
  };
}
