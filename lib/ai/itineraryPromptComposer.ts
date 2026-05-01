export const ITINERARY_THEME_OPTIONS = ['景点', '博物馆', '文保'] as const;

export type ItineraryThemeOption = (typeof ITINERARY_THEME_OPTIONS)[number];
export type ItineraryIntensity = 1 | 2 | 3;

interface ComposePromptInput {
  customPrompt: string;
  selectedThemeTags: ItineraryThemeOption[];
  intensity: ItineraryIntensity;
  destination?: string;
  days?: number;
  dailyHours?: number;
}

const INTENSITY_LABELS: Record<ItineraryIntensity, string> = {
  1: '轻松',
  2: '适中',
  3: '紧凑',
};

export function composeItineraryQuery({
  customPrompt,
  selectedThemeTags,
  intensity,
  destination,
  days,
  dailyHours,
}: ComposePromptInput): string {
  const prompt = customPrompt.trim();
  const sections = [prompt];

  if (destination?.trim()) {
    sections.push(`目的地：${destination.trim()}。`);
  }
  if (Number.isFinite(days)) {
    sections.push(`行程天数：${days}天。`);
  }
  if (Number.isFinite(dailyHours)) {
    sections.push(`每日可用时长：${dailyHours}小时。`);
  }

  if (selectedThemeTags.length > 0) {
    const preferenceRules: Partial<Record<ItineraryThemeOption, string>> = {
      景点: '景点优先级：5A > 4A。',
      博物馆: '博物馆优先级：一级博物馆优先。',
      文保: '文保优先级：第一批 > 第二批。',
    };
    sections.push(`偏好类型：${selectedThemeTags.join('、')}。`);
    selectedThemeTags.forEach((tag) => {
      const rule = preferenceRules[tag];
      if (rule) sections.push(rule);
    });
  }
  sections.push(`行程节奏：${INTENSITY_LABELS[intensity]}。`);
  sections.push('排布原则：尽量按点位坐标就近串联，减少往返。');

  return sections.filter(Boolean).join(' ');
}
