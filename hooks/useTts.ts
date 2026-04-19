/**
 * hooks/useTts.ts
 *
 * TTS 语音播报 Hook（EARS-1：支持播放/暂停基础控制）
 * 使用 expo-speech 提供语音播报
 */
import { useCallback, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

export type TtsState = 'idle' | 'playing';

export interface UseTtsReturn {
  state: TtsState;
  isPlaying: boolean;
  /** 开始播报指定文本 */
  speak: (text: string) => Promise<void>;
  /** 停止播报 */
  stop: () => void;
}

export function useTts(): UseTtsReturn {
  const [state, setState] = useState<TtsState>('idle');
  const currentTextRef = useRef<string>('');
  const isSpeakingRef = useRef(false);

  const stop = useCallback(() => {
    Speech.stop();
    isSpeakingRef.current = false;
    setState('idle');
  }, []);

  const speak = useCallback(async (text: string) => {
    // 先停止当前播报
    await stop();
    currentTextRef.current = text;
    isSpeakingRef.current = true;
    setState('playing');

    Speech.speak(text, {
      language: 'zh-CN',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => {
        isSpeakingRef.current = false;
        setState('idle');
      },
      onStopped: () => {
        isSpeakingRef.current = false;
        setState('idle');
      },
      onError: () => {
        isSpeakingRef.current = false;
        setState('idle');
      },
    });
  }, [stop]);

  return {
    state,
    isPlaying: state === 'playing',
    speak,
    stop,
  };
}
