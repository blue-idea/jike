type EdgeError = {
  code: string;
  message_zh: string;
};

type TtsRequest = {
  text?: string;
  voice_name?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_TTS_BASE_URL = 'https://read-aloud-smoky.vercel.app/api';
const DEFAULT_VOICE_NAME = 'zh-CN-XiaoxiaoNeural';
const MAX_TEXT_LENGTH = 1200;

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', '仅支持 POST 请求。', 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('UNAUTHORIZED', '请先登录后再使用语音播报。', 401);
  }

  try {
    const body = (await req.json()) as TtsRequest;
    const text = body.text?.trim() ?? '';
    const voiceName = body.voice_name?.trim() || DEFAULT_VOICE_NAME;

    if (!text) {
      return errorResponse('INVALID_TEXT', '播报内容为空，请先生成讲解。', 400);
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return errorResponse(
        'TEXT_TOO_LONG',
        `播报内容过长（>${MAX_TEXT_LENGTH}字），请分段播报。`,
        413,
      );
    }

    const ttsBaseUrl = Deno.env.get('TTS_API_BASE_URL') ?? DEFAULT_TTS_BASE_URL;
    const ttsToken = Deno.env.get('TTS_API_TOKEN');
    if (!ttsToken) {
      return errorResponse(
        'MISSING_TTS_TOKEN',
        '语音服务密钥未配置，请在 Supabase Secrets 中设置 TTS_API_TOKEN。',
        500,
      );
    }

    const synthesisUrl =
      `${ttsBaseUrl}/synthesis` +
      `?voiceName=${encodeURIComponent(voiceName)}` +
      `&token=${encodeURIComponent(ttsToken)}` +
      `&text=${encodeURIComponent(text)}`;

    const response = await fetch(synthesisUrl, {
      method: 'GET',
      headers: { accept: '*/*' },
    });

    if (!response.ok) {
      const textPreview = (await response.text()).slice(0, 300);
      return errorResponse(
        'TTS_PROVIDER_ERROR',
        `语音服务调用失败（${response.status}）。${textPreview || '请稍后重试。'}`,
        502,
      );
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', '语音服务暂时不可用，请稍后重试。', 500);
  }
});
