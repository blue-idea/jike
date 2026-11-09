/**
 * hooks/useTts.ts
 *
 * TTS 语音播报 Hook（EARS-1：支持播放/暂停基础控制）
 * 基于 Expo SDK 58 官方推荐的 expo-audio 模块进行音频管理
 * 通过 Supabase Edge Functions /ai-tts 代理语音服务（密钥不落客户端）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
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

/**
 * 将二进制 Uint8Array 音频数据高效转换为 Base64 字符串
 */
export function bytesToBase64(bytes: Uint8Array): string {
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
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubRef = useRef<{ remove: () => void } | null>(null);

  /**
   * 安全清理播放器监听器与原生实例
   */
  const cleanupPlayer = useCallback(() => {
    if (statusSubRef.current) {
      try {
        statusSubRef.current.remove();
      } catch {
        // 忽略监听注销异常
      }
      statusSubRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {
        // 忽略播放器原生释放异常
      }
      playerRef.current = null;
    }
  }, []);

  /**
   * 停止播报并释放当前音频实例
   */
  const stop = useCallback(async () => {
    cleanupPlayer();
    setState('idle');
  }, [cleanupPlayer]);

  /**
   * 暂停播报
   */
  const pause = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      playerRef.current.pause();
      setState('paused');
    } catch {
      // 忽略原生暂停异常
    }
  }, []);

  /**
   * 恢复播报
   */
  const resume = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      playerRef.current.play();
      setState('playing');
    } catch {
      // 忽略原生播放异常
    }
  }, []);

  /**
   * 组件卸载时释放音频资源
   */
  useEffect(() => {
    return () => {
      cleanupPlayer();
    };
  }, [cleanupPlayer]);

  /**
   * 请求 TTS 语音并使用 expo-audio 播放
   */
  const speak = useCallback(
    async (text: string) => {
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
          // 忽略解析错误
        }
        setState('idle');
        throw new Error(msg);
      }

      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      const bytes = new Uint8Array(await response.arrayBuffer());
      const base64Audio = bytesToBase64(bytes);
      const dataUri = `data:${contentType};base64,${base64Audio}`;

      try {
        // 设置全局音频会话模式（静音键打开仍可播放，不占后台）
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'duckOthers',
        });

        // 初始化 expo-audio 音频播放器
        const player = createAudioPlayer({ uri: dataUri });
        playerRef.current = player;

        // 监听播放状态更新
        const sub = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          if (!status.isLoaded) {
            setState('idle');
            return;
          }
          if (status.didJustFinish) {
            void stop();
            return;
          }
          setState(status.playing ? 'playing' : 'paused');
        });
        statusSubRef.current = sub;

        player.play();
        setState('playing');
      } catch (err) {
        cleanupPlayer();
        setState('idle');
        throw new Error(
          err instanceof Error
            ? `Audio playback failed: ${err.message}`
            : 'Audio playback failed'
        );
      }
    },
    [cleanupPlayer, stop]
  );

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
