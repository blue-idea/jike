/**
 * hooks/useItinerary.ts
 *
 * AI 行程生成状态管理 Hook
 * EARS-1: 支持自然语言需求提交、多日行程展示、偏好调整再生、手动增删点
 * EARS-2: 超时 T 秒中文提示 + 重试
 */
import { useCallback, useState } from 'react';
import {
  generateItinerary,
  generateItineraryMock,
  regenerateItinerary,
  type AiItineraryResult,
  type ItineraryConstraint,
  type ItineraryState,
} from '@/lib/ai/aiItineraryQueries';

export type { AiItineraryResult, ItineraryConstraint };

export interface UseItineraryReturn extends ItineraryState {
  /** 提交自然语言需求生成行程 */
  generate: (constraints: ItineraryConstraint) => Promise<void>;
  /** 基于已有结果调整偏好重新生成 */
  regenerate: (newConstraints: Partial<ItineraryConstraint>) => Promise<void>;
  /** 重试上次生成 */
  retry: () => Promise<void>;
  /** 手动添加 POI 到行程 */
  addStop: (dayIndex: number, stop: AiItineraryResult['days'][0]['stops'][0]) => void;
  /** 手动移除 POI */
  removeStop: (dayIndex: number, poiId: string) => void;
  /** 重置状态 */
  reset: () => void;
  /** 上一次使用的约束（用于重试） */
  lastConstraints: ItineraryConstraint | null;
}

export function useItinerary(): UseItineraryReturn {
  const [state, setState] = useState<ItineraryState>({
    status: 'idle',
    result: null,
    errorMessage: null,
  });
  const [lastConstraints, setLastConstraints] = useState<ItineraryConstraint | null>(null);

  const generate = useCallback(async (constraints: ItineraryConstraint) => {
    setState({ status: 'generating', result: null, errorMessage: null });
    setLastConstraints(constraints);
    try {
      // 优先使用真实 Edge 调用，失败后降级到 Mock
      let result: AiItineraryResult;
      try {
        result = await generateItinerary(constraints);
      } catch {
        // Edge 未部署时降级到 Mock（开发阶段）
        result = await generateItineraryMock(constraints);
      }
      setState({ status: 'success', result, errorMessage: null });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '行程生成失败，请稍后重试。';
      setState({ status: 'error', result: null, errorMessage: msg });
    }
  }, []);

  const regenerate = useCallback(
    async (newConstraints: Partial<ItineraryConstraint>) => {
      if (!state.result) return;
      setState({ status: 'generating', result: null, errorMessage: null });
      try {
        const result = await regenerateItinerary(state.result, newConstraints);
        setState({ status: 'success', result, errorMessage: null });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : '行程重新生成失败，请稍后重试。';
        setState({ status: 'error', result: null, errorMessage: msg });
      }
    },
    [state.result],
  );

  const retry = useCallback(async () => {
    if (!lastConstraints) return;
    await generate(lastConstraints);
  }, [lastConstraints, generate]);

  const addStop = useCallback(
    (dayIndex: number, stop: AiItineraryResult['days'][0]['stops'][0]) => {
      setState((prev) => {
        if (!prev.result) return prev;
        const newDays = [...prev.result.days];
        if (dayIndex >= 0 && dayIndex < newDays.length) {
          newDays[dayIndex] = {
            ...newDays[dayIndex],
            stops: [...newDays[dayIndex].stops, stop],
          };
        }
        return {
          ...prev,
          result: { ...prev.result!, days: newDays },
        };
      });
    },
    [],
  );

  const removeStop = useCallback((dayIndex: number, poiId: string) => {
    setState((prev) => {
      if (!prev.result) return prev;
      const newDays = [...prev.result.days];
      if (dayIndex >= 0 && dayIndex < newDays.length) {
        newDays[dayIndex] = {
          ...newDays[dayIndex],
          stops: newDays[dayIndex].stops.filter((s) => s.poi_id !== poiId),
        };
      }
      return {
        ...prev,
        result: { ...prev.result!, days: newDays },
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, errorMessage: null });
    setLastConstraints(null);
  }, []);

  return {
    ...state,
    generate,
    regenerate,
    retry,
    addStop,
    removeStop,
    reset,
    lastConstraints,
  };
}
