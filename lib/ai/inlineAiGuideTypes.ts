import type { PoiType } from '@/lib/ai/aiGuideQueries';

/** 打开内联 AI 讲解弹层时传入的 POI 参数（与首页 `triggerInlineAiGuide` 一致） */
export type InlineAiGuidePoiInput = {
  id: string;
  name: string;
  poiType: PoiType;
  image: string;
  typeLabel: string;
  heroTagLeft?: string | null;
  heroTagRight?: string | null;
  nameSubtitle?: string | null;
  regionLabel?: string | null;
};

export type InlineAiGuideActiveContext = InlineAiGuidePoiInput & { key: string };
