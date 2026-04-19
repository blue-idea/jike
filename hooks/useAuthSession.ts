/**
 * hooks/useAuthSession.ts
 *
 * 会话刷新与状态同步 Hook
 * EARS-19: 会话失效与 token 刷新边界场景处理
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟刷新一次

/**
 * 启动定期 token 刷新
 * 在 App 启动时调用一次即可
 */
export function useTokenRefresh() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const refreshSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return;

      // 检查是否即将过期（比如 5 分钟内）
      const expiresAt = data.session.expires_at;
      if (!expiresAt) return;

      const now = Math.floor(Date.now() / 1000);
      const fiveMinutes = 5 * 60;
      if (expiresAt - now < fiveMinutes) {
        // 尝试刷新
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[Auth] Session refresh failed:', refreshError.message);
        }
      }
    };

    // 立即执行一次
    void refreshSession();

    // 每 30 分钟检查一次
    intervalRef.current = setInterval(() => {
      void refreshSession();
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
