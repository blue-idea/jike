/**
 * hooks/usePhotoRecognition.ts
 *
 * AI 拍照识别状态管理 Hook
 * EARS-1: 拍照确认 → 上传 → Edge 多模态识别 → 候选置信度 → 跳转详情
 * EARS-2: 超时 T 秒中文提示 + 重试
 */
import { useCallback, useState } from 'react';
import {
  recognizePhoto,
  recognizePhotoMock,
  type AiPhotoResult,
  type PhotoRecognitionState,
} from '@/lib/ai/aiPhotoQueries';

export type { AiPhotoResult };

export interface UsePhotoRecognitionReturn extends PhotoRecognitionState {
  /** 发起拍照识别 */
  recognize: (imageUri: string) => Promise<void>;
  /** 重试上次识别 */
  retry: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
  /** 上一次识别的图片 URI */
  lastImageUri: string | null;
}

export function usePhotoRecognition(): UsePhotoRecognitionReturn {
  const [state, setState] = useState<PhotoRecognitionState>({
    status: 'idle',
    result: null,
    errorMessage: null,
  });
  const [lastImageUri, setLastImageUri] = useState<string | null>(null);

  const recognize = useCallback(async (imageUri: string) => {
    setState({ status: 'uploading', result: null, errorMessage: null });
    setLastImageUri(imageUri);

    try {
      // 优先真实 Edge，失败后降级 Mock（开发阶段）
      let result: AiPhotoResult;
      try {
        setState((s) => ({ ...s, status: 'recognizing' }));
        result = await recognizePhoto(imageUri);
      } catch {
        setState((s) => ({ ...s, status: 'recognizing' }));
        result = await recognizePhotoMock(imageUri);
      }
      setState({ status: 'success', result, errorMessage: null });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '拍照识别失败，请重试。';
      setState({ status: 'error', result: null, errorMessage: msg });
    }
  }, []);

  const retry = useCallback(async () => {
    if (!lastImageUri) return;
    await recognize(lastImageUri);
  }, [lastImageUri, recognize]);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, errorMessage: null });
    setLastImageUri(null);
  }, []);

  return {
    ...state,
    recognize,
    retry,
    reset,
    lastImageUri,
  };
}
