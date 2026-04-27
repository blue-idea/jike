/**
 * hooks/useTts.ts
 *
 * TTS 语音播报 Hook（EARS-1：支持播放/暂停基础控制）
 * 通过 Supabase Edge Functions /ai-tts 代理语音服务（密钥不落客户端）
 */
import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';

export type TtsState = 'idle' | 'loading' | 'playing' | 'paused';

export interface UseTtsReturn {
  state: TtsState;
  isPlaying: boolean;
  isLoading: boolean;
  /** 开始播报指定文本 */
  speak: (text: string) => Promise<void>;
  /** 暂停播报 */
  pause: () => Promise<void>;
  /** 恢复播报 */
  resume: () => Promise<void>;
  /** 停止播报 */
  stop: () => Promise<void>;
}

const DEFAULT_VOICE_NAME = 'zh-CN-XiaoxiaoNeural';

function bytesToBase64(bytes: Uint8Array): string {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const length = bytes.length;
  let i = 0;

  for (; i + 2 < length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += table[(n >> 18) & 63];
    result += table[(n >> 12) & 63];
    result += table[(n >> 6) & 63];
    result += table[n & 63];
  }

  if (i < length) {
    const n = (bytes[i] << 16) | ((i + 1 < length ? bytes[i + 1] : 0) << 8);
    result += table[(n >> 18) & 63];
    result += table[(n >> 12) & 63];
    result += i + 1 < length ? table[(n >> 6) & 63] : '=';
    result += '=';
  }

  return result;
}

export function useTts(): UseTtsReturn {
  const [state, setState] = useState<TtsState>('idle');
  const soundRef = useRef<Audio.Sound | null>(null);

  const cleanupSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // ignore
      }
      soundRef.current = null;
    }
  }, []);

  const stop = useCallback(async () => {
    await cleanupSound();
    setState('idle');
  }, [cleanupSound]);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.pauseAsync();
    setState('paused');
  }, []);

  const resume = useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.playAsync();
    setState('playing');
  }, []);

  const speak = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content) {
      throw new Error('播报内容为空');
    }

    await stop();
    setState('loading');

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      setState('idle');
      throw new Error('请先登录后再使用语音播报');
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      setState('idle');
      throw new Error('未配置 Supabase 地址');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/ai-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        text: content,
        voice_name: DEFAULT_VOICE_NAME,
      }),
    });

    if (!response.ok) {
      let msg = '语音播报失败，请稍后重试。';
      try {
        const json = await response.json();
        msg =
          json?.error?.message_zh ||
          json?.error?.message ||
          msg;
      } catch {
        // ignore parse error
      }
      setState('idle');
      throw new Error(msg);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const bytes = new Uint8Array(await response.arrayBuffer());
    const base64Audio = bytesToBase64(bytes);
    const dataUri = `data:${contentType};base64,${base64Audio}`;

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const sound = new Audio.Sound();
    soundRef.current = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        setState('idle');
        return;
      }
      if (status.didJustFinish) {
        void stop();
        return;
      }
      setState(status.isPlaying ? 'playing' : 'paused');
    });

    await sound.loadAsync({ uri: dataUri }, { shouldPlay: true });
    setState('playing');
  }, [stop]);

  return {
    state,
    isPlaying: state === 'playing',
    isLoading: state === 'loading',
    speak,
    pause,
    resume,
    stop,
  };
}
