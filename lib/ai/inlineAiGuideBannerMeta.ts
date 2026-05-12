import { FEATURED_SITES } from '@/constants/MockData';
import type { NearbyPoi } from '@/lib/location/nearbyQueries';
import type { AmapNearbyScenicItem } from '@/lib/location/amapNearbyScenic';
import type { InlineAiGuidePoiInput } from '@/lib/ai/inlineAiGuideTypes';

export type FeaturedSiteUnion = AmapNearbyScenicItem | (typeof FEATURED_SITES)[number];

export function bannerMetaForFeaturedSite(
  site: FeaturedSiteUnion,
): Pick<InlineAiGuidePoiInput, 'heroTagLeft' | 'heroTagRight' | 'nameSubtitle' | 'regionLabel'> {
  if ('lng' in site) {
    const district = site.tags[0]?.trim() || site.district?.trim() || '';
    const regionBits = [site.province, site.city, district].map((s) => s?.trim()).filter(Boolean);
    const heroTagLeft = site.type?.trim() ? site.type.trim() : '景点';
    const lvl = site.level?.trim() || '';
    const heroTagRight =
      /5A|4A|3A/i.test(lvl) || lvl.includes('A') ? `${lvl}景区` : lvl.length > 0 ? lvl : '景点';
    return {
      regionLabel: regionBits.length > 0 ? regionBits.join(' · ') : null,
      heroTagLeft,
      heroTagRight,
      nameSubtitle: null,
    };
  }
  const regionLabel = `${site.province} · ${site.city}`;
  const heroTagLeft = `${site.dynasty} · ${site.type}`;
  const heroTagRight =
    site.category === 'scenic'
      ? `${site.level}景区`
      : site.category === 'museum'
        ? '国家一级博物馆'
        : '全国重点文保';
  return { regionLabel, heroTagLeft, heroTagRight, nameSubtitle: null };
}

export function bannerMetaForNearbyPoi(
  poi: NearbyPoi,
): Pick<InlineAiGuidePoiInput, 'heroTagLeft' | 'heroTagRight' | 'nameSubtitle' | 'regionLabel'> {
  const regionLabel = poi.province?.trim() || null;
  const heroTagLeft = poi.label?.trim() || poi.recommend?.trim() || '文化地标';
  const heroTagRight =
    poi.poi_type === 'scenic'
      ? 'A 级景区'
      : poi.poi_type === 'heritage'
        ? '全国重点文保'
        : '国家一级博物馆';
  return { regionLabel, heroTagLeft, heroTagRight, nameSubtitle: null };
}
