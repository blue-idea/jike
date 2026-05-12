// Edge Function: ai-travel-journal
import { createClient } from 'jsr:@supabase/supabase-js@2';

type PoiType = 'scenic' | 'heritage' | 'museum';

interface TrajectoryPoint {
  id?: string;
  lat?: number;
  lng?: number;
  timestamp?: string;
  poi_id?: string;
  poi_name?: string;
  poi_type?: PoiType;
}

interface TravelSessionInput {
  id?: string;
  title?: string;
  started_at?: string;
  ended_at?: string;
  points?: TrajectoryPoint[];
}

interface TravelJournalRequest {
  session?: TravelSessionInput;
  locale?: string;
}

interface TravelJournalResponse {
  title: string;
  content: string;
  excerpt: string;
  point_count: number;
  poi_count: number;
  generated_at: string;
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

const MODEL_TIMEOUT_MS = 60_000;

class ModelTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelTimeoutError';
  }
}

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

function normalizePoints(points: unknown): TrajectoryPoint[] {
  if (!Array.isArray(points)) return [];
  return points
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const value = item as TrajectoryPoint;
      return {
        id: typeof value.id === 'string' ? value.id : undefined,
        lat: typeof value.lat === 'number' ? value.lat : undefined,
        lng: typeof value.lng === 'number' ? value.lng : undefined,
        timestamp: typeof value.timestamp === 'string' ? value.timestamp : undefined,
        poi_id: typeof value.poi_id === 'string' ? value.poi_id : undefined,
        poi_name: typeof value.poi_name === 'string' ? value.poi_name : undefined,
        poi_type: value.poi_type,
      };
    })
    .filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number');
}

function uniquePois(points: TrajectoryPoint[]): { id: string; name: string; type?: PoiType }[] {
  const map = new Map<string, { id: string; name: string; type?: PoiType }>();
  for (const point of points) {
    if (!point.poi_id || !point.poi_name) continue;
    if (!map.has(point.poi_id)) {
      map.set(point.poi_id, {
        id: point.poi_id,
        name: point.poi_name,
        type: point.poi_type,
      });
    }
  }
  return [...map.values()];
}

function buildFallbackJournal(session: Required<TravelSessionInput>): TravelJournalResponse {
  const points = normalizePoints(session.points);
  const pois = uniquePois(points);
  const title = session.title?.trim() || '我的文化行程游记';

  const startText = session.started_at
    ? `出发时间是 ${new Date(session.started_at).toLocaleString('zh-CN')}。`
    : '这是一段值得纪念的文化旅程。';

  const poiText = pois.length > 0
    ? `本次旅程途经了${pois.slice(0, 6).map((item) => item.name).join('、')}等地标。`
    : '本次旅程在城市中持续探索，沿途留下了丰富的足迹。';

  const content = [
    `${title}`,
    '',
    startText,
    `累计记录轨迹点 ${points.length} 个。`,
    poiText,
    '沿着这些轨迹回看，我们能看到行走节奏、停留重点与文化兴趣的变化。',
    '建议后续可结合照片、门票或手记补充细节，让这段游记更完整。',
  ].join('\n');

  return {
    title,
    content,
    excerpt: content.slice(0, 120),
    point_count: points.length,
    poi_count: pois.length,
    generated_at: new Date().toISOString(),
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

function normalizeModelJournal(
  payload: unknown,
  fallback: TravelJournalResponse,
): TravelJournalResponse {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const value = payload as Partial<TravelJournalResponse>;
  const title = typeof value.title === 'string' && value.title.trim().length > 0
    ? value.title.trim()
    : fallback.title;
  const content = typeof value.content === 'string' && value.content.trim().length > 0
    ? value.content.trim()
    : fallback.content;
  const excerpt = typeof value.excerpt === 'string' && value.excerpt.trim().length > 0
    ? value.excerpt.trim()
    : content.slice(0, 120);

  return {
    title,
    content,
    excerpt,
    point_count: fallback.point_count,
    poi_count: fallback.poi_count,
    generated_at: new Date().toISOString(),
  };
}

function buildPrompt(session: Required<TravelSessionInput>, locale: string): { system: string; user: string } {
  const points = normalizePoints(session.points);
  const pois = uniquePois(points);
  const title = session.title?.trim() || '我的文化行程游记';
  const head = points.slice(0, 3).map((item) => `${item.timestamp ?? '-'}@(${item.lng},${item.lat})`);
  const tail = points.slice(-3).map((item) => `${item.timestamp ?? '-'}@(${item.lng},${item.lat})`);

  return {
    system: [
      '你是一名中文旅行写作助手。',
      '请把轨迹数据和途经 POI 整理成可编辑的图文游记草稿。',
      '输出严格 JSON，且只能包含 title/content/excerpt 三个字段。',
      'content 使用简体中文，采用自然分段，不要使用 markdown 标题。',
      '不要编造精确历史事实；不确定信息用保守表达。',
      `locale=${locale}`,
    ].join(' '),
    user: [
      `游记标题建议：${title}`,
      `轨迹点数量：${points.length}`,
      `关联 POI：${pois.map((item) => item.name).join('、') || '无明确 POI'}`,
      `起始轨迹样例：${head.join(' | ') || '无'}`,
      `结束轨迹样例：${tail.join(' | ') || '无'}`,
      '请生成一篇 4-6 段的游记草稿，强调行走路线、停留重点和文化体验。',
    ].join('\n'),
  };
}

async function callModelWithTimeout(
  url: string,
  body: unknown,
  apiKey: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('模型返回为空');
    }

    return extractJsonObject(content);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ModelTimeoutError('游记生成超时，请稍后重试。');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateByModel(
  session: Required<TravelSessionInput>,
  locale: string,
): Promise<TravelJournalResponse | null> {
  const fallback = buildFallbackJournal(session);
  const prompt = buildPrompt(session, locale);

  const deepSeekKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (deepSeekKey) {
    try {
      const payload = await callModelWithTimeout(
        'https://api.deepseek.com/chat/completions',
        {
          model: 'deepseek-chat',
          temperature: 0.5,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        },
        deepSeekKey,
      );
      return normalizeModelJournal(payload, fallback);
    } catch (error) {
      if (error instanceof ModelTimeoutError) throw error;
    }
  }

  const qwenKey = Deno.env.get('DASHSCOPE_API_KEY');
  if (qwenKey) {
    try {
      const payload = await callModelWithTimeout(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        {
          model: 'qwen-plus',
          temperature: 0.5,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        },
        qwenKey,
      );
      return normalizeModelJournal(payload, fallback);
    } catch (error) {
      if (error instanceof ModelTimeoutError) throw error;
    }
  }

  return fallback;
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
      return errorResponse('UNAUTHORIZED', '请先登录后再生成游记。', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse('UNAUTHORIZED', '登录状态已失效，请重新登录。', 401);
    }

    const body = (await req.json()) as TravelJournalRequest;
    const session = (body.session ?? {}) as Required<TravelSessionInput>;
    const points = normalizePoints(session.points);

    if (!session.id || typeof session.id !== 'string') {
      return errorResponse('INVALID_PARAMS', '行程会话标识缺失，请重新记录后再试。', 400);
    }

    if (points.length < 2) {
      return errorResponse('INVALID_POINTS', '轨迹点过少，请继续记录后再生成游记。', 422);
    }

    const locale = body.locale?.trim() || 'zh-CN';
    const normalizedSession: Required<TravelSessionInput> = {
      ...session,
      points,
      title: session.title || '我的文化行程游记',
      started_at: session.started_at || '',
      ended_at: session.ended_at || '',
      id: session.id,
    };

    const generated = await generateByModel(normalizedSession, locale);
    const result = generated ?? buildFallbackJournal(normalizedSession);
    return jsonResponse({ data: result, error: null });
  } catch (error) {
    if (error instanceof ModelTimeoutError) {
      return errorResponse('MODEL_TIMEOUT', '游记生成超时，请稍后重试。', 504);
    }
    return errorResponse('INTERNAL_ERROR', 'AI 游记服务暂时不可用，请稍后重试。', 500);
  }
});

