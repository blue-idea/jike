import { createClient } from 'jsr:@supabase/supabase-js@2';

type PoiType = 'scenic' | 'heritage' | 'museum';
type GuideSectionType =
  | 'background'
  | 'cultural'
  | 'poetry'
  | 'story'
  | 'timeline'
  | 'attraction';

interface GuideSection {
  type: GuideSectionType;
  title: string;
  content: string;
}

interface AiGuideResult {
  sections: GuideSection[];
  disclaimer: string;
  poi_name: string;
  generated_at: string;
}

interface AiGuideRequest {
  poi_id?: string;
  poi_type?: PoiType;
  poi_name?: string;
  locale?: string;
}

interface EdgeError {
  code: string;
  message_zh: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_DISCLAIMER =
  '以上内容由 AI 生成，仅供参考；如需准确信息，请以景区或文博机构官方资料为准。';

const MODEL_TIMEOUT_MS = 60_000;

const POI_TYPE_LABELS: Record<PoiType, string> = {
  scenic: '景区',
  heritage: '文保单位',
  museum: '博物馆',
};

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

function normalizePoiName(request: AiGuideRequest): string {
  const poiName = request.poi_name?.trim();
  if (poiName) return poiName;

  const fallback = request.poi_id?.trim();
  if (fallback) return fallback;

  return '文化地标';
}

function normalizeGuideResult(payload: unknown, poiName: string): AiGuideResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('模型输出为空');
  }

  const raw = payload as Partial<AiGuideResult>;
  const sections = Array.isArray(raw.sections)
    ? raw.sections.filter((item): item is GuideSection => {
        if (!item || typeof item !== 'object') return false;
        const section = item as Partial<GuideSection>;
        return (
          typeof section.type === 'string' &&
          typeof section.title === 'string' &&
          typeof section.content === 'string'
        );
      })
    : [];

  if (sections.length === 0) {
    throw new Error('模型未返回有效 sections');
  }

  return {
    sections,
    disclaimer:
      typeof raw.disclaimer === 'string' && raw.disclaimer.trim().length > 0
        ? raw.disclaimer
        : DEFAULT_DISCLAIMER,
    poi_name:
      typeof raw.poi_name === 'string' && raw.poi_name.trim().length > 0
        ? raw.poi_name
        : poiName,
    generated_at:
      typeof raw.generated_at === 'string' && raw.generated_at.trim().length > 0
        ? raw.generated_at
        : new Date().toISOString(),
  };
}

function fallbackGuideContent(poiName: string, poiType: PoiType): AiGuideResult {
  const typeLabel = POI_TYPE_LABELS[poiType];

  return {
    poi_name: poiName,
    generated_at: new Date().toISOString(),
    disclaimer: DEFAULT_DISCLAIMER,
    sections: [
      {
        type: 'background',
        title: '历史背景',
        content: `${poiName}是一处具有文化识别度的${typeLabel}。若缺少确切史料，建议优先结合官方介绍、馆牌说明与地方志资料理解其历史沿革。`,
      },
      {
        type: 'cultural',
        title: '文化解读',
        content: `理解${poiName}，可以从空间形态、地域文脉、保存状态和公众记忆四个角度切入，观察它在当代文化传播中的位置。`,
      },
      {
        type: 'poetry',
        title: '主要看点',
        content: `参观${poiName}时，建议先抓住最具识别度的主体建筑、代表性展陈、标志性空间节点和最能体现地方文化气质的细节，这些往往是理解全貌的关键。`,
      },
      {
        type: 'story',
        title: '人物故事',
        content: `可以重点关注与${poiName}相关的修建者、保护者、研究者和讲述者，他们往往构成一处文化地点最有温度的人物线索。`,
      },
      {
        type: 'timeline',
        title: '朝代演变',
        content: '可按“起源背景、重要变迁、近现代保护、当代展示”四段来理解其时间脉络，避免在缺乏证据时硬写具体年份。',
      },
      {
        type: 'attraction',
        title: '参观建议',
        content: `如果时间有限，可先走主线区域，再补充次级空间；结合现场说明牌或讲解服务，会更容易把零散信息串成完整的参观体验。`,
      },
    ],
  };
}

function buildPrompt(poiName: string, poiType: PoiType, locale: string): {
  system: string;
  user: string;
} {
  const typeLabel = POI_TYPE_LABELS[poiType];

  return {
    system: [
      '你是一名严谨的中文文旅讲解撰稿人，擅长为中国景点生成结构化导览内容。',
      '你只能基于景点名称与常识做审慎推断，绝不能编造具体年份、人物、典故、馆藏编号或考古结论。',
      '如果信息不确定，请明确使用“通常认为”“可理解为”“若结合公开资料来看”等保守表述。',
      '输出必须是严格 JSON，不要输出 markdown，不要输出额外说明。',
      'JSON 顶层字段必须且只能包含：sections, disclaimer, poi_name, generated_at。',
      'sections 必须正好包含 6 个对象，type 依次使用 background, cultural, poetry, story, timeline, attraction。',
      '每个 section 都要有 title 和 content，content 用简体中文，长度控制在 60 到 140 个汉字，适合移动端阅读和语音播报。',
      'poetry 这个 section 的 title 固定写为“主要看点”，内容写游客最值得优先关注的建筑、展陈、空间或细节，不要再写诗意联想或相关诗词。',
      'attraction 这个 section 的 title 固定写为“参观建议”，内容写参观顺序、阅读方式、节奏或时间分配建议。',
      'timeline 模块可以写成一句完整概述，也可以在字符串中用“1. 2. 3.”组织时间线，但不要使用数组。',
      'disclaimer 必须是一句简洁中文提醒，强调“AI 生成，仅供参考”。',
      `locale=${locale}。`,
    ].join(' '),
    user: [
      `请为下列地点生成 AI 导游讲解：`,
      `景点名称：${poiName}`,
      `景点类型：${typeLabel}`,
      '要求如下：',
      '1. 语言自然、克制、可直接给游客阅读或语音播报。',
      '2. 重点写“这个地方为什么值得了解”，不要堆砌空泛赞美。',
      '3. 若景点名称本身可能对应多个地点，请采用更稳妥的泛化表达，不要擅自锁定到某个具体遗址。',
      '4. 不要写“根据数据库”或“根据资料不足”等工程化措辞，要保持导游讲解口吻。',
    ].join('\n'),
  };
}

async function callDeepSeekGuide(
  apiKey: string,
  prompt: { system: string; user: string },
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.5,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('DeepSeek 未返回有效内容');
    }

    return extractJsonObject(content);
  } finally {
    clearTimeout(timeout);
  }
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
      return errorResponse('UNAUTHORIZED', '请先登录后再使用 AI 讲解功能。', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse('UNAUTHORIZED', '登录状态已失效，请重新登录。', 401);
    }

    const body = (await req.json()) as AiGuideRequest;
    const poiType = body.poi_type;
    const locale = (body.locale ?? 'zh-CN').trim();
    const poiName = normalizePoiName(body);

    if (!poiType || !POI_TYPE_LABELS[poiType]) {
      return errorResponse('INVALID_PARAMS', '景点类型缺失，请重新选择后重试。', 400);
    }

    if (!poiName || poiName === '文化地标') {
      return errorResponse('INVALID_PARAMS', '景点名称缺失，请重新选择后重试。', 400);
    }

    const deepSeekKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepSeekKey) {
      const guideResult = fallbackGuideContent(poiName, poiType);
      return jsonResponse({ data: guideResult, error: null });
    }

    try {
      const prompt = buildPrompt(poiName, poiType, locale);
      const llmPayload = await callDeepSeekGuide(deepSeekKey, prompt);
      const guideResult = normalizeGuideResult(llmPayload, poiName);
      return jsonResponse({ data: guideResult, error: null });
    } catch {
      const guideResult = fallbackGuideContent(poiName, poiType);
      return jsonResponse({ data: guideResult, error: null });
    }
  } catch {
    return errorResponse('INTERNAL_ERROR', 'AI 导游服务暂时不可用，请稍后重试。', 500);
  }
});
