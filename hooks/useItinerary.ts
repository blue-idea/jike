/**
 * hooks/useItinerary.ts
 *
 * AI 行程生成状态管理 Hook（需求9）
 * - 自然语言需求提交
 * - 偏好调整重生
 * - 手动增删点后重算
 * - 超时中文提示 + 重试
 */
import { useCallback, useState } from 'react';
import {
  generateItinerary,
  regenerateItinerary,
  recomputeItineraryResult,
  type AiItineraryResult,
  type ItineraryConstraint,
  type ItineraryStop,
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
  addStop: (dayIndex: number, stop: ItineraryStop) => void;
  /** 手动移除 POI */
  removeStop: (dayIndex: number, poiId: string) => void;
  /** 重置状态 */
  reset: () => void;
  /** 上一次使用的约束（用于重试） */
  lastConstraints: ItineraryConstraint | null;
  /** 是否需要登录 */
  needsLogin: boolean;
}

export function useItinerary(): UseItineraryReturn {
  const [state, setState] = useState<ItineraryState>({
    status: 'idle',
    result: null,
    errorMessage: null,
  });
  const [lastConstraints, setLastConstraints] = useState<ItineraryConstraint | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const generate = useCallback(async (constraints: ItineraryConstraint) => {
    setState({ status: 'generating', result: null, errorMessage: null });
    setLastConstraints(constraints);
    setNeedsLogin(false);
    try {
      const result = await generateItinerary(constraints);
      setState({ status: 'success', result, errorMessage: null });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '行程生成失败，请稍后重试。';
      const loginRequired = msg.includes('请先登录');
      setNeedsLogin(loginRequired);
      setState({
        status: msg.includes('超时') ? 'timeout' : 'error',
        result: null,
        errorMessage: msg,
      });
    }
  }, []);

  const regenerate = useCallback(
    async (newConstraints: Partial<ItineraryConstraint>) => {
      if (!lastConstraints) return;
      setState({ status: 'generating', result: null, errorMessage: null });
      setNeedsLogin(false);
      try {
        const result = await regenerateItinerary(lastConstraints, newConstraints);
        const mergedConstraints = {
          ...lastConstraints,
          ...newConstraints,
          query: newConstraints.query ?? lastConstraints.query,
        };
        setLastConstraints(mergedConstraints);
        setState({ status: 'success', result, errorMessage: null });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : '行程重新生成失败，请稍后重试。';
        const loginRequired = msg.includes('请先登录');
        setNeedsLogin(loginRequired);
        setState({
          status: msg.includes('超时') ? 'timeout' : 'error',
          result: null,
          errorMessage: msg,
        });
      }
    },
    [lastConstraints],
  );

  const retry = useCallback(async () => {
    if (!lastConstraints) return;
    await generate(lastConstraints);
  }, [lastConstraints, generate]);

  const addStop = useCallback(
    (dayIndex: number, stop: ItineraryStop) => {
      setState((prev) => {
        if (!prev.result) return prev;
        const newDays = [...prev.result.days];
        if (dayIndex >= 0 && dayIndex < newDays.length) {
          newDays[dayIndex] = {
            ...newDays[dayIndex],
            stops: [...newDays[dayIndex].stops, stop],
          };
        }
        const recomputed = recomputeItineraryResult({
          ...prev.result,
          days: newDays,
        });
        return {
          ...prev,
          result: recomputed,
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
      const recomputed = recomputeItineraryResult({
        ...prev.result,
        days: newDays,
      });
      return {
        ...prev,
        result: recomputed,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, errorMessage: null });
    setLastConstraints(null);
    setNeedsLogin(false);
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
    needsLogin,
  };
}
