import type { AiGuideResult } from '@/lib/ai/aiGuideQueries';

export function buildGuideSpeakableText(result: AiGuideResult | null): string {
  if (!result) return '';
  const sectionText = result.sections
    .map((section) => `${section.title}。${section.content}`)
    .join('\n');
  return [sectionText, result.disclaimer].filter(Boolean).join('\n');
}
