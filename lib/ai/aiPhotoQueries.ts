/**
 * lib/ai/aiPhotoQueries.ts
 *
 * AI 拍照识别链路（EARS-1：多模态识别 + 名录约束 + 候选置信度 + 跳转详情）
 * EARS-2 覆盖：超时 T 秒中文提示 + 重试
 *
 * 调用约定：实际请求发至 Supabase Edge Functions /ai-photo-recognition，
 * 密钥仅存于 Edge 环境变量，客户端不持有。
 */
import { supabase } from '@/lib/supabase';
import {
  AI_TIMEOUT_SECONDS,
  TIMEOUT_MESSAGE,
} from '@/lib/ai/aiGuideQueries';

export type PoiType = 'scenic' | 'heritage' | 'museum';

export interface RecognitionCandidate {
  poi_id: string;
  poi_name: string;
  poi_type: PoiType;
  confidence: number; // 0-1
  match_reason: string;
  province?: string;
  city?: string;
}

export interface AiPhotoResult {
  candidates: RecognitionCandidate[];
  image_desc: string;
  disclaimer: string;
  generated_at: string;
}

export type PhotoRecognitionStatus =
  | 'idle'
  | 'uploading'
  | 'recognizing'
  | 'success'
  | 'timeout'
  | 'error';

export interface PhotoRecognitionState {
  status: PhotoRecognitionStatus;
  result: AiPhotoResult | null;
  errorMessage: string | null;
}

/**
 * 将图片上传至 Supabase Storage 并调用 Edge 进行识别
 * EARS-1: 返回候选 POI 列表及置信度，可跳转详情/AI 导览
 * EARS-2: 超时 T 秒中文提示 + 重试
 *
 * @param imageUri 本地图片 URI（file:// 或 asset URI）
 * @param abortSignal 可选 AbortSignal
 */
export async function recognizePhoto(
  imageUri: string,
  abortSignal?: AbortSignal,
): Promise<AiPhotoResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('请先登录后再使用拍照识别功能。');
  }

  // Step 1: 上传图片到 Supabase Storage
  const uriParts = imageUri.split('/');
  const fileName = uriParts[uriParts.length - 1] ?? `photo_${Date.now()}.jpg`;

  const response = await fetch(imageUri);
  if (!response.ok) {
    throw new Error('无法读取图片，请重试。');
  }
  const imageBlob = await response.blob();
  const arrayBuffer = await imageBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const storagePath = `photos/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('photo-recognition')
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error('图片上传失败，请重试。');
  }

  // Step 2: 获取公开 URL
  const { data: urlData } = supabase.storage
    .from('photo-recognition')
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // Step 3: 调用 Edge 进行识别
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_TIMEOUT_SECONDS * 1000,
  );

  let registered = false;
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => controller.abort());
    registered = true;
  }

  try {
    const edgeResponse = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-photo-recognition`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ image_url: publicUrl }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!edgeResponse.ok) {
      throw new Error(`HTTP ${edgeResponse.status}`);
    }

    const json = await edgeResponse.json();
    if (json.error) {
      throw new Error(json.error);
    }

    return json as AiPhotoResult;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  } finally {
    if (registered && abortSignal) {
      abortSignal.removeEventListener('abort', () => controller.abort());
    }
  }
}

/**
 * 模拟拍照识别返回（开发阶段 / Edge 未部署时使用）
 */
export async function recognizePhotoMock(
  _imageUri: string,
): Promise<AiPhotoResult> {
  await new Promise((r) => setTimeout(r, 2000));

  return {
    image_desc: '古建筑，木结构屋顶，斗拱结构明显，周围有石狮雕像',
    disclaimer: 'AI 识别结果仅供参考，实际信息以官方为准。',
    generated_at: new Date().toISOString(),
    candidates: [
      {
        poi_id: 'h001',
        poi_name: '南禅寺大殿',
        poi_type: 'heritage',
        confidence: 0.94,
        match_reason: '建筑形制与唐代木构特征高度吻合',
        province: '山西省',
        city: '忻州市',
      },
      {
        poi_id: 'h002',
        poi_name: '佛光寺东大殿',
        poi_type: 'heritage',
        confidence: 0.78,
        match_reason: '唐代木构建筑特征，但斗拱样式略有差异',
        province: '山西省',
        city: '忻州市',
      },
      {
        poi_id: 's001',
        poi_name: '五台山风景区',
        poi_type: 'scenic',
        confidence: 0.62,
        match_reason: '地理位置与拍摄地坐标接近',
        province: '山西省',
        city: '忻州市',
      },
    ],
  };
}

export function mapErrorToChinese(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('timeout') ||
      msg.includes('etimedout') ||
      msg.includes('aborted')
    ) {
      return TIMEOUT_MESSAGE;
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return '网络连接失败，请检查网络后重试。';
    }
  }
  return '拍照识别失败，请稍后重试。';
}
