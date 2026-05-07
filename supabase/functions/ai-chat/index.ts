import { createClient } from 'jsr:@supabase/supabase-js@2';

interface QaMessageInput {
  role?: 'user' | 'assistant';
  content?: string;
}

interface QaRequest {
  query?: string;
  messages?: QaMessageInput[];
  locale?: string;
}

interface QaResponse {
  answer: string;
  disclaimer: string;
  sources?: string[];
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
const DEFAULT_DISCLAIMER =
  '以上回答由 AI 生成，仅供文化旅游参考；若涉及权威结论，请以官方文博机构或学术出版资料为准。';

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

function normalizeHistory(messages: QaMessageInput[] | undefined): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: typeof item.content === 'string' ? item.content.trim() : '',
    }))
    .filter((item) => item.content.length > 0)
    .slice(-12);
}

async function callDeepSeekChat(
  apiKey: string,
  locale: string,
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const messages = [
      {
        role: 'system',
        content: [
          '你是一个中文文化旅游问答助手。',
          '回答范围仅限中国文化旅游相关内容：文物、博物馆、景区历史背景、朝代文化、参观建议、地域文脉。',
          '如果用户问题明显超出文化旅游范围，请礼貌拒绝并引导其改问文化旅游主题。',
          '严禁编造具体史实、年份、文物编号、法规条文；不确定时必须明确说明不确定，并建议查阅权威来源。',
          '输出纯文本，简洁分段，适合移动端阅读。',
          `locale=${locale}`,
        ].join(' '),
      },
      ...history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      { role: 'user', content: query },
    ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.3,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek HTTP ${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('DeepSeek 返回内容为空');
    }
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function callQwenChat(
  apiKey: string,
  locale: string,
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const messages = [
      {
        role: 'system',
        content: [
          '你是一个中文文化旅游问答助手。',
          '请只回答文化旅游范围问题，遇到不确定信息时必须说明并引导查证。',
          `locale=${locale}`,
        ].join(' '),
      },
      ...history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      { role: 'user', content: query },
    ];

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        temperature: 0.3,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Qwen HTTP ${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Qwen 返回内容为空');
    }
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function buildFallbackAnswer(query: string): string {
  return [
    `你问的是：「${query}」`,
    '这是一个和文化旅游相关的问题。当前模型服务暂时不可用，我建议你优先参考以下来源后再核对：',
    '1. 国家文物局、国家博物馆、地方文旅厅官网',
    '2. 景区/博物馆官方发布的导览资料',
    '3. 正规出版的历史文化研究书籍',
  ].join('\n');
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
      return errorResponse('UNAUTHORIZED', '请先登录后再使用问答功能。', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse('UNAUTHORIZED', '登录状态已失效，请重新登录。', 401);
    }

    const body = (await req.json()) as QaRequest;
    const query = body.query?.trim();
    if (!query) {
      return errorResponse('INVALID_PARAMS', '请输入要提问的内容。', 400);
    }

    const locale = body.locale?.trim() || 'zh-CN';
    const history = normalizeHistory(body.messages);
    const deepSeekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const qwenKey = Deno.env.get('DASHSCOPE_API_KEY');

    let answer = '';
    try {
      if (deepSeekKey) {
        answer = await callDeepSeekChat(deepSeekKey, locale, query, history);
      } else if (qwenKey) {
        answer = await callQwenChat(qwenKey, locale, query, history);
      } else {
        answer = buildFallbackAnswer(query);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResponse('MODEL_TIMEOUT', '问答生成超时，请稍后重试。', 504);
      }
      answer = buildFallbackAnswer(query);
    }

    const result: QaResponse = {
      answer,
      disclaimer: DEFAULT_DISCLAIMER,
      generated_at: new Date().toISOString(),
    };

    return jsonResponse({ data: result, error: null });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'AI 问答服务暂时不可用，请稍后重试。', 500);
  }
});
